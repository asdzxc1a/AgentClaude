/**
 * Jest test setup file
 * Configures global test environment and utilities
 */

import { ObservabilityDatabase } from '../src/database';
import { ObservabilityServer } from '../src/index';

// Global test timeout
jest.setTimeout(15000);

// Global variables for test database and server
(global as any).testDb = null;
(global as any).testServer = null;

// Setup before all tests
beforeAll(async () => {
  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.OBSERVABILITY_SERVER_URL = 'http://localhost:4001';
});

// Cleanup after all tests
afterAll(async () => {
  // Close any open database connections
  if ((global as any).testDb) {
    (global as any).testDb.close();
  }
  
  // Stop any running test servers
  if ((global as any).testServer) {
    (global as any).testServer.stop();
  }
});

// Helper functions for tests
(global as any).createTestDatabase = () => {
  return new ObservabilityDatabase(':memory:');
};

(global as any).createTestServer = (port: number = 4001) => {
  return new ObservabilityServer(port);
};

(global as any).waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
};

// Mock console methods to reduce test noise
const originalLog = console.log;
const originalError = console.error;

beforeEach(() => {
  // Suppress console output in tests unless explicitly needed
  console.log = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.log = originalLog;
  console.error = originalError;
});