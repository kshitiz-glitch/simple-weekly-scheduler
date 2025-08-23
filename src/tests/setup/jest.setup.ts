import { customMatchers } from '../utils/TestMatchers';

// Extend Jest matchers with custom matchers
expect.extend(customMatchers);

// Global test configuration
beforeAll(() => {
  // Set timezone for consistent date testing
  process.env.TZ = 'UTC';
  
  // Suppress console logs during tests unless explicitly needed
  if (!process.env.VERBOSE_TESTS) {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  // Cleanup after all tests
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  jest.clearAllTimers();
});

// Global test utilities
global.testUtils = {
  // Helper to create test dates
  createTestDate: (dateString: string): Date => {
    return new Date(dateString + 'T00:00:00.000Z');
  },
  
  // Helper to wait for async operations
  waitFor: (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // Helper to create mock functions with specific behavior
  createMockWithBehavior: <T extends (...args: any[]) => any>(
    behavior: T
  ): jest.MockedFunction<T> => {
    return jest.fn(behavior) as jest.MockedFunction<T>;
  }
};

// Custom Jest matchers type declarations
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidSchedule(): R;
      toHaveNoCriticalConflicts(): R;
      toHaveGoodDistribution(threshold?: number): R;
      toHaveReasonableUtilization(minRate?: number, maxRate?: number): R;
      toRespectTimeConstraints(startHour?: number, endHour?: number): R;
      toBeSuccessfulExport(): R;
      toHaveNoFacultyConflicts(): R;
      toHaveBalancedWorkload(maxDeviation?: number): R;
      toContainScheduleEntry(expectedEntry: any): R;
      toRespectHolidays(holidays: Date[]): R;
    }
  }
  
  namespace NodeJS {
    interface Global {
      testUtils: {
        createTestDate: (dateString: string) => Date;
        waitFor: (ms: number) => Promise<void>;
        createMockWithBehavior: <T extends (...args: any[]) => any>(
          behavior: T
        ) => jest.MockedFunction<T>;
      };
    }
  }
}

// Performance monitoring for tests
const performanceObserver = {
  measurements: new Map<string, number[]>(),
  
  start: (name: string): void => {
    if (!performanceObserver.measurements.has(name)) {
      performanceObserver.measurements.set(name, []);
    }
    performance.mark(`${name}-start`);
  },
  
  end: (name: string): number => {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name)[0];
    const duration = measure.duration;
    
    performanceObserver.measurements.get(name)?.push(duration);
    
    // Clean up marks and measures
    performance.clearMarks(`${name}-start`);
    performance.clearMarks(`${name}-end`);
    performance.clearMeasures(name);
    
    return duration;
  },
  
  getStats: (name: string): { avg: number; min: number; max: number; count: number } | null => {
    const measurements = performanceObserver.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }
    
    const avg = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    
    return { avg, min, max, count: measurements.length };
  },
  
  reset: (): void => {
    performanceObserver.measurements.clear();
    performance.clearMarks();
    performance.clearMeasures();
  }
};

// Make performance observer available globally
global.performanceObserver = performanceObserver;

// Test data cleanup
afterEach(() => {
  // Reset performance measurements after each test
  performanceObserver.reset();
});

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log the error
});

// Memory leak detection
let initialMemoryUsage: NodeJS.MemoryUsage;

beforeAll(() => {
  if (global.gc) {
    global.gc();
  }
  initialMemoryUsage = process.memoryUsage();
});

afterAll(() => {
  if (global.gc) {
    global.gc();
  }
  
  const finalMemoryUsage = process.memoryUsage();
  const memoryIncrease = finalMemoryUsage.heapUsed - initialMemoryUsage.heapUsed;
  
  // Log memory usage if it increased significantly (more than 50MB)
  if (memoryIncrease > 50 * 1024 * 1024) {
    console.warn(`Memory usage increased by ${Math.round(memoryIncrease / 1024 / 1024)}MB during tests`);
  }
});

// Test environment validation
if (process.env.NODE_ENV !== 'test') {
  console.warn('Tests should be run with NODE_ENV=test');
}

// Timeout configuration for different test types
jest.setTimeout(30000); // Default 30 seconds

// Custom test categories with different timeouts
const originalDescribe = describe;
global.describe = Object.assign(
  (name: string, fn: () => void) => originalDescribe(name, fn),
  {
    unit: (name: string, fn: () => void) => {
      return originalDescribe(`[UNIT] ${name}`, () => {
        jest.setTimeout(10000); // 10 seconds for unit tests
        fn();
      });
    },
    integration: (name: string, fn: () => void) => {
      return originalDescribe(`[INTEGRATION] ${name}`, () => {
        jest.setTimeout(30000); // 30 seconds for integration tests
        fn();
      });
    },
    performance: (name: string, fn: () => void) => {
      return originalDescribe(`[PERFORMANCE] ${name}`, () => {
        jest.setTimeout(60000); // 60 seconds for performance tests
        fn();
      });
    },
    skip: originalDescribe.skip,
    only: originalDescribe.only,
    each: originalDescribe.each
  }
);

// Export setup utilities for use in tests
export const testSetup = {
  performanceObserver,
  
  // Helper to run tests with performance monitoring
  withPerformanceMonitoring: <T>(name: string, fn: () => T): T => {
    performanceObserver.start(name);
    const result = fn();
    const duration = performanceObserver.end(name);
    
    if (duration > 1000) { // Log if test takes more than 1 second
      console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  },
  
  // Helper to create test data with cleanup
  withTestData: <T>(createData: () => T, cleanup?: (data: T) => void): T => {
    const data = createData();
    
    if (cleanup) {
      afterEach(() => cleanup(data));
    }
    
    return data;
  }
};
