import { type MediaPlaylist, type Segment, type Variant, parsePlaylist, sequenceIv } from '@/lib/hls';
import { tsToMp4 } from '@/lib/transmux';

const CONCURRENCY = 6;
const RETRIES = 3;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const nameInput = $<HTMLInputElement>('#name');
const qualityRow = $<HTMLLabelElement>('#quality-row');
const qualitySelect = $<HTMLSelectElement>('#quality');
const formatSelect = $<HTMLSelectElement>('#format');
const startButton = $<HTMLButtonElement>('#start');
const progress = $<HTMLProgressElement>('#progress');
const logBox = $<HTMLPreElement>('#log');

const params = new URLSearchParams(location.search);
const src = params.get('src')!;
const initiator = params.get('initiator');
nameInput.value = sanitize(params.get('title') ?? 'video');

try {
  formatSelect.value = localStorage.getItem('format') ?? 'mp4';
} catch {}
formatSelect.onchange = () => {
  try {
    localStorage.setItem('format', formatSelect.value);
  } catch {}
};

const log = (msg: string) => (logBox.textContent += `${msg}\n`);

function sanitize(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'video';
}

async function spoofHeaders() {
  if (!initiator) return;
  const tab = await browser.tabs.getCurrent();
  if (tab?.id == null) return;
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tab.id],
    addRules: [
      {
        id: tab.id,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'referer', operation: 'set', value: `${initiator}/` },
            { header: 'origin', operation: 'set', value: initiator },
          ],
        },
        condition: { tabIds: [tab.id], resourceTypes: ['xmlhttprequest'] },
      },
    ],
  });
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) return res;
      if (res.status === 403 || res.status === 401) {
        throw new Error(`HTTP ${res.status}: token expirou ou acesso negado. Recarregue a página do vídeo e tente de novo.`);
      }
      lastError = new Error(`HTTP ${res.status} em ${url}`);
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.message.startsWith('HTTP 40')) throw err;
    }
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  throw lastError;
}

async function loadMedia(url: string): Promise<MediaPlaylist> {
  const res = await fetchWithRetry(url);
  const playlist = parsePlaylist(await res.text(), res.url);
  if (playlist.kind !== 'media') throw new Error('Esperava media playlist, veio master');
  return playlist;
}

type Track = { blob: Blob; ext: string };

async function downloadTrack(media: MediaPlaylist, label: string, kind: 'video' | 'audio'): Promise<Track> {
  const keys = new Map<string, Promise<CryptoKey>>();
  const getKey = (uri: string) => {
    if (!keys.has(uri)) {
      keys.set(
        uri,
        fetchWithRetry(uri)
          .then((r) => r.arrayBuffer())
          .then((raw) => crypto.subtle.importKey('raw', raw, 'AES-CBC', false, ['decrypt'])),
      );
    }
    return keys.get(uri)!;
  };

  const fetchSegment = async (segment: Segment) => {
    const data = await (await fetchWithRetry(segment.uri)).arrayBuffer();
    if (!segment.key) return data;
    const iv = segment.key.iv ?? sequenceIv(segment.sequence);
    return crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv as BufferSource }, await getKey(segment.key.uri), data);
  };

  const total = media.segments.length;
  const parts: ArrayBuffer[] = new Array(total);
  let next = 0;
  let done = 0;
  progress.hidden = false;
  progress.max = total;
  progress.value = 0;
  log(`${label}: ${total} segmentos (${Math.round(media.duration / 60)} min)${media.segments[0]?.key ? ', AES-128' : ''}`);

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < total) {
        const i = next++;
        parts[i] = await fetchSegment(media.segments[i]!);
        progress.value = ++done;
        startButton.textContent = `${label}: ${done}/${total}`;
      }
    }),
  );

  if (media.initUri) {
    const init = await (await fetchWithRetry(media.initUri)).arrayBuffer();
    return { blob: new Blob([init, ...parts], { type: 'video/mp4' }), ext: kind === 'video' ? 'mp4' : 'm4a' };
  }
  if (formatSelect.value === 'mp4') {
    startButton.textContent = `${label}: convertendo para MP4…`;
    await new Promise((r) => setTimeout(r));
    const mp4 = tsToMp4(parts);
    return { blob: new Blob(mp4 as BlobPart[], { type: 'video/mp4' }), ext: kind === 'video' ? 'mp4' : 'm4a' };
  }
  return { blob: new Blob(parts, { type: 'video/mp2t' }), ext: kind === 'video' ? 'ts' : 'aac.ts' };
}

async function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  await browser.downloads.download({ url, filename, saveAs: false });
  log(`Salvo: ${filename} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
}

async function run(videoUrl: string, audioUrl?: string) {
  startButton.disabled = true;
  const name = sanitize(nameInput.value);

  const video = await downloadTrack(await loadMedia(videoUrl), 'Vídeo', 'video');
  const ext = video.ext;
  await save(video.blob, `${name}.${ext}`);

  if (audioUrl) {
    const audio = await downloadTrack(await loadMedia(audioUrl), 'Áudio', 'audio');
    await save(audio.blob, `${name}.${audio.ext}`);
    log(`\nÁudio veio separado. Juntar:\nffmpeg -i "${name}.${ext}" -i "${name}.${audio.ext}" -c copy "${name}.final.mp4"`);
  } else if (ext === 'ts') {
    log(`\nConverter pra MP4 (opcional):\nffmpeg -i "${name}.ts" -c copy "${name}.mp4"`);
  }

  startButton.textContent = 'Concluído ✓';
  showPlayer(video);
}

function showPlayer(track: Track) {
  if (track.ext !== 'ts') {
    const preview = $<HTMLVideoElement>('#preview');
    preview.src = URL.createObjectURL(track.blob);
    preview.hidden = false;
  }
  const openPlayer = $<HTMLButtonElement>('#open-player');
  openPlayer.hidden = false;
  openPlayer.onclick = () => browser.tabs.create({ url: browser.runtime.getURL('/player.html') });
}

function variantLabel(v: Variant) {
  const res = v.resolution ? v.resolution.split('x')[1] + 'p' : 'desconhecida';
  return `${res} · ${(v.bandwidth / 1_000_000).toFixed(1)} Mbps`;
}

async function init() {
  await spoofHeaders();
  const res = await fetchWithRetry(src);
  const playlist = parsePlaylist(await res.text(), res.url);

  let pick: () => { video: string; audio?: string };

  if (playlist.kind === 'master') {
    playlist.variants.forEach((v, i) => qualitySelect.add(new Option(variantLabel(v), String(i))));
    qualityRow.hidden = false;
    pick = () => {
      const variant = playlist.variants[Number(qualitySelect.value)]!;
      const group = playlist.audio.filter((a) => a.groupId === variant.audioGroup);
      const audio = group.find((a) => a.isDefault) ?? group[0];
      return { video: variant.uri, audio: audio?.uri };
    };
    log(`Master playlist: ${playlist.variants.length} qualidades`);
  } else {
    pick = () => ({ video: src });
    log('Media playlist (qualidade única)');
  }

  startButton.textContent = 'Baixar';
  startButton.disabled = false;
  startButton.onclick = () => {
    const { video, audio } = pick();
    run(video, audio).catch(fail);
  };
}

function fail(err: unknown) {
  log(`\nERRO: ${err instanceof Error ? err.message : String(err)}`);
  startButton.textContent = 'Falhou';
  startButton.disabled = false;
}

init().catch(fail);
