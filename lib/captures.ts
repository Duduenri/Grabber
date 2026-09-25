export type Capture = {
  url: string;
  kind: 'hls' | 'mp4';
  initiator?: string;
  at: number;
};

export const tabKey = (tabId: number) => `tab:${tabId}`;

export async function getCaptures(tabId: number): Promise<Capture[]> {
  const key = tabKey(tabId);
  const data = await browser.storage.session.get(key);
  return (data[key] as Capture[] | undefined) ?? [];
}
