import { defineConfig } from 'wxt';

// pins the Chrome extension ID so the native host manifest can allow it
const CHROME_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoDuZ8kv9l7IuBNyQeAor1qZTmZ7AQlURdCbp1ZLd/ABxCaK8k6q4anrN5JklKeezmPYd9z1XXhQQkZy4Yx7Q/CzR+MaBCMvSTdDdjk4+KsK1f7Pb3Z24fBkqhfjB9YopXbYiqxnNdzoOqJD1ea42t2zrvexblEZq5vc+2djprXMmdyYywkTOU9pCOa2py+IbE4Wid6h/5wOAKx9syST7Xi7gqE/J4/FhjCgCfKDqnENfhMM+Ybo3paSp1BDw+4O3V/trrC+NkJE8aUqGwiewc4TDtaWnxArEZJMTwzKtd6sYz/yryEGU5faqB6Oekk8ywNP6KfPfg14m9gbSqcXx5wIDAQAB';

const FIREFOX_ID = 'grabber@duduenri';

export default defineConfig({
  webExt: { disabled: true },
  zip: { excludeSources: ['native-host/run.sh'] },
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'Grabber',
    description: 'Detecta vídeos na página e baixa localmente: HLS, MP4 e YouTube via yt-dlp',
    homepage_url: 'https://github.com/Duduenri/Grabber',
    permissions: ['webRequest', 'storage', 'downloads', 'scripting', 'nativeMessaging', 'declarativeNetRequestWithHostAccess'],
    host_permissions: ['<all_urls>'],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: FIREFOX_ID,
              strict_min_version: '140.0',
              data_collection_permissions: { required: ['none'] },
            },
            gecko_android: { strict_min_version: '142.0' },
          },
        }
      : { key: CHROME_KEY }),
  }),
});
