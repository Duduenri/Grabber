declare module 'mux.js' {
  type TransmuxedSegment = { initSegment: Uint8Array; data: Uint8Array };
  class Transmuxer {
    on(event: 'data', cb: (segment: TransmuxedSegment) => void): void;
    push(bytes: Uint8Array): void;
    flush(): void;
  }
  const muxjs: { mp4: { Transmuxer: typeof Transmuxer } };
  export default muxjs;
}
