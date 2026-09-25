import { defineConfig } from 'wxt';

export default defineConfig({
  webExt: { disabled: true },
  manifest: {
    name: 'Grabber',
    description: 'Detecta vídeos (HLS/MP4) na página e baixa localmente',
    permissions: ['webRequest', 'storage', 'downloads', 'declarativeNetRequestWithHostAccess'],
    host_permissions: ['<all_urls>'],
  },
});
