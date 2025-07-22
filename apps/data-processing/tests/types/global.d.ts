/**
 * Global test types and augmentations
 */

import { ObservabilityDatabase } from '../../src/database';
import { ObservabilityServer } from '../../src/index';

declare global {
  namespace NodeJS {
    interface Global {
      testDb: ObservabilityDatabase | null;
      testServer: ObservabilityServer | null;
      createTestDatabase: () => ObservabilityDatabase;
      createTestServer: (port?: number) => ObservabilityServer;
      waitForCondition: (
        condition: () => boolean | Promise<boolean>,
        timeout?: number,
        interval?: number
      ) => Promise<void>;
    }
  }

  var testDb: ObservabilityDatabase | null;
  var testServer: ObservabilityServer | null;
  var createTestDatabase: () => ObservabilityDatabase;
  var createTestServer: (port?: number) => ObservabilityServer;
  var waitForCondition: (
    condition: () => boolean | Promise<boolean>,
    timeout?: number,
    interval?: number
  ) => Promise<void>;
}