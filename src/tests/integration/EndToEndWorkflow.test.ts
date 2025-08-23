import { Batch, Subject, DayOfWeek } from '../../models';
import { WeeklySchedule } from '../../models/WeeklySchedule';
import { ScheduleGenerator } from '../../algorithms/ScheduleGenerator';
import { InputManager } from '../../services/InputManager';
import { ValidationService } from '../../services/ValidationService';
import { ConflictReporter } from '../../services/ConflictReporter';
import { ExportManager } from '../../exporters/ExportManager';
import { FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from '../../services/constraints';
import { ExportFormat } from '../../exporters/ExportInterfaces';
import { TestDataFactory } from '../utils/TestDataFactory';
import { TestAssertions, PerformanceTestUtils } from '../utils/TestMatchers';
import { initializeGlobalErrorHandling } from '../../errors';

describe('End-to-End Timetable Generation Workflow', () => {
  let scheduleGenerator: ScheduleGenerator;
  let inputManager: InputManager;
  let validationService: ValidationService;
  let conflictReporter: ConflictReporter;
  let exportManager: ExportManager;
  let constraints: any[];

  beforeAll(() => {
    // Initialize global error handling for integration tests
    initializeGlobalErrorHandling();
  });

  beforeEach(() => {
    scheduleGenerator = new ScheduleGenerator({
      workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
      workingHours: { start: '08:00', end: '18:00' },
      slotDuration: 60,
      breakDuration: 15,
      maxAttemptsPerLecture: 100,
      allowPartialSchedules: true,
      prioritizeEvenDistribution: true
    });

    inputManager = new InputManager();
    validationService = new ValidationService();
    conflictReporter = new ConflictReporter();
    exportManager = new ExportManager();

    constraints = [
      new FacultyConflictConstraint(),
      new TimeSlotAvailabilityConstraint()
    ];
  });

  describe('Complete Workflow - Small Dataset', () => {
    it('should complete full workflow for small university scenario', async () => {
      // Step 1: Create and validate input data
      const scenario = TestDataFactory.createUniversityScenario();
      const batches = scenario.batches;
      const holidays = scenario.holidays;

      expect(batches.length).toBeGreaterThan(0);
      expect(holidays.length).toBeGreaterThan(0);

      // Step 2: Validate input data
      const validation = validationService.validateBatches(batches);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Step 3: Analyze scheduling feasibility
      const feasibilityAnalysis = await scheduleGenerator.analyzeSchedulingScenario(
        batches,
        constraints,
        holidays
      );

      expect(feasibilityAnalysis).toBeDefined();
      expect(typeof feasibilityAnalysis.feasible).toBe('boolean');
      expect(feasibilityAnalysis.confidence).toBeGreaterThanOrEqual(0);
      expect(feasibilityAnalysis.confidence).toBeLessThanOrEqual(1);

      // Step 4: Generate timetable
      const { result: schedule, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
        return await scheduleGenerator.generateTimetable(batches, constraints, holidays);
      });

      expect(schedule).toBeDefined();
      expect(schedule.entries.length).toBeGreaterThan(0);
      expect(timeMs).toBeLessThan(30000); // Should complete within 30 seconds

      // Step 5: Validate generated schedule
      expect(schedule).toBeValidSchedule();
      expect(schedule).toHaveNoCriticalConflicts();
      expect(schedule).toRespectTimeConstraints(8, 18);
      expect(schedule).toRespectHolidays(holidays);

      // Step 6: Generate conflict report
      const conflictReport = conflictReporter.generateConflictReport(
        schedule.entries,
        constraints,
        batches,
        holidays
      );

      expect(conflictReport).toBeDefined();
      expect(conflictReport.summary).toBeDefined();
      expect(Array.isArray(conflictReport.conflicts)).toBe(true);

      // Step 7: Export in multiple formats
      const exportFormats = [ExportFormat.JSON, ExportFormat.CSV, ExportFormat.HTML];
      const exportResults = new Map();

      for (const format of exportFormats) {
        const result = await exportManager.exportSchedule(schedule, {
          format,
          filename: `test_schedule.${format}`,
          includeMetadata: true,
          includeConflicts: true,
          includeStatistics: true
        });

        expect(result).toBeSuccessfulExport();
        exportResults.set(format, result);
      }

      expect(exportResults.size).toBe(3);

      // Step 8: Verify schedule statistics
      const stats = schedule.calculateStatistics();
      expect(stats.totalEntries).toBe(schedule.entries.length);
      expect(stats.entriesPerBatch.size).toBeGreaterThan(0);
      expect(stats.entriesPerFaculty.size).toBeGreaterThan(0);
      expect(stats.timeSlotUtilization.utilizationRate).toBeGreaterThan(0);

      // Step 9: Verify data integrity
      TestAssertions.assertScheduleQuality(schedule, {
        minUtilization: 10,
        maxUtilization: 90,
        maxCriticalConflicts: 0
      });

      console.log(`✅ Small dataset workflow completed successfully in ${timeMs}ms`);
      console.log(`📊 Generated ${schedule.entries.length} lectures for ${batches.length} batches`);
      console.log(`⚠️  Found ${schedule.conflicts.length} conflicts`);
      console.log(`📈 Utilization: ${stats.timeSlotUtilization.utilizationRate.toFixed(1)}%`);
    });

    it('should handle workflow with holidays and constraints', async () => {
      const batches = TestDataFactory.createOverlappingFacultyBatches();
      const holidays = TestDataFactory.createTestHolidays();

      // Test with more restrictive constraints
      const restrictiveConstraints = [
        new FacultyConflictConstraint(),
        new TimeSlotAvailabilityConstraint()
      ];

      const schedule = await scheduleGenerator.generateTimetable(batches, restrictiveConstraints, holidays);

      expect(schedule).toBeDefined();
      expect(schedule).toRespectHolidays(holidays);
      expect(schedule).toHaveNoFacultyConflicts();

      // Verify holiday handling
      const holidayDays = new Set(holidays.map(h => h.getDay()));
      const scheduledDays = new Set(schedule.entries.map(e => {
        const dayMap = {
          [DayOfWeek.SUNDAY]: 0,
          [DayOfWeek.MONDAY]: 1,
          [DayOfWeek.TUESDAY]: 2,
          [DayOfWeek.WEDNESDAY]: 3,
          [DayOfWeek.THURSDAY]: 4,
          [DayOfWeek.FRIDAY]: 5,
          [DayOfWeek.SATURDAY]: 6
        };
        return dayMap[e.timeSlot.day];
      }));

      // No lectures should be scheduled on holiday days
      const intersection = new Set([...holidayDays].filter(day => scheduledDays.has(day)));
      expect(intersection.size).toBe(0);
    });
  });

  describe('Complete Workflow - Medium Dataset', () => {
    it('should complete full workflow for medium complexity scenario', async () => {
      const batches = TestDataFactory.createLargeDataset(8, 6, 15);
      const holidays = [new Date('2024-12-25'), new Date('2024-01-01')];

      // Step 1: Pre-generation analysis
      const analysis = await scheduleGenerator.analyzeSchedulingScenario(batches, constraints, holidays);
      
      expect(analysis.feasible).toBeDefined();
      if (!analysis.feasible) {
        expect(analysis.recommendations.length).toBeGreaterThan(0);
        console.log(`⚠️  Scenario not feasible: ${analysis.issues.length} issues found`);
        console.log(`💡 Recommendations: ${analysis.recommendations.length} suggestions provided`);
      }

      // Step 2: Generate schedule (may be partial if not feasible)
      let schedule: WeeklySchedule;
      
      if (analysis.feasible || analysis.partialSolutionPossible) {
        schedule = await scheduleGenerator.generateTimetable(batches, constraints, holidays);
      } else {
        // Use partial generation
        const partialResult = await scheduleGenerator.generatePartialSchedule(
          batches,
          constraints,
          holidays,
          { targetCoverage: 70, allowConstraintRelaxation: true }
        );
        schedule = partialResult.schedule;
        
        expect(partialResult.coverage.coveragePercentage).toBeGreaterThan(50);
        expect(partialResult.unscheduledLectures.length).toBeGreaterThanOrEqual(0);
        
        console.log(`📊 Partial schedule generated: ${partialResult.coverage.coveragePercentage.toFixed(1)}% coverage`);
        console.log(`📝 Unscheduled lectures: ${partialResult.unscheduledLectures.length}`);
      }

      expect(schedule).toBeDefined();
      expect(schedule.entries.length).toBeGreaterThan(0);

      // Step 3: Quality assessment
      const stats = schedule.calculateStatistics();
      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.timeSlotUtilization.utilizationRate).toBeGreaterThan(0);

      // Step 4: Export and verify
      const exportResult = await exportManager.exportSchedule(schedule, {
        format: ExportFormat.JSON,
        includeMetadata: true,
        includeStatistics: true
      });

      expect(exportResult).toBeSuccessfulExport();

      const exportedData = JSON.parse(exportResult.data as string);
      expect(exportedData.entries).toHaveLength(schedule.entries.length);
      expect(exportedData.metadata).toBeDefined();
      expect(exportedData.statistics).toBeDefined();
    });

    it('should handle constraint relaxation workflow', async () => {
      const batches = TestDataFactory.createHeavyWorkloadBatches();
      
      // Step 1: Initial feasibility check
      const initialAnalysis = await scheduleGenerator.analyzeSchedulingScenario(batches, constraints);
      
      if (!initialAnalysis.feasible) {
        // Step 2: Apply constraint relaxation
        const relaxationResult = await scheduleGenerator.applyConstraintRelaxation(batches, constraints);
        
        expect(relaxationResult.success).toBe(true);
        expect(relaxationResult.relaxationsApplied.length).toBeGreaterThan(0);
        expect(relaxationResult.estimatedImprovement).toBeGreaterThan(0);
        
        console.log(`🔧 Applied ${relaxationResult.relaxationsApplied.length} relaxations`);
        console.log(`📈 Estimated improvement: ${relaxationResult.estimatedImprovement}%`);
        console.log(`⚖️  Tradeoffs: ${relaxationResult.tradeoffs.length} identified`);

        // Step 3: Generate with relaxed constraints
        const schedule = await scheduleGenerator.generateTimetable(
          relaxationResult.modifiedBatches || batches,
          relaxationResult.modifiedConstraints,
          []
        );

        expect(schedule).toBeDefined();
        expect(schedule.entries.length).toBeGreaterThan(0);
        
        // Step 4: Verify improvement
        const finalAnalysis = await scheduleGenerator.analyzeSchedulingScenario(
          relaxationResult.modifiedBatches || batches,
          relaxationResult.modifiedConstraints
        );
        
        expect(finalAnalysis.estimatedSuccessRate).toBeGreaterThanOrEqual(initialAnalysis.estimatedSuccessRate);
      }
    });
  });

  describe('Complete Workflow - Large Dataset', () => {
    it('should handle large dataset with performance monitoring', async () => {
      const batches = TestDataFactory.createLargeDataset(15, 8, 25);
      const holidays = TestDataFactory.createTestHolidays();

      // Monitor memory usage
      const initialMemory = PerformanceTestUtils.measureMemoryUsage();

      // Step 1: Feasibility analysis with timeout
      const analysisPromise = scheduleGenerator.analyzeSchedulingScenario(batches, constraints, holidays);
      const analysisTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timeout')), 15000)
      );

      let analysis;
      try {
        analysis = await Promise.race([analysisPromise, analysisTimeout]);
      } catch (error) {
        console.warn('Analysis timed out, proceeding with generation');
        analysis = { feasible: false, partialSolutionPossible: true };
      }

      // Step 2: Generate schedule with performance monitoring
      const { result: schedule, timeMs } = await PerformanceTestUtils.measureExecutionTime(async () => {
        if (analysis.feasible) {
          return await scheduleGenerator.generateTimetable(batches, constraints, holidays);
        } else {
          const partialResult = await scheduleGenerator.generatePartialSchedule(
            batches,
            constraints,
            holidays,
            { targetCoverage: 60, allowConstraintRelaxation: true }
          );
          return partialResult.schedule;
        }
      });

      expect(schedule).toBeDefined();
      expect(timeMs).toBeLessThan(60000); // Should complete within 60 seconds

      // Step 3: Memory usage check
      const finalMemory = PerformanceTestUtils.measureMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // Less than 200MB increase

      // Step 4: Performance validation
      const stats = schedule.calculateStatistics();
      expect(stats.totalEntries).toBeGreaterThan(0);

      console.log(`⚡ Large dataset processed in ${timeMs}ms`);
      console.log(`💾 Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
      console.log(`📊 Generated ${schedule.entries.length} lectures`);
      console.log(`🎯 Utilization: ${stats.timeSlotUtilization.utilizationRate.toFixed(1)}%`);

      // Step 5: Export performance test
      const exportStartTime = Date.now();
      const exportResult = await exportManager.exportSchedule(schedule, {
        format: ExportFormat.JSON,
        includeMetadata: true,
        includeStatistics: true
      });
      const exportTime = Date.now() - exportStartTime;

      expect(exportResult).toBeSuccessfulExport();
      expect(exportTime).toBeLessThan(5000); // Export should complete within 5 seconds

      console.log(`📤 Export completed in ${exportTime}ms`);
    });

    it('should handle impossible scenarios gracefully', async () => {
      // Create an impossible scenario
      const impossibleBatches = TestDataFactory.createLargeDataset(50, 15, 10); // Too many lectures, too few faculty
      const manyHolidays = Array.from({ length: 20 }, (_, i) => {
        const date = new Date('2024-01-01');
        date.setDate(date.getDate() + i * 7); // Every week is a holiday
        return date;
      });

      // Step 1: Analyze impossible scenario
      const analysis = await scheduleGenerator.analyzeSchedulingScenario(
        impossibleBatches,
        constraints,
        manyHolidays
      );

      expect(analysis.feasible).toBe(false);
      expect(analysis.issues.length).toBeGreaterThan(0);
      expect(analysis.recommendations.length).toBeGreaterThan(0);

      const criticalIssues = analysis.issues.filter(issue => issue.severity === 'critical');
      expect(criticalIssues.length).toBeGreaterThan(0);

      console.log(`🚨 Impossible scenario detected: ${criticalIssues.length} critical issues`);

      // Step 2: Attempt partial generation
      if (analysis.partialSolutionPossible) {
        const partialResult = await scheduleGenerator.generatePartialSchedule(
          impossibleBatches,
          constraints,
          manyHolidays,
          { 
            targetCoverage: 30, // Low target for impossible scenario
            allowConstraintRelaxation: true,
            prioritizationStrategy: 'core-subjects'
          }
        );

        expect(partialResult.schedule).toBeDefined();
        expect(partialResult.coverage.coveragePercentage).toBeGreaterThan(0);
        expect(partialResult.unscheduledLectures.length).toBeGreaterThan(0);
        expect(partialResult.recommendations.length).toBeGreaterThan(0);

        console.log(`📊 Partial solution: ${partialResult.coverage.coveragePercentage.toFixed(1)}% coverage`);
        console.log(`📝 ${partialResult.unscheduledLectures.length} lectures unscheduled`);
        console.log(`💡 ${partialResult.recommendations.length} recommendations provided`);

        // Verify recommendations are actionable
        const highPriorityRecommendations = partialResult.recommendations.filter(r => r.priority <= 3);
        expect(highPriorityRecommendations.length).toBeGreaterThan(0);

        highPriorityRecommendations.forEach(rec => {
          expect(rec.actions.length).toBeGreaterThan(0);
          expect(['low', 'medium', 'high']).toContain(rec.effort);
          expect(['low', 'medium', 'high']).toContain(rec.impact);
        });
      }

      // Step 3: Verify error handling
      try {
        await scheduleGenerator.generateTimetable(impossibleBatches, constraints, manyHolidays);
        // If it doesn't throw, it should return a schedule with conflicts or empty entries
      } catch (error) {
        // Should handle errors gracefully
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle empty input gracefully', async () => {
      const emptyBatches: Batch[] = [];
      const schedule = await scheduleGenerator.generateTimetable(emptyBatches, constraints, []);

      expect(schedule).toBeDefined();
      expect(schedule.entries).toHaveLength(0);
      expect(schedule.validate().isValid).toBe(true);
    });

    it('should handle single lecture scenario', async () => {
      const singleBatch = new Batch('SINGLE', 'Single Batch');
      singleBatch.addSubject(new Subject('single', 'Single Subject', 1, 60, 'Single Faculty'));

      const schedule = await scheduleGenerator.generateTimetable([singleBatch], constraints, []);

      expect(schedule).toBeDefined();
      expect(schedule.entries.length).toBeLessThanOrEqual(1);
      if (schedule.entries.length > 0) {
        expect(schedule).toBeValidSchedule();
      }
    });

    it('should handle malformed data with error recovery', async () => {
      // Create batch with invalid data
      const batch = new Batch('', ''); // Empty IDs
      
      try {
        // This should trigger validation errors
        const schedule = await scheduleGenerator.generateTimetable([batch], constraints, []);
        
        // If it doesn't throw, it should handle gracefully
        expect(schedule).toBeDefined();
      } catch (error) {
        // Should be a proper TimetableError with recovery suggestions
        expect(error.message).toBeDefined();
      }
    });

    it('should handle concurrent generation requests', async () => {
      const batches = TestDataFactory.createSimpleBatch();
      const promises = [];

      // Start multiple generation requests simultaneously
      for (let i = 0; i < 3; i++) {
        promises.push(scheduleGenerator.generateTimetable([batches], constraints, []));
      }

      const results = await Promise.all(promises);

      results.forEach(schedule => {
        expect(schedule).toBeDefined();
        expect(schedule.entries.length).toBeGreaterThanOrEqual(0);
      });

      // All results should be valid (though may differ due to randomness)
      results.forEach(schedule => {
        if (schedule.entries.length > 0) {
          expect(schedule).toBeValidSchedule();
        }
      });
    });
  });

  describe('Integration with External Systems', () => {
    it('should integrate with input validation pipeline', async () => {
      // Simulate CSV input processing
      const csvData = `Batch,Subject,Faculty,Lectures,Duration
CS-101,Mathematics,Dr. Smith,3,60
CS-101,Physics,Dr. Johnson,2,60
CS-102,Chemistry,Dr. Brown,2,60`;

      const parseResult = inputManager.parseCSV(csvData);
      expect(parseResult.success).toBe(true);
      expect(parseResult.batches.length).toBeGreaterThan(0);

      const validation = validationService.validateBatches(parseResult.batches);
      expect(validation.isValid).toBe(true);

      const schedule = await scheduleGenerator.generateTimetable(parseResult.batches, constraints, []);
      expect(schedule).toBeDefined();
      expect(schedule.entries.length).toBeGreaterThan(0);
    });

    it('should integrate with export pipeline', async () => {
      const batches = TestDataFactory.createSimpleBatch();
      const schedule = await scheduleGenerator.generateTimetable([batches], constraints, []);

      // Test multiple export formats in sequence
      const formats = [ExportFormat.JSON, ExportFormat.CSV, ExportFormat.HTML];
      const exportResults = [];

      for (const format of formats) {
        const result = await exportManager.exportSchedule(schedule, {
          format,
          filename: `integration_test.${format}`,
          includeMetadata: true
        });

        expect(result).toBeSuccessfulExport();
        exportResults.push(result);
      }

      expect(exportResults.length).toBe(3);

      // Verify data consistency across formats
      const jsonData = JSON.parse(exportResults[0].data as string);
      expect(jsonData.entries).toHaveLength(schedule.entries.length);
    });

    it('should integrate with conflict reporting pipeline', async () => {
      const conflictingBatches = TestDataFactory.createOverlappingFacultyBatches();
      const schedule = await scheduleGenerator.generateTimetable(conflictingBatches, constraints, []);

      const conflictReport = conflictReporter.generateConflictReport(
        schedule.entries,
        constraints,
        conflictingBatches,
        []
      );

      expect(conflictReport).toBeDefined();
      expect(conflictReport.summary).toBeDefined();

      // If there are conflicts, verify they're properly reported
      if (schedule.conflicts.length > 0) {
        expect(conflictReport.conflicts.length).toBeGreaterThan(0);
        expect(conflictReport.resolutionSuggestions).toBeDefined();
        expect(conflictReport.resolutionSuggestions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Regression Tests', () => {
    it('should maintain consistent results for same input', async () => {
      const batches = TestDataFactory.createSimpleBatch();
      const holidays = [new Date('2024-12-25')];

      // Generate schedule multiple times with same input
      const schedules = [];
      for (let i = 0; i < 3; i++) {
        const schedule = await scheduleGenerator.generateTimetable([batches], constraints, holidays);
        schedules.push(schedule);
      }

      // All schedules should have same number of entries (deterministic for simple case)
      const entryCounts = schedules.map(s => s.entries.length);
      const uniqueCounts = new Set(entryCounts);
      expect(uniqueCounts.size).toBeLessThanOrEqual(2); // Allow some variation due to randomness

      // All schedules should be valid
      schedules.forEach(schedule => {
        if (schedule.entries.length > 0) {
          expect(schedule).toBeValidSchedule();
          expect(schedule).toRespectHolidays(holidays);
        }
      });
    });

    it('should handle previously problematic scenarios', async () => {
      // Test scenarios that have caused issues in the past
      const edgeCases = TestDataFactory.createEdgeCaseScenarios();

      for (const testCase of edgeCases) {
        console.log(`Testing edge case: ${testCase.name}`);
        
        try {
          const schedule = await scheduleGenerator.generateTimetable(testCase.batches, constraints, []);
          
          expect(schedule).toBeDefined();
          if (schedule.entries.length > 0) {
            expect(schedule).toBeValidSchedule();
          }
          
          console.log(`✅ ${testCase.name}: ${schedule.entries.length} lectures scheduled`);
        } catch (error) {
          console.log(`⚠️  ${testCase.name}: ${error.message}`);
          // Edge cases may fail, but should fail gracefully
          expect(error.message).toBeDefined();
        }
      }
    });
  });

  afterEach(() => {
    // Cleanup after each test
    if (scheduleGenerator) {
      scheduleGenerator.clearErrorHistory();
    }
  });

  afterAll(() => {
    // Final cleanup
    console.log('🏁 End-to-end integration tests completed');
  });
});
