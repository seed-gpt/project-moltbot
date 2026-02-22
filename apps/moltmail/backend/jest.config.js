/** @type {import("jest").Config} */
export default {
  displayName: "moltmail",
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", {
      useESM: true,
      diagnostics: false,
    }],
  },
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  setupFiles: ["../../../packages/shared/jest.teardown.ts"],
};
