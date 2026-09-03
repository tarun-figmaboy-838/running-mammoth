import { defineConfig, devices } from '@playwright/test';

/* The game is a fixed 1920x1080 backbuffer letterboxed into a 16:9 stage, so the
   tests run at that size and at a phone landscape size — the two shapes that matter.
   The server is started for the run and torn down after it. */
export default defineConfig({
  testDir: './tests',
  // the game preloads its art set before it will run; a per-test 30s is too tight
  timeout: 120_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8181',
    // Video and trace recording made the page run slower than real time, which was
    // itself causing timeouts, and left 250MB in test-results. A failure screenshot
    // is enough day to day; ask for the rest with --trace on when chasing something.
    trace: process.env.CI ? 'retain-on-failure' : 'off',
    video: 'off',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    { name: 'phone-landscape', use: { ...devices['Desktop Chrome'], viewport: { width: 844, height: 390 } } }
  ],
  webServer: {
    command: 'node tools/serve.mjs 8181',
    url: 'http://127.0.0.1:8181/index.html',
    reuseExistingServer: true,
    timeout: 30_000
  }
});
