module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js', 'react-native-gesture-handler/jestSetup'],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
};
