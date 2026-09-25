#!/usr/bin/env python3
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import threading

OUTPUT_DIR = os.path.expanduser("~/Downloads")

PRESETS = {
    "mp4-1080": ["-S", "vcodec:h264,res:1080,acodec:m4a", "--merge-output-format", "mp4"],
    "mp4-720": ["-S", "vcodec:h264,res:720,acodec:m4a", "--merge-output-format", "mp4"],
    "best": ["-f", "bv*+ba/b", "--merge-output-format", "mkv"],
    "audio": ["-f", "ba[ext=m4a]/ba", "-x", "--audio-format", "m4a"],
}

PROGRESS = re.compile(r"^GRAB_PROGRESS\s+(\S+)\|(.*)\|(.*)$")
FILE = re.compile(r"^GRAB_FILE (.+)$")

write_lock = threading.Lock()


def send(message):
    data = json.dumps(message).encode()
    with write_lock:
        sys.stdout.buffer.write(struct.pack("<I", len(data)) + data)
        sys.stdout.buffer.flush()


def read():
    header = sys.stdin.buffer.read(4)
    if len(header) < 4:
        return None
    (length,) = struct.unpack("<I", header)
    return json.loads(sys.stdin.buffer.read(length))


def ytdlp_version():
    binary = shutil.which("yt-dlp")
    if not binary:
        return None
    return subprocess.run([binary, "--version"], capture_output=True, text=True).stdout.strip()


def js_runtime_args():
    if shutil.which("deno"):
        return []
    node = shutil.which("node")
    return ["--js-runtimes", f"node:{node}"] if node else []


def download(url, preset):
    if not re.match(r"^https?://", url or ""):
        return send({"type": "error", "message": "URL inválida"})
    if preset not in PRESETS:
        return send({"type": "error", "message": f"Preset desconhecido: {preset}"})
    binary = shutil.which("yt-dlp")
    if not binary:
        return send({"type": "error", "message": "yt-dlp não encontrado no PATH"})

    cmd = [
        binary,
        "--no-playlist",
        "--newline",
        "--progress",
        "--no-colors",
        *js_runtime_args(),
        *PRESETS[preset],
        "-o", os.path.join(OUTPUT_DIR, "%(title)s.%(ext)s"),
        "--progress-template", "download:GRAB_PROGRESS %(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
        "--print", "after_move:GRAB_FILE %(filepath)s",
        "--no-simulate",
        url,
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)

    def watch_disconnect():
        while read() is not None:
            pass
        proc.kill()

    threading.Thread(target=watch_disconnect, daemon=True).start()

    final_file = None
    for raw in proc.stdout:
        line = raw.strip()
        if not line:
            continue
        if m := PROGRESS.match(line):
            percent, speed, eta = (g.strip() for g in m.groups())
            send({"type": "progress", "percent": percent, "speed": speed, "eta": eta})
        elif m := FILE.match(line):
            final_file = m.group(1)
        else:
            send({"type": "log", "line": line})

    code = proc.wait()
    if code == 0:
        send({"type": "done", "file": final_file})
    else:
        send({"type": "error", "message": f"yt-dlp saiu com código {code}"})


def main():
    message = read()
    if message is None:
        return
    if message.get("type") == "ping":
        send({"type": "pong", "ytdlp": ytdlp_version(), "ffmpeg": bool(shutil.which("ffmpeg"))})
    elif message.get("type") == "download":
        download(message.get("url"), message.get("preset"))


if __name__ == "__main__":
    main()
    sys.stdout.flush()
    os._exit(0)
