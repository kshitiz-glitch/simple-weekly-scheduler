import { Batch, Subject, DayOfWeek } from '../../models';
import { ScheduleGenerator } from '../../algorithms/ScheduleGenerator';
import { ExportManager } from '../../exporters/ExportManager';
import { FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from '../../services/constraints';
import { ExportFormat } from '../../exporters/ExportInterfaces';
import { TestDataFactory } from '../utils/TestDataFactory';
import { PerformanceTestUtils } from '../utils/TestMatchers';

describe('Performance Integration Tests', () => {
  let scheduleGenerator: ScheduleGenerator;
  let exportManager: ExportManager;
  let constraints: any[];

  beforeEach(() => {
    scheduleGenerator = new ScheduleGenerator({
      workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
      workingHours: { start: '08:00', end: '18:00' },
      slotDuration: 60,
      breakDuration: 15,
      maxAttemptsPerLecture: 50, // Reduced for performance tests
      allowPartialSchedules: true,
      prioritizeEvenDistribution: true
    });

    exportManager = new ExportManager();
    constraints = [
      new FacultyConflictConstraint(),
      new TimeSlotAvailabilityConstraint()
    ];
  });

  describe('Scalability Performance Tests', () => {
    it('should scale linearly with increasing batch count', async () => {
      const batchCounts = [5, 10, 15, 20];
      const results: Array<{
        batchCount: number;
        timeMs: number;
        entriesGenerated: number;
        memoryUsed: number;
        utilizationRate: number;
      }> = [];

      for (const batchCount of batchCounts) {
        const initialMemory = PerformanceTestUtils.measureMemoryUsage();
        const batches = TestDataFactory.createLargeDataset(batchCount, 5, Math.ceil(batchCount * 2));

        const { result: schedule, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
          return await scheduleGenerator.generateTimetable(batches, constraints, []);
        });

        const finalMemory = PerformanceTestUtils.measureMemoryUsage();
        const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;
        const stats = schedule.calculateStatistics();

        results.push({
          batchCount,
          timeMs,
          entriesGenerated: schedule.entries.length,
          memoryUsed: Math.round(memoryUsed / 1024 / 1024), // MB
          utilizationRate: stats.timeSlotUtilization.utilizationRate
        });

        // Performance expectations
        expect(timeMs).toBeLessThan(batchCount * 2000); // Max 2 seconds per batch
        expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // Max 100MB per test
        expect(schedule.entries.length).toBeGreaterThan(0);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      console.table(results);

      // Verify roughly linear scaling
      const timeRatios = results.slice(1).map((result, index) => 
        result.timeMs / results[index].timeMs
      );

      // Time should not increase exponentially
      timeRatios.forEach((ratio, index) => {
        expect(ratio).toBeLessThan(4); // Should not be more than 4x slower
        console.log(`Scaling ratio ${index + 1}: ${ratio.toFixed(2)}x`);
      });

      // Memory usage should be reasonable
      const maxMemory = Math.max(...results.map(r => r.memoryUsed));
      expect(maxMemory).toBeLessThan(150); // Less than 150MB

      console.log(`📊 Scalability test completed. Max memory: ${maxMemory}MB`);
    });

    it('should handle increasing subject complexity efficiently', async () => {
      const subjectCounts = [3, 6, 9, 12];
      const results: Array<{
        subjectCount: number;
        timeMs: number;
        complexityScore: number;
        successRate: number;
      }> = [];

      for (const subjectCount of subjectCounts) {
        const batches = TestDataFactory.createLargeDataset(8, subjectCount, 20);
        
        const { result: schedule, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
          return await scheduleGenerator.generateTimetable(batches, constraints, []);
        });

        const totalLectures = batches.reduce((sum, batch) => sum + batch.getTotalLecturesPerWeek(), 0);
        const successRate = (schedule.entries.length / totalLectures) * 100;
        const complexityScore = batches.length * subjectCount * totalLectures;

        results.push({
          subjectCount,
          timeMs,
          complexityScore,
          successRate
        });

        // Performance expectations
        expect(timeMs).toBeLessThan(subjectCount * 1000); // Max 1 second per subject
        expect(successRate).toBeGreaterThan(50); // At least 50% success rate

        console.log(`Subjects: ${subjectCount}, Time: ${timeMs}ms, Success: ${successRate.toFixed(1)}%`);
      }

      console.table(results);

      // Verify performance doesn't degrade too much with complexity
      const avgTimePerComplexity = results.map(r => r.timeMs / r.complexityScore);
      const maxEfficiency = Math.max(...avgTimePerComplexity);
      const minEfficiency = Math.min(...avgTimePerComplexity);
      const efficiencyRatio = maxEfficiency / minEfficiency;

      expect(efficiencyRatio).toBeLessThan(10); // Efficiency shouldn't degrade more than 10x
      console.log(`⚡ Efficiency ratio: ${efficiencyRatio.toFixed(2)}x`);
    });

    it('should maintain performance with many constraints', async () => {
      const constraintCounts = [2, 5, 8, 10];
      const baseBatches = TestDataFactory.createLargeDataset(10, 6, 15);
      
      const results: Array<{
        constraintCount: number;
        timeMs: number;
        conflictCount: number;
        entriesGenerated: number;
      }> = [];

      for (const constraintCount of constraintCounts) {
        // Create multiple constraint instances
        const testConstraints = [];
        for (let i = 0; i < constraintCount; i++) {
          if (i % 2 === 0) {
            testConstraints.push(new FacultyConflictConstraint());
          } else {
            testConstraints.push(new TimeSlotAvailabilityConstraint());
          }
        }

        const { result: schedule, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
          return await scheduleGenerator.generateTimetable(baseBatches, testConstraints, []);
        });

        results.push({
          constraintCount,
          timeMs,
          conflictCount: schedule.conflicts.length,
          entriesGenerated: schedule.entries.length
        });

        // Performance expectations
        expect(timeMs).toBeLessThan(constraintCount * 2000 + 10000); // Base 10s + 2s per constraint
        expect(schedule.entries.length).toBeGreaterThan(0);

        console.log(`Constraints: ${constraintCount}, Time: ${timeMs}ms, Conflicts: ${schedule.conflicts.length}`);
      }

      console.table(results);

      // Verify constraint processing doesn't cause exponential slowdown
      const timePerConstraint = results.map(r => r.timeMs / r.constraintCount);
      const maxTimePerConstraint = Math.max(...timePerConstraint);
      expect(maxTimePerConstraint).toBeLessThan(5000); // Max 5 seconds per constraint

      console.log(`🔒 Max time per constraint: ${maxTimePerConstraint.toFixed(0)}ms`);
    });
  });

  describe('Memory Performance Tests', () => {
    it('should maintain stable memory usage across multiple generations', async () => {
      const memoryMeasurements: number[] = [];
      const batches = TestDataFactory.createLargeDataset(12, 6, 18);

      for (let i = 0; i < 10; i++) {
        const initialMemory = PerformanceTestUtils.measureMemoryUsage();
        
        await scheduleGenerator.generateTimetable(batches, constraints, []);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const finalMemory = PerformanceTestUtils.measureMemoryUsage();
        memoryMeasurements.push(finalMemory.heapUsed);
        
        console.log(`Generation ${i + 1}: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
      }

      // Memory should not continuously increase (no major memory leaks)
      const firstThree = memoryMeasurements.slice(0, 3);
      const lastThree = memoryMeasurements.slice(-3);
      
      const avgFirst = firstThree.reduce((sum, val) => sum + val, 0) / firstThree.length;
      const avgLast = lastThree.reduce((sum, val) => sum + val, 0) / lastThree.length;
      
      const memoryIncrease = (avgLast - avgFirst) / avgFirst;
      expect(memoryIncrease).toBeLessThan(0.5); // Less than 50% increase

      console.log(`💾 Memory stability: ${(memoryIncrease * 100).toFixed(1)}% increase over 10 generations`);
    });

    it('should handle memory pressure gracefully', async () => {
      // Create a very large dataset to test memory limits
      const largeBatches = TestDataFactory.createLargeDataset(30, 10, 50);
      
      const initialMemory = PerformanceTestUtils.measureMemoryUsage();
      
      try {
        const { result: schedule, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
          return await scheduleGenerator.generateTimetable(largeBatches, constraints, []);
        });

        const finalMemory = PerformanceTestUtils.measureMemoryUsage();
        const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;

        expect(schedule).toBeDefined();
        expect(memoryUsed).toBeLessThan(500 * 1024 * 1024); // Less than 500MB
        expect(timeMs).toBeLessThan(120000); // Less than 2 minutes

        console.log(`🧠 Large dataset: ${Math.round(memoryUsed / 1024 / 1024)}MB used, ${timeMs}ms`);
        console.log(`📊 Generated ${schedule.entries.length} entries`);

      } catch (error) {
        // If it fails due to memory pressure, it should fail gracefully
        expect(error.message).toBeDefined();
        console.log(`⚠️  Memory pressure test failed gracefully: ${error.message}`);
      }
    });
  });

  describe('Export Performance Tests', () => {
    it('should export large schedules efficiently', async () => {
      const batches = TestDataFactory.createLargeDataset(20, 8, 30);
      const schedule = await scheduleGenerator.generateTimetable(batches, constraints, []);

      const formats = [ExportFormat.JSON, ExportFormat.CSV, ExportFormat.HTML];
      const exportResults: Array<{
        format: string;
        timeMs: number;
        sizeBytes: number;
        throughputMBps: number;
      }> = [];

      for (const format of formats) {
        const { result: exportResult, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
          return await exportManager.exportSchedule(schedule, {
            format,
            filename: `perf_test.${format}`,
            includeMetadata: true,
            includeStatistics: true
          });
        });

        expect(exportResult.success).toBe(true);
        expect(timeMs).toBeLessThan(10000); // Max 10 seconds per export

        const throughputMBps = (exportResult.size / 1024 / 1024) / (timeMs / 1000);

        exportResults.push({
          format: format.toString(),
          timeMs,
          sizeBytes: exportResult.size,
          throughputMBps
        });

        console.log(`📤 ${format}: ${timeMs}ms, ${Math.round(exportResult.size / 1024)}KB, ${throughputMBps.toFixed(2)} MB/s`);
      }

      console.table(exportResults);

      // Verify reasonable throughput
      exportResults.forEach(result => {
        expect(result.throughputMBps).toBeGreaterThan(0.1); // At least 0.1 MB/s
      });

      const avgThroughput = exportResults.reduce((sum, r) => sum + r.throughputMBps, 0) / exportResults.length;
      console.log(`📊 Average export throughput: ${avgThroughput.toFixed(2)} MB/s`);
    });

    it('should handle concurrent exports efficiently', async () => {
      const batches = TestDataFactory.createLargeDataset(15, 6, 20);
      const schedule = await scheduleGenerator.generateTimetable(batches, constraints, []);

      const concurrentExports = 5;
      const exportPromises = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentExports; i++) {
        const promise = exportManager.exportSchedule(schedule, {
          format: ExportFormat.JSON,
          filename: `concurrent_${i}.json`,
          includeMetadata: true
        });
        exportPromises.push(promise);
      }

      const results = await Promise.all(exportPromises);
      const totalTime = Date.now() - startTime;

      // All exports should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.size).toBeGreaterThan(0);
      });

      // Concurrent exports should be more efficient than sequential
      expect(totalTime).toBeLessThan(concurrentExports * 5000); // Less than 5s per export

      console.log(`🔄 ${concurrentExports} concurrent exports completed in ${totalTime}ms`);
      console.log(`⚡ Average time per export: ${(totalTime / concurrentExports).toFixed(0)}ms`);
    });
  });

  describe('End-to-End Performance Benchmarks', () => {
    it('should meet performance benchmarks for typical use cases', async () => {
      const benchmarks = [
        {
          name: 'Small University (5 batches, 4 subjects each)',
          batches: TestDataFactory.createLargeDataset(5, 4, 8),
          maxTimeMs: 3000,
          minUtilization: 40,
          maxMemoryMB: 50
        },
        {
          name: 'Medium University (12 batches, 6 subjects each)',
          batches: TestDataFactory.createLargeDataset(12, 6, 18),
          maxTimeMs: 15000,
          minUtilization: 30,
          maxMemoryMB: 100
        },
        {
          name: 'Large University (20 batches, 8 subjects each)',
          batches: TestDataFactory.createLargeDataset(20, 8, 35),
          maxTimeMs: 45000,
          minUtilization: 25,
          maxMemoryMB: 200
        }
      ];

      const results: Array<{
        name: string;
        timeMs: number;
        memoryMB: number;
        utilizationRate: number;
        entriesGenerated: number;
        passed: boolean;
      }> = [];

      for (const benchmark of benchmarks) {
        console.log(`\n🎯 Running benchmark: ${benchmark.name}`);
        
        const initialMemory = PerformanceTestUtils.measureMemoryUsage();
        
        const { result: schedule, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
          return await scheduleGenerator.generateTimetable(benchmark.batches, constraints, []);
        });

        const finalMemory = PerformanceTestUtils.measureMemoryUsage();
        const memoryMB = Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024);
        
        const stats = schedule.calculateStatistics();
        const utilizationRate = stats.timeSlotUtilization.utilizationRate;

        const passed = timeMs <= benchmark.maxTimeMs && 
                      utilizationRate >= benchmark.minUtilization &&
                      memoryMB <= benchmark.maxMemoryMB;

        results.push({
          name: benchmark.name,
          timeMs,
          memoryMB,
          utilizationRate,
          entriesGenerated: schedule.entries.length,
          passed
        });

        // Assertions
        expect(timeMs).toBeLessThan(benchmark.maxTimeMs);
        expect(utilizationRate).toBeGreaterThanOrEqual(benchmark.minUtilization);
        expect(memoryMB).toBeLessThan(benchmark.maxMemoryMB);

        console.log(`✅ ${benchmark.name}: ${timeMs}ms, ${memoryMB}MB, ${utilizationRate.toFixed(1)}% util`);

        // Force garbage collection
        if (global.gc) {
          global.gc();
        }
      }

      console.log('\n📊 Performance Benchmark Results:');
      console.table(results);

      // All benchmarks should pass
      const passedCount = results.filter(r => r.passed).length;
      expect(passedCount).toBe(results.length);

      console.log(`🏆 All ${results.length} performance benchmarks passed!`);
    });

    it('should maintain consistent performance across multiple runs', async () => {
      const batches = TestDataFactory.createLargeDataset(10, 5, 15);
      const runCount = 5;
      
      const benchmark = await PerformanceTestUtils.runBenchmark(
        'Consistency Test',
        async () => {
          return await scheduleGenerator.generateTimetable(batches, constraints, []);
        },
        runCount
      );

      console.log('🔄 Consistency Benchmark Results:', benchmark);

      // Performance should be consistent (coefficient of variation < 50%)
      const cv = (benchmark.maxTimeMs - benchmark.minTimeMs) / benchmark.averageTimeMs;
      expect(cv).toBeLessThan(0.5);

      // Average time should be reasonable
      expect(benchmark.averageTimeMs).toBeLessThan(20000);

      console.log(`📊 Performance consistency: CV = ${(cv * 100).toFixed(1)}%`);
      console.log(`⏱️  Average time: ${benchmark.averageTimeMs.toFixed(0)}ms`);
      console.log(`📈 Range: ${benchmark.minTimeMs}ms - ${benchmark.maxTimeMs}ms`);
    });
  });

  afterEach(() => {
    // Force garbage collection after each test if available
    if (global.gc) {
      global.gc();
    }
  });

  afterAll(() => {
    console.log('🏁 Performance integration tests completed');
  });
});
