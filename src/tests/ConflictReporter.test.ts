import { ConflictReporter, ConflictType, ConflictSeverity } from '../services/ConflictReporter';
import { ScheduleEntry, DayOfWeek, Batch, Subject } from '../models';
import { FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from '../services/constraints';

describe('ConflictReporter', () => {
  let conflictReporter: ConflictReporter;
  let sampleSchedule: ScheduleEntry[];
  let sampleBatches: Batch[];
  let constraints: any[];

  beforeEach(() => {
    conflictReporter = new ConflictReporter();
    
    // Create sample schedule with various conflicts
    sampleSchedule = [
      // Faculty double booking conflict
      {
        batchId: 'batch1',
        subjectId: 'math',
        facultyId: 'faculty1',
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '09:00',
          endTime: '10:00',
          isAvailable: true
        }
      },
      {
        batchId: 'batch2',
        subjectId: 'physics',
        facultyId: 'faculty1', // Same faculty, overlapping time
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '09:30',
          endTime: '10:30',
          isAvailable: true
        }
      },
      // Batch overload (too many lectures on same day)
      {
        batchId: 'batch1',
        subjectId: 'english',
        facultyId: 'faculty2',
        timeSlot: {
          day: DayOfWeek.TUESDAY,
          startTime: '08:00',
          endTime: '09:00',
          isAvailable: true
        }
      },
      {
        batchId: 'batch1',
        subjectId: 'chemistry',
        facultyId: 'faculty3',
        timeSlot: {
          day: DayOfWeek.TUESDAY,
          startTime: '09:00',
          endTime: '10:00',
          isAvailable: true
        }
      },
      // Excessive gap
      {
        batchId: 'batch1',
        subjectId: 'biology',
        facultyId: 'faculty4',
        timeSlot: {
          day: DayOfWeek.TUESDAY,
          startTime: '15:00',
          endTime: '16:00',
          isAvailable: true
        }
      }
    ];

    // Create sample batches
    const mathSubject = new Subject('math', 'Mathematics', 3, 60, 'faculty1');
    const physicsSubject = new Subject('physics', 'Physics', 2, 60, 'faculty1');
    const englishSubject = new Subject('english', 'English', 2, 60, 'faculty2');
    
    const batch1 = new Batch('batch1', 'Computer Science A');
    batch1.addSubject(mathSubject);
    batch1.addSubject(englishSubject);
    
    const batch2 = new Batch('batch2', 'Computer Science B');
    batch2.addSubject(physicsSubject);

    sampleBatches = [batch1, batch2];

    constraints = [
      new FacultyConflictConstraint(),
      new TimeSlotAvailabilityConstraint()
    ];
  });

  describe('generateConflictReport', () => {
    it('should detect faculty double booking conflicts', () => {
      const conflicts = conflictReporter.generateConflictReport(
        sampleSchedule,
        constraints,
        sampleBatches,
        []
      );

      const facultyConflicts = conflicts.filter(c => c.type === ConflictType.FACULTY_DOUBLE_BOOKING);
      expect(facultyConflicts.length).toBeGreaterThan(0);
      
      const conflict = facultyConflicts[0];
      expect(conflict.severity).toBe(ConflictSeverity.CRITICAL);
      expect(conflict.affectedEntries).toHaveLength(2);
      expect(conflict.metadata.facultiesAffected).toContain('faculty1');
    });

    it('should detect time slot overlaps', () => {
      const overlappingSchedule: ScheduleEntry[] = [
        {
          batchId: 'batch1',
          subjectId: 'math',
          facultyId: 'faculty1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '10:00',
            isAvailable: true
          }
        },
        {
          batchId: 'batch1', // Same batch, overlapping time
          subjectId: 'physics',
          facultyId: 'faculty2',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:30',
            endTime: '10:30',
            isAvailable: true
          }
        }
      ];

      const conflicts = conflictReporter.generateConflictReport(
        overlappingSchedule,
        constraints,
        sampleBatches,
        []
      );

      const overlapConflicts = conflicts.filter(c => c.type === ConflictType.TIME_SLOT_OVERLAP);
      expect(overlapConflicts.length).toBeGreaterThan(0);
      
      const conflict = overlapConflicts[0];
      expect(conflict.severity).toBe(ConflictSeverity.HIGH);
      expect(conflict.affectedEntries).toHaveLength(2);
    });

    it('should detect batch overloads', () => {
      // Create a schedule with many lectures on the same day for one batch
      const overloadedSchedule: ScheduleEntry[] = [];
      for (let i = 0; i < 10; i++) {
        overloadedSchedule.push({
          batchId: 'batch1',
          subjectId: `subject${i}`,
          facultyId: `faculty${i}`,
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: `${(8 + i).toString().padStart(2, '0')}:00`,
            endTime: `${(9 + i).toString().padStart(2, '0')}:00`,
            isAvailable: true
          }
        });
      }

      const conflicts = conflictReporter.generateConflictReport(
        overloadedSchedule,
        constraints,
        sampleBatches,
        []
      );

      const overloadConflicts = conflicts.filter(c => c.type === ConflictType.BATCH_OVERLOAD);
      expect(overloadConflicts.length).toBeGreaterThan(0);
      
      const conflict = overloadConflicts[0];
      expect(conflict.severity).toBe(ConflictSeverity.MEDIUM);
      expect(conflict.affectedEntries.length).toBeGreaterThan(8);
    });

    it('should detect holiday conflicts', () => {
      const holidays = [new Date('2024-01-01')]; // Monday
      
      // Mock Date.prototype.getDay to return Monday (1)
      const originalGetDay = Date.prototype.getDay;
      Date.prototype.getDay = jest.fn().mockReturnValue(1);

      const conflicts = conflictReporter.generateConflictReport(
        sampleSchedule,
        constraints,
        sampleBatches,
        holidays
      );

      const holidayConflicts = conflicts.filter(c => c.type === ConflictType.HOLIDAY_CONFLICT);
      expect(holidayConflicts.length).toBeGreaterThan(0);
      
      const conflict = holidayConflicts[0];
      expect(conflict.severity).toBe(ConflictSeverity.HIGH);
      expect(conflict.affectedEntries.length).toBeGreaterThan(0);

      // Restore original method
      Date.prototype.getDay = originalGetDay;
    });

    it('should detect distribution imbalances', () => {
      const imbalancedSchedule: ScheduleEntry[] = [
        // All math lectures on Monday (poor distribution)
        {
          batchId: 'batch1',
          subjectId: 'math',
          facultyId: 'faculty1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '10:00',
            isAvailable: true
          }
        },
        {
          batchId: 'batch1',
          subjectId: 'math',
          facultyId: 'faculty1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '10:00',
            endTime: '11:00',
            isAvailable: true
          }
        },
        {
          batchId: 'batch1',
          subjectId: 'math',
          facultyId: 'faculty1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '11:00',
            endTime: '12:00',
            isAvailable: true
          }
        }
      ];

      const conflicts = conflictReporter.generateConflictReport(
        imbalancedSchedule,
        constraints,
        sampleBatches,
        []
      );

      const distributionConflicts = conflicts.filter(c => c.type === ConflictType.DISTRIBUTION_IMBALANCE);
      expect(distributionConflicts.length).toBeGreaterThan(0);
      
      const conflict = distributionConflicts[0];
      expect(conflict.severity).toBe(ConflictSeverity.LOW);
    });

    it('should detect excessive gaps', () => {
      const gappySchedule: ScheduleEntry[] = [
        {
          batchId: 'batch1',
          subjectId: 'math',
          facultyId: 'faculty1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '10:00',
            isAvailable: true
          }
        },
        {
          batchId: 'batch1',
          subjectId: 'physics',
          facultyId: 'faculty2',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '15:00', // 5-hour gap
            endTime: '16:00',
            isAvailable: true
          }
        }
      ];

      const conflicts = conflictReporter.generateConflictReport(
        gappySchedule,
        constraints,
        sampleBatches,
        []
      );

      const gapConflicts = conflicts.filter(c => c.type === ConflictType.EXCESSIVE_GAPS);
      expect(gapConflicts.length).toBeGreaterThan(0);
      
      const conflict = gapConflicts[0];
      expect(conflict.severity).toBe(ConflictSeverity.LOW);
      expect(conflict.affectedEntries).toHaveLength(2);
    });

    it('should generate resolutions for conflicts', () => {
      const conflicts = conflictReporter.generateConflictReport(
        sampleSchedule,
        constraints,
        sampleBatches,
        []
      );

      conflicts.forEach(conflict => {
        expect(conflict.suggestedResolutions).toBeDefined();
        expect(Array.isArray(conflict.suggestedResolutions)).toBe(true);
        
        if (conflict.suggestedResolutions.length > 0) {
          const resolution = conflict.suggestedResolutions[0];
          expect(resolution.confidence).toBeGreaterThanOrEqual(0);
          expect(resolution.confidence).toBeLessThanOrEqual(1);
          expect(resolution.description).toBeDefined();
          expect(resolution.steps).toBeDefined();
          expect(resolution.impact).toBeDefined();
        }
      });
    });

    it('should handle empty schedule', () => {
      const conflicts = conflictReporter.generateConflictReport(
        [],
        constraints,
        sampleBatches,
        []
      );

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('analyzeConflicts', () => {
    it('should provide comprehensive conflict analysis', () => {
      const conflicts = conflictReporter.generateConflictReport(
        sampleSchedule,
        constraints,
        sampleBatches,
        []
      );

      const analysis = conflictReporter.analyzeConflicts(conflicts);

      expect(analysis.totalConflicts).toBe(conflicts.length);
      expect(analysis.conflictsByType).toBeInstanceOf(Map);
      expect(analysis.conflictsBySeverity).toBeInstanceOf(Map);
      expect(analysis.resolutionSummary).toBeDefined();
      expect(analysis.affectedResources).toBeDefined();
      
      expect(analysis.resolutionSummary.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(analysis.resolutionSummary.averageConfidence).toBeLessThanOrEqual(1);
    });

    it('should count conflicts by type correctly', () => {
      const conflicts = conflictReporter.generateConflictReport(
        sampleSchedule,
        constraints,
        sampleBatches,
        []
      );

      const analysis = conflictReporter.analyzeConflicts(conflicts);

      let totalByType = 0;
      analysis.conflictsByType.forEach(count => {
        totalByType += count;
      });

      expect(totalByType).toBe(analysis.totalConflicts);
    });

    it('should count conflicts by severity correctly', () => {
      const conflicts = conflictReporter.generateConflictReport(
        sampleSchedule,
        constraints,
        sampleBatches,
        []
      );

      const analysis = conflictReporter.analyzeConflicts(conflicts);

      let totalBySeverity = 0;
      analysis.conflictsBySeverity.forEach(count => {
        totalBySeverity += count;
      });

      expect(totalBySeverity).toBe(analysis.totalConflicts);
    });

    it('should track affected resources', () => {
      const conflicts = conflictReporter.generateConflictReport(
        sampleSchedule,
        constraints,
        sampleBatches,
        []
      );

      const analysis = conflictReporter.analyzeConflicts(conflicts);

      expect(analysis.affectedResources.batches.size).toBeGreaterThan(0);
      expect(analysis.affectedResources.faculties.size).toBeGreaterThan(0);
      expect(analysis.affectedResources.timeSlots.size).toBeGreaterThan(0);
    });

    it('should handle empty conflicts array', () => {
      const analysis = conflictReporter.analyzeConflicts([]);

      expect(analysis.totalConflicts).toBe(0);
      expect(analysis.conflictsByType.size).toBe(0);
      expect(analysis.conflictsBySeverity.size).toBe(0);
      expect(analysis.resolutionSummary.automaticResolutions).toBe(0);
      expect(analysis.resolutionSummary.manualInterventions).toBe(0);
      expect(analysis.resolutionSummary.averageConfidence).toBe(0);
    });
  });

  describe('applyAutomaticResolutions', () => {
    it('should apply high-confidence automatic resolutions', () => {
      const conflicts = conflictReporter.generateConflictReport(
        sampleSchedule,
        constraints,
        sampleBatches,
        []
      );

      const result = conflictReporter.applyAutomaticResolutions(
        conflicts,
        sampleSchedule,
        0.7 // High confidence threshold
      );

      expect(result.resolvedSchedule).toBeDefined();
      expect(result.appliedResolutions).toBeDefined();
      expect(result.unresolvedConflicts).toBeDefined();
      
      expect(result.resolvedSchedule.length).toBe(sampleSchedule.length);
    });

    it('should not apply low-confidence resolutions', () => {
      const conflicts = conflictReporter.generateConflictReport(
        sampleSchedule,
        constraints,
        sampleBatches,
        []
      );

      const result = conflictReporter.applyAutomaticResolutions(
        conflicts,
        sampleSchedule,
        0.95 // Very high confidence threshold
      );

      // Should have fewer applied resolutions due to high threshold
      expect(result.appliedResolutions.length).toBeLessThanOrEqual(conflicts.length);
      expect(result.unresolvedConflicts.length).toBeGreaterThanOrEqual(0);
    });

    it('should maintain schedule integrity', () => {
      const conflicts = conflictReporter.generateConflictReport(
        sampleSchedule,
        constraints,
        sampleBatches,
        []
      );

      const result = conflictReporter.applyAutomaticResolutions(
        conflicts,
        sampleSchedule,
        0.5
      );

      // Check that all subjects are still present
      const originalSubjects = new Set(sampleSchedule.map(e => `${e.batchId}_${e.subjectId}`));
      const resolvedSubjects = new Set(result.resolvedSchedule.map(e => `${e.batchId}_${e.subjectId}`));
      
      expect(resolvedSubjects).toEqual(originalSubjects);
    });

    it('should handle empty conflicts', () => {
      const result = conflictReporter.applyAutomaticResolutions(
        [],
        sampleSchedule,
        0.8
      );

      expect(result.resolvedSchedule).toEqual(sampleSchedule);
      expect(result.appliedResolutions).toHaveLength(0);
      expect(result.unresolvedConflicts).toHaveLength(0);
    });
  });

  describe('generateTextReport', () => {
    it('should generate comprehensive text report', () => {
      const conflicts = conflictReporter.generateConflictReport(
        sampleSchedule,
        constraints,
        sampleBatches,
        []
      );

      const analysis = conflictReporter.analyzeConflicts(conflicts);
      const report = conflictReporter.generateTextReport(conflicts, analysis);

      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
      
      // Check for key sections
      expect(report).toContain('TIMETABLE CONFLICT ANALYSIS REPORT');
      expect(report).toContain('SUMMARY:');
      expect(report).toContain('CONFLICTS BY TYPE:');
      expect(report).toContain('CONFLICTS BY SEVERITY:');
      expect(report).toContain('AFFECTED RESOURCES:');
      expect(report).toContain('DETAILED CONFLICTS:');
    });

    it('should include conflict statistics', () => {
      const conflicts = conflictReporter.generateConflictReport(
        sampleSchedule,
        constraints,
        sampleBatches,
        []
      );

      const analysis = conflictReporter.analyzeConflicts(conflicts);
      const report = conflictReporter.generateTextReport(conflicts, analysis);

      expect(report).toContain(`Total Conflicts: ${analysis.totalConflicts}`);
      expect(report).toContain('Automatic Resolutions Available:');
      expect(report).toContain('Manual Interventions Required:');
      expect(report).toContain('Average Resolution Confidence:');
    });

    it('should handle empty conflicts gracefully', () => {
      const analysis = conflictReporter.analyzeConflicts([]);
      const report = conflictReporter.generateTextReport([], analysis);

      expect(report).toContain('Total Conflicts: 0');
      expect(report).toContain('DETAILED CONFLICTS:');
    });

    it('should format conflicts with proper numbering', () => {
      const conflicts = conflictReporter.generateConflictReport(
        sampleSchedule,
        constraints,
        sampleBatches,
        []
      );

      const analysis = conflictReporter.analyzeConflicts(conflicts);
      const report = conflictReporter.generateTextReport(conflicts, analysis);

      if (conflicts.length > 0) {
        expect(report).toContain('1. ');
        if (conflicts.length > 1) {
          expect(report).toContain('2. ');
        }
      }
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed schedule entries', () => {
      const malformedSchedule: any[] = [
        {
          batchId: 'batch1',
          subjectId: 'math',
          // Missing facultyId
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '10:00',
            isAvailable: true
          }
        }
      ];

      expect(() => {
        conflictReporter.generateConflictReport(
          malformedSchedule,
          constraints,
          sampleBatches,
          []
        );
      }).not.toThrow();
    });

    it('should handle invalid time formats', () => {
      const invalidTimeSchedule: ScheduleEntry[] = [
        {
          batchId: 'batch1',
          subjectId: 'math',
          facultyId: 'faculty1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: 'invalid-time',
            endTime: '10:00',
            isAvailable: true
          }
        }
      ];

      expect(() => {
        conflictReporter.generateConflictReport(
          invalidTimeSchedule,
          constraints,
          sampleBatches,
          []
        );
      }).not.toThrow();
    });

    it('should handle null or undefined inputs', () => {
      expect(() => {
        conflictReporter.generateConflictReport(
          sampleSchedule,
          [],
          [],
          []
        );
      }).not.toThrow();
    });

    it('should handle very large schedules efficiently', () => {
      // Create a large schedule
      const largeSchedule: ScheduleEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        largeSchedule.push({
          batchId: `batch${i % 10}`,
          subjectId: `subject${i % 50}`,
          facultyId: `faculty${i % 20}`,
          timeSlot: {
            day: Object.values(DayOfWeek)[i % 5],
            startTime: `${(9 + (i % 8)).toString().padStart(2, '0')}:00`,
            endTime: `${(10 + (i % 8)).toString().padStart(2, '0')}:00`,
            isAvailable: true
          }
        });
      }

      const startTime = Date.now();
      const conflicts = conflictReporter.generateConflictReport(
        largeSchedule,
        constraints,
        sampleBatches,
        []
      );
      const endTime = Date.now();

      expect(conflicts).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
