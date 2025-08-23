#!/usr/bin/env node

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Test runner script for the timetable generator
 * Provides different test execution modes and reporting
 */

interface TestRunOptions {
  category?: 'unit' | 'integration' | 'performance' | 'all';
  coverage?: boolean;
  watch?: boolean;
  verbose?: boolean;
  bail?: boolean;
  updateSnapshots?: boolean;
  maxWorkers?: number;
  testNamePattern?: string;
  testPathPattern?: string;
}

class TestRunner {
  private readonly jestConfigPath: string;
  private readonly rootDir: string;

  constructor() {
    this.rootDir = path.resolve(__dirname, '../../..');
    this.jestConfigPath = path.join(__dirname, 'setup', 'jest.config.js');
  }

  /**
   * Run tests with specified options
   */
  async runTests(options: TestRunOptions = {}): Promise<void> {
    const {
      category = 'all',
      coverage = true,
      watch = false,
      verbose = false,
      bail = false,
      updateSnapshots = false,
      maxWorkers,
      testNamePattern,
      testPathPattern
    } = options;

    console.log('🧪 Starting Timetable Generator Tests...\n');

    const jestArgs = this.buildJestArgs({
      category,
      coverage,
      watch,
      verbose,
      bail,
      updateSnapshots,
      maxWorkers,
      testNamePattern,
      testPathPattern
    });

    try {
      const command = `npx jest ${jestArgs.join(' ')}`;
      console.log(`Executing: ${command}\n`);

      execSync(command, {
        stdio: 'inherit',
        cwd: this.rootDir,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          TZ: 'UTC'
        }
      });

      console.log('\n✅ Tests completed successfully!');
      
      if (coverage) {
        this.displayCoverageInfo();
      }

    } catch (error) {
      console.error('\n❌ Tests failed!');
      process.exit(1);
    }
  }

  /**
   * Build Jest command line arguments
   */
  private buildJestArgs(options: TestRunOptions): string[] {
    const args: string[] = [];

    // Config file
    args.push(`--config=${this.jestConfigPath}`);

    // Test category
    if (options.category && options.category !== 'all') {
      args.push(`--selectProjects=${options.category}`);
    }

    // Coverage
    if (options.coverage) {
      args.push('--coverage');
    } else {
      args.push('--coverage=false');
    }

    // Watch mode
    if (options.watch) {
      args.push('--watch');
    }

    // Verbose output
    if (options.verbose) {
      args.push('--verbose');
    }

    // Bail on first failure
    if (options.bail) {
      args.push('--bail');
    }

    // Update snapshots
    if (options.updateSnapshots) {
      args.push('--updateSnapshot');
    }

    // Max workers
    if (options.maxWorkers) {
      args.push(`--maxWorkers=${options.maxWorkers}`);
    }

    // Test name pattern
    if (options.testNamePattern) {
      args.push(`--testNamePattern="${options.testNamePattern}"`);
    }

    // Test path pattern
    if (options.testPathPattern) {
      args.push(`--testPathPattern="${options.testPathPattern}"`);
    }

    return args;
  }

  /**
   * Display coverage information
   */
  private displayCoverageInfo(): void {
    const coverageDir = path.join(this.rootDir, 'coverage');
    const htmlReportPath = path.join(coverageDir, 'lcov-report', 'index.html');
    
    if (fs.existsSync(htmlReportPath)) {
      console.log(`\n📊 Coverage report available at: file://${htmlReportPath}`);
    }

    const coverageSummaryPath = path.join(coverageDir, 'coverage-summary.json');
    if (fs.existsSync(coverageSummaryPath)) {
      try {
        const summary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
        const total = summary.total;
        
        console.log('\n📈 Coverage Summary:');
        console.log(`  Lines: ${total.lines.pct}%`);
        console.log(`  Functions: ${total.functions.pct}%`);
        console.log(`  Branches: ${total.branches.pct}%`);
        console.log(`  Statements: ${total.statements.pct}%`);
      } catch (error) {
        console.warn('Could not read coverage summary');
      }
    }
  }

  /**
   * Run specific test suites
   */
  async runUnitTests(): Promise<void> {
    console.log('🔬 Running Unit Tests...');
    await this.runTests({ category: 'unit', coverage: true });
  }

  async runIntegrationTests(): Promise<void> {
    console.log('🔗 Running Integration Tests...');
    await this.runTests({ category: 'integration', coverage: true });
  }

  async runPerformanceTests(): Promise<void> {
    console.log('⚡ Running Performance Tests...');
    await this.runTests({ 
      category: 'performance', 
      coverage: false, // Performance tests don't need coverage
      maxWorkers: 1 // Run performance tests sequentially
    });
  }

  /**
   * Run tests in watch mode for development
   */
  async runWatchMode(): Promise<void> {
    console.log('👀 Running Tests in Watch Mode...');
    await this.runTests({ 
      watch: true, 
      coverage: false, // Disable coverage in watch mode for speed
      verbose: false 
    });
  }

  /**
   * Run tests with minimal output (for CI)
   */
  async runCIMode(): Promise<void> {
    console.log('🤖 Running Tests in CI Mode...');
    await this.runTests({
      coverage: true,
      bail: true,
      verbose: false,
      maxWorkers: 2
    });
  }

  /**
   * Generate test report
   */
  async generateReport(): Promise<void> {
    console.log('📋 Generating Test Report...');
    
    await this.runTests({
      coverage: true,
      verbose: true
    });

    // Additional reporting logic could go here
    console.log('\n📄 Test report generated successfully!');
  }
}

/**
 * CLI interface
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const runner = new TestRunner();

  if (args.length === 0) {
    console.log(`
🧪 Timetable Generator Test Runner

Usage: npm run test [command] [options]

Commands:
  unit          Run unit tests only
  integration   Run integration tests only
  performance   Run performance tests only
  watch         Run tests in watch mode
  ci            Run tests in CI mode
  report        Generate comprehensive test report

Options:
  --coverage    Enable/disable coverage (default: true)
  --verbose     Enable verbose output
  --bail        Stop on first failure
  --pattern     Test name pattern to match
  --path        Test path pattern to match

Examples:
  npm run test unit
  npm run test integration --verbose
  npm run test watch
  npm run test --pattern="ScheduleGenerator"
    `);
    return;
  }

  const command = args[0];
  const options: TestRunOptions = {};

  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--coverage') {
      options.coverage = true;
    } else if (arg === '--no-coverage') {
      options.coverage = false;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--bail') {
      options.bail = true;
    } else if (arg === '--update-snapshots') {
      options.updateSnapshots = true;
    } else if (arg.startsWith('--pattern=')) {
      options.testNamePattern = arg.split('=')[1];
    } else if (arg.startsWith('--path=')) {
      options.testPathPattern = arg.split('=')[1];
    } else if (arg.startsWith('--max-workers=')) {
      options.maxWorkers = parseInt(arg.split('=')[1]);
    }
  }

  try {
    switch (command) {
      case 'unit':
        await runner.runUnitTests();
        break;
      case 'integration':
        await runner.runIntegrationTests();
        break;
      case 'performance':
        await runner.runPerformanceTests();
        break;
      case 'watch':
        await runner.runWatchMode();
        break;
      case 'ci':
        await runner.runCIMode();
        break;
      case 'report':
        await runner.generateReport();
        break;
      case 'all':
      default:
        await runner.runTests(options);
        break;
    }
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { TestRunner, TestRunOptions };
