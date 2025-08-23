import { 
  ManualAdjustmentService, 
  AdjustmentType, 
  ChangeField, 
  AdjustmentPriority,
  ResolutionEffort 
} from '../services/ManualAdjustmentService';
import { ScheduleEntry, DayOfWeek, Batch, Subject } from '../models';

describe('ManualAdjustmentService', () => {
  let adjustmentService: ManualAdjustmentService;
  let sampleSchedule: ScheduleEntry[];
  let sampleBatches: Batch[];

  beforeEach(() => {
    adjustmentService = new ManualAdjustmentService();
    
    sampleSchedule = [
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
          day: DayOfWeek.TUESDAY,
          startTime: '10:00',
          endTime: '11:00',
          isAvailable: true
        }
      },
      {
        batchId: 'batch2',
        subjectId: 'chemistry',
        facultyId: 'faculty3',
        timeSlot: {
          day: DayOfWeek.WEDNESDAY,
          startTime: '11:00',
          endTime: '12:00',
          isAvailable: true
        }
      }
    ];

    // Create sample batches
    const mathSubject = new Subject('math', 'Mathematics', 3, 60, 'faculty1');
    const physicsSubject = new Subject('physics', 'Physics', 2, 60, 'faculty2');
    
    const batch1 = new Batch('batch1', 'Computer Science A');
    batch1.addSubject(mathSubject);
    batch1.addSubject(physicsSubject);

    const batch2 = new Batch('batch2', 'Computer Science B');

    sampleBatches = [batch1, batch2];
  });

  describe('createAdjustmentRequest', () => {
    it('should create a valid adjustment request', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.TIME_SLOT,
        currentValue: targetEntry.timeSlot,
        proposedValue: {
          day: DayOfWeek.TUESDAY,
          startTime: '14:00',
          endTime: '15:00',
          isAvailable: true
        }
      }];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.RESCHEDULE_LECTURE,
        'Move math lecture to Tuesday afternoon',
        targetEntry,
        proposedChanges,
        'Avoid conflict with faculty meeting',
        AdjustmentPriority.HIGH,
        'admin'
      );

      expect(request.requestId).toBeDefined();
      expect(request.type).toBe(AdjustmentType.RESCHEDULE_LECTURE);
      expect(request.description).toBe('Move math lecture to Tuesday afternoon');
      expect(request.targetEntry).toEqual(targetEntry);
      expect(request.proposedChanges).toHaveLength(1);
      expect(request.reason).toBe('Avoid conflict with faculty meeting');
      expect(request.priority).toBe(AdjustmentPriority.HIGH);
      expect(request.requestedBy).toBe('admin');
      expect(request.requestedAt).toBeInstanceOf(Date);
    });

    it('should generate unique request IDs', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.TIME_SLOT,
        currentValue: targetEntry.timeSlot,
        proposedValue: {
          day: DayOfWeek.TUESDAY,
          startTime: '14:00',
          endTime: '15:00',
          isAvailable: true
        }
      }];

      const request1 = adjustmentService.createAdjustmentRequest(
        AdjustmentType.RESCHEDULE_LECTURE,
        'First request',
        targetEntry,
        proposedChanges,
        'Test reason'
      );

      const request2 = adjustmentService.createAdjustmentRequest(
        AdjustmentType.RESCHEDULE_LECTURE,
        'Second request',
        targetEntry,
        proposedChanges,
        'Test reason'
      );

      expect(request1.requestId).not.toBe(request2.requestId);
    });

    it('should assign default values when not provided', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.FACULTY_ID,
        currentValue: 'faculty1',
        proposedValue: 'faculty2'
      }];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.CHANGE_FACULTY,
        'Change faculty assignment',
        targetEntry,
        proposedChanges,
        'Faculty unavailable'
      );

      expect(request.priority).toBe(AdjustmentPriority.MEDIUM);
      expect(request.requestedBy).toBe('system');
    });
  });

  describe('analyzeAdjustmentImpact', () => {
    it('should analyze impact of time slot changes', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.TIME_SLOT,
        currentValue: targetEntry.timeSlot,
        proposedValue: {
          day: DayOfWeek.TUESDAY,
          startTime: '10:00', // Conflicts with existing entry
          endTime: '11:00',
          isAvailable: true
        }
      }];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.RESCHEDULE_LECTURE,
        'Test reschedule',
        targetEntry,
        proposedChanges,
        'Test reason'
      );

      const analyzedRequest = adjustmentService.analyzeAdjustmentImpact(
        request,
        sampleSchedule,
        sampleBatches
      );

      const change = analyzedRequest.proposedChanges[0];
      expect(change.impact).toBeDefined();
      expect(change.impact.conflictsIntroduced).toBeGreaterThan(0);
      expect(change.impact.feasibilityScore).toBeLessThan(0.5);
      expect(change.impact.affectedEntries.length).toBeGreaterThan(0);
    });

    it('should analyze impact of faculty changes', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.FACULTY_ID,
        currentValue: 'faculty1',
        proposedValue: 'faculty2' // Faculty2 has a lecture at different time
      }];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.CHANGE_FACULTY,
        'Change faculty',
        targetEntry,
        proposedChanges,
        'Faculty conflict'
      );

      const analyzedRequest = adjustmentService.analyzeAdjustmentImpact(
        request,
        sampleSchedule,
        sampleBatches
      );

      const change = analyzedRequest.proposedChanges[0];
      expect(change.impact).toBeDefined();
      expect(change.impact.feasibilityScore).toBeGreaterThan(0);
    });

    it('should analyze impact of duration changes', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.DURATION,
        currentValue: 60,
        proposedValue: 120 // Double the duration
      }];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.MODIFY_DURATION,
        'Extend lecture duration',
        targetEntry,
        proposedChanges,
        'Need more time for topic'
      );

      const analyzedRequest = adjustmentService.analyzeAdjustmentImpact(
        request,
        sampleSchedule,
        sampleBatches
      );

      const change = analyzedRequest.proposedChanges[0];
      expect(change.impact).toBeDefined();
      expect(change.impact.feasibilityScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle multiple proposed changes', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [
        {
          field: ChangeField.TIME_SLOT,
          currentValue: targetEntry.timeSlot,
          proposedValue: {
            day: DayOfWeek.FRIDAY,
            startTime: '14:00',
            endTime: '15:00',
            isAvailable: true
          }
        },
        {
          field: ChangeField.FACULTY_ID,
          currentValue: 'faculty1',
          proposedValue: 'faculty3'
        }
      ];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.RESCHEDULE_LECTURE,
        'Multiple changes',
        targetEntry,
        proposedChanges,
        'Complex adjustment'
      );

      const analyzedRequest = adjustmentService.analyzeAdjustmentImpact(
        request,
        sampleSchedule,
        sampleBatches
      );

      expect(analyzedRequest.proposedChanges).toHaveLength(2);
      analyzedRequest.proposedChanges.forEach(change => {
        expect(change.impact).toBeDefined();
      });
    });
  });

  describe('applyAdjustment', () => {
    it('should successfully apply a valid time slot change', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.TIME_SLOT,
        currentValue: targetEntry.timeSlot,
        proposedValue: {
          day: DayOfWeek.FRIDAY,
          startTime: '14:00',
          endTime: '15:00',
          isAvailable: true
        }
      }];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.RESCHEDULE_LECTURE,
        'Move to Friday',
        targetEntry,
        proposedChanges,
        'Better scheduling'
      );

      const result = adjustmentService.applyAdjustment(request, sampleSchedule);

      expect(result.success).toBe(true);
      expect(result.appliedChanges).toHaveLength(1);
      expect(result.modifiedSchedule).toHaveLength(sampleSchedule.length);
      
      // Check that the change was applied
      const modifiedEntry = result.modifiedSchedule.find(e => 
        e.batchId === targetEntry.batchId && e.subjectId === targetEntry.subjectId
      );
      expect(modifiedEntry?.timeSlot.day).toBe(DayOfWeek.FRIDAY);
      expect(modifiedEntry?.timeSlot.startTime).toBe('14:00');
    });

    it('should successfully apply faculty changes', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.FACULTY_ID,
        currentValue: 'faculty1',
        proposedValue: 'faculty4'
      }];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.CHANGE_FACULTY,
        'Change faculty',
        targetEntry,
        proposedChanges,
        'Faculty reassignment'
      );

      const result = adjustmentService.applyAdjustment(request, sampleSchedule);

      expect(result.success).toBe(true);
      expect(result.appliedChanges).toHaveLength(1);
      
      const modifiedEntry = result.modifiedSchedule.find(e => 
        e.batchId === targetEntry.batchId && e.subjectId === targetEntry.subjectId
      );
      expect(modifiedEntry?.facultyId).toBe('faculty4');
    });

    it('should successfully apply duration changes', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.DURATION,
        currentValue: 60,
        proposedValue: 90
      }];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.MODIFY_DURATION,
        'Extend duration',
        targetEntry,
        proposedChanges,
        'Need more time'
      );

      const result = adjustmentService.applyAdjustment(request, sampleSchedule);

      expect(result.success).toBe(true);
      expect(result.appliedChanges).toHaveLength(1);
      
      const modifiedEntry = result.modifiedSchedule.find(e => 
        e.batchId === targetEntry.batchId && e.subjectId === targetEntry.subjectId
      );
      expect(modifiedEntry?.timeSlot.endTime).toBe('10:30'); // 90 minutes from 09:00
    });

    it('should handle target entry not found', () => {
      const nonExistentEntry: ScheduleEntry = {
        batchId: 'nonexistent',
        subjectId: 'nonexistent',
        facultyId: 'nonexistent',
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '09:00',
          endTime: '10:00',
          isAvailable: true
        }
      };

      const proposedChanges = [{
        field: ChangeField.TIME_SLOT,
        currentValue: nonExistentEntry.timeSlot,
        proposedValue: {
          day: DayOfWeek.TUESDAY,
          startTime: '14:00',
          endTime: '15:00',
          isAvailable: true
        }
      }];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.RESCHEDULE_LECTURE,
        'Test nonexistent',
        nonExistentEntry,
        proposedChanges,
        'Test'
      );

      const result = adjustmentService.applyAdjustment(request, sampleSchedule);

      expect(result.success).toBe(false);
      expect(result.warnings).toContain('Target entry not found in schedule');
      expect(result.modifiedSchedule).toEqual(sampleSchedule);
    });

    it('should provide warnings for conflicting changes', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.TIME_SLOT,
        currentValue: targetEntry.timeSlot,
        proposedValue: sampleSchedule[1].timeSlot // Conflicts with existing entry
      }];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.RESCHEDULE_LECTURE,
        'Create conflict',
        targetEntry,
        proposedChanges,
        'Test conflict'
      );

      const result = adjustmentService.applyAdjustment(request, sampleSchedule);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.newConflicts.length).toBeGreaterThan(0);
    });

    it('should handle unsupported change fields', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: 'unsupported_field' as any,
        currentValue: 'old_value',
        proposedValue: 'new_value'
      }];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.RESCHEDULE_LECTURE,
        'Unsupported change',
        targetEntry,
        proposedChanges,
        'Test unsupported'
      );

      const result = adjustmentService.applyAdjustment(request, sampleSchedule);

      expect(result.success).toBe(false);
      expect(result.warnings.some(w => w.includes('Unsupported change field'))).toBe(true);
    });
  });

  describe('suggestAlternativeAdjustments', () => {
    it('should suggest reschedule alternatives', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.TIME_SLOT,
        currentValue: targetEntry.timeSlot,
        proposedValue: {
          day: DayOfWeek.TUESDAY,
          startTime: '14:00',
          endTime: '15:00',
          isAvailable: true
        }
      }];

      const originalRequest = adjustmentService.createAdjustmentRequest(
        AdjustmentType.RESCHEDULE_LECTURE,
        'Original reschedule',
        targetEntry,
        proposedChanges,
        'Original reason'
      );

      const alternatives = adjustmentService.suggestAlternativeAdjustments(
        originalRequest,
        sampleSchedule
      );

      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives.length).toBeLessThanOrEqual(3);
      
      alternatives.forEach(alt => {
        expect(alt.type).toBe(AdjustmentType.RESCHEDULE_LECTURE);
        expect(alt.targetEntry).toEqual(targetEntry);
        expect(alt.requestedBy).toBe('system_suggestion');
      });
    });

    it('should suggest swap alternatives', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.TIME_SLOT,
        currentValue: targetEntry.timeSlot,
        proposedValue: sampleSchedule[1].timeSlot
      }];

      const originalRequest = adjustmentService.createAdjustmentRequest(
        AdjustmentType.SWAP_LECTURES,
        'Original swap',
        targetEntry,
        proposedChanges,
        'Original reason'
      );

      const alternatives = adjustmentService.suggestAlternativeAdjustments(
        originalRequest,
        sampleSchedule
      );

      expect(alternatives.length).toBeGreaterThan(0);
      alternatives.forEach(alt => {
        expect(alt.type).toBe(AdjustmentType.SWAP_LECTURES);
      });
    });

    it('should suggest faculty change alternatives', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.FACULTY_ID,
        currentValue: 'faculty1',
        proposedValue: 'faculty2'
      }];

      const originalRequest = adjustmentService.createAdjustmentRequest(
        AdjustmentType.CHANGE_FACULTY,
        'Original faculty change',
        targetEntry,
        proposedChanges,
        'Original reason'
      );

      const alternatives = adjustmentService.suggestAlternativeAdjustments(
        originalRequest,
        sampleSchedule
      );

      expect(alternatives.length).toBeGreaterThan(0);
      alternatives.forEach(alt => {
        expect(alt.type).toBe(AdjustmentType.CHANGE_FACULTY);
      });
    });

    it('should handle unsupported adjustment types', () => {
      const targetEntry = sampleSchedule[0];
      const originalRequest = adjustmentService.createAdjustmentRequest(
        AdjustmentType.ADD_LECTURE,
        'Add lecture',
        targetEntry,
        [],
        'Add new lecture'
      );

      const alternatives = adjustmentService.suggestAlternativeAdjustments(
        originalRequest,
        sampleSchedule
      );

      expect(alternatives).toHaveLength(0);
    });
  });

  describe('createBatchAdjustment', () => {
    it('should create adjustment requests for multiple entries', () => {
      const entries = [sampleSchedule[0], sampleSchedule[1]];
      const batchRequests = adjustmentService.createBatchAdjustment(
        entries,
        AdjustmentType.RESCHEDULE_LECTURE,
        'Batch reschedule operation'
      );

      expect(batchRequests).toHaveLength(2);
      
      batchRequests.forEach((request, index) => {
        expect(request.type).toBe(AdjustmentType.RESCHEDULE_LECTURE);
        expect(request.targetEntry).toEqual(entries[index]);
        expect(request.reason).toBe('Batch reschedule operation');
        expect(request.requestedBy).toBe('batch_operation');
        expect(request.description).toContain(`${index + 1} of 2`);
      });
    });

    it('should handle empty entries array', () => {
      const batchRequests = adjustmentService.createBatchAdjustment(
        [],
        AdjustmentType.RESCHEDULE_LECTURE,
        'Empty batch'
      );

      expect(batchRequests).toHaveLength(0);
    });
  });

  describe('rollbackAdjustment', () => {
    it('should restore original schedule', () => {
      const originalSchedule = [...sampleSchedule];
      const mockResult = {
        success: true,
        modifiedSchedule: [...sampleSchedule],
        appliedChanges: [],
        newConflicts: [],
        resolvedConflicts: [],
        warnings: [],
        recommendations: []
      };

      // Modify the mock result's schedule
      mockResult.modifiedSchedule[0].timeSlot.day = DayOfWeek.FRIDAY;

      const rolledBackSchedule = adjustmentService.rollbackAdjustment(
        originalSchedule,
        mockResult
      );

      expect(rolledBackSchedule).toEqual(originalSchedule);
      expect(rolledBackSchedule[0].timeSlot.day).toBe(DayOfWeek.MONDAY);
    });
  });

  describe('getAdjustmentStatistics', () => {
    it('should calculate statistics from adjustment results', () => {
      const mockResults = [
        {
          success: true,
          modifiedSchedule: sampleSchedule,
          appliedChanges: [{
            changeId: 'change1',
            field: ChangeField.TIME_SLOT,
            currentValue: sampleSchedule[0].timeSlot,
            proposedValue: { day: DayOfWeek.FRIDAY, startTime: '14:00', endTime: '15:00', isAvailable: true },
            impact: {
              affectedEntries: [],
              conflictsIntroduced: 0,
              conflictsResolved: 1,
              feasibilityScore: 0.8
            }
          }],
          newConflicts: [],
          resolvedConflicts: [],
          warnings: [],
          recommendations: []
        },
        {
          success: false,
          modifiedSchedule: sampleSchedule,
          appliedChanges: [],
          newConflicts: [],
          resolvedConflicts: [],
          warnings: ['Failed adjustment'],
          recommendations: []
        }
      ];

      const stats = adjustmentService.getAdjustmentStatistics(mockResults);

      expect(stats.totalAdjustments).toBe(2);
      expect(stats.successfulAdjustments).toBe(1);
      expect(stats.failedAdjustments).toBe(1);
      expect(stats.averageFeasibilityScore).toBeGreaterThan(0);
      expect(stats.impactSummary.totalEntriesModified).toBe(1);
      expect(stats.impactSummary.totalConflictsResolved).toBe(1);
    });

    it('should handle empty results array', () => {
      const stats = adjustmentService.getAdjustmentStatistics([]);

      expect(stats.totalAdjustments).toBe(0);
      expect(stats.successfulAdjustments).toBe(0);
      expect(stats.failedAdjustments).toBe(0);
      expect(stats.averageFeasibilityScore).toBe(0);
      expect(stats.impactSummary.totalEntriesModified).toBe(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle invalid time formats in duration changes', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.DURATION,
        currentValue: 60,
        proposedValue: -30 // Invalid negative duration
      }];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.MODIFY_DURATION,
        'Invalid duration',
        targetEntry,
        proposedChanges,
        'Test invalid'
      );

      expect(() => {
        adjustmentService.applyAdjustment(request, sampleSchedule);
      }).not.toThrow();
    });

    it('should handle concurrent modifications gracefully', () => {
      const targetEntry = sampleSchedule[0];
      const proposedChanges = [{
        field: ChangeField.TIME_SLOT,
        currentValue: targetEntry.timeSlot,
        proposedValue: {
          day: DayOfWeek.FRIDAY,
          startTime: '14:00',
          endTime: '15:00',
          isAvailable: true
        }
      }];

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.RESCHEDULE_LECTURE,
        'Concurrent test',
        targetEntry,
        proposedChanges,
        'Test concurrent'
      );

      // Modify the schedule before applying adjustment
      const modifiedSchedule = [...sampleSchedule];
      modifiedSchedule[0].timeSlot.day = DayOfWeek.THURSDAY;

      const result = adjustmentService.applyAdjustment(request, modifiedSchedule);
      expect(result).toBeDefined();
    });

    it('should handle very large adjustment requests', () => {
      const targetEntry = sampleSchedule[0];
      const manyChanges = [];
      
      for (let i = 0; i < 100; i++) {
        manyChanges.push({
          field: ChangeField.TIME_SLOT,
          currentValue: targetEntry.timeSlot,
          proposedValue: {
            day: DayOfWeek.FRIDAY,
            startTime: '14:00',
            endTime: '15:00',
            isAvailable: true
          }
        });
      }

      const request = adjustmentService.createAdjustmentRequest(
        AdjustmentType.RESCHEDULE_LECTURE,
        'Large request',
        targetEntry,
        manyChanges,
        'Test large'
      );

      expect(() => {
        adjustmentService.applyAdjustment(request, sampleSchedule);
      }).not.toThrow();
    });
  });
});
