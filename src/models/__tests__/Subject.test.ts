import { Subject } from '../Subject';

describe('Subject', () => {
  const validSubjectData = {
    name: 'Mathematics',
    batchId: 'batch_1',
    lecturesPerWeek: 5,
    lectureDuration: 60,
    facultyId: 'faculty_1'
  };

  describe('constructor', () => {
    it('should create a subject with valid data', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        validSubjectData.lectureDuration,
        validSubjectData.facultyId
      );

      expect(subject.name).toBe(validSubjectData.name);
      expect(subject.batchId).toBe(validSubjectData.batchId);
      expect(subject.lecturesPerWeek).toBe(validSubjectData.lecturesPerWeek);
      expect(subject.lectureDuration).toBe(validSubjectData.lectureDuration);
      expect(subject.facultyId).toBe(validSubjectData.facultyId);
      expect(subject.id).toBeDefined();
    });

    it('should create a subject with custom ID', () => {
      const customId = 'custom_subject_id';
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        validSubjectData.lectureDuration,
        validSubjectData.facultyId,
        customId
      );

      expect(subject.id).toBe(customId);
    });

    it('should throw error for invalid name', () => {
      expect(() => new Subject(
        '',
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        validSubjectData.lectureDuration,
        validSubjectData.facultyId
      )).toThrow('Invalid subject');

      expect(() => new Subject(
        'a'.repeat(101),
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        validSubjectData.lectureDuration,
        validSubjectData.facultyId
      )).toThrow('Invalid subject');
    });

    it('should throw error for invalid batch ID', () => {
      expect(() => new Subject(
        validSubjectData.name,
        '',
        validSubjectData.lecturesPerWeek,
        validSubjectData.lectureDuration,
        validSubjectData.facultyId
      )).toThrow('Invalid subject');
    });

    it('should throw error for invalid lectures per week', () => {
      expect(() => new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        0,
        validSubjectData.lectureDuration,
        validSubjectData.facultyId
      )).toThrow('Invalid subject');

      expect(() => new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        21,
        validSubjectData.lectureDuration,
        validSubjectData.facultyId
      )).toThrow('Invalid subject');
    });

    it('should throw error for invalid lecture duration', () => {
      expect(() => new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        29,
        validSubjectData.facultyId
      )).toThrow('Invalid subject');

      expect(() => new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        181,
        validSubjectData.facultyId
      )).toThrow('Invalid subject');
    });

    it('should throw error for invalid faculty ID', () => {
      expect(() => new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        validSubjectData.lectureDuration,
        ''
      )).toThrow('Invalid subject');
    });
  });

  describe('validate', () => {
    it('should return valid result for valid subject', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        validSubjectData.lectureDuration,
        validSubjectData.facultyId
      );

      const result = subject.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn for too many lectures per week', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        15, // More than 10
        validSubjectData.lectureDuration,
        validSubjectData.facultyId
      );

      const result = subject.validate();

      expect(result.warnings).toContain('More than 10 lectures per week may be difficult to schedule');
    });

    it('should warn for very long lectures', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        150, // More than 120 minutes
        validSubjectData.facultyId
      );

      const result = subject.validate();

      expect(result.warnings).toContain('Lectures longer than 2 hours may be too long for students');
    });

    it('should warn for very short lectures', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        30, // Less than 45 minutes
        validSubjectData.facultyId
      );

      const result = subject.validate();

      expect(result.warnings).toContain('Lectures shorter than 45 minutes may be too brief for effective learning');
    });

    it('should warn for excessive total weekly duration', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        10,
        90, // 10 * 90 = 900 minutes = 15 hours
        validSubjectData.facultyId
      );

      const result = subject.validate();

      expect(result.warnings).toContain('Total weekly duration for this subject exceeds 10 hours');
    });
  });

  describe('getTotalWeeklyDuration', () => {
    it('should calculate total weekly duration correctly', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        5,
        60,
        validSubjectData.facultyId
      );

      expect(subject.getTotalWeeklyDuration()).toBe(300); // 5 * 60
    });
  });

  describe('getTotalWeeklyHours', () => {
    it('should calculate total weekly hours correctly', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        5,
        60,
        validSubjectData.facultyId
      );

      expect(subject.getTotalWeeklyHours()).toBe(5.0); // 300 minutes = 5 hours
    });

    it('should round to 1 decimal place', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        3,
        50, // 150 minutes = 2.5 hours
        validSubjectData.facultyId
      );

      expect(subject.getTotalWeeklyHours()).toBe(2.5);
    });
  });

  describe('update methods', () => {
    let subject: Subject;

    beforeEach(() => {
      subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        validSubjectData.lectureDuration,
        validSubjectData.facultyId
      );
    });

    describe('updateName', () => {
      it('should update name with valid input', () => {
        subject.updateName('Physics');
        expect(subject.name).toBe('Physics');
      });

      it('should throw error for invalid name', () => {
        expect(() => subject.updateName('')).toThrow('Invalid subject name');
      });
    });

    describe('updateLecturesPerWeek', () => {
      it('should update lectures per week with valid input', () => {
        subject.updateLecturesPerWeek(3);
        expect(subject.lecturesPerWeek).toBe(3);
      });

      it('should throw error for invalid count', () => {
        expect(() => subject.updateLecturesPerWeek(0)).toThrow('Invalid lecture count');
      });
    });

    describe('updateLectureDuration', () => {
      it('should update lecture duration with valid input', () => {
        subject.updateLectureDuration(45);
        expect(subject.lectureDuration).toBe(45);
      });

      it('should throw error for invalid duration', () => {
        expect(() => subject.updateLectureDuration(20)).toThrow('Invalid lecture duration');
      });
    });

    describe('updateFacultyId', () => {
      it('should update faculty ID with valid input', () => {
        subject.updateFacultyId('faculty_2');
        expect(subject.facultyId).toBe('faculty_2');
      });

      it('should throw error for empty faculty ID', () => {
        expect(() => subject.updateFacultyId('')).toThrow('Faculty ID cannot be empty');
      });
    });
  });

  describe('canFitInTimeSlot', () => {
    it('should return true if subject fits in time slot', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        60,
        validSubjectData.facultyId
      );

      expect(subject.canFitInTimeSlot(90)).toBe(true);
      expect(subject.canFitInTimeSlot(60)).toBe(true);
    });

    it('should return false if subject does not fit in time slot', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        60,
        validSubjectData.facultyId
      );

      expect(subject.canFitInTimeSlot(45)).toBe(false);
    });
  });

  describe('getRequiredTimeSlots', () => {
    it('should return number of lectures per week', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        5,
        validSubjectData.lectureDuration,
        validSubjectData.facultyId
      );

      expect(subject.getRequiredTimeSlots()).toBe(5);
    });
  });

  describe('getSummary', () => {
    it('should return correct summary', () => {
      const subject = new Subject(
        'Mathematics',
        validSubjectData.batchId,
        5,
        60,
        validSubjectData.facultyId
      );

      const summary = subject.getSummary();

      expect(summary).toContain('Mathematics');
      expect(summary).toContain('5 lectures/week');
      expect(summary).toContain('60min');
      expect(summary).toContain('5h/week');
    });
  });

  describe('getDetails', () => {
    it('should return detailed information', () => {
      const subject = new Subject(
        'Mathematics',
        'batch_1',
        5,
        60,
        'faculty_1'
      );

      const details = subject.getDetails();

      expect(details).toContain('Subject: Mathematics');
      expect(details).toContain('Batch ID: batch_1');
      expect(details).toContain('Faculty ID: faculty_1');
      expect(details).toContain('Lectures per week: 5');
      expect(details).toContain('Duration per lecture: 60 minutes');
      expect(details).toContain('Total weekly time: 5 hours');
    });
  });

  describe('hasConflictWith', () => {
    it('should return true for subjects with same faculty', () => {
      const subject1 = new Subject(
        'Mathematics',
        'batch_1',
        5,
        60,
        'faculty_1'
      );

      const subject2 = new Subject(
        'Physics',
        'batch_2',
        3,
        45,
        'faculty_1' // Same faculty
      );

      expect(subject1.hasConflictWith(subject2)).toBe(true);
    });

    it('should return false for subjects with different faculty', () => {
      const subject1 = new Subject(
        'Mathematics',
        'batch_1',
        5,
        60,
        'faculty_1'
      );

      const subject2 = new Subject(
        'Physics',
        'batch_2',
        3,
        45,
        'faculty_2' // Different faculty
      );

      expect(subject1.hasConflictWith(subject2)).toBe(false);
    });

    it('should return false for same subject (same ID)', () => {
      const subject = new Subject(
        'Mathematics',
        'batch_1',
        5,
        60,
        'faculty_1'
      );

      expect(subject.hasConflictWith(subject)).toBe(false);
    });
  });

  describe('clone', () => {
    it('should create a deep copy', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        validSubjectData.lectureDuration,
        validSubjectData.facultyId
      );

      const cloned = subject.clone();

      expect(cloned.id).toBe(subject.id);
      expect(cloned.name).toBe(subject.name);
      expect(cloned.batchId).toBe(subject.batchId);
      expect(cloned.lecturesPerWeek).toBe(subject.lecturesPerWeek);
      expect(cloned.lectureDuration).toBe(subject.lectureDuration);
      expect(cloned.facultyId).toBe(subject.facultyId);
      expect(cloned).not.toBe(subject); // Different object reference
    });
  });

  describe('JSON serialization', () => {
    it('should convert to JSON correctly', () => {
      const subject = new Subject(
        validSubjectData.name,
        validSubjectData.batchId,
        validSubjectData.lecturesPerWeek,
        validSubjectData.lectureDuration,
        validSubjectData.facultyId
      );

      const json = subject.toJSON();

      expect(json.id).toBe(subject.id);
      expect(json.name).toBe(subject.name);
      expect(json.batchId).toBe(subject.batchId);
      expect(json.lecturesPerWeek).toBe(subject.lecturesPerWeek);
      expect(json.lectureDuration).toBe(subject.lectureDuration);
      expect(json.facultyId).toBe(subject.facultyId);
    });

    it('should create from JSON correctly', () => {
      const data = {
        id: 'subject_1',
        name: 'Mathematics',
        batchId: 'batch_1',
        lecturesPerWeek: 5,
        lectureDuration: 60,
        facultyId: 'faculty_1'
      };

      const subject = Subject.fromJSON(data);

      expect(subject.id).toBe(data.id);
      expect(subject.name).toBe(data.name);
      expect(subject.batchId).toBe(data.batchId);
      expect(subject.lecturesPerWeek).toBe(data.lecturesPerWeek);
      expect(subject.lectureDuration).toBe(data.lectureDuration);
      expect(subject.facultyId).toBe(data.facultyId);
    });
  });

  describe('utility methods', () => {
    let subject1: Subject;
    let subject2: Subject;

    beforeEach(() => {
      subject1 = new Subject('Mathematics', 'batch_1', 5, 60, 'faculty_1');
      subject2 = new Subject('Physics', 'batch_1', 3, 45, 'faculty_2');
    });

    describe('compareTo', () => {
      it('should compare subjects by name', () => {
        expect(subject1.compareTo(subject2)).toBeLessThan(0); // Mathematics < Physics
        expect(subject2.compareTo(subject1)).toBeGreaterThan(0); // Physics > Mathematics
        expect(subject1.compareTo(subject1)).toBe(0); // Same subject
      });
    });

    describe('equals', () => {
      it('should return true for same subject', () => {
        expect(subject1.equals(subject1)).toBe(true);
      });

      it('should return false for different subjects', () => {
        expect(subject1.equals(subject2)).toBe(false);
      });
    });

    describe('hashCode', () => {
      it('should return subject ID as hash code', () => {
        expect(subject1.hashCode()).toBe(subject1.id);
      });
    });
  });
});
