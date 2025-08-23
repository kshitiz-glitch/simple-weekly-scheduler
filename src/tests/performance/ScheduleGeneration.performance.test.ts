import { ScheduleGenerator } from '../../algorithms/ScheduleGenerator';
import { DayOfWeek } from '../../models';
import { FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from '../../services/constraints';
import { TestDataFactory } from '../utils/TestDataFactory';
import { PerformanceTestUtils } from '../utils/TestMatchers';

describe.performance('Schedule Generation Performance', () => {
  let generator: ScheduleGenerator;
  let constraints: any[];

  beforeEach(() => {
    generator = new ScheduleGenerator({
      workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
      workingHours: { start: '08:00', end: '18:00' },
      slotDuration: 60,
      breakDuration: 0,
      maxAttemptsPerLecture: 100,
      allowPartialSchedules: true,
      prioritizeEvenDistribution: true
    });

    constraints = [
      new FacultyConflictConstraint(),
      new TimeSlotAvailabilityConstraint()
    ];
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with batch count', async () => {
      const batchCounts = [5, 10, 20, 30];
      const results: Array<{ batchCount: number; timeMs: number; entriesGenerated: number }> = [];

      for (const batchCount of batchCounts) {
        const batches = TestDataFactory.createLargeDataset(batchCount, 5, 20);
        
        const { result: schedule, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
          return await generator.generateTimetable(batches, constraints, []);
        });

        results.push({
          batchCount,
          timeMs,
          entriesGenerated: schedule.entries.length
        });

        // Each test should complete within reasonable time
        expect(timeMs).toBeLessThan(batchCount * 1000); // 1 second per batch max
      }

      // Log performance results
      console.table(results);

      // Verify roughly linear scaling (allowing for some variance)
      const timeRatios = results.slice(1).map((result, index) => 
        result.timeMs / results[index].timeMs
      );
      
      // Time should not increase exponentially
      timeRatios.forEach(ratio => {
        expect(ratio).toBeLessThan(5); // Should not be more than 5x slower
      });
    });

    it('should handle increasing subject complexity', async () => {
      const subjectCounts = [3, 6, 10, 15];
      const results: Array<{ subjectCount: number; timeMs: number; utilizationRate: number }> = [];

      for (const subjectCount of subjectCounts) {
        const batches = TestDataFactory.createLargeDataset(10, subjectCount, 30);
        
        const { result: schedule, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
          return await generator.generateTimetable(batches, constraints, []);
        });

        const stats = schedule.calculateStatistics();
        
        results.push({
          subjectCount,
          timeMs,
          utilizationRate: stats.timeSlotUtilization.utilizationRate
        });

        // Should complete within reasonable time
        expect(timeMs).toBeLessThan(subjectCount * 500); // 500ms per subject max
      }

      console.table(results);

      // Utilization should generally increase with more subjects
      const utilizationTrend = results.slice(1).every((result, index) => 
        result.utilizationRate >= results[index].utilizationRate * 0.8 // Allow 20% variance
      );
      
      expect(utilizationTrend).toBe(true);
    });

    it('should maintain performance with many constraints', async () => {
      const constraintCounts = [2, 5, 10, 15];
      const results: Array<{ constraintCount: number; timeMs: number; conflictCount: number }> = [];

      for (const constraintCount of constraintCounts) {
        // Create multiple instances of constraints
        const testConstraints = [];
        for (let i = 0; i < constraintCount; i++) {
          testConstraints.push(new FacultyConflictConstraint());
          if (i % 2 === 0) {
            testConstraints.push(new TimeSlotAvailabilityConstraint());
          }
        }

        const batches = TestDataFactory.createLargeDataset(15, 8, 25);
        
        const { result: schedule, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
          return await generator.generateTimetable(batches, testConstraints.slice(0, constraintCount), []);
        });

        results.push({
          constraintCount,
          timeMs,
          conflictCount: schedule.conflicts.length
        });

        // Should complete within reasonable time even with many constraints
        expect(timeMs).toBeLessThan(constraintCount * 1000 + 10000); // Base 10s + 1s per constraint
      }

      console.table(results);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should maintain reasonable memory usage', async () => {
      const initialMemory = PerformanceTestUtils.measureMemoryUsage();
      
      // Generate multiple large schedules
      for (let i = 0; i < 5; i++) {
        const batches = TestDataFactory.createLargeDataset(20, 10, 40);
        const schedule = await generator.generateTimetable(batches, constraints, []);
        
        expect(schedule.entries.length).toBeGreaterThan(0);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = PerformanceTestUtils.measureMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      console.log(`Memory usage increased by ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    });

    it('should clean up resources properly', async () => {
      const memoryMeasurements: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const batches = TestDataFactory.createLargeDataset(10, 8, 20);
        await generator.generateTimetable(batches, constraints, []);
        
        if (global.gc) {
          global.gc();
        }
        
        const memory = PerformanceTestUtils.measureMemoryUsage();
        memoryMeasurements.push(memory.heapUsed);
      }

      // Memory usage should not continuously increase
      const memoryTrend = memoryMeasurements.slice(-3); // Last 3 measurements
      const averageRecent = memoryTrend.reduce((sum, val) => sum + val, 0) / memoryTrend.length;
      const firstMeasurement = memoryMeasurements[0];
      
      // Recent average should not be significantly higher than initial
      const memoryIncrease = (averageRecent - firstMeasurement) / firstMeasurement;
      expect(memoryIncrease).toBeLessThan(0.5); // Less than 50% increase
    });
  });

  describe('Optimization Performance', () => {
    it('should improve schedule quality over time', async () => {
      const batches = TestDataFactory.createLargeDataset(15, 8, 25);
      
      // Test with different optimization settings
      const optimizationLevels = [
        { maxAttempts: 10, prioritizeDistribution: false },
        { maxAttempts: 50, prioritizeDistribution: false },
        { maxAttempts: 100, prioritizeDistribution: true },
        { maxAttempts: 200, prioritizeDistribution: true }
      ];

      const results: Array<{
        level: number;
        timeMs: number;
        optimizationScore: number;
        utilizationRate: number;
      }> = [];

      for (let i = 0; i < optimizationLevels.length; i++) {
        const config = optimizationLevels[i];
        const testGenerator = new ScheduleGenerator({
          workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
          workingHours: { start: '08:00', end: '18:00' },
          slotDuration: 60,
          breakDuration: 0,
          maxAttemptsPerLecture: config.maxAttempts,
          allowPartialSchedules: true,
          prioritizeEvenDistribution: config.prioritizeDistribution
        });

        const { result: schedule, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
          return await testGenerator.generateTimetable(batches, constraints, []);
        });

        const stats = schedule.calculateStatistics();
        
        results.push({
          level: i + 1,
          timeMs,
          optimizationScore: schedule.metadata.optimizationScore || 0,
          utilizationRate: stats.timeSlotUtilization.utilizationRate
        });
      }

      console.table(results);

      // Higher optimization levels should generally produce better results
      // (allowing for some variance due to randomness)
      const qualityTrend = results.slice(1).some((result, index) => 
        result.optimizationScore >= results[index].optimizationScore * 0.9
      );
      
      expect(qualityTrend).toBe(true);
    });

    it('should balance time vs quality trade-offs', async () => {
      const batches = TestDataFactory.createLargeDataset(12, 6, 20);
      
      const timeConstraints = [1000, 3000, 5000, 10000]; // Max time in ms
      const results: Array<{
        maxTimeMs: number;
        actualTimeMs: number;
        qualityScore: number;
        entriesGenerated: number;
      }> = [];

      for (const maxTime of timeConstraints) {
        const startTime = Date.now();
        
        // Adjust max attempts based on time constraint
        const maxAttempts = Math.floor(maxTime / 50); // Rough estimate
        
        const testGenerator = new ScheduleGenerator({
          workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
          workingHours: { start: '08:00', end: '18:00' },
          slotDuration: 60,
          breakDuration: 0,
          maxAttemptsPerLecture: maxAttempts,
          allowPartialSchedules: true,
          prioritizeEvenDistribution: true
        });

        const schedule = await testGenerator.generateTimetable(batches, constraints, []);
        const actualTime = Date.now() - startTime;
        
        const stats = schedule.calculateStatistics();
        const qualityScore = (schedule.metadata.optimizationScore || 0) * 
                           (stats.timeSlotUtilization.utilizationRate / 100);

        results.push({
          maxTimeMs: maxTime,
          actualTimeMs: actualTime,
          qualityScore,
          entriesGenerated: schedule.entries.length
        });

        // Should generally stay within time constraint (with some buffer)
        expect(actualTime).toBeLessThan(maxTime * 1.5);
      }

      console.table(results);

      // Quality should generally improve with more time
      const qualityImprovement = results[results.length - 1].qualityScore > results[0].qualityScore;
      expect(qualityImprovement).toBe(true);
    });
  });

  describe('Concurrent Processing', () => {
    it('should handle multiple simultaneous generations', async () => {
      const batchSets = Array.from({ length: 5 }, (_, i) => 
        TestDataFactory.createLargeDataset(8, 5, 15)
      );

      const { result: schedules, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return await Promise.all(
          batchSets.map(batches => 
            generator.generateTimetable(batches, constraints, [])
          )
        );
      });

      expect(schedules).toHaveLength(5);
      schedules.forEach(schedule => {
        expect(schedule.entries.length).toBeGreaterThan(0);
      });

      // Concurrent processing should be more efficient than sequential
      // (though this depends on the implementation)
      expect(timeMs).toBeLessThan(25000); // Should complete within 25 seconds
      
      console.log(`Concurrent generation of 5 schedules took ${timeMs}ms`);
    });
  });

  describe('Benchmark Tests', () => {
    it('should meet performance benchmarks', async () => {
      const benchmarks = [
        {
          name: 'Small Dataset (5 batches, 5 subjects each)',
          batches: TestDataFactory.createLargeDataset(5, 5, 10),
          maxTimeMs: 2000,
          minUtilization: 30
        },
        {
          name: 'Medium Dataset (15 batches, 8 subjects each)',
          batches: TestDataFactory.createLargeDataset(15, 8, 25),
          maxTimeMs: 8000,
          minUtilization: 25
        },
        {
          name: 'Large Dataset (30 batches, 10 subjects each)',
          batches: TestDataFactory.createLargeDataset(30, 10, 50),
          maxTimeMs: 20000,
          minUtilization: 20
        }
      ];

      const results: Array<{
        name: string;
        timeMs: number;
        utilizationRate: number;
        entriesGenerated: number;
        passed: boolean;
      }> = [];

      for (const benchmark of benchmarks) {
        const { result: schedule, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
          return await generator.generateTimetable(benchmark.batches, constraints, []);
        });

        const stats = schedule.calculateStatistics();
        const passed = timeMs <= benchmark.maxTimeMs && 
                      stats.timeSlotUtilization.utilizationRate >= benchmark.minUtilization;

        results.push({
          name: benchmark.name,
          timeMs,
          utilizationRate: stats.timeSlotUtilization.utilizationRate,
          entriesGenerated: schedule.entries.length,
          passed
        });

        expect(timeMs).toBeLessThan(benchmark.maxTimeMs);
        expect(stats.timeSlotUtilization.utilizationRate).toBeGreaterThanOrEqual(benchmark.minUtilization);
      }

      console.table(results);
      
      // All benchmarks should pass
      expect(results.every(r => r.passed)).toBe(true);
    });

    it('should maintain consistent performance across runs', async () => {
      const batches = TestDataFactory.createLargeDataset(12, 6, 20);
      const runCount = 5;
      
      const benchmark = await PerformanceTestUtils.runBenchmark(
        'Consistent Performance Test',
        async () => {
          return await generator.generateTimetable(batches, constraints, []);
        },
        runCount
      );

      console.log(`Benchmark Results:`, benchmark);

      // Performance should be consistent (coefficient of variation < 50%)
      const cv = (benchmark.maxTimeMs - benchmark.minTimeMs) / benchmark.averageTimeMs;
      expect(cv).toBeLessThan(0.5);

      // Average time should be reasonable
      expect(benchmark.averageTimeMs).toBeLessThan(10000);
    });
  });
});
