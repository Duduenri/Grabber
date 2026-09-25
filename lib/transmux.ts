import muxjs from 'mux.js';

export function tsToMp4(segments: ArrayBuffer[]): Uint8Array[] {
  const transmuxer = new muxjs.mp4.Transmuxer();
  const out: Uint8Array[] = [];
  transmuxer.on('data', (segment) => {
    if (out.length === 0) out.push(new Uint8Array(segment.initSegment));
    out.push(new Uint8Array(segment.data));
  });
  for (const segment of segments) {
    transmuxer.push(new Uint8Array(segment));
    transmuxer.flush();
  }
  if (out.length === 0) throw new Error('Falha ao converter para MP4 (stream não reconhecido)');
  return out;
}
