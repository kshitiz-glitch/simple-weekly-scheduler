import { ConstraintViolation, ScheduleEntry } from '../../models';
import { BaseConstraint } from './BaseConstraint';

/**
 * Constraint to prevent faculty from being assigned to multiple classes at the same time
 */
export class FacultyConflictConstraint extends BaseConstraint {
  constructor(priority: number = 100) {
    super(
      'faculty-conflict',
      'Faculty cannot be assigned to multiple classes at the same time',
      priority
    );
  }

  /**
   * Validate that faculty is not double-booked
   */
  validate(entry: ScheduleEntry, existing: ScheduleEntry[]): ConstraintViolation | null {
    if (!this.isEnabled) {
      return null;
    }

    // Find all existing entries for the same faculty
    const facultyEntries = this.findConflictingEntries(
      entry,
      existing,
      (existingEntry) => existingEntry.facultyId === entry.facultyId
    );

    // Check for time slot conflicts
    const conflictingEntries = facultyEntries.filter(existingEntry =>
      this.timeSlotsOverlap(entry.timeSlot, existingEntry.timeSlot)
    );

    if (conflictingEntries.length > 0) {
      const conflictDetails = conflictingEntries.map(conflictEntry => {
        const slot = conflictEntry.timeSlot;
        return `${slot.day} ${slot.startTime}-${slot.endTime}`;
      }).join(', ');

      return this.createViolation(
        `Faculty conflict detected: Faculty ${entry.facultyId} is already scheduled at ${conflictDetails}`,
        [entry, ...conflictingEntries],
        'error'
      );
    }

    return null;
  }

  /**
   * Check if faculty has any conflicts in the given time period
   */
  checkFacultyAvailability(
    facultyId: string,
    timeSlot: { day: string; startTime: string; endTime: string },
    existing: ScheduleEntry[]
  ): boolean {
    const facultyEntries = existing.filter(entry => entry.facultyId === facultyId);
    
    return !facultyEntries.some(entry => 
      this.timeSlotsOverlap(
        { ...timeSlot, isAvailable: true } as any,
        entry.timeSlot
      )
    );
  }

  /**
   * Get all time slots where faculty is busy
   */
  getFacultyBusySlots(facultyId: string, existing: ScheduleEntry[]): ScheduleEntry[] {
    return existing.filter(entry => entry.facultyId === facultyId);
  }

  /**
   * Get faculty workload (number of scheduled lectures)
   */
  getFacultyWorkload(facultyId: string, existing: ScheduleEntry[]): number {
    return existing.filter(entry => entry.facultyId === facultyId).length;
  }

  /**
   * Find the least busy faculty from a list
   */
  findLeastBusyFaculty(facultyIds: string[], existing: ScheduleEntry[]): string | null {
    if (facultyIds.length === 0) {
      return null;
    }

    let leastBusyFaculty = facultyIds[0];
    let minWorkload = this.getFacultyWorkload(leastBusyFaculty, existing);

    for (let i = 1; i < facultyIds.length; i++) {
      const workload = this.getFacultyWorkload(facultyIds[i], existing);
      if (workload < minWorkload) {
        minWorkload = workload;
        leastBusyFaculty = facultyIds[i];
      }
    }

    return leastBusyFaculty;
  }

  /**
   * Get faculty utilization statistics
   */
  getFacultyUtilization(existing: ScheduleEntry[]): Map<string, {
    totalLectures: number;
    uniqueDays: number;
    averageLecturesPerDay: number;
    busySlots: ScheduleEntry[];
  }> {
    const utilization = new Map();

    // Group entries by faculty
    const facultyGroups = new Map<string, ScheduleEntry[]>();
    existing.forEach(entry => {
      if (!facultyGroups.has(entry.facultyId)) {
        facultyGroups.set(entry.facultyId, []);
      }
      facultyGroups.get(entry.facultyId)!.push(entry);
    });

    // Calculate statistics for each faculty
    facultyGroups.forEach((entries, facultyId) => {
      const uniqueDays = new Set(entries.map(entry => entry.timeSlot.day)).size;
      const totalLectures = entries.length;
      const averageLecturesPerDay = uniqueDays > 0 ? totalLectures / uniqueDays : 0;

      utilization.set(facultyId, {
        totalLectures,
        uniqueDays,
        averageLecturesPerDay: Math.round(averageLecturesPerDay * 10) / 10,
        busySlots: [...entries]
      });
    });

    return utilization;
  }

  /**
   * Suggest alternative time slots for conflicted faculty
   */
  suggestAlternativeSlots(
    entry: ScheduleEntry,
    existing: ScheduleEntry[],
    availableSlots: { day: string; startTime: string; endTime: string }[]
  ): { day: string; startTime: string; endTime: string }[] {
    return availableSlots.filter(slot => 
      this.checkFacultyAvailability(entry.facultyId, slot, existing)
    );
  }

  /**
   * Clone this constraint
   */
  clone(): FacultyConflictConstraint {
    const cloned = new FacultyConflictConstraint(this.priority);
    cloned.setEnabled(this.isEnabled);
    return cloned;
  }

  /**
   * Get detailed conflict report
   */
  getConflictReport(existing: ScheduleEntry[]): {
    totalConflicts: number;
    conflictsByFaculty: Map<string, ScheduleEntry[][]>;
    mostConflictedFaculty: string | null;
  } {
    const conflictsByFaculty = new Map<string, ScheduleEntry[][]>();
    let totalConflicts = 0;

    // Group entries by faculty
    const facultyGroups = new Map<string, ScheduleEntry[]>();
    existing.forEach(entry => {
      if (!facultyGroups.has(entry.facultyId)) {
        facultyGroups.set(entry.facultyId, []);
      }
      facultyGroups.get(entry.facultyId)!.push(entry);
    });

    // Find conflicts for each faculty
    facultyGroups.forEach((entries, facultyId) => {
      const conflicts: ScheduleEntry[][] = [];
      
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          if (this.timeSlotsOverlap(entries[i].timeSlot, entries[j].timeSlot)) {
            conflicts.push([entries[i], entries[j]]);
            totalConflicts++;
          }
        }
      }
      
      if (conflicts.length > 0) {
        conflictsByFaculty.set(facultyId, conflicts);
      }
    });

    // Find most conflicted faculty
    let mostConflictedFaculty: string | null = null;
    let maxConflicts = 0;
    
    conflictsByFaculty.forEach((conflicts, facultyId) => {
      if (conflicts.length > maxConflicts) {
        maxConflicts = conflicts.length;
        mostConflictedFaculty = facultyId;
      }
    });

    return {
      totalConflicts,
      conflictsByFaculty,
      mostConflictedFaculty
    };
  }
}
