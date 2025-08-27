/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  timeout: 30 * 1000,
  retries: 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'firefox',
      use: { browserName: 'firefox' }
    }
  ],
  testDir: 'tests'
}
