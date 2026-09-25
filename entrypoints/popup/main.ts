import { getCaptures } from '@/lib/captures';

const list = document.querySelector<HTMLUListElement>('#list')!;
const empty = document.querySelector<HTMLParagraphElement>('#empty')!;

const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
const captures = tab?.id != null ? await getCaptures(tab.id) : [];

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
    const params = new URLSearchParams({ src: capture.url, title: tab?.title ?? 'video' });
    if (capture.initiator) params.set('initiator', capture.initiator);
    await browser.tabs.create({ url: browser.runtime.getURL(`/downloader.html?${params}`) });
  };
  li.append(tag, name, button);
  list.append(li);
}
