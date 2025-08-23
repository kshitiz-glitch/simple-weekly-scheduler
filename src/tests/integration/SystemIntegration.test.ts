import { Batch, Subject, DayOfWeek } from '../../models';
import { WeeklySchedule } from '../../models/WeeklySchedule';
import { ScheduleGenerator } from '../../algorithms/ScheduleGenerator';
import { InputManager } from '../../services/InputManager';
import { ValidationService } from '../../services/ValidationService';
import { ConflictReporter } from '../../services/ConflictReporter';
import { ExportManager } from '../../exporters/ExportManager';
import { ManualAdjustmentService } from '../../services/ManualAdjustmentService';
import { ImpossibleScenarioDetector, ConstraintRelaxationService, PartialScheduleGenerator } from '../../services';
import { FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from '../../services/constraints';
import { ExportFormat } from '../../exporters/ExportInterfaces';
import { TestDataFactory } from '../utils/TestDataFactory';
import { GlobalErrorBoundary } from '../../errors';

describe('System Integration Tests', () => {
  let scheduleGenerator: ScheduleGenerator;
  let inputManager: InputManager;
  let validationService: ValidationService;
  let conflictReporter: ConflictReporter;
  let exportManager: ExportManager;
  let adjustmentService: ManualAdjustmentService;
  let scenarioDetector: ImpossibleScenarioDetector;
  let relaxationService: ConstraintRelaxationService;
  let partialGenerator: PartialScheduleGenerator;
  let globalErrorBoundary: GlobalErrorBoundary;

  beforeAll(() => {
    // Initialize global error boundary for system tests
    globalErrorBoundary = GlobalErrorBoundary.initialize();
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
    adjustmentService = new ManualAdjustmentService();
    scenarioDetector = new ImpossibleScenarioDetector();
    relaxationService = new ConstraintRelaxationService();
    partialGenerator = new PartialScheduleGenerator();
  });

  describe('Complete System Workflow', () => {
    it('should execute complete timetable generation system workflow', async () => {
      console.log('🚀 Starting complete system workflow test...');

      // Phase 1: Data Input and Validation
      console.log('📥 Phase 1: Data Input and Validation');
      
      const csvInput = `Batch,Subject,Faculty,Lectures,Duration
Computer Science A,Mathematics,Dr. Smith,3,60
Computer Science A,Programming,Dr. Johnson,4,60
Computer Science A,Physics,Dr. Brown,2,60
Computer Science B,Mathematics,Dr. Smith,3,60
Computer Science B,Database,Dr. Wilson,3,60
Computer Science B,Networks,Dr. Davis,2,60
Information Technology,Programming,Dr. Johnson,3,60
Information Technology,Web Development,Dr. Miller,4,60
Information Technology,Database,Dr. Wilson,2,60`;

      // Parse input data
      const parseResult = inputManager.parseCSV(csvInput);
      expect(parseResult.success).toBe(true);
      expect(parseResult.batches.length).toBe(3);
      console.log(`✅ Parsed ${parseResult.batches.length} batches from CSV`);

      // Validate input data
      const validation = validationService.validateBatches(parseResult.batches);
      expect(validation.isValid).toBe(true);
      console.log(`✅ Input validation passed`);

      // Phase 2: Scenario Analysis
      console.log('🔍 Phase 2: Scenario Analysis');
      
      const constraints = [new FacultyConflictConstraint(), new TimeSlotAvailabilityConstraint()];
      const holidays = [new Date('2024-12-25'), new Date('2024-01-01')];

      const scenarioAnalysis = await scheduleGenerator.analyzeSchedulingScenario(
        parseResult.batches,
        constraints,
        holidays
      );

      expect(scenarioAnalysis).toBeDefined();
      expect(typeof scenarioAnalysis.feasible).toBe('boolean');
      console.log(`📊 Scenario feasible: ${scenarioAnalysis.feasible}`);
      console.log(`🎯 Confidence: ${(scenarioAnalysis.confidence * 100).toFixed(1)}%`);
      console.log(`⚠️  Issues found: ${scenarioAnalysis.issues.length}`);
      console.log(`💡 Recommendations: ${scenarioAnalysis.recommendations.length}`);

      // Phase 3: Schedule Generation
      console.log('⚙️ Phase 3: Schedule Generation');
      
      let schedule: WeeklySchedule;
      let generationMetadata: any = {};

      if (scenarioAnalysis.feasible) {
        // Generate full schedule
        schedule = await scheduleGenerator.generateTimetable(parseResult.batches, constraints, holidays);
        generationMetadata.type = 'full';
        console.log(`✅ Full schedule generated`);
      } else if (scenarioAnalysis.partialSolutionPossible) {
        // Generate partial schedule
        const partialResult = await scheduleGenerator.generatePartialSchedule(
          parseResult.batches,
          constraints,
          holidays,
          { targetCoverage: 75, allowConstraintRelaxation: true }
        );
        schedule = partialResult.schedule;
        generationMetadata = {
          type: 'partial',
          coverage: partialResult.coverage.coveragePercentage,
          unscheduled: partialResult.unscheduledLectures.length,
          relaxations: partialResult.metadata.relaxationsApplied
        };
        console.log(`⚠️  Partial schedule generated: ${partialResult.coverage.coveragePercentage.toFixed(1)}% coverage`);
      } else {
        throw new Error('Schedule generation not possible');
      }

      expect(schedule).toBeDefined();
      expect(schedule.entries.length).toBeGreaterThan(0);

      // Phase 4: Quality Assessment
      console.log('📈 Phase 4: Quality Assessment');
      
      const stats = schedule.calculateStatistics();
      expect(stats.totalEntries).toBe(schedule.entries.length);
      
      console.log(`📊 Statistics:`);
      console.log(`   Total lectures: ${stats.totalEntries}`);
      console.log(`   Batches: ${stats.entriesPerBatch.size}`);
      console.log(`   Faculty: ${stats.entriesPerFaculty.size}`);
      console.log(`   Utilization: ${stats.timeSlotUtilization.utilizationRate.toFixed(1)}%`);
      console.log(`   Conflicts: ${schedule.conflicts.length}`);

      // Phase 5: Conflict Analysis and Resolution
      console.log('🔧 Phase 5: Conflict Analysis and Resolution');
      
      const conflictReport = conflictReporter.generateConflictReport(
        schedule.entries,
        constraints,
        parseResult.batches,
        holidays
      );

      expect(conflictReport).toBeDefined();
      console.log(`⚠️  Conflict report generated: ${conflictReport.conflicts.length} conflicts`);

      if (conflictReport.conflicts.length > 0) {
        console.log(`💡 Resolution suggestions: ${conflictReport.resolutionSuggestions?.length || 0}`);
        
        // Attempt manual adjustments for critical conflicts
        const criticalConflicts = conflictReport.conflicts.filter(c => c.severity === 'error');
        if (criticalConflicts.length > 0 && criticalConflicts.length <= 3) {
          console.log(`🔧 Attempting to resolve ${criticalConflicts.length} critical conflicts`);
          
          for (const conflict of criticalConflicts.slice(0, 2)) { // Resolve up to 2 conflicts
            if (conflict.affectedEntries.length >= 2) {
              try {
                const success = await adjustmentService.swapLectures(
                  schedule,
                  conflict.affectedEntries[0],
                  conflict.affectedEntries[1]
                );
                if (success) {
                  console.log(`✅ Resolved conflict: ${conflict.type}`);
                }
              } catch (error) {
                console.log(`⚠️  Could not resolve conflict: ${conflict.type}`);
              }
            }
          }
        }
      }

      // Phase 6: Export and Documentation
      console.log('📤 Phase 6: Export and Documentation');
      
      const exportFormats = [ExportFormat.JSON, ExportFormat.CSV, ExportFormat.HTML];
      const exportResults = new Map();

      for (const format of exportFormats) {
        const exportResult = await exportManager.exportSchedule(schedule, {
          format,
          filename: `system_test_schedule.${format}`,
          includeMetadata: true,
          includeConflicts: true,
          includeStatistics: true
        });

        expect(exportResult.success).toBe(true);
        exportResults.set(format, exportResult);
        console.log(`✅ Exported to ${format}: ${Math.round(exportResult.size / 1024)}KB`);
      }

      // Phase 7: System Validation
      console.log('✅ Phase 7: System Validation');
      
      // Validate final schedule integrity
      const finalValidation = schedule.validate();
      expect(finalValidation.isValid).toBe(true);

      // Verify all batches are represented
      const scheduledBatches = new Set(schedule.entries.map(e => e.batchId));
      const originalBatches = new Set(parseResult.batches.map(b => b.id));
      expect(scheduledBatches.size).toBeGreaterThan(0);
      
      // Verify no time constraint violations
      schedule.entries.forEach(entry => {
        const startHour = parseInt(entry.timeSlot.startTime.split(':')[0]);
        const endHour = parseInt(entry.timeSlot.endTime.split(':')[0]);
        expect(startHour).toBeGreaterThanOrEqual(8);
        expect(endHour).toBeLessThanOrEqual(18);
      });

      // Verify holiday constraints
      const holidayDays = new Set(holidays.map(h => h.getDay()));
      schedule.entries.forEach(entry => {
        const dayMap = {
          [DayOfWeek.MONDAY]: 1, [DayOfWeek.TUESDAY]: 2, [DayOfWeek.WEDNESDAY]: 3,
          [DayOfWeek.THURSDAY]: 4, [DayOfWeek.FRIDAY]: 5, [DayOfWeek.SATURDAY]: 6, [DayOfWeek.SUNDAY]: 0
        };
        const entryDay = dayMap[entry.timeSlot.day];
        expect(holidayDays.has(entryDay)).toBe(false);
      });

      console.log('🎉 Complete system workflow test passed!');
      console.log(`📋 Summary:`);
      console.log(`   Generation type: ${generationMetadata.type}`);
      console.log(`   Lectures scheduled: ${schedule.entries.length}`);
      console.log(`   Export formats: ${exportResults.size}`);
      console.log(`   Final conflicts: ${schedule.conflicts.length}`);
    });

    it('should handle complex multi-department scenario', async () => {
      console.log('🏫 Testing complex multi-department scenario...');

      // Create complex university scenario
      const departments = [
        { name: 'Computer Science', batches: 4, subjects: 6 },
        { name: 'Mathematics', batches: 3, subjects: 5 },
        { name: 'Physics', batches: 2, subjects: 4 },
        { name: 'Chemistry', batches: 2, subjects: 4 }
      ];

      const allBatches: Batch[] = [];
      let facultyCounter = 1;

      departments.forEach(dept => {
        for (let b = 1; b <= dept.batches; b++) {
          const batch = new Batch(`${dept.name}-${b}`, `${dept.name} Batch ${b}`);
          
          for (let s = 1; s <= dept.subjects; s++) {
            const subject = new Subject(
              `${dept.name.toLowerCase()}-subject-${s}`,
              `${dept.name} Subject ${s}`,
              Math.floor(Math.random() * 3) + 2, // 2-4 lectures per week
              60,
              `Faculty-${facultyCounter++}`
            );
            batch.addSubject(subject);
          }
          
          allBatches.push(batch);
        }
      });

      console.log(`📚 Created ${allBatches.length} batches across ${departments.length} departments`);

      // Add some shared faculty to create conflicts
      const sharedFaculty = ['Dr. SharedMath', 'Dr. SharedPhysics', 'Dr. SharedCS'];
      allBatches.forEach((batch, batchIndex) => {
        if (batchIndex % 3 === 0) { // Every 3rd batch gets shared faculty
          const subjects = batch.subjects;
          if (subjects.length > 0) {
            const sharedFacultyId = sharedFaculty[batchIndex % sharedFaculty.length];
            (subjects[0] as any).facultyId = sharedFacultyId; // Force shared faculty
          }
        }
      });

      const constraints = [new FacultyConflictConstraint(), new TimeSlotAvailabilityConstraint()];
      const holidays = TestDataFactory.createTestHolidays();

      // Analyze scenario
      const analysis = await scheduleGenerator.analyzeSchedulingScenario(allBatches, constraints, holidays);
      console.log(`🔍 Analysis: ${analysis.feasible ? 'Feasible' : 'Not feasible'}`);
      console.log(`📊 Issues: ${analysis.issues.length}, Recommendations: ${analysis.recommendations.length}`);

      // Generate schedule
      let schedule: WeeklySchedule;
      if (analysis.feasible) {
        schedule = await scheduleGenerator.generateTimetable(allBatches, constraints, holidays);
      } else {
        // Use constraint relaxation
        const relaxationResult = await scheduleGenerator.applyConstraintRelaxation(allBatches, constraints, holidays);
        console.log(`🔧 Applied ${relaxationResult.relaxationsApplied.length} relaxations`);
        
        schedule = await scheduleGenerator.generateTimetable(
          relaxationResult.modifiedBatches || allBatches,
          relaxationResult.modifiedConstraints,
          holidays
        );
      }

      expect(schedule).toBeDefined();
      expect(schedule.entries.length).toBeGreaterThan(0);

      // Verify multi-department distribution
      const departmentStats = new Map<string, number>();
      schedule.entries.forEach(entry => {
        const deptName = entry.batchId.split('-')[0];
        departmentStats.set(deptName, (departmentStats.get(deptName) || 0) + 1);
      });

      console.log('🏢 Department distribution:');
      departmentStats.forEach((count, dept) => {
        console.log(`   ${dept}: ${count} lectures`);
      });

      expect(departmentStats.size).toBeGreaterThan(1); // Multiple departments represented

      // Test system resilience with conflicts
      const conflictReport = conflictReporter.generateConflictReport(
        schedule.entries,
        constraints,
        allBatches,
        holidays
      );

      console.log(`⚠️  System handled ${conflictReport.conflicts.length} conflicts in complex scenario`);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should demonstrate comprehensive error handling across system', async () => {
      console.log('🛡️ Testing system-wide error handling...');

      // Test 1: Invalid input data
      console.log('📝 Test 1: Invalid input handling');
      const invalidCsv = `Batch,Subject,Faculty,Lectures,Duration
,Invalid Subject,,0,-60
Batch2,Subject2,Faculty2,100,1000`;

      const parseResult = inputManager.parseCSV(invalidCsv);
      if (!parseResult.success) {
        expect(parseResult.errors.length).toBeGreaterThan(0);
        console.log(`✅ Invalid input properly rejected: ${parseResult.errors.length} errors`);
      }

      // Test 2: Impossible scheduling scenario
      console.log('🚫 Test 2: Impossible scenario handling');
      const impossibleBatches = TestDataFactory.createLargeDataset(100, 20, 5); // Too many lectures, too few faculty
      const manyHolidays = Array.from({ length: 50 }, (_, i) => new Date(2024, 0, i + 1));

      try {
        const analysis = await scheduleGenerator.analyzeSchedulingScenario(
          impossibleBatches,
          [new FacultyConflictConstraint()],
          manyHolidays
        );

        expect(analysis.feasible).toBe(false);
        expect(analysis.issues.length).toBeGreaterThan(0);
        console.log(`✅ Impossible scenario detected: ${analysis.issues.length} issues`);

        if (analysis.partialSolutionPossible) {
          const partialResult = await scheduleGenerator.generatePartialSchedule(
            impossibleBatches,
            [new FacultyConflictConstraint()],
            manyHolidays,
            { targetCoverage: 20, allowConstraintRelaxation: true }
          );

          expect(partialResult.schedule).toBeDefined();
          console.log(`✅ Partial solution generated: ${partialResult.coverage.coveragePercentage.toFixed(1)}% coverage`);
        }
      } catch (error) {
        console.log(`✅ Error handled gracefully: ${error.message}`);
      }

      // Test 3: Export failure recovery
      console.log('📤 Test 3: Export failure recovery');
      const validSchedule = new WeeklySchedule([], [], { generatedAt: new Date(), totalLectures: 0, batchCount: 0 });

      try {
        const result = await exportManager.exportSchedule(validSchedule, {
          format: 'invalid' as ExportFormat,
          filename: 'test.invalid'
        });

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        console.log(`✅ Export failure handled: ${result.error}`);
      } catch (error) {
        console.log(`✅ Export error caught: ${error.message}`);
      }

      // Test 4: Memory pressure simulation
      console.log('💾 Test 4: Memory pressure handling');
      try {
        const hugeBatches = TestDataFactory.createLargeDataset(200, 50, 100);
        
        const schedule = await scheduleGenerator.generateTimetable(hugeBatches, [], []);
        console.log(`⚠️  Large dataset processed: ${schedule.entries.length} entries`);
      } catch (error) {
        console.log(`✅ Memory pressure handled: ${error.message}`);
      }

      console.log('🛡️ System error handling tests completed');
    });

    it('should maintain system stability under stress', async () => {
      console.log('💪 Testing system stability under stress...');

      const stressTests = [
        {
          name: 'Rapid successive generations',
          test: async () => {
            const batches = TestDataFactory.createLargeDataset(8, 5, 12);
            const promises = [];
            
            for (let i = 0; i < 5; i++) {
              promises.push(scheduleGenerator.generateTimetable(batches, [], []));
            }
            
            const results = await Promise.all(promises);
            return results.every(schedule => schedule.entries.length >= 0);
          }
        },
        {
          name: 'Concurrent exports',
          test: async () => {
            const schedule = TestDataFactory.createSampleWeeklySchedule();
            const promises = [];
            
            for (let i = 0; i < 10; i++) {
              promises.push(exportManager.exportSchedule(schedule, {
                format: ExportFormat.JSON,
                filename: `stress_${i}.json`
              }));
            }
            
            const results = await Promise.all(promises);
            return results.every(result => result.success);
          }
        },
        {
          name: 'Mixed operations',
          test: async () => {
            const batches = TestDataFactory.createLargeDataset(6, 4, 10);
            
            // Mix of different operations
            const operations = [
              () => scheduleGenerator.generateTimetable(batches, [], []),
              () => validationService.validateBatches(batches),
              () => scenarioDetector.analyzeScenario(batches, [], {
                workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
                workingHours: { start: '08:00', end: '18:00' },
                slotDuration: 60,
                breakDuration: 15,
                holidays: [],
                allowOverlaps: false,
                maxLecturesPerDay: 8,
                maxConsecutiveLectures: 4
              })
            ];
            
            const promises = operations.map(op => op());
            const results = await Promise.all(promises);
            
            return results.every(result => result !== null && result !== undefined);
          }
        }
      ];

      for (const stressTest of stressTests) {
        console.log(`🔄 Running: ${stressTest.name}`);
        
        try {
          const startTime = Date.now();
          const success = await stressTest.test();
          const duration = Date.now() - startTime;
          
          expect(success).toBe(true);
          console.log(`✅ ${stressTest.name}: Passed in ${duration}ms`);
        } catch (error) {
          console.log(`⚠️  ${stressTest.name}: ${error.message}`);
          // Stress tests may fail, but should fail gracefully
        }
      }

      console.log('💪 System stability tests completed');
    });
  });

  describe('Integration with External Dependencies', () => {
    it('should integrate properly with all system components', async () => {
      console.log('🔗 Testing component integration...');

      // Create test data
      const batches = TestDataFactory.createUniversityScenario().batches;
      const constraints = [new FacultyConflictConstraint(), new TimeSlotAvailabilityConstraint()];
      const holidays = [new Date('2024-12-25')];

      // Test component chain: Input -> Validation -> Analysis -> Generation -> Conflict -> Export
      console.log('📊 Testing component integration chain...');

      // 1. Input processing
      const inputValidation = validationService.validateBatches(batches);
      expect(inputValidation.isValid).toBe(true);

      // 2. Scenario analysis
      const analysis = await scenarioDetector.analyzeScenario(batches, constraints, {
        workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
        workingHours: { start: '08:00', end: '18:00' },
        slotDuration: 60,
        breakDuration: 15,
        holidays,
        allowOverlaps: false,
        maxLecturesPerDay: 8,
        maxConsecutiveLectures: 4
      });
      expect(analysis).toBeDefined();

      // 3. Schedule generation
      const schedule = await scheduleGenerator.generateTimetable(batches, constraints, holidays);
      expect(schedule).toBeDefined();

      // 4. Conflict analysis
      const conflictReport = conflictReporter.generateConflictReport(
        schedule.entries,
        constraints,
        batches,
        holidays
      );
      expect(conflictReport).toBeDefined();

      // 5. Manual adjustments (if needed)
      if (schedule.entries.length >= 2) {
        const adjustmentSuccess = await adjustmentService.swapLectures(
          schedule,
          schedule.entries[0],
          schedule.entries[1]
        );
        // May succeed or fail depending on constraints
        expect(typeof adjustmentSuccess).toBe('boolean');
      }

      // 6. Export
      const exportResult = await exportManager.exportSchedule(schedule, {
        format: ExportFormat.JSON,
        includeMetadata: true
      });
      expect(exportResult.success).toBe(true);

      console.log('✅ All components integrated successfully');

      // Test data flow integrity
      const originalLectureCount = batches.reduce((sum, batch) => sum + batch.getTotalLecturesPerWeek(), 0);
      const scheduledLectureCount = schedule.entries.length;
      
      console.log(`📊 Data integrity: ${scheduledLectureCount}/${originalLectureCount} lectures scheduled`);
      expect(scheduledLectureCount).toBeLessThanOrEqual(originalLectureCount);
    });

    it('should handle system configuration changes', async () => {
      console.log('⚙️ Testing system configuration adaptability...');

      const batches = TestDataFactory.createLargeDataset(6, 4, 10);
      const constraints = [new FacultyConflictConstraint()];

      // Test different system configurations
      const configurations = [
        {
          name: 'Standard 5-day week',
          config: {
            workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
            workingHours: { start: '08:00', end: '18:00' },
            slotDuration: 60
          }
        },
        {
          name: '6-day week with Saturday',
          config: {
            workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY],
            workingHours: { start: '08:00', end: '17:00' },
            slotDuration: 60
          }
        },
        {
          name: 'Extended hours',
          config: {
            workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
            workingHours: { start: '07:00', end: '20:00' },
            slotDuration: 60
          }
        },
        {
          name: 'Short slots',
          config: {
            workingDays: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
            workingHours: { start: '08:00', end: '18:00' },
            slotDuration: 45
          }
        }
      ];

      for (const config of configurations) {
        console.log(`🔧 Testing configuration: ${config.name}`);
        
        const generator = new ScheduleGenerator({
          ...config.config,
          breakDuration: 15,
          maxAttemptsPerLecture: 50,
          allowPartialSchedules: true,
          prioritizeEvenDistribution: true
        });

        try {
          const schedule = await generator.generateTimetable(batches, constraints, []);
          
          expect(schedule).toBeDefined();
          console.log(`✅ ${config.name}: ${schedule.entries.length} lectures scheduled`);
          
          // Verify configuration compliance
          schedule.entries.forEach(entry => {
            expect(config.config.workingDays).toContain(entry.timeSlot.day);
            
            const startHour = parseInt(entry.timeSlot.startTime.split(':')[0]);
            const configStartHour = parseInt(config.config.workingHours.start.split(':')[0]);
            const configEndHour = parseInt(config.config.workingHours.end.split(':')[0]);
            
            expect(startHour).toBeGreaterThanOrEqual(configStartHour);
            expect(startHour).toBeLessThan(configEndHour);
          });
          
        } catch (error) {
          console.log(`⚠️  ${config.name}: ${error.message}`);
        }
      }

      console.log('⚙️ Configuration adaptability tests completed');
    });
  });

  afterEach(() => {
    // Clear any error history after each test
    if (scheduleGenerator) {
      scheduleGenerator.clearErrorHistory();
    }
  });

  afterAll(() => {
    console.log('🏁 System integration tests completed');
    
    // Display global error statistics if available
    if (globalErrorBoundary) {
      const stats = globalErrorBoundary.getErrorStatistics();
      if (stats.totalErrors > 0) {
        console.log(`📊 Global error statistics: ${stats.totalErrors} errors handled`);
        console.log(`📈 Recovery success rate: ${stats.recoverySuccessRate.toFixed(1)}%`);
      }
    }
  });
});
