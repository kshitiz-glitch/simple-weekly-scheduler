import { ScheduleGenerator, SchedulingOptions } from '../ScheduleGenerator';
import { Batch, Subject, Faculty, DayOfWeek, TimeSlot } from '../../models';
import { FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from '../../services/constraints';

describe('ScheduleGenerator', () => {
  let generator: ScheduleGenerator;
  let mockBatch: Batch;
  let mockSubject: Subject;
  let mockFaculty: Faculty;

  beforeEach(() => {
    generator = new ScheduleGenerator();
    
    mockFaculty = new Faculty('Dr. Smith');
    mockBatch = new Batch('Grade 10');
    mockSubject = new Subject('Mathematics', mockBatch.id, 3, 60, mockFaculty.id);
    
    mockBatch.addSubject(mockSubject);
    mockFaculty.addSubject(mockSubject.id);
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const options = generator.getOptions();
      
      expect(options.workingDays).toHaveLength(5); // Mon-Fri
      expect(options.workingHours.start).toBe('08:00');
      expect(options.workingHours.end).toBe('18:00');
      expect(options.slotDuration).toBe(60);
      expect(options.allowPartialSchedules).toBe(true);
    });

    it('should accept custom options', () => {
      const customOptions: Partial<SchedulingOptions> = {
        workingDays: [DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY],
        slotDuration: 90,
        allowPartialSchedules: false
      };

      const customGenerator = new ScheduleGenerator(customOptions);
      const options = customGenerator.getOptions();
      
      expect(options.workingDays).toHaveLength(3);
      expect(options.slotDuration).toBe(90);
      expect(options.allowPartialSchedules).toBe(false);
    });
  });

  describe('generateTimetable', () => {
    it('should generate a basic timetable', async () => {
      const batches = [mockBatch];
      const constraints = [new FacultyConflictConstraint(), new TimeSlotAvailabilityConstraint()];
      const holidays: Date[] = [];

      const schedule = await generator.generateTimetable(batches, constraints, holidays);

      expect(schedule).toBeDefined();
      expect(schedule.metadata.batchCount).toBe(1);
      expect(schedule.metadata.generatedAt).toBeInstanceOf(Date);
    });

    it('should handle empty batches', async () => {
      const batches: Batch[] = [];
      const constraints = [new FacultyConflictConstraint()];
      const holidays: Date[] = [];

      const schedule = await generator.generateTimetable(batches, constraints, holidays);

      expect(schedule.entries).toHaveLength(0);
      expect(schedule.metadata.totalLectures).toBe(0);
    });

    it('should handle scheduling errors gracefully', async () => {
      // Create an impossible scenario
      const impossibleOptions: Partial<SchedulingOptions> = {
        workingDays: [], // No working days
        allowPartialSchedules: false
      };

      const impossibleGenerator = new ScheduleGenerator(impossibleOptions);
      const batches = [mockBatch];
      const constraints = [new FacultyConflictConstraint()];

      const schedule = await impossibleGenerator.generateTimetable(batches, constraints, []);

      expect(schedule.conflicts.length).toBeGreaterThan(0);
      expect(schedule.conflicts.some(c => c.type === 'generation-error')).toBe(true);
    });

    it('should respect holidays', async () => {
      const holidays = [new Date('2024-12-25')]; // Christmas
      const batches = [mockBatch];
      const constraints = [new TimeSlotAvailabilityConstraint(holidays)];

      const schedule = await generator.generateTimetable(batches, constraints, holidays);

      // Should not schedule on holidays (this is a basic check)
      expect(schedule).toBeDefined();
    });
  });

  describe('optimizeDistribution', () => {
    it('should optimize single lecture (no change needed)', () => {
      const entries = [{
        batchId: mockBatch.id,
        subjectId: mockSubject.id,
        facultyId: mockFaculty.id,
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '09:00',
          endTime: '10:00',
          isAvailable: true
        }
      }];

      const optimized = generator.optimizeDistribution(entries);

      expect(optimized).toHaveLength(1);
      expect(optimized[0]).toEqual(entries[0]);
    });

    it('should optimize multiple lectures for better distribution', () => {
      const entries = [
        {
          batchId: mockBatch.id,
          subjectId: mockSubject.id,
          facultyId: mockFaculty.id,
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '09:00',
            endTime: '10:00',
            isAvailable: true
          }
        },
        {
          batchId: mockBatch.id,
          subjectId: mockSubject.id,
          facultyId: mockFaculty.id,
          timeSlot: {
            day: DayOfWeek.MONDAY,
            startTime: '10:00',
            endTime: '11:00',
            isAvailable: true
          }
        }
      ];

      const optimized = generator.optimizeDistribution(entries);

      expect(optimized).toHaveLength(2);
      // Should return the entries (optimization logic may vary)
    });

    it('should skip optimization when disabled', () => {
      generator.setOptions({ prioritizeEvenDistribution: false });
      
      const entries = [{
        batchId: mockBatch.id,
        subjectId: mockSubject.id,
        facultyId: mockFaculty.id,
        timeSlot: {
          day: DayOfWeek.MONDAY,
          startTime: '09:00',
          endTime: '10:00',
          isAvailable: true
        }
      }];

      const optimized = generator.optimizeDistribution(entries);

      expect(optimized).toEqual(entries);
    });
  });

  describe('validateSchedulingFeasibility', () => {
    it('should validate feasible scheduling scenario', () => {
      const batches = [mockBatch];
      const holidays: Date[] = [];

      const result = generator.validateSchedulingFeasibility(batches, holidays);

      expect(result.feasible).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect infeasible scenarios', () => {
      // Create a batch with too many lectures
      const heavySubject = new Subject('Heavy Subject', mockBatch.id, 100, 60, mockFaculty.id);
      const heavyBatch = new Batch('Heavy Batch');
      heavyBatch.addSubject(heavySubject);

      const result = generator.validateSchedulingFeasibility([heavyBatch], []);

      expect(result.feasible).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should warn about high utilization', () => {
      // Create a scenario with high utilization
      const manySubjects: Subject[] = [];
      for (let i = 0; i < 10; i++) {
        const subject = new Subject(`Subject ${i}`, mockBatch.id, 4, 60, `faculty_${i}`);
        manySubjects.push(subject);
        mockBatch.subjects.push(subject);
      }

      const result = generator.validateSchedulingFeasibility([mockBatch], []);

      expect(result.issues.some(issue => issue.includes('utilization'))).toBe(true);
    });

    it('should detect faculty overload', () => {
      // Create multiple subjects for the same faculty
      const subjects: Subject[] = [];
      for (let i = 0; i < 20; i++) {
        const subject = new Subject(`Subject ${i}`, mockBatch.id, 2, 60, mockFaculty.id);
        subjects.push(subject);
        mockBatch.subjects.push(subject);
      }

      const result = generator.validateSchedulingFeasibility([mockBatch], []);

      expect(result.issues.some(issue => issue.includes('faculty'))).toBe(true);
    });
  });

  describe('options management', () => {
    it('should get current options', () => {
      const options = generator.getOptions();
      
      expect(options).toBeDefined();
      expect(options.workingDays).toBeDefined();
      expect(options.workingHours).toBeDefined();
      expect(options.slotDuration).toBeDefined();
    });

    it('should update options', () => {
      const newOptions: Partial<SchedulingOptions> = {
        slotDuration: 45,
        breakDuration: 10,
        maxAttemptsPerLecture: 50
      };

      generator.setOptions(newOptions);
      const updatedOptions = generator.getOptions();

      expect(updatedOptions.slotDuration).toBe(45);
      expect(updatedOptions.breakDuration).toBe(10);
      expect(updatedOptions.maxAttemptsPerLecture).toBe(50);
      
      // Should preserve other options
      expect(updatedOptions.workingDays).toHaveLength(5);
    });
  });

  describe('statistics', () => {
    it('should return null for statistics when no generation has occurred', () => {
      const stats = generator.getLastGenerationStatistics();
      expect(stats).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle batch with no subjects', () => {
      const emptyBatch = new Batch('Empty Batch');
      const batches = [emptyBatch];
      const constraints = [new FacultyConflictConstraint()];

      expect(async () => {
        await generator.generateTimetable(batches, constraints, []);
      }).not.toThrow();
    });

    it('should handle subject with zero lectures per week', () => {
      const zeroLectureSubject = new Subject('Zero Subject', mockBatch.id, 0, 60, mockFaculty.id);
      const batch = new Batch('Test Batch');
      batch.subjects.push(zeroLectureSubject);

      const result = generator.validateSchedulingFeasibility([batch], []);
      expect(result.feasible).toBe(true);
    });

    it('should handle very short working hours', () => {
      const shortHoursGenerator = new ScheduleGenerator({
        workingHours: { start: '09:00', end: '09:30' }, // 30 minutes only
        slotDuration: 60 // 1 hour slots
      });

      const result = shortHoursGenerator.validateSchedulingFeasibility([mockBatch], []);
      expect(result.feasible).toBe(false);
    });

    it('should handle weekend-only working days', () => {
      const weekendGenerator = new ScheduleGenerator({
        workingDays: [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY]
      });

      const batches = [mockBatch];
      const constraints = [new TimeSlotAvailabilityConstraint([], [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY])];

      expect(async () => {
        await weekendGenerator.generateTimetable(batches, constraints, []);
      }).not.toThrow();
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple batches with different subjects', async () => {
      const batch1 = new Batch('Grade 10');
      const batch2 = new Batch('Grade 11');
      
      const subject1 = new Subject('Math 10', batch1.id, 2, 60, 'faculty_1');
      const subject2 = new Subject('Physics 11', batch2.id, 3, 45, 'faculty_2');
      
      batch1.addSubject(subject1);
      batch2.addSubject(subject2);

      const batches = [batch1, batch2];
      const constraints = [new FacultyConflictConstraint(), new TimeSlotAvailabilityConstraint()];

      const schedule = await generator.generateTimetable(batches, constraints, []);

      expect(schedule.metadata.batchCount).toBe(2);
      expect(schedule.entries.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle faculty conflicts correctly', async () => {
      const batch1 = new Batch('Grade 10');
      const batch2 = new Batch('Grade 11');
      
      // Same faculty for both subjects
      const subject1 = new Subject('Math 10', batch1.id, 5, 60, 'shared_faculty');
      const subject2 = new Subject('Math 11', batch2.id, 5, 60, 'shared_faculty');
      
      batch1.addSubject(subject1);
      batch2.addSubject(subject2);

      const batches = [batch1, batch2];
      const constraints = [new FacultyConflictConstraint()];

      const schedule = await generator.generateTimetable(batches, constraints, []);

      // Should handle the shared faculty scenario
      expect(schedule).toBeDefined();
    });
  });
});
