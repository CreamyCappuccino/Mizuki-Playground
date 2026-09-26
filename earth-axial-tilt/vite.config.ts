import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  input: {
    main: resolve(import.meta.dirname, 'index.html'),
    geography: resolve(import.meta.dirname, 'geography-lab.html'),
    feedback: resolve(import.meta.dirname, 'feedback-lab.html'),
  },
  build: { modulePreload: {
    // WebKit can retain a failed modulepreload across reload. Let this optional
    // launcher import normally so its existing reload recovery remains usable.
    // Keep all other dependency preloads (including the primary globe) intact.
    resolveDependencies: (filename, dependencies) => filename.includes('seasonAtlas-') ? [] : dependencies,
  }, rolldownOptions: { output: { codeSplitting: { groups: [
    { name: 'three-core', test: /node_modules\/three\/build\/three\.core\.js/, priority: 20 },
    { name: 'three-renderer', test: /node_modules\/three\//, priority: 10 },
  ] } } } },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
