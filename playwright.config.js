/** @type {import('@playwright/test').PlaywrightTestConfig} */
const privateRun = Boolean(process.env.PRIVATE_RUN)

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
      use: Object.assign(
        { browserName: 'firefox' },
        privateRun
          ? { firefoxUserPrefs: { 'dom.indexedDB.enabled': false, 'dom.storage.enabled': false } }
          : {}
      )
    }
  ],
  testDir: 'tests'
}
