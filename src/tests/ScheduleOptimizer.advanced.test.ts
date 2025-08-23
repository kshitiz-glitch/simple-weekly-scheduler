import { ScheduleOptimizer } from '../algorithms/ScheduleOptimizer';
import { ScheduleEntry, DayOfWeek } from '../models';

describe('ScheduleOptimizer - Advanced Distribution', () => {
  let optimizer: ScheduleOptimizer;
  let sampleSchedule: ScheduleEntry[];

  beforeEach(() => {
    optimizer = new ScheduleOptimizer({
      prioritizeEvenDistribution: true,
      minimizeGaps: true,
      balanceFacultyWorkload: true,
      preferMorningSlots: false,
      maxOptimizationIterations: 50,
      improvementThreshold: 0.01
    });

    // Create a sample schedule with distribution issues
    sampleSchedule = [
      // Math lectures all on Monday (poor distribution)
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
      },
      // Physics lectures with gaps
      {
        batchId: 'batch1',
        subjectId: 'physics',
        facultyId: 'faculty2',
        timeSlot: {
          day: DayOfWeek.TUESDAY,
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
          startTime: '15:00',
          endTime: '16:00',
          isAvailable: true
        }
      }
    ];
  });

  describe('optimize', () => {
    it('should improve overall schedule score', () => {
      const originalScore = optimizer.calculateScore(sampleSchedule);
      const optimizedSchedule = optimizer.optimize(sampleSchedule);
      const optimizedScore = optimizer.calculateScore(optimizedSchedule);

      expect(optimizedScore).toBeGreaterThanOrEqual(originalScore);
      expect(optimizedSchedule).toHaveLength(sampleSchedule.length);
    });

    it('should maintain all original entries', () => {
      const optimizedSchedule = optimizer.optimize(sampleSchedule);
      
      expect(optimizedSchedule).toHaveLength(sampleSchedule.length);
      
      // Check that all subjects and batches are preserved
      const originalSubjects = new Set(sampleSchedule.map(e => `${e.batchId}_${e.subjectId}`));
      const optimizedSubjects = new Set(optimizedSchedule.map(e => `${e.batchId}_${e.subjectId}`));
      
      expect(optimizedSubjects).toEqual(originalSubjects);
    });

    it('should converge within maximum iterations', () => {
      const maxIterations = 10;
      const limitedOptimizer = new ScheduleOptimizer({
        maxOptimizationIterations: maxIterations,
        improvementThreshold: 0.001
      });

      const startTime = Date.now();
      const optimizedSchedule = limitedOptimizer.optimize(sampleSchedule);
      const endTime = Date.now();

      expect(optimizedSchedule).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle empty schedule', () => {
      const optimizedSchedule = optimizer.optimize([]);
      expect(optimizedSchedule).toEqual([]);
    });

    it('should handle single entry schedule', () => {
      const singleEntry = [sampleSchedule[0]];
      const optimizedSchedule = optimizer.optimize(singleEntry);
      
      expect(optimizedSchedule).toHaveLength(1);
      expect(optimizedSchedule[0]).toEqual(singleEntry[0]);
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate comprehensive optimization metrics', () => {
      const metrics = optimizer.calculateMetrics(sampleSchedule);

      expect(metrics.distributionScore).toBeGreaterThanOrEqual(0);
      expect(metrics.distributionScore).toBeLessThanOrEqual(1);
      expect(metrics.gapScore).toBeGreaterThanOrEqual(0);
      expect(metrics.gapScore).toBeLessThanOrEqual(1);
      expect(metrics.facultyWorkloadScore).toBeGreaterThanOrEqual(0);
      expect(metrics.facultyWorkloadScore).toBeLessThanOrEqual(1);
      expect(metrics.timePreferenceScore).toBeGreaterThanOrEqual(0);
      expect(metrics.timePreferenceScore).toBeLessThanOrEqual(1);
      expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
      expect(metrics.overallScore).toBeLessThanOrEqual(1);
    });

    it('should give perfect scores for well-distributed schedule', () => {
      const wellDistributedSchedule: ScheduleEntry[] = [
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
            day: DayOfWeek.WEDNESDAY,
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
            day: DayOfWeek.FRIDAY,
            startTime: '09:00',
            endTime: '10:00',
            isAvailable: true
          }
        }
      ];

      const metrics = optimizer.calculateMetrics(wellDistributedSchedule);
      expect(metrics.distributionScore).toBeGreaterThan(0.8);
      expect(metrics.gapScore).toBe(1.0); // No gaps possible with single lectures per day
    });

    it('should penalize poor distribution', () => {
      const poorlyDistributedSchedule: ScheduleEntry[] = [
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

      const metrics = optimizer.calculateMetrics(poorlyDistributedSchedule);
      expect(metrics.distributionScore).toBeLessThan(0.5);
    });
  });

  describe('distribution optimization', () => {
    it('should spread lectures across different days', () => {
      const mathOnlyMonday = sampleSchedule.filter(e => e.subjectId === 'math');
      expect(mathOnlyMonday.every(e => e.timeSlot.day === DayOfWeek.MONDAY)).toBe(true);

      const optimizedSchedule = optimizer.optimize(sampleSchedule);
      const optimizedMath = optimizedSchedule.filter(e => e.subjectId === 'math');
      
      // Should have better distribution (not all on Monday)
      const uniqueDays = new Set(optimizedMath.map(e => e.timeSlot.day));
      expect(uniqueDays.size).toBeGreaterThan(1);
    });

    it('should maintain lecture count per subject', () => {
      const originalMathCount = sampleSchedule.filter(e => e.subjectId === 'math').length;
      const originalPhysicsCount = sampleSchedule.filter(e => e.subjectId === 'physics').length;

      const optimizedSchedule = optimizer.optimize(sampleSchedule);
      const optimizedMathCount = optimizedSchedule.filter(e => e.subjectId === 'math').length;
      const optimizedPhysicsCount = optimizedSchedule.filter(e => e.subjectId === 'physics').length;

      expect(optimizedMathCount).toBe(originalMathCount);
      expect(optimizedPhysicsCount).toBe(originalPhysicsCount);
    });

    it('should handle subjects with single lecture', () => {
      const singleLectureSchedule: ScheduleEntry[] = [
        {
          batchId: 'batch1',
          subjectId: 'english',
          facultyId: 'faculty3',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '14:00',
            endTime: '15:00',
            isAvailable: true
          }
        }
      ];

      const optimizedSchedule = optimizer.optimize(singleLectureSchedule);
      expect(optimizedSchedule).toHaveLength(1);
      expect(optimizedSchedule[0]).toEqual(singleLectureSchedule[0]);
    });
  });

  describe('gap minimization', () => {
    it('should reduce gaps between lectures', () => {
      const scheduleWithGaps: ScheduleEntry[] = [
        {
          batchId: 'batch1',
          subjectId: 'physics',
          facultyId: 'faculty2',
          timeSlot: {
            day: DayOfWeek.TUESDAY,
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
            startTime: '15:00',
            endTime: '16:00',
            isAvailable: true
          }
        }
      ];

      const gapOptimizer = new ScheduleOptimizer({
        prioritizeEvenDistribution: false,
        minimizeGaps: true,
        balanceFacultyWorkload: false,
        preferMorningSlots: false
      });

      const originalGapScore = gapOptimizer.calculateMetrics(scheduleWithGaps).gapScore;
      const optimizedSchedule = gapOptimizer.optimize(scheduleWithGaps);
      const optimizedGapScore = gapOptimizer.calculateMetrics(optimizedSchedule).gapScore;

      expect(optimizedGapScore).toBeGreaterThanOrEqual(originalGapScore);
    });

    it('should maintain compact schedules', () => {
      const compactSchedule: ScheduleEntry[] = [
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
            startTime: '10:00',
            endTime: '11:00',
            isAvailable: true
          }
        }
      ];

      const optimizedSchedule = optimizer.optimize(compactSchedule);
      const metrics = optimizer.calculateMetrics(optimizedSchedule);
      
      expect(metrics.gapScore).toBeGreaterThan(0.8); // Should maintain compactness
    });
  });

  describe('faculty workload balancing', () => {
    it('should balance faculty workload across days', () => {
      const unbalancedSchedule: ScheduleEntry[] = [
        // Faculty1 has 3 lectures on Monday
        {
          batchId: 'batch1',
          subjectId: 'math1',
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
          subjectId: 'math2',
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
          subjectId: 'math3',
          facultyId: 'faculty1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '11:00',
            endTime: '12:00',
            isAvailable: true
          }
        }
      ];

      const workloadOptimizer = new ScheduleOptimizer({
        prioritizeEvenDistribution: false,
        minimizeGaps: false,
        balanceFacultyWorkload: true,
        preferMorningSlots: false
      });

      const originalWorkloadScore = workloadOptimizer.calculateMetrics(unbalancedSchedule).facultyWorkloadScore;
      const optimizedSchedule = workloadOptimizer.optimize(unbalancedSchedule);
      const optimizedWorkloadScore = workloadOptimizer.calculateMetrics(optimizedSchedule).facultyWorkloadScore;

      expect(optimizedWorkloadScore).toBeGreaterThanOrEqual(originalWorkloadScore);
      
      // Check that lectures are distributed across different days
      const faculty1Lectures = optimizedSchedule.filter(e => e.facultyId === 'faculty1');
      const uniqueDays = new Set(faculty1Lectures.map(e => e.timeSlot.day));
      expect(uniqueDays.size).toBeGreaterThan(1);
    });

    it('should handle single faculty member', () => {
      const singleFacultySchedule = sampleSchedule.filter(e => e.facultyId === 'faculty1');
      const optimizedSchedule = optimizer.optimize(singleFacultySchedule);
      
      expect(optimizedSchedule).toHaveLength(singleFacultySchedule.length);
      expect(optimizedSchedule.every(e => e.facultyId === 'faculty1')).toBe(true);
    });
  });

  describe('time preference optimization', () => {
    it('should prefer morning slots when enabled', () => {
      const morningOptimizer = new ScheduleOptimizer({
        prioritizeEvenDistribution: false,
        minimizeGaps: false,
        balanceFacultyWorkload: false,
        preferMorningSlots: true
      });

      const mixedTimeSchedule: ScheduleEntry[] = [
        {
          batchId: 'batch1',
          subjectId: 'math',
          facultyId: 'faculty1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '15:00',
            endTime: '16:00',
            isAvailable: true
          }
        },
        {
          batchId: 'batch1',
          subjectId: 'physics',
          facultyId: 'faculty2',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '10:00',
            isAvailable: true
          }
        }
      ];

      const optimizedSchedule = morningOptimizer.optimize(mixedTimeSchedule);
      const metrics = morningOptimizer.calculateMetrics(optimizedSchedule);
      
      expect(metrics.timePreferenceScore).toBeGreaterThan(0.5);
    });

    it('should not prioritize morning slots when disabled', () => {
      const noMorningOptimizer = new ScheduleOptimizer({
        prioritizeEvenDistribution: false,
        minimizeGaps: false,
        balanceFacultyWorkload: false,
        preferMorningSlots: false
      });

      const afternoonSchedule: ScheduleEntry[] = [
        {
          batchId: 'batch1',
          subjectId: 'math',
          facultyId: 'faculty1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '14:00',
            endTime: '15:00',
            isAvailable: true
          }
        }
      ];

      const optimizedSchedule = noMorningOptimizer.optimize(afternoonSchedule);
      expect(optimizedSchedule[0].timeSlot.startTime).toBe('14:00');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle schedule with all entries on same day', () => {
      const sameDaySchedule: ScheduleEntry[] = [
        {
          batchId: 'batch1',
          subjectId: 'math1',
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
          subjectId: 'math2',
          facultyId: 'faculty1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '10:00',
            endTime: '11:00',
            isAvailable: true
          }
        }
      ];

      const optimizedSchedule = optimizer.optimize(sameDaySchedule);
      expect(optimizedSchedule).toHaveLength(sameDaySchedule.length);
    });

    it('should handle schedule with overlapping time slots', () => {
      const overlappingSchedule: ScheduleEntry[] = [
        {
          batchId: 'batch1',
          subjectId: 'math',
          facultyId: 'faculty1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '10:30',
            isAvailable: true
          }
        },
        {
          batchId: 'batch1',
          subjectId: 'physics',
          facultyId: 'faculty2',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '10:00',
            endTime: '11:00',
            isAvailable: true
          }
        }
      ];

      expect(() => {
        optimizer.optimize(overlappingSchedule);
      }).not.toThrow();
    });

    it('should handle very large schedules efficiently', () => {
      // Create a large schedule
      const largeSchedule: ScheduleEntry[] = [];
      for (let i = 0; i < 100; i++) {
        largeSchedule.push({
          batchId: `batch${i % 10}`,
          subjectId: `subject${i % 20}`,
          facultyId: `faculty${i % 15}`,
          timeSlot: {
            day: Object.values(DayOfWeek)[i % 5],
            startTime: `${(9 + (i % 8)).toString().padStart(2, '0')}:00`,
            endTime: `${(10 + (i % 8)).toString().padStart(2, '0')}:00`,
            isAvailable: true
          }
        });
      }

      const startTime = Date.now();
      const optimizedSchedule = optimizer.optimize(largeSchedule);
      const endTime = Date.now();

      expect(optimizedSchedule).toHaveLength(largeSchedule.length);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});
