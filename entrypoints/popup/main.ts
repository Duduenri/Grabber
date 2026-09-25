import { getCaptures } from '@/lib/captures';

const list = document.querySelector<HTMLUListElement>('#list')!;
const empty = document.querySelector<HTMLParagraphElement>('#empty')!;

const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
const SUBTITLE = /textstream|subtitle|caption|\.vtt/i;
const captures = (tab?.id != null ? await getCaptures(tab.id) : []).filter((c) => !SUBTITLE.test(c.url));

async function pageTitle(): Promise<string> {
  if (tab?.id == null) return 'video';
  try {
    const [result] = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () =>
        document.querySelector('h1')?.textContent?.trim() ||
        document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content ||
        document.title,
    });
    return (result?.result as string | undefined) || tab.title || 'video';
  } catch {
    return tab.title ?? 'video';
  }
}

empty.hidden = captures.length > 0;

for (const capture of [...captures].sort((a, b) => a.at - b.at)) {
  const li = document.createElement('li');
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = capture.kind.toUpperCase();
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = new URL(capture.url).pathname.split('/').pop() ?? capture.url;
  name.title = capture.url;
  const button = document.createElement('button');
  button.textContent = 'Baixar';
  button.onclick = async () => {
    if (capture.kind === 'mp4') {
      await browser.downloads.download({ url: capture.url });
      return;
    }
    const params = new URLSearchParams({ src: capture.url, title: await pageTitle() });
    if (capture.initiator) params.set('initiator', capture.initiator);
    await browser.tabs.create({ url: browser.runtime.getURL(`/downloader.html?${params}`) });
  };
  li.append(tag, name, button);
  list.append(li);
}
