module.exports = {
    testEnvironment: 'jsdom',
    transform: {},
    setupFiles: ['<rootDir>/jest.setup.js'],
    testMatch: ['**/src/js/__tests__/**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '/tests-archive/', '/test-archive/'],
};
