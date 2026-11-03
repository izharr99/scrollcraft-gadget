import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/** Injects <head> meta from src/content.json at build time so crawlers see the real copy. */
function contentMeta(): Plugin {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return {
    name: 'content-meta',
    transformIndexHtml(html) {
      const { meta } = JSON.parse(readFileSync(new URL('./src/content.json', import.meta.url), 'utf8'));
      return html
        .replaceAll('%TITLE%', esc(meta.title))
        .replaceAll('%DESCRIPTION%', esc(meta.description))
        .replaceAll('%THEME%', esc(meta.themeColor))
        .replaceAll('%LANG%', esc(meta.lang));
    },
  };
}

export default defineConfig({
  plugins: [contentMeta()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
  },
});
