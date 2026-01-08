// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://thegroomingfiles.com',
  output: 'static',
  build: {
    assets: 'assets'
  }
});
