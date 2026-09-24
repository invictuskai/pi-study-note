// astro.config.mjs
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import { site, base } from './site.config.mjs';
import remarkBasePath from './src/utils/remark-base-path.ts';

export default defineConfig({
  integrations: [
    mdx({
      gfm: true,
    }),
    react(),
  ],
  site,
  base,
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  markdown: {
    remarkPlugins: [[remarkBasePath, { base }]],
    shikiConfig: {
      theme: 'one-dark-pro',
      wrap: true,
    },
  },
  experimental: { clientPrerender: true },
});
