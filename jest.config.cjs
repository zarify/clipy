// Jest configuration (CJS) — keeps compatibility while project uses ESM modules
module.exports = {
    testEnvironment: 'jsdom',
    // Run this file before each test file to provide global shims (localStorage, window, etc.)
    setupFiles: ['<rootDir>/jest.setup.js'],
    // Do not transform files by default; keep tests fast and simple for this repo
    transform: {},
    // Treat .js files as ESM modules where appropriate
    extensionsToTreatAsEsm: ['.js'],
    testTimeout: 10000
}
module.exports = {
    testEnvironment: 'jsdom',
    transform: {},
    setupFiles: ['<rootDir>/jest.setup.js'],
    testMatch: ['**/src/js/__tests__/**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '/tests-archive/', '/test-archive/'],
};
