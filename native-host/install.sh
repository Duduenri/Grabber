#!/usr/bin/env bash
set -euo pipefail

HOST_NAME="com.grabber.host"
EXTENSION_ID="cmjilacbcoijmjemgcjpmbndepbibjje"
FIREFOX_ID="grabber@duduenri"
HOST_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_PATH="$HOST_DIR/run.sh"

# Chrome launches hosts with a minimal PATH, so pin the installing shell's PATH
cat > "$HOST_PATH" <<SH
#!/usr/bin/env bash
export PATH="$HOME/.local/bin:$PATH"
exec python3 "$HOST_DIR/grabber_host.py"
SH
chmod +x "$HOST_PATH" "$HOST_DIR/grabber_host.py"

DIRS=(
  "$HOME/.config/google-chrome/NativeMessagingHosts"
  "$HOME/.config/chromium/NativeMessagingHosts"
  "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
)

for dir in "${DIRS[@]}"; do
  [ -d "$(dirname "$dir")" ] || continue
  mkdir -p "$dir"
  cat > "$dir/$HOST_NAME.json" <<JSON
{
  "name": "$HOST_NAME",
  "description": "Grabber yt-dlp bridge",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXTENSION_ID/"]
}
JSON
  echo "✔ $dir/$HOST_NAME.json"
done

FIREFOX_DIRS=(
  "$HOME/.mozilla/native-messaging-hosts"
  "$HOME/snap/firefox/common/.mozilla/native-messaging-hosts"
)

for dir in "${FIREFOX_DIRS[@]}"; do
  command -v firefox >/dev/null || break
  [ "$dir" = "${FIREFOX_DIRS[0]}" ] || [ -d "$(dirname "$dir")" ] || continue
  mkdir -p "$dir"
  cat > "$dir/$HOST_NAME.json" <<JSON
{
  "name": "$HOST_NAME",
  "description": "Grabber yt-dlp bridge",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_extensions": ["$FIREFOX_ID"]
}
JSON
  echo "✔ $dir/$HOST_NAME.json"
done

command -v yt-dlp >/dev/null || [ -x "$HOME/.local/bin/yt-dlp" ] || echo "⚠ yt-dlp não encontrado. Instale: curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ~/.local/bin/yt-dlp && chmod +x ~/.local/bin/yt-dlp"
command -v ffmpeg >/dev/null || echo "⚠ ffmpeg não encontrado (necessário p/ juntar áudio+vídeo): sudo apt install ffmpeg"
