import { type Capture, getCaptures, tabKey } from '@/lib/captures';

function classify(url: string): Capture['kind'] | null {
  const path = new URL(url).pathname.toLowerCase();
  if (path.endsWith('.m3u8')) return 'hls';
  if (path.endsWith('.mp4')) return 'mp4';
  return null;
}

const originOf = (url?: string) => (url ? new URL(url).origin : undefined);

const dedupeKey = (url: string) => {
  const u = new URL(url);
  return u.origin + u.pathname;
};

let queue = Promise.resolve();

function record(tabId: number, capture: Capture) {
  queue = queue.then(async () => {
    const list = await getCaptures(tabId);
    const key = dedupeKey(capture.url);
    const existing = list.findIndex((c) => dedupeKey(c.url) === key);
    // keep the freshest URL: signed tokens expire in minutes
    if (existing >= 0) list[existing] = capture;
    else list.push(capture);
    await browser.storage.session.set({ [tabKey(tabId)]: list });
    await browser.action.setBadgeText({ tabId, text: String(list.length) });
  });
}

async function clear(tabId: number) {
  await browser.storage.session.remove(tabKey(tabId));
  await browser.action.setBadgeText({ tabId, text: '' }).catch(() => {});
}

export default defineBackground(() => {
  // Chrome-only API; Firefox already restricts session storage to extension pages
  if ('setAccessLevel' in browser.storage.session) {
    void browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  }
  browser.action.setBadgeBackgroundColor({ color: '#029975' });

  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId < 0) return;
      const kind = classify(details.url);
      if (!kind) return;
      record(details.tabId, {
        url: details.url,
        kind,
        initiator: details.initiator ?? originOf((details as { originUrl?: string }).originUrl),
        at: Date.now(),
      });
    },
    { urls: ['<all_urls>'], types: ['xmlhttprequest', 'media', 'other'] },
  );

  const dropHeaderRule = (tabId: number) =>
    browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] }).catch(() => {});
  const extensionOrigin = browser.runtime.getURL('/');

  browser.tabs.onRemoved.addListener((tabId) => {
    void clear(tabId);
    void dropHeaderRule(tabId);
  });
  browser.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status === 'loading' && info.url) void clear(tabId);
    if (info.url && !info.url.startsWith(extensionOrigin)) void dropHeaderRule(tabId);
  });
});
