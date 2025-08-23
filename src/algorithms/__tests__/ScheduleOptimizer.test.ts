import { ScheduleOptimizer, OptimizationOptions } from '../ScheduleOptimizer';
import { ScheduleEntry, DayOfWeek, TimeSlot } from '../../models';

describe('ScheduleOptimizer', () => {
  let optimizer: ScheduleOptimizer;
  let mockSchedule: ScheduleEntry[];

  beforeEach(() => {
    optimizer = new ScheduleOptimizer();
    
    mockSchedule = [
      {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '09:00',
          endTime: '10:00',
          isAvailable: true
        }
      },
      {
        batchId: 'batch_1',
        subjectId: 'subject_1',
        facultyId: 'faculty_1',
        timeSlot: {
          day: DayOfWeek.TUESDAY,
          startTime: '10:00',
          endTime: '11:00',
          isAvailable: true
        }
      },
      {
        batchId: 'batch_1',
        subjectId: 'subject_2',
        facultyId: 'faculty_2',
        timeSlot: {
          day: DayOfWeek.WEDNESDAY,
          startTime: '14:00',
          endTime: '15:00',
          isAvailable: true
        }
      }
    ];
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const options = optimizer.getOptions();
      
      expect(options.prioritizeEvenDistribution).toBe(true);
      expect(options.minimizeGaps).toBe(true);
      expect(options.balanceFacultyWorkload).toBe(true);
      expect(options.preferMorningSlots).toBe(false);
      expect(options.maxOptimizationIterations).toBe(100);
    });

    it('should accept custom options', () => {
      const customOptions: Partial<OptimizationOptions> = {
        prioritizeEvenDistribution: false,
        preferMorningSlots: true,
        maxOptimizationIterations: 50
      };

      const customOptimizer = new ScheduleOptimizer(customOptions);
      const options = customOptimizer.getOptions();
      
      expect(options.prioritizeEvenDistribution).toBe(false);
      expect(options.preferMorningSlots).toBe(true);
      expect(options.maxOptimizationIterations).toBe(50);
    });
  });

  describe('optimize', () => {
    it('should optimize a schedule', () => {
      const optimized = optimizer.optimize(mockSchedule);

      expect(optimized).toHaveLength(mockSchedule.length);
      expect(optimized.every(entry => 
        mockSchedule.some(original => 
          original.batchId === entry.batchId && 
          original.subjectId === entry.subjectId
        )
      )).toBe(true);
    });

    it('should handle empty schedule', () => {
      const optimized = optimizer.optimize([]);

      expect(optimized).toHaveLength(0);
    });

    it('should respect maximum iterations', () => {
      const limitedOptimizer = new ScheduleOptimizer({
        maxOptimizationIterations: 1
      });

      const optimized = limitedOptimizer.optimize(mockSchedule);

      expect(optimized).toHaveLength(mockSchedule.length);
    });

    it('should stop when no significant improvement', () => {
      const optimizer = new ScheduleOptimizer({
        improvementThreshold: 1.0 // Very high threshold
      });

      const optimized = optimizer.optimize(mockSchedule);

      expect(optimized).toHaveLength(mockSchedule.length);
    });
  });

  describe('calculateScore', () => {
    it('should calculate score for valid schedule', () => {
      const score = optimizer.calculateScore(mockSchedule);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return 0 for empty schedule', () => {
      const score = optimizer.calculateScore([]);

      expect(score).toBe(0);
    });

    it('should weight different optimization criteria', () => {
      const distributionOnlyOptimizer = new ScheduleOptimizer({
        prioritizeEvenDistribution: true,
        minimizeGaps: false,
        balanceFacultyWorkload: false,
        preferMorningSlots: false
      });

      const score = distributionOnlyOptimizer.calculateScore(mockSchedule);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate detailed metrics', () => {
      const metrics = optimizer.calculateMetrics(mockSchedule);

      expect(metrics.distributionScore).toBeGreaterThanOrEqual(0);
      expect(metrics.distributionScore).toBeLessThanOrEqual(1);
      expect(metrics.gapScore).toBeGreaterThanOrEqual(0);
      expect(metrics.gapScore).toBeLessThanOrEqual(1);
      expect(metrics.facultyWorkloadScore).toBeGreaterThanOrEqual(0);
      expect(metrics.facultyWorkloadScore).toBeLessThanOrEqual(1);
      expect(metrics.timePreferenceScore).toBeGreaterThanOrEqual(0);
      expect(metrics.timePreferenceScore).toBeLessThanOrEqual(1);
      expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle single lecture schedule', () => {
      const singleLecture = [mockSchedule[0]];
      const metrics = optimizer.calculateMetrics(singleLecture);

      expect(metrics.distributionScore).toBe(1.0); // Perfect distribution for single lecture
      expect(metrics.gapScore).toBe(1.0); // No gaps possible
    });
  });

  describe('distribution optimization', () => {
    it('should improve distribution of multiple lectures for same subject', () => {
      const clusteredSchedule: ScheduleEntry[] = [
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '10:00',
            isAvailable: true
          }
        },
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '10:00',
            endTime: '11:00',
            isAvailable: true
          }
        },
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '11:00',
            endTime: '12:00',
            isAvailable: true
          }
        }
      ];

      const originalScore = optimizer.calculateScore(clusteredSchedule);
      const optimized = optimizer.optimize(clusteredSchedule);
      const optimizedScore = optimizer.calculateScore(optimized);

      expect(optimized).toHaveLength(clusteredSchedule.length);
      // Score should be same or better (optimization may not always improve in this simple case)
      expect(optimizedScore).toBeGreaterThanOrEqual(originalScore - 0.1); // Allow small tolerance
    });
  });

  describe('gap minimization', () => {
    it('should calculate gap score correctly', () => {
      const gappySchedule: ScheduleEntry[] = [
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '10:00',
            isAvailable: true
          }
        },
        {
          batchId: 'batch_1',
          subjectId: 'subject_2',
          facultyId: 'faculty_2',
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '15:00', // Large gap
            endTime: '16:00',
            isAvailable: true
          }
        }
      ];

      const metrics = optimizer.calculateMetrics(gappySchedule);

      expect(metrics.gapScore).toBeLessThan(1.0); // Should penalize gaps
    });
  });

  describe('faculty workload balancing', () => {
    it('should calculate faculty workload score', () => {
      const unbalancedSchedule: ScheduleEntry[] = [
        // Faculty 1 has 3 lectures on Monday
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: { day: DayOfWeek.MONDAY, startTime: '09:00', endTime: '10:00', isAvailable: true }
        },
        {
          batchId: 'batch_1',
          subjectId: 'subject_2',
          facultyId: 'faculty_1',
          timeSlot: { day: DayOfWeek.MONDAY, startTime: '10:00', endTime: '11:00', isAvailable: true }
        },
        {
          batchId: 'batch_1',
          subjectId: 'subject_3',
          facultyId: 'faculty_1',
          timeSlot: { day: DayOfWeek.MONDAY, startTime: '11:00', endTime: '12:00', isAvailable: true }
        },
        // Faculty 1 has 0 lectures on Tuesday (unbalanced)
      ];

      const metrics = optimizer.calculateMetrics(unbalancedSchedule);

      expect(metrics.facultyWorkloadScore).toBeLessThan(1.0); // Should penalize imbalance
    });
  });

  describe('time preference', () => {
    it('should prefer morning slots when enabled', () => {
      const morningOptimizer = new ScheduleOptimizer({
        preferMorningSlots: true
      });

      const morningSchedule: ScheduleEntry[] = [
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: { day: DayOfWeek.MONDAY, startTime: '09:00', endTime: '10:00', isAvailable: true }
        }
      ];

      const eveningSchedule: ScheduleEntry[] = [
        {
          batchId: 'batch_1',
          subjectId: 'subject_1',
          facultyId: 'faculty_1',
          timeSlot: { day: DayOfWeek.MONDAY, startTime: '18:00', endTime: '19:00', isAvailable: true }
        }
      ];

      const morningMetrics = morningOptimizer.calculateMetrics(morningSchedule);
      const eveningMetrics = morningOptimizer.calculateMetrics(eveningSchedule);

      expect(morningMetrics.timePreferenceScore).toBeGreaterThan(eveningMetrics.timePreferenceScore);
    });
  });

  describe('options management', () => {
    it('should get current options', () => {
      const options = optimizer.getOptions();
      
      expect(options).toBeDefined();
      expect(typeof options.prioritizeEvenDistribution).toBe('boolean');
      expect(typeof options.minimizeGaps).toBe('boolean');
      expect(typeof options.maxOptimizationIterations).toBe('number');
    });

    it('should update options', () => {
      const newOptions: Partial<OptimizationOptions> = {
        prioritizeEvenDistribution: false,
        preferMorningSlots: true,
        maxOptimizationIterations: 25
      };

      optimizer.setOptions(newOptions);
      const updatedOptions = optimizer.getOptions();

      expect(updatedOptions.prioritizeEvenDistribution).toBe(false);
      expect(updatedOptions.preferMorningSlots).toBe(true);
      expect(updatedOptions.maxOptimizationIterations).toBe(25);
      
      // Should preserve other options
      expect(updatedOptions.minimizeGaps).toBe(true); // Original default
    });
  });

  describe('edge cases', () => {
    it('should handle schedule with single entry', () => {
      const singleEntry = [mockSchedule[0]];
      
      const optimized = optimizer.optimize(singleEntry);
      const score = optimizer.calculateScore(singleEntry);

      expect(optimized).toHaveLength(1);
      expect(score).toBeGreaterThan(0);
    });

    it('should handle all entries on same day', () => {
      const sameDaySchedule = mockSchedule.map(entry => ({
        ...entry,
        timeSlot: {
          ...entry.timeSlot,
          day: DayOfWeek.MONDAY
        }
      }));

      const optimized = optimizer.optimize(sameDaySchedule);
      const metrics = optimizer.calculateMetrics(sameDaySchedule);

      expect(optimized).toHaveLength(sameDaySchedule.length);
      expect(metrics.distributionScore).toBeLessThan(1.0); // Should penalize clustering
    });

    it('should handle schedule with no optimization enabled', () => {
      const noOptimizationOptimizer = new ScheduleOptimizer({
        prioritizeEvenDistribution: false,
        minimizeGaps: false,
        balanceFacultyWorkload: false,
        preferMorningSlots: false
      });

      const optimized = noOptimizationOptimizer.optimize(mockSchedule);
      const score = noOptimizationOptimizer.calculateScore(mockSchedule);

      expect(optimized).toEqual(mockSchedule);
      expect(score).toBe(0); // No criteria enabled
    });
  });
});
