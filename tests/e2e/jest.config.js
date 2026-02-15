/** @type {import('jest').Config} */
export default {
  displayName: 'e2e',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testTimeout: 30000, // 30 seconds for E2E tests
};
