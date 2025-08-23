import { ScheduleEntry, ConstraintViolation, DayOfWeek, TimeSlot } from './index';

export interface WeeklyScheduleMetadata {
  generatedAt: Date;
  totalLectures: number;
  batchCount: number;
  facultyCount?: number;
  subjectCount?: number;
  holidayConflictsResolved?: number;
  unresolvableHolidayConflicts?: number;
  optimizationScore?: number;
  generationTimeMs?: number;
}

export interface ScheduleStatistics {
  totalEntries: number;
  entriesPerDay: Map<DayOfWeek, number>;
  entriesPerBatch: Map<string, number>;
  entriesPerFaculty: Map<string, number>;
  entriesPerSubject: Map<string, number>;
  timeSlotUtilization: {
    totalSlots: number;
    occupiedSlots: number;
    utilizationRate: number;
  };
  dailyLoadDistribution: {
    averageEntriesPerDay: number;
    maxEntriesPerDay: number;
    minEntriesPerDay: number;
    standardDeviation: number;
  };
}

export class WeeklySchedule {
  public entries: ScheduleEntry[];
  public conflicts: ConstraintViolation[];
  public metadata: WeeklyScheduleMetadata;

  constructor(
    entries: ScheduleEntry[] = [],
    conflicts: ConstraintViolation[] = [],
    metadata?: Partial<WeeklyScheduleMetadata>
  ) {
    this.entries = entries;
    this.conflicts = conflicts;
    this.metadata = {
      generatedAt: new Date(),
      totalLectures: entries.length,
      batchCount: new Set(entries.map(e => e.batchId)).size,
      ...metadata
    };
  }

  /**
   * Get all entries for a specific batch
   */
  getEntriesForBatch(batchId: string): ScheduleEntry[] {
    return this.entries.filter(entry => entry.batchId === batchId);
  }

  /**
   * Get all entries for a specific faculty
   */
  getEntriesForFaculty(facultyId: string): ScheduleEntry[] {
    return this.entries.filter(entry => entry.facultyId === facultyId);
  }

  /**
   * Get all entries for a specific day
   */
  getEntriesForDay(day: DayOfWeek): ScheduleEntry[] {
    return this.entries.filter(entry => entry.timeSlot.day === day);
  }

  /**
   * Get all entries for a specific subject
   */
  getEntriesForSubject(subjectId: string): ScheduleEntry[] {
    return this.entries.filter(entry => entry.subjectId === subjectId);
  }

  /**
   * Get entries for a specific batch on a specific day
   */
  getEntriesForBatchAndDay(batchId: string, day: DayOfWeek): ScheduleEntry[] {
    return this.entries.filter(entry => 
      entry.batchId === batchId && entry.timeSlot.day === day
    );
  }

  /**
   * Get entries for a specific faculty on a specific day
   */
  getEntriesForFacultyAndDay(facultyId: string, day: DayOfWeek): ScheduleEntry[] {
    return this.entries.filter(entry => 
      entry.facultyId === facultyId && entry.timeSlot.day === day
    );
  }

  /**
   * Get all unique batch IDs
   */
  getBatchIds(): string[] {
    return [...new Set(this.entries.map(entry => entry.batchId))];
  }

  /**
   * Get all unique faculty IDs
   */
  getFacultyIds(): string[] {
    return [...new Set(this.entries.map(entry => entry.facultyId))];
  }

  /**
   * Get all unique subject IDs
   */
  getSubjectIds(): string[] {
    return [...new Set(this.entries.map(entry => entry.subjectId))];
  }

  /**
   * Get all time slots used in the schedule
   */
  getUsedTimeSlots(): TimeSlot[] {
    return this.entries.map(entry => entry.timeSlot);
  }

  /**
   * Get unique time slots (no duplicates)
   */
  getUniqueTimeSlots(): TimeSlot[] {
    const uniqueSlots = new Map<string, TimeSlot>();
    
    this.entries.forEach(entry => {
      const key = `${entry.timeSlot.day}_${entry.timeSlot.startTime}_${entry.timeSlot.endTime}`;
      if (!uniqueSlots.has(key)) {
        uniqueSlots.set(key, entry.timeSlot);
      }
    });

    return Array.from(uniqueSlots.values());
  }

  /**
   * Check if a time slot is occupied
   */
  isTimeSlotOccupied(day: DayOfWeek, startTime: string, batchId?: string): boolean {
    return this.entries.some(entry => 
      entry.timeSlot.day === day && 
      entry.timeSlot.startTime === startTime &&
      (!batchId || entry.batchId === batchId)
    );
  }

  /**
   * Get conflicts for a specific batch
   */
  getConflictsForBatch(batchId: string): ConstraintViolation[] {
    return this.conflicts.filter(conflict => 
      conflict.affectedEntries.some(entry => entry.batchId === batchId)
    );
  }

  /**
   * Get conflicts for a specific faculty
   */
  getConflictsForFaculty(facultyId: string): ConstraintViolation[] {
    return this.conflicts.filter(conflict => 
      conflict.affectedEntries.some(entry => entry.facultyId === facultyId)
    );
  }

  /**
   * Get conflicts by severity
   */
  getConflictsBySeverity(severity: 'error' | 'warning'): ConstraintViolation[] {
    return this.conflicts.filter(conflict => conflict.severity === severity);
  }

  /**
   * Calculate comprehensive schedule statistics
   */
  calculateStatistics(): ScheduleStatistics {
    const entriesPerDay = new Map<DayOfWeek, number>();
    const entriesPerBatch = new Map<string, number>();
    const entriesPerFaculty = new Map<string, number>();
    const entriesPerSubject = new Map<string, number>();

    // Initialize day counts
    Object.values(DayOfWeek).forEach(day => {
      entriesPerDay.set(day, 0);
    });

    // Count entries
    this.entries.forEach(entry => {
      // Count by day
      const dayCount = entriesPerDay.get(entry.timeSlot.day) || 0;
      entriesPerDay.set(entry.timeSlot.day, dayCount + 1);

      // Count by batch
      const batchCount = entriesPerBatch.get(entry.batchId) || 0;
      entriesPerBatch.set(entry.batchId, batchCount + 1);

      // Count by faculty
      const facultyCount = entriesPerFaculty.get(entry.facultyId) || 0;
      entriesPerFaculty.set(entry.facultyId, facultyCount + 1);

      // Count by subject
      const subjectCount = entriesPerSubject.get(entry.subjectId) || 0;
      entriesPerSubject.set(entry.subjectId, subjectCount + 1);
    });

    // Calculate time slot utilization
    const uniqueSlots = this.getUniqueTimeSlots();
    const totalPossibleSlots = this.calculateTotalPossibleSlots();
    const utilizationRate = totalPossibleSlots > 0 ? uniqueSlots.length / totalPossibleSlots : 0;

    // Calculate daily load distribution
    const dailyCounts = Array.from(entriesPerDay.values());
    const averageEntriesPerDay = dailyCounts.reduce((sum, count) => sum + count, 0) / dailyCounts.length;
    const maxEntriesPerDay = Math.max(...dailyCounts);
    const minEntriesPerDay = Math.min(...dailyCounts);
    
    const variance = dailyCounts.reduce((sum, count) => 
      sum + Math.pow(count - averageEntriesPerDay, 2), 0
    ) / dailyCounts.length;
    const standardDeviation = Math.sqrt(variance);

    return {
      totalEntries: this.entries.length,
      entriesPerDay,
      entriesPerBatch,
      entriesPerFaculty,
      entriesPerSubject,
      timeSlotUtilization: {
        totalSlots: totalPossibleSlots,
        occupiedSlots: uniqueSlots.length,
        utilizationRate: Math.round(utilizationRate * 1000) / 10 // Round to 1 decimal
      },
      dailyLoadDistribution: {
        averageEntriesPerDay: Math.round(averageEntriesPerDay * 10) / 10,
        maxEntriesPerDay,
        minEntriesPerDay,
        standardDeviation: Math.round(standardDeviation * 10) / 10
      }
    };
  }

  /**
   * Add an entry to the schedule
   */
  addEntry(entry: ScheduleEntry): void {
    this.entries.push(entry);
    this.updateMetadata();
  }

  /**
   * Remove an entry from the schedule
   */
  removeEntry(entry: ScheduleEntry): boolean {
    const index = this.entries.findIndex(e => 
      e.batchId === entry.batchId &&
      e.subjectId === entry.subjectId &&
      e.facultyId === entry.facultyId &&
      e.timeSlot.day === entry.timeSlot.day &&
      e.timeSlot.startTime === entry.timeSlot.startTime
    );

    if (index !== -1) {
      this.entries.splice(index, 1);
      this.updateMetadata();
      return true;
    }
    return false;
  }

  /**
   * Update an existing entry
   */
  updateEntry(oldEntry: ScheduleEntry, newEntry: ScheduleEntry): boolean {
    const index = this.entries.findIndex(e => 
      e.batchId === oldEntry.batchId &&
      e.subjectId === oldEntry.subjectId &&
      e.facultyId === oldEntry.facultyId &&
      e.timeSlot.day === oldEntry.timeSlot.day &&
      e.timeSlot.startTime === oldEntry.timeSlot.startTime
    );

    if (index !== -1) {
      this.entries[index] = newEntry;
      this.updateMetadata();
      return true;
    }
    return false;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
    this.conflicts = [];
    this.updateMetadata();
  }

  /**
   * Merge another schedule into this one
   */
  merge(otherSchedule: WeeklySchedule): void {
    this.entries.push(...otherSchedule.entries);
    this.conflicts.push(...otherSchedule.conflicts);
    this.updateMetadata();
  }

  /**
   * Create a copy of the schedule
   */
  clone(): WeeklySchedule {
    return new WeeklySchedule(
      [...this.entries],
      [...this.conflicts],
      { ...this.metadata }
    );
  }

  /**
   * Sort entries by day and time
   */
  sortEntries(): void {
    this.entries.sort((a, b) => {
      const dayOrder = Object.values(DayOfWeek);
      const dayA = dayOrder.indexOf(a.timeSlot.day);
      const dayB = dayOrder.indexOf(b.timeSlot.day);
      
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      
      return a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
    });
  }

  /**
   * Get schedule summary
   */
  getSummary(): {
    totalLectures: number;
    totalBatches: number;
    totalFaculties: number;
    totalSubjects: number;
    totalConflicts: number;
    errorConflicts: number;
    warningConflicts: number;
  } {
    return {
      totalLectures: this.entries.length,
      totalBatches: this.getBatchIds().length,
      totalFaculties: this.getFacultyIds().length,
      totalSubjects: this.getSubjectIds().length,
      totalConflicts: this.conflicts.length,
      errorConflicts: this.getConflictsBySeverity('error').length,
      warningConflicts: this.getConflictsBySeverity('warning').length
    };
  }

  /**
   * Validate schedule integrity
   */
  validate(): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for duplicate entries
    const entryKeys = new Set<string>();
    this.entries.forEach((entry, index) => {
      const key = `${entry.batchId}_${entry.timeSlot.day}_${entry.timeSlot.startTime}`;
      if (entryKeys.has(key)) {
        issues.push(`Duplicate entry found at index ${index}: ${key}`);
      }
      entryKeys.add(key);
    });

    // Check for invalid time formats
    this.entries.forEach((entry, index) => {
      if (!this.isValidTimeFormat(entry.timeSlot.startTime)) {
        issues.push(`Invalid start time format at index ${index}: ${entry.timeSlot.startTime}`);
      }
      if (!this.isValidTimeFormat(entry.timeSlot.endTime)) {
        issues.push(`Invalid end time format at index ${index}: ${entry.timeSlot.endTime}`);
      }
    });

    // Check for logical time inconsistencies
    this.entries.forEach((entry, index) => {
      const startMinutes = this.timeToMinutes(entry.timeSlot.startTime);
      const endMinutes = this.timeToMinutes(entry.timeSlot.endTime);
      
      if (startMinutes >= endMinutes) {
        issues.push(`Invalid time range at index ${index}: ${entry.timeSlot.startTime} - ${entry.timeSlot.endTime}`);
      }
    });

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Private helper methods
   */
  private updateMetadata(): void {
    this.metadata.totalLectures = this.entries.length;
    this.metadata.batchCount = this.getBatchIds().length;
    this.metadata.facultyCount = this.getFacultyIds().length;
    this.metadata.subjectCount = this.getSubjectIds().length;
  }

  private calculateTotalPossibleSlots(): number {
    // Assume 5 working days, 10 hours per day (8 AM to 6 PM), 1-hour slots
    return 5 * 10;
  }

  private isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
