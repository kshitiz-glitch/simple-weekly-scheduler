# Timetable Generator Test Suite

This directory contains a comprehensive test suite for the Automated Timetable Generator system. The test suite is designed to ensure reliability, performance, and correctness of all system components.

## Test Structure

```
src/tests/
├── integration/           # End-to-end integration tests
│   └── TimetableGenerator.integration.test.ts
├── unit/                  # Unit tests for individual components
│   └── AllComponents.test.ts
├── performance/           # Performance and scalability tests
│   └── ScheduleGeneration.performance.test.ts
├── utils/                 # Test utilities and helpers
│   ├── TestDataFactory.ts
│   └── TestMatchers.ts
├── setup/                 # Test configuration and setup
│   ├── jest.config.js
│   └── jest.setup.ts
├── run-tests.ts          # Test runner script
└── README.md             # This file
```

## Test Categories

### Unit Tests
- **Purpose**: Test individual components in isolation
- **Location**: `src/tests/unit/`
- **Coverage**: Models, Services, Algorithms, Exporters
- **Timeout**: 10 seconds per test
- **Focus**: Correctness, edge cases, error handling

### Integration Tests
- **Purpose**: Test complete workflows and component interactions
- **Location**: `src/tests/integration/`
- **Coverage**: End-to-end timetable generation process
- **Timeout**: 30 seconds per test
- **Focus**: Data flow, system integration, real-world scenarios

### Performance Tests
- **Purpose**: Validate system performance and scalability
- **Location**: `src/tests/performance/`
- **Coverage**: Large datasets, concurrent processing, memory usage
- **Timeout**: 60 seconds per test
- **Focus**: Speed, memory efficiency, scalability

## Running Tests

### Prerequisites
```bash
npm install
npm install --save-dev jest @types/jest ts-jest jest-html-reporters
```

### Basic Commands

```bash
# Run all tests
npm run test

# Run specific test categories
npm run test unit
npm run test integration
npm run test performance

# Run tests in watch mode (development)
npm run test watch

# Run tests with coverage report
npm run test --coverage

# Run tests in CI mode
npm run test ci

# Run specific test files
npm run test --path="ScheduleGenerator"

# Run tests matching a pattern
npm run test --pattern="should generate schedule"
```

### Advanced Usage

```bash
# Run tests with verbose output
npm run test --verbose

# Stop on first failure
npm run test --bail

# Update snapshots
npm run test --update-snapshots

# Run with specific number of workers
npm run test --max-workers=4

# Generate comprehensive report
npm run test report
```

## Test Utilities

### TestDataFactory
Provides factory methods for creating test data:

```typescript
import { TestDataFactory } from '../utils/TestDataFactory';

// Create simple test batch
const batch = TestDataFactory.createSimpleBatch();

// Create large dataset for performance testing
const batches = TestDataFactory.createLargeDataset(50, 20, 100);

// Create edge case scenarios
const edgeCases = TestDataFactory.createEdgeCaseScenarios();

// Create realistic university scenario
const scenario = TestDataFactory.createUniversityScenario();
```

### Custom Matchers
Extended Jest matchers for timetable-specific assertions:

```typescript
// Schedule validation
expect(schedule).toBeValidSchedule();
expect(schedule).toHaveNoCriticalConflicts();
expect(schedule).toHaveGoodDistribution(0.3);
expect(schedule).toHaveReasonableUtilization(20, 80);

// Time constraint validation
expect(entries).toRespectTimeConstraints(8, 18);
expect(schedule).toRespectHolidays(holidays);

// Export validation
expect(exportResult).toBeSuccessfulExport();

// Faculty conflict validation
expect(schedule).toHaveNoFacultyConflicts();

// Workload balance validation
expect(schedule).toHaveBalancedWorkload(2);
```

### Performance Testing
Utilities for measuring and benchmarking performance:

```typescript
import { PerformanceTestUtils } from '../utils/TestMatchers';

// Measure execution time
const { result, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
  return await generator.generateTimetable(batches, constraints, []);
});

// Run benchmark
const benchmark = await PerformanceTestUtils.runBenchmark(
  'Schedule Generation',
  async () => generator.generateTimetable(batches, constraints, []),
  10 // iterations
);

// Measure memory usage
const memory = PerformanceTestUtils.measureMemoryUsage();
```

## Test Configuration

### Jest Configuration
- **Config File**: `src/tests/setup/jest.config.js`
- **Environment**: Node.js
- **TypeScript**: Supported via ts-jest
- **Coverage**: Enabled by default with thresholds
- **Timeout**: Configurable per test category
- **Reporters**: Console, HTML, LCOV

### Coverage Thresholds
```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 75,
    lines: 80,
    statements: 80
  }
}
```

### Test Setup
- **Setup File**: `src/tests/setup/jest.setup.ts`
- **Custom Matchers**: Automatically loaded
- **Global Utilities**: Available in all tests
- **Performance Monitoring**: Built-in
- **Memory Leak Detection**: Enabled

## Writing Tests

### Unit Test Example
```typescript
describe('ScheduleGenerator', () => {
  let generator: ScheduleGenerator;

  beforeEach(() => {
    generator = new ScheduleGenerator(defaultConfig);
  });

  it('should generate valid schedule for simple batch', async () => {
    const batches = [TestDataFactory.createSimpleBatch()];
    const schedule = await generator.generateTimetable(batches, [], []);
    
    expect(schedule).toBeValidSchedule();
    expect(schedule.entries.length).toBeGreaterThan(0);
  });
});
```

### Integration Test Example
```typescript
describe('End-to-End Workflow', () => {
  it('should complete full timetable generation workflow', async () => {
    // Step 1: Create and validate data
    const batches = TestDataFactory.createSampleBatches();
    const validation = validationService.validateBatches(batches);
    expect(validation.isValid).toBe(true);

    // Step 2: Generate schedule
    const schedule = await generator.generateTimetable(batches, constraints, []);
    expect(schedule).toBeValidSchedule();

    // Step 3: Export and verify
    const exportResult = await exportManager.exportSchedule(schedule, options);
    expect(exportResult).toBeSuccessfulExport();
  });
});
```

### Performance Test Example
```typescript
describe.performance('Scalability Tests', () => {
  it('should scale linearly with batch count', async () => {
    const batchCounts = [5, 10, 20, 30];
    
    for (const batchCount of batchCounts) {
      const batches = TestDataFactory.createLargeDataset(batchCount, 5, 20);
      
      const { timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return await generator.generateTimetable(batches, constraints, []);
      });
      
      expect(timeMs).toBeLessThan(batchCount * 1000);
    }
  });
});
```

## Test Data Management

### Sample Data
The test suite includes various types of sample data:

- **Simple Batches**: Basic scenarios with few subjects
- **Complex Scenarios**: Multiple batches with overlapping faculty
- **Large Datasets**: Performance testing with many batches/subjects
- **Edge Cases**: Boundary conditions and unusual scenarios
- **Realistic Scenarios**: University-like data structures

### Data Cleanup
- Automatic cleanup after each test
- Memory leak detection
- Performance monitoring
- Resource management

## Continuous Integration

### CI Configuration
The test suite is designed to work with CI/CD pipelines:

```bash
# CI mode (optimized for automated testing)
npm run test ci

# Generates reports in CI-friendly formats
# Includes coverage reports
# Fails fast on errors
# Uses appropriate worker count
```

### Coverage Reports
- **HTML Report**: `coverage/lcov-report/index.html`
- **LCOV Format**: `coverage/lcov.info`
- **JSON Summary**: `coverage/coverage-summary.json`
- **Text Summary**: Console output

## Debugging Tests

### Debug Mode
```bash
# Run with verbose output
npm run test --verbose

# Run specific test
npm run test --pattern="specific test name"

# Run single test file
npm run test --path="ScheduleGenerator.test.ts"
```

### Common Issues
1. **Timeout Errors**: Increase timeout for complex tests
2. **Memory Issues**: Check for memory leaks in large datasets
3. **Flaky Tests**: Ensure proper cleanup and isolation
4. **Performance Variance**: Use multiple iterations for benchmarks

## Best Practices

### Test Writing
1. **Isolation**: Each test should be independent
2. **Cleanup**: Properly clean up resources
3. **Assertions**: Use specific, meaningful assertions
4. **Data**: Use factory methods for consistent test data
5. **Performance**: Monitor execution time and memory usage

### Test Organization
1. **Grouping**: Group related tests in describe blocks
2. **Naming**: Use descriptive test names
3. **Setup**: Use beforeEach/afterEach for common setup
4. **Categories**: Separate unit, integration, and performance tests

### Performance Testing
1. **Baselines**: Establish performance baselines
2. **Variance**: Account for system variance in measurements
3. **Scaling**: Test with different data sizes
4. **Resources**: Monitor memory and CPU usage

## Maintenance

### Regular Tasks
- Review and update test data
- Monitor performance benchmarks
- Update coverage thresholds
- Maintain test documentation

### When Adding Features
1. Add unit tests for new components
2. Update integration tests for new workflows
3. Add performance tests for scalability-critical features
4. Update test data factories as needed

## Troubleshooting

### Common Problems

**Tests timing out:**
```bash
# Increase timeout
npm run test --timeout=60000
```

**Memory issues:**
```bash
# Run with garbage collection
node --expose-gc node_modules/.bin/jest
```

**Coverage issues:**
```bash
# Check coverage report
open coverage/lcov-report/index.html
```

**Performance variance:**
```bash
# Run performance tests multiple times
npm run test performance --verbose
```

For more detailed information about specific test components, see the individual test files and their documentation.