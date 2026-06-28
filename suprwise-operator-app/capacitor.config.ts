import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.suprwise.operator',
  appName: 'Suprwise Operator',
  webDir: 'dist',
  // Route fetch/XHR through the native HTTP layer. This bypasses browser CORS
  // and mixed-content blocking (the WebView is served from https://localhost,
  // while the dev backend is plain http://10.0.2.2:8000).
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
