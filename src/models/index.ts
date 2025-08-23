// Core data model interfaces and types

export enum DayOfWeek {
  MONDAY = 'Monday',
  TUESDAY = 'Tuesday',
  WEDNESDAY = 'Wednesday',
  THURSDAY = 'Thursday',
  FRIDAY = 'Friday',
  SATURDAY = 'Saturday',
  SUNDAY = 'Sunday'
}

// Core interfaces
export interface ScheduleEntry {
  batchId: string;
  subjectId: string;
  facultyId: string;
  timeSlot: {
    day: DayOfWeek;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConstraintViolation {
  type: string;
  message: string;
  affectedEntries: ScheduleEntry[];
  severity: 'error' | 'warning';
}

// Basic data interfaces
export interface Batch {
  id: string;
  name: string;
  subjects: Subject[];
}

export interface Subject {
  id: string;
  name: string;
  batchId: string;
  lecturesPerWeek: number;
  lectureDuration: number;
  facultyId: string;
}

export interface Faculty {
  id: string;
  name: string;
  subjects: string[];
}

export interface TimeSlot {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface WeeklySchedule {
  entries: ScheduleEntry[];
  conflicts: ConstraintViolation[];
  metadata: {
    generatedAt: Date;
    totalLectures: number;
    batchCount: number;
  };
}
