import { InputManager } from '../InputManager';
import { Batch, Faculty } from '../../models';
import * as readlineSync from 'readline-sync';

// Mock readline-sync
jest.mock('readline-sync');
const mockReadlineSync = readlineSync as jest.Mocked<typeof readlineSync>;

describe('InputManager', () => {
  let inputManager: InputManager;

  beforeEach(() => {
    inputManager = new InputManager();
    jest.clearAllMocks();
    
    // Mock console.log to avoid cluttering test output
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('collectBatchInfo', () => {
    it('should collect batch information successfully', async () => {
      mockReadlineSync.question
        .mockReturnValueOnce('2') // batch count
        .mockReturnValueOnce('Grade 10') // first batch name
        .mockReturnValueOnce('Grade 11'); // second batch name

      const batches = await inputManager.collectBatchInfo();

      expect(batches).toHaveLength(2);
      expect(batches[0].name).toBe('Grade 10');
      expect(batches[1].name).toBe('Grade 11');
    });

    it('should handle invalid batch count and retry', async () => {
      mockReadlineSync.question
        .mockReturnValueOnce('invalid') // invalid count
        .mockReturnValueOnce('0') // zero count
        .mockReturnValueOnce('2') // valid count
        .mockReturnValueOnce('Grade 10')
        .mockReturnValueOnce('Grade 11');

      const batches = await inputManager.collectBatchInfo();

      expect(batches).toHaveLength(2);
    });

    it('should warn for large batch count', async () => {
      mockReadlineSync.question
        .mockReturnValueOnce('25') // large count
        .mockReturnValueOnce('Grade 10');
      
      mockReadlineSync.keyInYNStrict
        .mockReturnValueOnce(false) // reject large count
        .mockReturnValueOnce(true); // accept on retry
      
      mockReadlineSync.question
        .mockReturnValueOnce('1') // smaller count
        .mockReturnValueOnce('Grade 10');

      const batches = await inputManager.collectBatchInfo();

      expect(batches).toHaveLength(1);
    });

    it('should handle invalid batch names and retry', async () => {
      mockReadlineSync.question
        .mockReturnValueOnce('1') // batch count
        .mockReturnValueOnce('') // empty name
        .mockReturnValueOnce('a'.repeat(51)) // too long name
        .mockReturnValueOnce('Valid Name'); // valid name

      const batches = await inputManager.collectBatchInfo();

      expect(batches).toHaveLength(1);
      expect(batches[0].name).toBe('Valid Name');
    });
  });

  describe('collectSubjectInfo', () => {
    let batch: Batch;

    beforeEach(() => {
      batch = new Batch('Grade 10');
    });

    it('should collect subject information successfully', async () => {
      mockReadlineSync.question
        .mockReturnValueOnce('2') // subject count
        .mockReturnValueOnce('Mathematics') // subject 1 name
        .mockReturnValueOnce('5') // lectures per week
        .mockReturnValueOnce('60') // duration
        .mockReturnValueOnce('Dr. Smith') // faculty
        .mockReturnValueOnce('Physics') // subject 2 name
        .mockReturnValueOnce('3') // lectures per week
        .mockReturnValueOnce('45') // duration
        .mockReturnValueOnce('Dr. Johnson'); // faculty

      const subjects = await inputManager.collectSubjectInfo(batch);

      expect(subjects).toHaveLength(2);
      expect(subjects[0].name).toBe('Mathematics');
      expect(subjects[1].name).toBe('Physics');
      
      // Check that faculties were created
      const faculties = inputManager.getFaculties();
      expect(faculties).toHaveLength(2);
    });

    it('should reuse existing faculty', async () => {
      mockReadlineSync.question
        .mockReturnValueOnce('2') // subject count
        .mockReturnValueOnce('Mathematics') // subject 1 name
        .mockReturnValueOnce('5') // lectures per week
        .mockReturnValueOnce('60') // duration
        .mockReturnValueOnce('Dr. Smith') // faculty
        .mockReturnValueOnce('Physics') // subject 2 name
        .mockReturnValueOnce('3') // lectures per week
        .mockReturnValueOnce('45') // duration
        .mockReturnValueOnce('Dr. Smith'); // same faculty

      const subjects = await inputManager.collectSubjectInfo(batch);

      expect(subjects).toHaveLength(2);
      
      // Should only have one faculty
      const faculties = inputManager.getFaculties();
      expect(faculties).toHaveLength(1);
      expect(faculties[0].getSubjectCount()).toBe(2);
    });

    it('should handle invalid inputs and retry', async () => {
      mockReadlineSync.question
        .mockReturnValueOnce('invalid') // invalid subject count
        .mockReturnValueOnce('0') // zero subjects
        .mockReturnValueOnce('1') // valid count
        .mockReturnValueOnce('') // empty subject name
        .mockReturnValueOnce('Mathematics') // valid name
        .mockReturnValueOnce('0') // invalid lectures
        .mockReturnValueOnce('5') // valid lectures
        .mockReturnValueOnce('20') // invalid duration
        .mockReturnValueOnce('60') // valid duration
        .mockReturnValueOnce('') // empty faculty
        .mockReturnValueOnce('Dr. Smith'); // valid faculty

      const subjects = await inputManager.collectSubjectInfo(batch);

      expect(subjects).toHaveLength(1);
      expect(subjects[0].name).toBe('Mathematics');
    });

    it('should warn for high lecture count', async () => {
      mockReadlineSync.question
        .mockReturnValueOnce('1') // subject count
        .mockReturnValueOnce('Mathematics') // subject name
        .mockReturnValueOnce('15') // high lecture count
        .mockReturnValueOnce('60') // duration
        .mockReturnValueOnce('Dr. Smith'); // faculty

      mockReadlineSync.keyInYNStrict
        .mockReturnValueOnce(false) // reject high count
        .mockReturnValueOnce(true); // accept on retry

      mockReadlineSync.question
        .mockReturnValueOnce('5'); // lower count

      const subjects = await inputManager.collectSubjectInfo(batch);

      expect(subjects).toHaveLength(1);
      expect(subjects[0].lecturesPerWeek).toBe(5);
    });

    it('should warn for long lecture duration', async () => {
      mockReadlineSync.question
        .mockReturnValueOnce('1') // subject count
        .mockReturnValueOnce('Mathematics') // subject name
        .mockReturnValueOnce('5') // lectures per week
        .mockReturnValueOnce('150') // long duration
        .mockReturnValueOnce('Dr. Smith'); // faculty

      mockReadlineSync.keyInYNStrict
        .mockReturnValueOnce(false) // reject long duration
        .mockReturnValueOnce(true); // accept on retry

      mockReadlineSync.question
        .mockReturnValueOnce('60'); // shorter duration

      const subjects = await inputManager.collectSubjectInfo(batch);

      expect(subjects).toHaveLength(1);
      expect(subjects[0].lectureDuration).toBe(60);
    });
  });

  describe('collectHolidays', () => {
    it('should return empty array when user declines', async () => {
      mockReadlineSync.keyInYNStrict.mockReturnValueOnce(false);

      const holidays = await inputManager.collectHolidays();

      expect(holidays).toHaveLength(0);
    });

    it('should collect holidays successfully', async () => {
      mockReadlineSync.keyInYNStrict.mockReturnValueOnce(true);
      mockReadlineSync.question
        .mockReturnValueOnce('2024-12-25') // Christmas
        .mockReturnValueOnce('2024-01-01') // New Year
        .mockReturnValueOnce(''); // finish

      const holidays = await inputManager.collectHolidays();

      expect(holidays).toHaveLength(2);
      expect(holidays[0]).toEqual(new Date('2024-12-25T00:00:00.000Z'));
      expect(holidays[1]).toEqual(new Date('2024-01-01T00:00:00.000Z'));
    });

    it('should handle invalid date formats', async () => {
      mockReadlineSync.keyInYNStrict.mockReturnValueOnce(true);
      mockReadlineSync.question
        .mockReturnValueOnce('invalid-date') // invalid format
        .mockReturnValueOnce('2024-13-01') // invalid month
        .mockReturnValueOnce('2024-12-25') // valid date
        .mockReturnValueOnce(''); // finish

      const holidays = await inputManager.collectHolidays();

      expect(holidays).toHaveLength(1);
    });

    it('should prevent duplicate holidays', async () => {
      mockReadlineSync.keyInYNStrict.mockReturnValueOnce(true);
      mockReadlineSync.question
        .mockReturnValueOnce('2024-12-25') // first time
        .mockReturnValueOnce('2024-12-25') // duplicate
        .mockReturnValueOnce(''); // finish

      const holidays = await inputManager.collectHolidays();

      expect(holidays).toHaveLength(1);
    });

    it('should warn for past dates', async () => {
      const pastDate = '2020-01-01';
      
      mockReadlineSync.keyInYNStrict
        .mockReturnValueOnce(true) // want to configure holidays
        .mockReturnValueOnce(false); // reject past date

      mockReadlineSync.question
        .mockReturnValueOnce(pastDate)
        .mockReturnValueOnce(''); // finish

      const holidays = await inputManager.collectHolidays();

      expect(holidays).toHaveLength(0);
    });
  });

  describe('validateInput', () => {
    it('should validate string input', () => {
      expect(inputManager.validateInput('valid string')).toEqual({
        isValid: true,
        errors: [],
        warnings: []
      });

      expect(inputManager.validateInput('')).toEqual({
        isValid: false,
        errors: ['Input cannot be empty'],
        warnings: []
      });

      expect(inputManager.validateInput('a'.repeat(250))).toEqual({
        isValid: true,
        errors: [],
        warnings: ['Input is very long and may be truncated']
      });
    });

    it('should validate number input', () => {
      expect(inputManager.validateInput(42)).toEqual({
        isValid: true,
        errors: [],
        warnings: []
      });

      expect(inputManager.validateInput(NaN)).toEqual({
        isValid: false,
        errors: ['Input must be a valid number'],
        warnings: []
      });

      expect(inputManager.validateInput(-5)).toEqual({
        isValid: false,
        errors: ['Input must be non-negative'],
        warnings: []
      });

      expect(inputManager.validateInput(1500)).toEqual({
        isValid: true,
        errors: [],
        warnings: ['Input is very large']
      });
    });

    it('should validate date input', () => {
      const validDate = new Date('2024-12-25');
      expect(inputManager.validateInput(validDate)).toEqual({
        isValid: true,
        errors: [],
        warnings: []
      });

      const invalidDate = new Date('invalid');
      expect(inputManager.validateInput(invalidDate)).toEqual({
        isValid: false,
        errors: ['Invalid date'],
        warnings: []
      });
    });

    it('should validate array input', () => {
      expect(inputManager.validateInput([1, 2, 3])).toEqual({
        isValid: true,
        errors: [],
        warnings: []
      });

      expect(inputManager.validateInput([])).toEqual({
        isValid: true,
        errors: [],
        warnings: ['Array is empty']
      });

      const largeArray = new Array(150).fill(1);
      expect(inputManager.validateInput(largeArray)).toEqual({
        isValid: true,
        errors: [],
        warnings: ['Array is very large']
      });
    });

    it('should handle null/undefined input', () => {
      expect(inputManager.validateInput(null)).toEqual({
        isValid: false,
        errors: ['Input data is required'],
        warnings: []
      });

      expect(inputManager.validateInput(undefined)).toEqual({
        isValid: false,
        errors: ['Input data is required'],
        warnings: []
      });
    });
  });

  describe('utility methods', () => {
    it('should return created faculties', () => {
      expect(inputManager.getFaculties()).toHaveLength(0);

      // Simulate creating faculties through subject collection
      const faculty1 = new Faculty('Dr. Smith');
      const faculty2 = new Faculty('Dr. Johnson');
      
      // Access private method for testing
      (inputManager as any).faculties.set(faculty1.id, faculty1);
      (inputManager as any).faculties.set(faculty2.id, faculty2);

      const faculties = inputManager.getFaculties();
      expect(faculties).toHaveLength(2);
      expect(faculties.map(f => f.name)).toContain('Dr. Smith');
      expect(faculties.map(f => f.name)).toContain('Dr. Johnson');
    });

    it('should clear all data', () => {
      // Add some data
      const faculty = new Faculty('Dr. Smith');
      (inputManager as any).faculties.set(faculty.id, faculty);

      expect(inputManager.getFaculties()).toHaveLength(1);

      inputManager.clear();

      expect(inputManager.getFaculties()).toHaveLength(0);
    });

    it('should display configuration summary', () => {
      const batch1 = new Batch('Grade 10');
      const batch2 = new Batch('Grade 11');
      const holidays = [new Date('2024-12-25'), new Date('2024-01-01')];

      // Should not throw
      expect(() => {
        inputManager.displaySummary([batch1, batch2], holidays);
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle very large subject count warning', async () => {
      const batch = new Batch('Grade 10');
      
      mockReadlineSync.question
        .mockReturnValueOnce('20') // large subject count
        .mockReturnValueOnce('Mathematics')
        .mockReturnValueOnce('5')
        .mockReturnValueOnce('60')
        .mockReturnValueOnce('Dr. Smith');

      mockReadlineSync.keyInYNStrict
        .mockReturnValueOnce(false) // reject large count
        .mockReturnValueOnce(true); // accept on retry

      mockReadlineSync.question
        .mockReturnValueOnce('1'); // smaller count

      const subjects = await inputManager.collectSubjectInfo(batch);

      expect(subjects).toHaveLength(1);
    });

    it('should handle case-insensitive faculty matching', async () => {
      const batch = new Batch('Grade 10');
      
      mockReadlineSync.question
        .mockReturnValueOnce('2') // subject count
        .mockReturnValueOnce('Mathematics')
        .mockReturnValueOnce('5')
        .mockReturnValueOnce('60')
        .mockReturnValueOnce('Dr. Smith') // first faculty
        .mockReturnValueOnce('Physics')
        .mockReturnValueOnce('3')
        .mockReturnValueOnce('45')
        .mockReturnValueOnce('dr. smith'); // same faculty, different case

      const subjects = await inputManager.collectSubjectInfo(batch);

      expect(subjects).toHaveLength(2);
      
      // Should reuse the same faculty
      const faculties = inputManager.getFaculties();
      expect(faculties).toHaveLength(1);
      expect(faculties[0].getSubjectCount()).toBe(2);
    });
  });
});
