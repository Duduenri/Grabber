const SPEEDS = [1, 1.25, 1.5, 1.75, 2];

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const drop = $<HTMLLabelElement>('#drop');
const input = $<HTMLInputElement>('#files');
const video = $<HTMLVideoElement>('#video');
const speeds = $<HTMLDivElement>('#speeds');
const list = $<HTMLOListElement>('#list');

let files: File[] = [];
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

const positionKey = (f: File) => `pos:${f.name}:${f.size}`;

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

function renderList() {
  list.replaceChildren(
    ...files.map((file, i) => {
      const li = document.createElement('li');
      li.className = i === current ? 'playing' : '';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = file.name;
      const meta = document.createElement('span');
      meta.className = 'meta';
      const pos = Number(storageGet(positionKey(file)) ?? 0);
      meta.textContent = pos > 0 ? `parou em ${formatTime(pos)}` : `${(file.size / 1024 / 1024).toFixed(0)} MB`;
      li.append(name, meta);
      li.onclick = () => play(i);
      return li;
    }),
  );
}

function play(index: number) {
  const file = files[index];
  if (!file) return;
  current = index;
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = URL.createObjectURL(file);
  video.hidden = false;
  speeds.hidden = false;
  video.src = currentUrl;
  video.playbackRate = Number(storageGet('speed') ?? 1);
  const pos = Number(storageGet(positionKey(file)) ?? 0);
  video.onloadedmetadata = () => {
    if (pos > 0 && pos < video.duration - 5) video.currentTime = pos;
    void video.play();
  };
  document.title = `${file.name} · Grabber`;
  renderList();
}

function load(newFiles: FileList | null) {
  if (!newFiles?.length) return;
  files = [...newFiles].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  play(0);
}

let lastSave = 0;
video.ontimeupdate = () => {
  const file = files[current];
  if (!file || Date.now() - lastSave < 2000) return;
  lastSave = Date.now();
  storageSet(positionKey(file), String(Math.floor(video.currentTime)));
};

video.onended = () => {
  const file = files[current];
  if (file) storageSet(positionKey(file), '0');
  if (current + 1 < files.length) play(current + 1);
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
