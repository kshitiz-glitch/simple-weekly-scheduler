#!/usr/bin/env node

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Integration test runner with comprehensive reporting and environment setup
 */

interface TestSuite {
  name: string;
  file: string;
  description: string;
  estimatedDuration: number; // in seconds
  memoryRequirement: number; // in MB
  dependencies: string[];
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  memoryUsed: number;
  errors: string[];
  warnings: string[];
}

class IntegrationTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'End-to-End Workflow',
      file: 'EndToEndWorkflow.test.ts',
      description: 'Complete timetable generation workflow tests',
      estimatedDuration: 120,
      memoryRequirement: 200,
      dependencies: ['models', 'algorithms', 'services', 'exporters']
    },
    {
      name: 'Performance Integration',
      file: 'PerformanceIntegration.test.ts',
      description: 'Performance and scalability integration tests',
      estimatedDuration: 300,
      memoryRequirement: 500,
      dependencies: ['algorithms', 'exporters', 'utils']
    },
    {
      name: 'System Integration',
      file: 'SystemIntegration.test.ts',
      description: 'Complete system integration and component interaction tests',
      estimatedDuration: 180,
      memoryRequirement: 300,
      dependencies: ['all']
    }
  ];

  private results: TestResult[] = [];
  private startTime: Date;
  private totalEstimatedDuration: number;

  constructor() {
    this.startTime = new Date();
    this.totalEstimatedDuration = this.testSuites.reduce((sum, suite) => sum + suite.estimatedDuration, 0);
  }

  /**
   * Run all integration tests with comprehensive reporting
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 TIMETABLE GENERATOR - INTEGRATION TEST RUNNER');
    console.log('='.repeat(60));
    console.log(`📅 Started: ${this.startTime.toLocaleString()}`);
    console.log(`⏱️  Estimated duration: ${Math.ceil(this.totalEstimatedDuration / 60)} minutes`);
    console.log(`📊 Test suites: ${this.testSuites.length}`);
    console.log('');

    // Pre-flight checks
    await this.performPreflightChecks();

    // Run each test suite
    for (let i = 0; i < this.testSuites.length; i++) {
      const suite = this.testSuites[i];
      console.log(`🚀 Running Suite ${i + 1}/${this.testSuites.length}: ${suite.name}`);
      console.log(`📝 ${suite.description}`);
      console.log(`⏱️  Estimated: ${suite.estimatedDuration}s, Memory: ${suite.memoryRequirement}MB`);
      console.log('-'.repeat(50));

      const result = await this.runTestSuite(suite);
      this.results.push(result);

      if (result.passed) {
        console.log(`✅ ${suite.name} PASSED in ${result.duration}s`);
      } else {
        console.log(`❌ ${suite.name} FAILED in ${result.duration}s`);
        if (result.errors.length > 0) {
          console.log(`   Errors: ${result.errors.length}`);
          result.errors.slice(0, 3).forEach(error => {
            console.log(`   - ${error}`);
          });
        }
      }

      if (result.warnings.length > 0) {
        console.log(`⚠️  Warnings: ${result.warnings.length}`);
      }

      console.log(`💾 Memory used: ${result.memoryUsed}MB`);
      console.log('');

      // Brief pause between suites
      await this.sleep(2000);
    }

    // Generate final report
    await this.generateFinalReport();
  }

  /**
   * Run a specific test suite
   */
  async runTestSuite(suite: TestSuite): Promise<TestResult> {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage().heapUsed;

    const result: TestResult = {
      suite: suite.name,
      passed: false,
      duration: 0,
      memoryUsed: 0,
      errors: [],
      warnings: []
    };

    try {
      // Set up environment for the test
      process.env.NODE_ENV = 'test';
      process.env.INTEGRATION_TEST = 'true';
      process.env.TEST_TIMEOUT = (suite.estimatedDuration * 2000).toString(); // 2x estimated time

      // Run the test suite
      const testCommand = `npx jest ${suite.file} --testTimeout=${suite.estimatedDuration * 2000} --verbose --detectOpenHandles --forceExit`;
      
      console.log(`   Executing: ${testCommand}`);
      
      const output = execSync(testCommand, {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: suite.estimatedDuration * 2000
      });

      // Parse output for warnings and additional info
      const lines = output.split('\n');
      result.warnings = lines.filter(line => 
        line.includes('warn') || line.includes('deprecated') || line.includes('⚠️')
      );

      result.passed = true;

    } catch (error: any) {
      result.passed = false;
      
      if (error.stdout) {
        const lines = error.stdout.split('\n');
        result.errors = lines.filter(line => 
          line.includes('Error:') || line.includes('Failed:') || line.includes('❌')
        );
        
        result.warnings = lines.filter(line => 
          line.includes('warn') || line.includes('⚠️')
        );
      }

      if (error.message) {
        result.errors.push(error.message);
      }
    }

    const endTime = Date.now();
    result.duration = Math.round((endTime - startTime) / 1000);
    
    const finalMemory = process.memoryUsage().heapUsed;
    result.memoryUsed = Math.round((finalMemory - initialMemory) / 1024 / 1024);

    return result;
  }

  /**
   * Perform pre-flight checks before running tests
   */
  private async performPreflightChecks(): Promise<void> {
    console.log('🔍 Pre-flight Checks');
    console.log('-'.repeat(30));

    // Check Node.js version
    const nodeVersion = process.version;
    console.log(`✅ Node.js version: ${nodeVersion}`);

    // Check available memory
    const totalMemory = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);
    const requiredMemory = Math.max(...this.testSuites.map(s => s.memoryRequirement));
    console.log(`💾 Available memory: ${totalMemory}MB (required: ${requiredMemory}MB)`);

    if (totalMemory < requiredMemory) {
      console.log(`⚠️  Warning: Available memory may be insufficient for performance tests`);
    }

    // Check test files exist
    let missingFiles = 0;
    for (const suite of this.testSuites) {
      const filePath = path.join(__dirname, suite.file);
      if (!fs.existsSync(filePath)) {
        console.log(`❌ Missing test file: ${suite.file}`);
        missingFiles++;
      }
    }

    if (missingFiles > 0) {
      throw new Error(`${missingFiles} test files are missing`);
    }

    console.log(`✅ All ${this.testSuites.length} test files found`);

    // Check Jest configuration
    const jestConfigPath = path.join(__dirname, '../setup/jest.config.js');
    if (fs.existsSync(jestConfigPath)) {
      console.log(`✅ Jest configuration found`);
    } else {
      console.log(`⚠️  Jest configuration not found, using defaults`);
    }

    // Check TypeScript compilation
    try {
      execSync('npx tsc --noEmit', { 
        cwd: path.resolve(__dirname, '../../..'),
        stdio: 'pipe',
        timeout: 30000
      });
      console.log(`✅ TypeScript compilation check passed`);
    } catch (error) {
      console.log(`⚠️  TypeScript compilation issues detected`);
    }

    console.log('');
  }

  /**
   * Generate comprehensive final report
   */
  private async generateFinalReport(): Promise<void> {
    const endTime = new Date();
    const totalDuration = Math.round((endTime.getTime() - this.startTime.getTime()) / 1000);
    
    console.log('📊 INTEGRATION TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`⏱️  Total duration: ${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`);
    console.log(`📅 Completed: ${endTime.toLocaleString()}`);
    console.log('');

    // Summary statistics
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = this.results.length - passedTests;
    const totalWarnings = this.results.reduce((sum, r) => sum + r.warnings.length, 0);
    const totalErrors = this.results.reduce((sum, r) => sum + r.errors.length, 0);
    const maxMemoryUsed = Math.max(...this.results.map(r => r.memoryUsed));
    const totalMemoryUsed = this.results.reduce((sum, r) => sum + r.memoryUsed, 0);

    console.log('📈 Summary Statistics:');
    console.log(`   Test Suites: ${this.results.length}`);
    console.log(`   ✅ Passed: ${passedTests}`);
    console.log(`   ❌ Failed: ${failedTests}`);
    console.log(`   ⚠️  Warnings: ${totalWarnings}`);
    console.log(`   🚨 Errors: ${totalErrors}`);
    console.log(`   💾 Peak Memory: ${maxMemoryUsed}MB`);
    console.log(`   💾 Total Memory: ${totalMemoryUsed}MB`);
    console.log(`   📊 Success Rate: ${((passedTests / this.results.length) * 100).toFixed(1)}%`);
    console.log('');

    // Detailed results table
    console.log('📋 Detailed Results:');
    console.log('-'.repeat(80));
    console.log('Suite'.padEnd(25) + 'Status'.padEnd(10) + 'Duration'.padEnd(12) + 'Memory'.padEnd(10) + 'Issues');
    console.log('-'.repeat(80));

    this.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const duration = `${result.duration}s`;
      const memory = `${result.memoryUsed}MB`;
      const issues = result.errors.length + result.warnings.length;
      
      console.log(
        result.suite.padEnd(25) + 
        status.padEnd(10) + 
        duration.padEnd(12) + 
        memory.padEnd(10) + 
        issues.toString()
      );
    });

    console.log('-'.repeat(80));
    console.log('');

    // Performance analysis
    if (this.results.length > 0) {
      console.log('⚡ Performance Analysis:');
      
      const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / this.results.length;
      const avgMemory = this.results.reduce((sum, r) => sum + r.memoryUsed, 0) / this.results.length;
      
      console.log(`   Average duration: ${avgDuration.toFixed(1)}s`);
      console.log(`   Average memory: ${avgMemory.toFixed(1)}MB`);
      
      // Identify slowest and most memory-intensive tests
      const slowestTest = this.results.reduce((prev, curr) => prev.duration > curr.duration ? prev : curr);
      const memoryHeaviestTest = this.results.reduce((prev, curr) => prev.memoryUsed > curr.memoryUsed ? prev : curr);
      
      console.log(`   Slowest test: ${slowestTest.suite} (${slowestTest.duration}s)`);
      console.log(`   Most memory: ${memoryHeaviestTest.suite} (${memoryHeaviestTest.memoryUsed}MB)`);
      console.log('');
    }

    // Error summary
    if (totalErrors > 0) {
      console.log('🚨 Error Summary:');
      this.results.filter(r => r.errors.length > 0).forEach(result => {
        console.log(`   ${result.suite}:`);
        result.errors.slice(0, 3).forEach(error => {
          console.log(`     - ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`);
        });
      });
      console.log('');
    }

    // Recommendations
    console.log('💡 Recommendations:');
    if (failedTests > 0) {
      console.log(`   - Review and fix ${failedTests} failed test suite(s)`);
    }
    if (totalWarnings > 0) {
      console.log(`   - Address ${totalWarnings} warning(s) for improved stability`);
    }
    if (maxMemoryUsed > 400) {
      console.log(`   - Consider optimizing memory usage (peak: ${maxMemoryUsed}MB)`);
    }
    if (totalDuration > this.totalEstimatedDuration * 1.5) {
      console.log(`   - Performance optimization may be needed (${totalDuration}s vs estimated ${this.totalEstimatedDuration}s)`);
    }
    if (passedTests === this.results.length) {
      console.log(`   - All tests passed! System is ready for production`);
    }
    console.log('');

    // Generate report file
    await this.generateReportFile();

    // Final status
    if (passedTests === this.results.length) {
      console.log('🎉 ALL INTEGRATION TESTS PASSED!');
      process.exit(0);
    } else {
      console.log(`❌ ${failedTests} TEST SUITE(S) FAILED`);
      process.exit(1);
    }
  }

  /**
   * Generate detailed report file
   */
  private async generateReportFile(): Promise<void> {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSuites: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        totalDuration: Math.round((new Date().getTime() - this.startTime.getTime()) / 1000),
        totalWarnings: this.results.reduce((sum, r) => sum + r.warnings.length, 0),
        totalErrors: this.results.reduce((sum, r) => sum + r.errors.length, 0)
      },
      results: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage()
      }
    };

    const reportPath = path.join(__dirname, `integration-test-report-${Date.now()}.json`);
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
      console.log(`📄 Detailed report saved: ${reportPath}`);
    } catch (error) {
      console.log(`⚠️  Could not save report file: ${error.message}`);
    }
  }

  /**
   * Utility method for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run specific test suite by name
   */
  async runSpecificSuite(suiteName: string): Promise<void> {
    const suite = this.testSuites.find(s => s.name.toLowerCase().includes(suiteName.toLowerCase()));
    
    if (!suite) {
      console.log(`❌ Test suite '${suiteName}' not found`);
      console.log('Available suites:');
      this.testSuites.forEach(s => console.log(`   - ${s.name}`));
      process.exit(1);
    }

    console.log(`🎯 Running specific suite: ${suite.name}`);
    console.log('');

    await this.performPreflightChecks();
    const result = await this.runTestSuite(suite);
    this.results.push(result);
    
    await this.generateFinalReport();
  }
}

/**
 * CLI interface
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const runner = new IntegrationTestRunner();

  if (args.length === 0) {
    // Run all tests
    await runner.runAllTests();
  } else if (args[0] === '--suite' && args[1]) {
    // Run specific suite
    await runner.runSpecificSuite(args[1]);
  } else if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
🧪 Integration Test Runner

Usage:
  npm run test:integration              # Run all integration tests
  npm run test:integration --suite <name>  # Run specific test suite

Available test suites:
  - end-to-end     # End-to-end workflow tests
  - performance    # Performance integration tests  
  - system         # System integration tests

Options:
  --help, -h       # Show this help message

Examples:
  npm run test:integration
  npm run test:integration --suite performance
  npm run test:integration --suite system
    `);
  } else {
    console.log('❌ Invalid arguments. Use --help for usage information.');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  });
}

export { IntegrationTestRunner };
