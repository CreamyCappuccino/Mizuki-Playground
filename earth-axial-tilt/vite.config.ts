import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { rolldownOptions: { output: { codeSplitting: { groups: [
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
