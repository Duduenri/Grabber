const HOST = 'com.grabber.host';

type HostMessage =
  | { type: 'pong'; ytdlp: string | null; ffmpeg: boolean }
  | { type: 'progress'; percent: string; speed: string; eta: string }
  | { type: 'log'; line: string }
  | { type: 'done'; file: string | null }
  | { type: 'error'; message: string };

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const urlInput = $<HTMLInputElement>('#url');
const presetSelect = $<HTMLSelectElement>('#preset');
const startButton = $<HTMLButtonElement>('#start');
const progress = $<HTMLProgressElement>('#progress');
const logBox = $<HTMLPreElement>('#log');

const url = new URLSearchParams(location.search).get('url') ?? '';
urlInput.value = url;

const log = (msg: string) => (logBox.textContent += `${msg}\n`);

try {
  presetSelect.value = localStorage.getItem('preset') ?? 'mp4-1080';
} catch {}
presetSelect.onchange = () => {
  try {
    localStorage.setItem('preset', presetSelect.value);
  } catch {}
};

function download() {
  startButton.disabled = true;
  presetSelect.disabled = true;
  progress.hidden = false;
  let finished = false;

  const port = browser.runtime.connectNative(HOST);
  port.onMessage.addListener((msg: HostMessage) => {
    if (msg.type === 'progress') {
      progress.value = parseFloat(msg.percent) || 0;
      startButton.textContent = `${msg.percent} · ${msg.speed} · faltam ${msg.eta}`;
    } else if (msg.type === 'log') {
      log(msg.line);
    } else if (msg.type === 'done') {
      finished = true;
      progress.value = 100;
      startButton.textContent = 'Concluído ✓';
      log(`\nSalvo em: ${msg.file ?? '~/Downloads'}`);
      const openPlayer = $<HTMLButtonElement>('#open-player');
      openPlayer.hidden = false;
      openPlayer.onclick = () => browser.tabs.create({ url: browser.runtime.getURL('/player.html') });
    } else if (msg.type === 'error') {
      finished = true;
      startButton.textContent = 'Falhou';
      log(`\nERRO: ${msg.message}`);
    }
  });
  port.onDisconnect.addListener(() => {
    if (finished) return;
    startButton.textContent = 'Falhou';
    log(`\nERRO: conexão com o host caiu. ${browser.runtime.lastError?.message ?? ''}`);
  });
  port.postMessage({ type: 'download', url, preset: presetSelect.value });
  log('Mantenha esta aba aberta até terminar.');
}

async function init() {
  try {
    const pong = (await browser.runtime.sendNativeMessage(HOST, { type: 'ping' })) as HostMessage;
    if (pong.type !== 'pong' || !pong.ytdlp) {
      log('yt-dlp não encontrado. Rode native-host/install.sh e veja o README.');
      startButton.textContent = 'yt-dlp ausente';
      return;
    }
    log(`yt-dlp ${pong.ytdlp}${pong.ffmpeg ? '' : ' · ⚠ ffmpeg ausente, áudio e vídeo não serão juntados'}`);
    startButton.textContent = 'Baixar';
    startButton.disabled = false;
    startButton.onclick = download;
  } catch (err) {
    startButton.textContent = 'Host não instalado';
    log(`Host nativo não encontrado (${err instanceof Error ? err.message : err}).`);
    log('Instale com: ./native-host/install.sh');
    log(`\nOu rode no terminal:\nyt-dlp -S "vcodec:h264,res:1080,acodec:m4a" --merge-output-format mp4 "${url}"`);
  }
}

init();
