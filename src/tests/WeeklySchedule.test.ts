import { WeeklySchedule } from '../models/WeeklySchedule';
import { ScheduleEntry, DayOfWeek, ConstraintViolation } from '../models';

describe('WeeklySchedule', () => {
  let sampleEntries: ScheduleEntry[];
  let sampleConflicts: ConstraintViolation[];

  beforeEach(() => {
    sampleEntries = [
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

    sampleConflicts = [
      {
        type: 'faculty_conflict',
        message: 'Faculty double booking detected',
        affectedEntries: [sampleEntries[0]],
        severity: 'error'
      }
    ];
  });

  describe('constructor', () => {
    it('should create a schedule with default values', () => {
      const schedule = new WeeklySchedule();

      expect(schedule.entries).toEqual([]);
      expect(schedule.conflicts).toEqual([]);
      expect(schedule.metadata.generatedAt).toBeInstanceOf(Date);
      expect(schedule.metadata.totalLectures).toBe(0);
      expect(schedule.metadata.batchCount).toBe(0);
    });

    it('should create a schedule with provided entries and conflicts', () => {
      const schedule = new WeeklySchedule(sampleEntries, sampleConflicts);

      expect(schedule.entries).toEqual(sampleEntries);
      expect(schedule.conflicts).toEqual(sampleConflicts);
      expect(schedule.metadata.totalLectures).toBe(3);
      expect(schedule.metadata.batchCount).toBe(2);
    });

    it('should accept custom metadata', () => {
      const customMetadata = {
        optimizationScore: 0.85,
        generationTimeMs: 1500
      };

      const schedule = new WeeklySchedule(sampleEntries, [], customMetadata);

      expect(schedule.metadata.optimizationScore).toBe(0.85);
      expect(schedule.metadata.generationTimeMs).toBe(1500);
      expect(schedule.metadata.totalLectures).toBe(3);
    });
  });

  describe('getEntriesForBatch', () => {
    it('should return entries for a specific batch', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const batch1Entries = schedule.getEntriesForBatch('batch1');

      expect(batch1Entries).toHaveLength(2);
      expect(batch1Entries.every(entry => entry.batchId === 'batch1')).toBe(true);
    });

    it('should return empty array for non-existent batch', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const nonExistentEntries = schedule.getEntriesForBatch('nonexistent');

      expect(nonExistentEntries).toEqual([]);
    });
  });

  describe('getEntriesForFaculty', () => {
    it('should return entries for a specific faculty', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const faculty1Entries = schedule.getEntriesForFaculty('faculty1');

      expect(faculty1Entries).toHaveLength(1);
      expect(faculty1Entries[0].facultyId).toBe('faculty1');
    });

    it('should return empty array for non-existent faculty', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const nonExistentEntries = schedule.getEntriesForFaculty('nonexistent');

      expect(nonExistentEntries).toEqual([]);
    });
  });

  describe('getEntriesForDay', () => {
    it('should return entries for a specific day', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const mondayEntries = schedule.getEntriesForDay(DayOfWeek.MONDAY);

      expect(mondayEntries).toHaveLength(1);
      expect(mondayEntries[0].timeSlot.day).toBe(DayOfWeek.MONDAY);
    });

    it('should return empty array for day with no entries', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const sundayEntries = schedule.getEntriesForDay(DayOfWeek.SUNDAY);

      expect(sundayEntries).toEqual([]);
    });
  });

  describe('getEntriesForSubject', () => {
    it('should return entries for a specific subject', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const mathEntries = schedule.getEntriesForSubject('math');

      expect(mathEntries).toHaveLength(1);
      expect(mathEntries[0].subjectId).toBe('math');
    });
  });

  describe('getEntriesForBatchAndDay', () => {
    it('should return entries for specific batch and day', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const entries = schedule.getEntriesForBatchAndDay('batch1', DayOfWeek.MONDAY);

      expect(entries).toHaveLength(1);
      expect(entries[0].batchId).toBe('batch1');
      expect(entries[0].timeSlot.day).toBe(DayOfWeek.MONDAY);
    });

    it('should return empty array when no match', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const entries = schedule.getEntriesForBatchAndDay('batch1', DayOfWeek.SUNDAY);

      expect(entries).toEqual([]);
    });
  });

  describe('getBatchIds', () => {
    it('should return unique batch IDs', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const batchIds = schedule.getBatchIds();

      expect(batchIds).toContain('batch1');
      expect(batchIds).toContain('batch2');
      expect(batchIds).toHaveLength(2);
    });

    it('should return empty array for empty schedule', () => {
      const schedule = new WeeklySchedule();
      const batchIds = schedule.getBatchIds();

      expect(batchIds).toEqual([]);
    });
  });

  describe('getFacultyIds', () => {
    it('should return unique faculty IDs', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const facultyIds = schedule.getFacultyIds();

      expect(facultyIds).toContain('faculty1');
      expect(facultyIds).toContain('faculty2');
      expect(facultyIds).toContain('faculty3');
      expect(facultyIds).toHaveLength(3);
    });
  });

  describe('getSubjectIds', () => {
    it('should return unique subject IDs', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const subjectIds = schedule.getSubjectIds();

      expect(subjectIds).toContain('math');
      expect(subjectIds).toContain('physics');
      expect(subjectIds).toContain('chemistry');
      expect(subjectIds).toHaveLength(3);
    });
  });

  describe('isTimeSlotOccupied', () => {
    it('should return true for occupied time slot', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const isOccupied = schedule.isTimeSlotOccupied(DayOfWeek.MONDAY, '09:00');

      expect(isOccupied).toBe(true);
    });

    it('should return false for free time slot', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const isOccupied = schedule.isTimeSlotOccupied(DayOfWeek.MONDAY, '08:00');

      expect(isOccupied).toBe(false);
    });

    it('should check for specific batch when provided', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const isOccupied = schedule.isTimeSlotOccupied(DayOfWeek.MONDAY, '09:00', 'batch1');

      expect(isOccupied).toBe(true);
    });

    it('should return false for different batch', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const isOccupied = schedule.isTimeSlotOccupied(DayOfWeek.MONDAY, '09:00', 'batch2');

      expect(isOccupied).toBe(false);
    });
  });

  describe('getConflictsForBatch', () => {
    it('should return conflicts affecting a specific batch', () => {
      const schedule = new WeeklySchedule(sampleEntries, sampleConflicts);
      const conflicts = schedule.getConflictsForBatch('batch1');

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('faculty_conflict');
    });

    it('should return empty array for batch with no conflicts', () => {
      const schedule = new WeeklySchedule(sampleEntries, sampleConflicts);
      const conflicts = schedule.getConflictsForBatch('batch2');

      expect(conflicts).toEqual([]);
    });
  });

  describe('getConflictsBySeverity', () => {
    it('should return conflicts by severity', () => {
      const schedule = new WeeklySchedule(sampleEntries, sampleConflicts);
      const errorConflicts = schedule.getConflictsBySeverity('error');
      const warningConflicts = schedule.getConflictsBySeverity('warning');

      expect(errorConflicts).toHaveLength(1);
      expect(warningConflicts).toHaveLength(0);
    });
  });

  describe('calculateStatistics', () => {
    it('should calculate comprehensive statistics', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const stats = schedule.calculateStatistics();

      expect(stats.totalEntries).toBe(3);
      expect(stats.entriesPerDay).toBeInstanceOf(Map);
      expect(stats.entriesPerBatch).toBeInstanceOf(Map);
      expect(stats.entriesPerFaculty).toBeInstanceOf(Map);
      expect(stats.entriesPerSubject).toBeInstanceOf(Map);
      expect(stats.timeSlotUtilization).toBeDefined();
      expect(stats.dailyLoadDistribution).toBeDefined();
    });

    it('should calculate correct daily distribution', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const stats = schedule.calculateStatistics();

      expect(stats.entriesPerDay.get(DayOfWeek.MONDAY)).toBe(1);
      expect(stats.entriesPerDay.get(DayOfWeek.TUESDAY)).toBe(1);
      expect(stats.entriesPerDay.get(DayOfWeek.WEDNESDAY)).toBe(1);
      expect(stats.entriesPerDay.get(DayOfWeek.THURSDAY)).toBe(0);
      expect(stats.entriesPerDay.get(DayOfWeek.FRIDAY)).toBe(0);
    });

    it('should calculate correct batch distribution', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const stats = schedule.calculateStatistics();

      expect(stats.entriesPerBatch.get('batch1')).toBe(2);
      expect(stats.entriesPerBatch.get('batch2')).toBe(1);
    });
  });

  describe('addEntry', () => {
    it('should add an entry to the schedule', () => {
      const schedule = new WeeklySchedule();
      const newEntry = sampleEntries[0];

      schedule.addEntry(newEntry);

      expect(schedule.entries).toContain(newEntry);
      expect(schedule.metadata.totalLectures).toBe(1);
      expect(schedule.metadata.batchCount).toBe(1);
    });
  });

  describe('removeEntry', () => {
    it('should remove an entry from the schedule', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const entryToRemove = sampleEntries[0];

      const removed = schedule.removeEntry(entryToRemove);

      expect(removed).toBe(true);
      expect(schedule.entries).not.toContain(entryToRemove);
      expect(schedule.metadata.totalLectures).toBe(2);
    });

    it('should return false when entry not found', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const nonExistentEntry: ScheduleEntry = {
        batchId: 'nonexistent',
        subjectId: 'nonexistent',
        facultyId: 'nonexistent',
        timeSlot: {
          day: DayOfWeek.SUNDAY,
          startTime: '08:00',
          endTime: '09:00',
          isAvailable: true
        }
      };

      const removed = schedule.removeEntry(nonExistentEntry);

      expect(removed).toBe(false);
      expect(schedule.entries).toHaveLength(3);
    });
  });

  describe('updateEntry', () => {
    it('should update an existing entry', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const oldEntry = sampleEntries[0];
      const newEntry = {
        ...oldEntry,
        subjectId: 'updated_math'
      };

      const updated = schedule.updateEntry(oldEntry, newEntry);

      expect(updated).toBe(true);
      expect(schedule.entries[0].subjectId).toBe('updated_math');
    });

    it('should return false when entry not found', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const nonExistentEntry: ScheduleEntry = {
        batchId: 'nonexistent',
        subjectId: 'nonexistent',
        facultyId: 'nonexistent',
        timeSlot: {
          day: DayOfWeek.SUNDAY,
          startTime: '08:00',
          endTime: '09:00',
          isAvailable: true
        }
      };
      const newEntry = { ...nonExistentEntry, subjectId: 'updated' };

      const updated = schedule.updateEntry(nonExistentEntry, newEntry);

      expect(updated).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries and conflicts', () => {
      const schedule = new WeeklySchedule(sampleEntries, sampleConflicts);

      schedule.clear();

      expect(schedule.entries).toEqual([]);
      expect(schedule.conflicts).toEqual([]);
      expect(schedule.metadata.totalLectures).toBe(0);
      expect(schedule.metadata.batchCount).toBe(0);
    });
  });

  describe('merge', () => {
    it('should merge another schedule', () => {
      const schedule1 = new WeeklySchedule([sampleEntries[0]], [sampleConflicts[0]]);
      const schedule2 = new WeeklySchedule([sampleEntries[1]], []);

      schedule1.merge(schedule2);

      expect(schedule1.entries).toHaveLength(2);
      expect(schedule1.conflicts).toHaveLength(1);
      expect(schedule1.metadata.totalLectures).toBe(2);
    });
  });

  describe('clone', () => {
    it('should create a deep copy of the schedule', () => {
      const schedule = new WeeklySchedule(sampleEntries, sampleConflicts);
      const cloned = schedule.clone();

      expect(cloned).not.toBe(schedule);
      expect(cloned.entries).toEqual(schedule.entries);
      expect(cloned.conflicts).toEqual(schedule.conflicts);
      expect(cloned.metadata).toEqual(schedule.metadata);

      // Verify it's a deep copy
      cloned.entries.push(sampleEntries[0]);
      expect(schedule.entries).toHaveLength(3);
      expect(cloned.entries).toHaveLength(4);
    });
  });

  describe('sortEntries', () => {
    it('should sort entries by day and time', () => {
      const unsortedEntries = [
        sampleEntries[2], // Wednesday
        sampleEntries[0], // Monday
        sampleEntries[1]  // Tuesday
      ];
      const schedule = new WeeklySchedule(unsortedEntries);

      schedule.sortEntries();

      expect(schedule.entries[0].timeSlot.day).toBe(DayOfWeek.MONDAY);
      expect(schedule.entries[1].timeSlot.day).toBe(DayOfWeek.TUESDAY);
      expect(schedule.entries[2].timeSlot.day).toBe(DayOfWeek.WEDNESDAY);
    });
  });

  describe('getSummary', () => {
    it('should return schedule summary', () => {
      const schedule = new WeeklySchedule(sampleEntries, sampleConflicts);
      const summary = schedule.getSummary();

      expect(summary.totalLectures).toBe(3);
      expect(summary.totalBatches).toBe(2);
      expect(summary.totalFaculties).toBe(3);
      expect(summary.totalSubjects).toBe(3);
      expect(summary.totalConflicts).toBe(1);
      expect(summary.errorConflicts).toBe(1);
      expect(summary.warningConflicts).toBe(0);
    });
  });

  describe('validate', () => {
    it('should validate a correct schedule', () => {
      const schedule = new WeeklySchedule(sampleEntries);
      const validation = schedule.validate();

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toEqual([]);
    });

    it('should detect invalid time formats', () => {
      const invalidEntries = [{
        ...sampleEntries[0],
        timeSlot: {
          ...sampleEntries[0].timeSlot,
          startTime: 'invalid-time'
        }
      }];
      const schedule = new WeeklySchedule(invalidEntries);
      const validation = schedule.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues[0]).toContain('Invalid start time format');
    });

    it('should detect invalid time ranges', () => {
      const invalidEntries = [{
        ...sampleEntries[0],
        timeSlot: {
          ...sampleEntries[0].timeSlot,
          startTime: '10:00',
          endTime: '09:00' // End before start
        }
      }];
      const schedule = new WeeklySchedule(invalidEntries);
      const validation = schedule.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues[0]).toContain('Invalid time range');
    });

    it('should detect duplicate entries', () => {
      const duplicateEntries = [sampleEntries[0], sampleEntries[0]];
      const schedule = new WeeklySchedule(duplicateEntries);
      const validation = schedule.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues[0]).toContain('Duplicate entry found');
    });
  });

  describe('edge cases', () => {
    it('should handle empty schedule gracefully', () => {
      const schedule = new WeeklySchedule();

      expect(schedule.getBatchIds()).toEqual([]);
      expect(schedule.getFacultyIds()).toEqual([]);
      expect(schedule.getSubjectIds()).toEqual([]);
      expect(schedule.calculateStatistics().totalEntries).toBe(0);
      expect(schedule.getSummary().totalLectures).toBe(0);
    });

    it('should handle schedule with only conflicts', () => {
      const schedule = new WeeklySchedule([], sampleConflicts);

      expect(schedule.entries).toEqual([]);
      expect(schedule.conflicts).toEqual(sampleConflicts);
      expect(schedule.metadata.totalLectures).toBe(0);
    });

    it('should handle very large schedules efficiently', () => {
      const largeEntries: ScheduleEntry[] = [];
      for (let i = 0; i < 1000; i++) {
        largeEntries.push({
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
      const schedule = new WeeklySchedule(largeEntries);
      const stats = schedule.calculateStatistics();
      const endTime = Date.now();

      expect(stats.totalEntries).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
