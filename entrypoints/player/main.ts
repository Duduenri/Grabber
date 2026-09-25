const SPEEDS = [1, 1.25, 1.5, 1.75, 2];

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const drop = $<HTMLLabelElement>('#drop');
const input = $<HTMLInputElement>('#files');
const video = $<HTMLVideoElement>('#video');
const speeds = $<HTMLDivElement>('#speeds');
const list = $<HTMLOListElement>('#list');

type Item = { name: string; key: string; size?: number; source: Blob | string };

let items: Item[] = [];
let current = -1;
let currentUrl: string | null = null;

const storageGet = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const storageSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

const positionKey = (item: Item) => `pos:${item.key}`;
const fromFile = (file: Blob, name: string): Item => ({ name, key: `${name}:${file.size}`, size: file.size, source: file });
const fileUrl = (path: string) => 'file://' + path.split('/').map(encodeURIComponent).join('/');

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

function renderList() {
  list.replaceChildren(
    ...items.map((item, i) => {
      const li = document.createElement('li');
      li.className = i === current ? 'playing' : '';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = item.name;
      const meta = document.createElement('span');
      meta.className = 'meta';
      const pos = Number(storageGet(positionKey(item)) ?? 0);
      meta.textContent =
        pos > 0 ? `parou em ${formatTime(pos)}` : item.size ? `${(item.size / 1024 / 1024).toFixed(0)} MB` : '';
      li.append(name, meta);
      li.onclick = () => play(i);
      return li;
    }),
  );
}

function play(index: number) {
  const item = items[index];
  if (!item) return;
  current = index;
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = typeof item.source === 'string' ? null : URL.createObjectURL(item.source);
  video.hidden = false;
  speeds.hidden = false;
  video.src = currentUrl ?? item.source as string;
  video.playbackRate = Number(storageGet('speed') ?? 1);
  const pos = Number(storageGet(positionKey(item)) ?? 0);
  video.onloadedmetadata = () => {
    if (pos > 0 && pos < video.duration - 5) video.currentTime = pos;
    video.play().catch(() => {});
  };
  video.onerror = () => {
    if (typeof item.source === 'string') notice('Não consegui abrir o arquivo do disco. Arraste ele aqui.');
  };
  document.title = `${item.name} · Grabber`;
  renderList();
}

function load(newFiles: FileList | null) {
  if (!newFiles?.length) return;
  items = [...newFiles]
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))
    .map((f) => fromFile(f, f.name));
  play(0);
}

let lastSave = 0;
video.ontimeupdate = () => {
  const item = items[current];
  if (!item || Date.now() - lastSave < 2000) return;
  lastSave = Date.now();
  storageSet(positionKey(item), String(Math.floor(video.currentTime)));
};

video.onended = () => {
  const item = items[current];
  if (item) storageSet(positionKey(item), '0');
  if (current + 1 < items.length) play(current + 1);
  else renderList();
};

for (const speed of SPEEDS) {
  const button = document.createElement('button');
  button.textContent = `${speed}x`;
  button.onclick = () => {
    video.playbackRate = speed;
    storageSet('speed', String(speed));
  };
  speeds.append(button);
}
video.onratechange = () => {
  speeds.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', SPEEDS[i] === video.playbackRate));
};

input.onchange = () => load(input.files);
drop.ondragover = (e) => {
  e.preventDefault();
  drop.classList.add('over');
};
drop.ondragleave = () => drop.classList.remove('over');
drop.ondrop = (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  load(e.dataTransfer?.files ?? null);
};

const noticeBox = $<HTMLDivElement>('#notice');
function notice(message: string, action?: { label: string; run: () => void }) {
  noticeBox.hidden = false;
  noticeBox.replaceChildren(message);
  if (action) {
    const button = document.createElement('button');
    button.textContent = action.label;
    button.onclick = action.run;
    noticeBox.append(' ', button);
  }
}

async function openFromParams() {
  const params = new URLSearchParams(location.search);
  const channelId = params.get('channel');
  const path = params.get('path');

  if (channelId) {
    const channel = new BroadcastChannel(channelId);
    channel.onmessage = (e: MessageEvent<{ blob: Blob; name: string }>) => {
      items = [fromFile(e.data.blob, e.data.name)];
      play(0);
      channel.close();
    };
    channel.postMessage('ready');
    return;
  }

  if (path) {
    const name = path.split('/').pop() ?? path;
    if (!(await browser.extension.isAllowedFileSchemeAccess())) {
      notice(`Pra abrir "${name}" direto do disco, ative "Permitir acesso a URLs de arquivo" nos detalhes do Grabber (só uma vez).`, {
        label: 'Abrir configurações',
        run: () => void browser.tabs.create({ url: `chrome://extensions/?id=${browser.runtime.id}` }),
      });
      return;
    }
    items = [{ name, key: path, source: fileUrl(path) }];
    play(0);
  }
}

void openFromParams();
