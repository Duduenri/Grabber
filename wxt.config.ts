import { defineConfig } from 'wxt';

export default defineConfig({
  webExt: { disabled: true },
  manifest: {
    name: 'Grabber',
    description: 'Detecta vídeos (HLS/MP4) na página e baixa localmente',
    // pins the extension ID so the native host manifest can allow it
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoDuZ8kv9l7IuBNyQeAor1qZTmZ7AQlURdCbp1ZLd/ABxCaK8k6q4anrN5JklKeezmPYd9z1XXhQQkZy4Yx7Q/CzR+MaBCMvSTdDdjk4+KsK1f7Pb3Z24fBkqhfjB9YopXbYiqxnNdzoOqJD1ea42t2zrvexblEZq5vc+2djprXMmdyYywkTOU9pCOa2py+IbE4Wid6h/5wOAKx9syST7Xi7gqE/J4/FhjCgCfKDqnENfhMM+Ybo3paSp1BDw+4O3V/trrC+NkJE8aUqGwiewc4TDtaWnxArEZJMTwzKtd6sYz/yryEGU5faqB6Oekk8ywNP6KfPfg14m9gbSqcXx5wIDAQAB',
    permissions: ['webRequest', 'storage', 'downloads', 'scripting', 'nativeMessaging', 'declarativeNetRequestWithHostAccess'],
    host_permissions: ['<all_urls>'],
  },
});
