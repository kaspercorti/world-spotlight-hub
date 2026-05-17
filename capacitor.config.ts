import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maptension.app',
  appName: 'maptension',
  webDir: 'dist',
  server: {
    url: 'https://3600c371-7653-4800-bbf3-44ca5606b62c.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
