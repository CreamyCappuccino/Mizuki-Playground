import { defineConfig } from '@playwright/test';
// Run against an already-started local Vite dev server (or the standalone preview).
// This configuration does not change ports, start services, or alter deployment.
export default defineConfig({testDir:'./qa',testMatch:'geography.browser.spec.ts',workers:1,
  use:{baseURL:process.env.GEOGRAPHY_BASE_URL??'http://127.0.0.1:5173',trace:'retain-on-failure'},
  projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}]});
