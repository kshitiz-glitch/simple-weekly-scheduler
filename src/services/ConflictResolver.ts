import { ScheduleEntry, TimeSlot, DayOfWeek, ConstraintViolation } from '../models';
import { BaseConstraint } from './constraints';
import { TimeSlotManager } from '../algorithms/TimeSlotManager';

export interface ConflictResolution {
  originalEntry: ScheduleEntry;
  suggestedAlternatives: {
    timeSlot: TimeSlot;
    score: number;
    reason: string;
  }[];
  resolutionType: 'reschedule' | 'split' | 'swap' | 'impossible';
  confidence: number;
}

export interface HolidayConflict {
  affectedEntries: ScheduleEntry[];
  holidayDate: Date;
  resolutionOptions: ConflictResolution[];
}

export class ConflictResolver {
  private timeSlotManager: TimeSlotManager;

  constructor() {
    this.timeSlotManager = new TimeSlotManager();
  }

  /**
   * Detect and resolve holiday conflicts in a schedule
   */
  resolveHolidayConflicts(
    schedule: ScheduleEntry[],
    holidays: Date[],
    availableSlots: TimeSlot[],
    constraints: BaseConstraint[]
  ): {
    conflicts: HolidayConflict[];
    resolvedSchedule: ScheduleEntry[];
    unresolvableConflicts: HolidayConflict[];
  } {
    const conflicts: HolidayConflict[] = [];
    const resolvedEntries: ScheduleEntry[] = [];
    const unresolvableConflicts: HolidayConflict[] = [];

    // Identify holiday conflicts
    const holidayConflicts = this.identifyHolidayConflicts(schedule, holidays);

    for (const conflict of holidayConflicts) {
      const resolutionOptions: ConflictResolution[] = [];

      for (const affectedEntry of conflict.affectedEntries) {
        const resolution = this.findAlternativeSlots(
          affectedEntry,
          schedule,
          availableSlots,
          constraints
        );
        resolutionOptions.push(resolution);
      }

      const holidayConflict: HolidayConflict = {
        affectedEntries: conflict.affectedEntries,
        holidayDate: conflict.holidayDate,
        resolutionOptions
      };

      // Try to automatically resolve the conflict
      const autoResolved = this.attemptAutoResolution(holidayConflict, schedule);
      
      if (autoResolved.success) {
        resolvedEntries.push(...autoResolved.newEntries);
        conflicts.push(holidayConflict);
      } else {
        unresolvableConflicts.push(holidayConflict);
      }
    }

    // Create resolved schedule
    const nonConflictingEntries = schedule.filter(entry => 
      !holidayConflicts.some(conflict => 
        conflict.affectedEntries.some(affected => 
          this.entriesEqual(entry, affected)
        )
      )
    );

    const resolvedSchedule = [...nonConflictingEntries, ...resolvedEntries];

    return {
      conflicts,
      resolvedSchedule,
      unresolvableConflicts
    };
  }

  /**
   * Find alternative time slots for a conflicting entry
   */
  findAlternativeSlots(
    entry: ScheduleEntry,
    currentSchedule: ScheduleEntry[],
    availableSlots: TimeSlot[],
    constraints: BaseConstraint[]
  ): ConflictResolution {
    const alternatives: {
      timeSlot: TimeSlot;
      score: number;
      reason: string;
    }[] = [];

    // Filter out the current entry from schedule for testing
    const scheduleWithoutEntry = currentSchedule.filter(e => !this.entriesEqual(e, entry));

    for (const slot of availableSlots) {
      // Skip if slot is already occupied
      if (!this.timeSlotManager.isSlotAvailable(slot, scheduleWithoutEntry)) {
        continue;
      }

      // Create test entry with new slot
      const testEntry: ScheduleEntry = {
        ...entry,
        timeSlot: slot
      };

      // Check constraints
      const constraintViolations = this.checkConstraints(testEntry, scheduleWithoutEntry, constraints);
      
      if (constraintViolations.length === 0) {
        const score = this.calculateSlotScore(slot, entry.timeSlot);
        const reason = this.generateReasonForSlot(slot, entry.timeSlot);
        
        alternatives.push({
          timeSlot: slot,
          score,
          reason
        });
      }
    }

    // Sort alternatives by score (higher is better)
    alternatives.sort((a, b) => b.score - a.score);

    // Determine resolution type
    let resolutionType: 'reschedule' | 'split' | 'swap' | 'impossible' = 'impossible';
    let confidence = 0;

    if (alternatives.length > 0) {
      resolutionType = 'reschedule';
      confidence = Math.min(alternatives[0].score / 100, 1.0);
    }

    return {
      originalEntry: entry,
      suggestedAlternatives: alternatives.slice(0, 5), // Top 5 alternatives
      resolutionType,
      confidence
    };
  }

  /**
   * Suggest schedule swaps to resolve conflicts
   */
  suggestScheduleSwaps(
    conflictingEntry: ScheduleEntry,
    schedule: ScheduleEntry[],
    constraints: BaseConstraint[]
  ): {
    swapPartner: ScheduleEntry;
    feasible: boolean;
    benefitScore: number;
  }[] {
    const swapSuggestions: {
      swapPartner: ScheduleEntry;
      feasible: boolean;
      benefitScore: number;
    }[] = [];

    for (const potentialPartner of schedule) {
      if (this.entriesEqual(conflictingEntry, potentialPartner)) {
        continue;
      }

      // Test if swapping would resolve conflicts
      const swappedSchedule = this.createSwappedSchedule(
        schedule,
        conflictingEntry,
        potentialPartner
      );

      const conflictingEntrySwapped = {
        ...conflictingEntry,
        timeSlot: potentialPartner.timeSlot
      };

      const partnerSwapped = {
        ...potentialPartner,
        timeSlot: conflictingEntry.timeSlot
      };

      // Check if both entries satisfy constraints after swap
      const conflictingViolations = this.checkConstraints(
        conflictingEntrySwapped,
        swappedSchedule.filter(e => !this.entriesEqual(e, conflictingEntrySwapped)),
        constraints
      );

      const partnerViolations = this.checkConstraints(
        partnerSwapped,
        swappedSchedule.filter(e => !this.entriesEqual(e, partnerSwapped)),
        constraints
      );

      const feasible = conflictingViolations.length === 0 && partnerViolations.length === 0;
      const benefitScore = this.calculateSwapBenefit(conflictingEntry, potentialPartner);

      swapSuggestions.push({
        swapPartner: potentialPartner,
        feasible,
        benefitScore
      });
    }

    // Sort by feasibility first, then by benefit score
    swapSuggestions.sort((a, b) => {
      if (a.feasible !== b.feasible) {
        return a.feasible ? -1 : 1;
      }
      return b.benefitScore - a.benefitScore;
    });

    return swapSuggestions.slice(0, 3); // Top 3 suggestions
  }

  /**
   * Identify entries that conflict with holidays
   */
  private identifyHolidayConflicts(
    schedule: ScheduleEntry[],
    holidays: Date[]
  ): { affectedEntries: ScheduleEntry[]; holidayDate: Date }[] {
    const conflicts: { affectedEntries: ScheduleEntry[]; holidayDate: Date }[] = [];

    for (const holiday of holidays) {
      const holidayDayOfWeek = this.getDateDayOfWeek(holiday);
      
      const affectedEntries = schedule.filter(entry => 
        entry.timeSlot.day === holidayDayOfWeek
      );

      if (affectedEntries.length > 0) {
        conflicts.push({
          affectedEntries,
          holidayDate: holiday
        });
      }
    }

    return conflicts;
  }

  /**
   * Attempt automatic resolution of holiday conflicts
   */
  private attemptAutoResolution(
    conflict: HolidayConflict,
    schedule: ScheduleEntry[]
  ): { success: boolean; newEntries: ScheduleEntry[] } {
    const newEntries: ScheduleEntry[] = [];
    let allResolved = true;

    for (const resolution of conflict.resolutionOptions) {
      if (resolution.suggestedAlternatives.length > 0 && resolution.confidence > 0.7) {
        // Use the best alternative
        const bestAlternative = resolution.suggestedAlternatives[0];
        const newEntry: ScheduleEntry = {
          ...resolution.originalEntry,
          timeSlot: bestAlternative.timeSlot
        };
        newEntries.push(newEntry);
      } else {
        allResolved = false;
        break;
      }
    }

    return {
      success: allResolved,
      newEntries: allResolved ? newEntries : []
    };
  }

  /**
   * Check constraints for a schedule entry
   */
  private checkConstraints(
    entry: ScheduleEntry,
    schedule: ScheduleEntry[],
    constraints: BaseConstraint[]
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const constraint of constraints) {
      if (!constraint.isConstraintEnabled()) {
        continue;
      }

      const violation = constraint.validate(entry, schedule);
      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Calculate score for a time slot alternative
   */
  private calculateSlotScore(newSlot: TimeSlot, originalSlot: TimeSlot): number {
    let score = 50; // Base score

    // Prefer same day
    if (newSlot.day === originalSlot.day) {
      score += 30;
    }

    // Prefer similar time
    const originalStartMinutes = this.timeToMinutes(originalSlot.startTime);
    const newStartMinutes = this.timeToMinutes(newSlot.startTime);
    const timeDifference = Math.abs(originalStartMinutes - newStartMinutes);
    
    // Reduce score based on time difference (max penalty: 20 points)
    const timePenalty = Math.min(timeDifference / 60 * 5, 20);
    score -= timePenalty;

    // Prefer morning slots (slight preference)
    if (newStartMinutes < 12 * 60) { // Before noon
      score += 5;
    }

    return Math.max(0, score);
  }

  /**
   * Generate human-readable reason for slot suggestion
   */
  private generateReasonForSlot(newSlot: TimeSlot, originalSlot: TimeSlot): string {
    if (newSlot.day === originalSlot.day) {
      const originalTime = originalSlot.startTime;
      const newTime = newSlot.startTime;
      
      if (originalTime === newTime) {
        return 'Same time, different day due to holiday';
      } else {
        return `Same day, moved from ${originalTime} to ${newTime}`;
      }
    } else {
      return `Moved to ${newSlot.day} ${newSlot.startTime} due to holiday conflict`;
    }
  }

  /**
   * Calculate benefit score for swapping two entries
   */
  private calculateSwapBenefit(entry1: ScheduleEntry, entry2: ScheduleEntry): number {
    let benefit = 0;

    // Benefit if entries are from different batches (reduces batch conflicts)
    if (entry1.batchId !== entry2.batchId) {
      benefit += 20;
    }

    // Benefit if entries are from different faculties (reduces faculty conflicts)
    if (entry1.facultyId !== entry2.facultyId) {
      benefit += 15;
    }

    // Benefit based on time slot compatibility
    const time1Minutes = this.timeToMinutes(entry1.timeSlot.startTime);
    const time2Minutes = this.timeToMinutes(entry2.timeSlot.startTime);
    const timeDifference = Math.abs(time1Minutes - time2Minutes);
    
    // Smaller time differences are better for swaps
    benefit += Math.max(0, 10 - timeDifference / 60);

    return benefit;
  }

  /**
   * Create a schedule with two entries swapped
   */
  private createSwappedSchedule(
    schedule: ScheduleEntry[],
    entry1: ScheduleEntry,
    entry2: ScheduleEntry
  ): ScheduleEntry[] {
    return schedule.map(entry => {
      if (this.entriesEqual(entry, entry1)) {
        return { ...entry1, timeSlot: entry2.timeSlot };
      } else if (this.entriesEqual(entry, entry2)) {
        return { ...entry2, timeSlot: entry1.timeSlot };
      }
      return entry;
    });
  }

  /**
   * Check if two schedule entries are equal
   */
  private entriesEqual(entry1: ScheduleEntry, entry2: ScheduleEntry): boolean {
    return entry1.batchId === entry2.batchId &&
           entry1.subjectId === entry2.subjectId &&
           entry1.facultyId === entry2.facultyId &&
           entry1.timeSlot.day === entry2.timeSlot.day &&
           entry1.timeSlot.startTime === entry2.timeSlot.startTime &&
           entry1.timeSlot.endTime === entry2.timeSlot.endTime;
  }

  /**
   * Get day of week from a date
   */
  private getDateDayOfWeek(date: Date): DayOfWeek {
    const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    switch (dayIndex) {
      case 0: return DayOfWeek.SUNDAY;
      case 1: return DayOfWeek.MONDAY;
      case 2: return DayOfWeek.TUESDAY;
      case 3: return DayOfWeek.WEDNESDAY;
      case 4: return DayOfWeek.THURSDAY;
      case 5: return DayOfWeek.FRIDAY;
      case 6: return DayOfWeek.SATURDAY;
      default: return DayOfWeek.MONDAY; // fallback
    }
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
