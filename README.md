# Grabber

Chrome extension (Manifest V3) that detects videos on the current page and downloads them locally.

- Captures `.m3u8` (HLS) and `.mp4` requests per tab, including inside iframes
- Parses HLS master/media playlists, lets you pick the quality
- Downloads segments in parallel and decrypts AES-128 (no DRM support)
- Saves `.ts` (or `.mp4` for fMP4); separate audio tracks are saved alongside

## Setup

```bash
npm install
npm run build
```

Open `chrome://extensions`, enable Developer mode, click **Load unpacked** and select `.output/chrome-mv3`.

## Usage

1. Open the page with the video and reload it (the playlist is only requested on load)
2. Click the Grabber icon and hit **Baixar** on the HLS entry
3. Choose quality and download

Convert `.ts` to `.mp4`:

```bash
ffmpeg -i video.ts -c copy video.mp4
```

## Scripts

- `npm run build` — production build
- `npm run compile` — type check
