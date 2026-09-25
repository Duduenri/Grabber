export type Variant = {
  uri: string;
  bandwidth: number;
  resolution?: string;
  audioGroup?: string;
};

export type AudioRendition = {
  uri: string;
  groupId: string;
  name?: string;
  isDefault: boolean;
};

export type Key = { uri: string; iv?: Uint8Array };

export type Segment = { uri: string; sequence: number; key?: Key };

export type MasterPlaylist = { kind: 'master'; variants: Variant[]; audio: AudioRendition[] };

export type MediaPlaylist = { kind: 'media'; segments: Segment[]; initUri?: string; duration: number };

export type Playlist = MasterPlaylist | MediaPlaylist;

function parseAttributes(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of input.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) {
    attrs[m[1]!] = m[2]!.replace(/^"|"$/g, '');
  }
  return attrs;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '').padStart(32, '0');
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function sequenceIv(sequence: number): Uint8Array {
  const iv = new Uint8Array(16);
  new DataView(iv.buffer).setUint32(12, sequence);
  return iv;
}

export function parsePlaylist(text: string, baseUrl: string): Playlist {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let i = 0;
  const nextLine = () => lines[++i] ?? '';
  if (lines[0] !== '#EXTM3U') throw new Error('Resposta não é uma playlist HLS');

  const resolve = (uri: string) => new URL(uri, baseUrl).href;

  if (lines.some((l) => l.startsWith('#EXT-X-STREAM-INF'))) {
    const variants: Variant[] = [];
    const audio: AudioRendition[] = [];
    for (i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const a = parseAttributes(line.slice(18));
        variants.push({
          uri: resolve(nextLine()),
          bandwidth: Number(a.BANDWIDTH ?? 0),
          resolution: a.RESOLUTION,
          audioGroup: a.AUDIO,
        });
      } else if (line.startsWith('#EXT-X-MEDIA:')) {
        const a = parseAttributes(line.slice(13));
        if (a.TYPE === 'AUDIO' && a.URI) {
          audio.push({ uri: resolve(a.URI), groupId: a['GROUP-ID'] ?? '', name: a.NAME, isDefault: a.DEFAULT === 'YES' });
        }
      }
    }
    variants.sort((x, y) => y.bandwidth - x.bandwidth);
    return { kind: 'master', variants, audio };
  }

  const segments: Segment[] = [];
  let sequence = 0;
  let key: Key | undefined;
  let initUri: string | undefined;
  let duration = 0;

  for (i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      sequence = Number(line.slice(22));
    } else if (line.startsWith('#EXT-X-KEY:')) {
      const a = parseAttributes(line.slice(11));
      if (a.METHOD === 'NONE') key = undefined;
      else if (a.METHOD === 'AES-128' && a.URI) key = { uri: resolve(a.URI), iv: a.IV ? hexToBytes(a.IV) : undefined };
      else throw new Error(`Criptografia ${a.METHOD} não suportada (provável DRM)`);
    } else if (line.startsWith('#EXT-X-MAP:')) {
      const uri = parseAttributes(line.slice(11)).URI;
      if (uri) initUri = resolve(uri);
    } else if (line.startsWith('#EXT-X-BYTERANGE')) {
      throw new Error('Playlists com BYTERANGE ainda não suportadas');
    } else if (line.startsWith('#EXTINF:')) {
      duration += parseFloat(line.slice(8));
      segments.push({ uri: resolve(nextLine()), sequence: sequence++, key });
    }
  }

  return { kind: 'media', segments, initUri, duration };
}
