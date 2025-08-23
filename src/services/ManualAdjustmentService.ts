import { ScheduleEntry, TimeSlot, DayOfWeek, Batch, Subject } from '../models';
import { ConflictReport, ConflictResolution } from './ConflictReporter';

export interface AdjustmentRequest {
  requestId: string;
  type: AdjustmentType;
  description: string;
  targetEntry: ScheduleEntry;
  proposedChanges: ProposedChange[];
  reason: string;
  priority: AdjustmentPriority;
  requestedBy: string;
  requestedAt: Date;
}

export interface ProposedChange {
  changeId: string;
  field: ChangeField;
  currentValue: any;
  proposedValue: any;
  impact: ChangeImpact;
}

export interface ChangeImpact {
  affectedEntries: ScheduleEntry[];
  conflictsIntroduced: number;
  conflictsResolved: number;
  feasibilityScore: number; // 0-1
}

export interface AdjustmentResult {
  success: boolean;
  modifiedSchedule: ScheduleEntry[];
  appliedChanges: ProposedChange[];
  newConflicts: ConflictReport[];
  resolvedConflicts: ConflictReport[];
  warnings: string[];
  recommendations: string[];
}

export enum AdjustmentType {
  RESCHEDULE_LECTURE = 'reschedule_lecture',
  SWAP_LECTURES = 'swap_lectures',
  CHANGE_FACULTY = 'change_faculty',
  MODIFY_DURATION = 'modify_duration',
  ADD_LECTURE = 'add_lecture',
  REMOVE_LECTURE = 'remove_lecture',
  SPLIT_LECTURE = 'split_lecture',
  MERGE_LECTURES = 'merge_lectures',
  ADJUST_CONSTRAINTS = 'adjust_constraints'
}

export enum ChangeField {
  TIME_SLOT = 'time_slot',
  FACULTY_ID = 'faculty_id',
  DURATION = 'duration',
  BATCH_ID = 'batch_id',
  SUBJECT_ID = 'subject_id'
}

export enum AdjustmentPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export class ManualAdjustmentService {
  private adjustmentCounter = 0;
  private changeCounter = 0;

  /**
   * Create a manual adjustment request
   */
  createAdjustmentRequest(
    type: AdjustmentType,
    description: string,
    targetEntry: ScheduleEntry,
    proposedChanges: Omit<ProposedChange, 'changeId' | 'impact'>[],
    reason: string,
    priority: AdjustmentPriority = AdjustmentPriority.MEDIUM,
    requestedBy: string = 'system'
  ): AdjustmentRequest {
    const changes: ProposedChange[] = proposedChanges.map(change => ({
      ...change,
      changeId: this.generateChangeId(),
      impact: {
        affectedEntries: [],
        conflictsIntroduced: 0,
        conflictsResolved: 0,
        feasibilityScore: 0.5
      }
    }));

    return {
      requestId: this.generateAdjustmentId(),
      type,
      description,
      targetEntry,
      proposedChanges: changes,
      reason,
      priority,
      requestedBy,
      requestedAt: new Date()
    };
  }

  /**
   * Analyze the impact of proposed changes
   */
  analyzeAdjustmentImpact(
    request: AdjustmentRequest,
    currentSchedule: ScheduleEntry[],
    batches: Batch[]
  ): AdjustmentRequest {
    const updatedChanges = request.proposedChanges.map(change => ({
      ...change,
      impact: this.calculateChangeImpact(change, request.targetEntry, currentSchedule, batches)
    }));

    return {
      ...request,
      proposedChanges: updatedChanges
    };
  }

  /**
   * Apply manual adjustments to the schedule
   */
  applyAdjustment(
    request: AdjustmentRequest,
    currentSchedule: ScheduleEntry[]
  ): AdjustmentResult {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let modifiedSchedule = [...currentSchedule];
    const appliedChanges: ProposedChange[] = [];

    try {
      // Find the target entry in the schedule
      const targetIndex = modifiedSchedule.findIndex(entry => 
        this.entriesEqual(entry, request.targetEntry)
      );

      if (targetIndex === -1) {
        return {
          success: false,
          modifiedSchedule: currentSchedule,
          appliedChanges: [],
          newConflicts: [],
          resolvedConflicts: [],
          warnings: ['Target entry not found in schedule'],
          recommendations: ['Verify that the target entry exists in the current schedule']
        };
      }

      // Apply each proposed change
      for (const change of request.proposedChanges) {
        const result = this.applyChange(change, targetIndex, modifiedSchedule);
        
        if (result.success) {
          modifiedSchedule = result.modifiedSchedule;
          appliedChanges.push(change);
        } else {
          warnings.push(`Failed to apply change ${change.changeId}: ${result.error}`);
        }
      }

      // Validate the modified schedule
      const validation = this.validateModifiedSchedule(modifiedSchedule, currentSchedule);
      warnings.push(...validation.warnings);
      recommendations.push(...validation.recommendations);

      return {
        success: appliedChanges.length > 0,
        modifiedSchedule,
        appliedChanges,
        newConflicts: validation.newConflicts,
        resolvedConflicts: validation.resolvedConflicts,
        warnings,
        recommendations
      };

    } catch (error) {
      return {
        success: false,
        modifiedSchedule: currentSchedule,
        appliedChanges: [],
        newConflicts: [],
        resolvedConflicts: [],
        warnings: [`Adjustment failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        recommendations: ['Review the adjustment request and try again']
      };
    }
  }

  /**
   * Suggest alternative adjustments
   */
  suggestAlternativeAdjustments(
    originalRequest: AdjustmentRequest,
    currentSchedule: ScheduleEntry[]
  ): AdjustmentRequest[] {
    const alternatives: AdjustmentRequest[] = [];

    switch (originalRequest.type) {
      case AdjustmentType.RESCHEDULE_LECTURE:
        alternatives.push(...this.suggestRescheduleAlternatives(originalRequest, currentSchedule));
        break;
      case AdjustmentType.SWAP_LECTURES:
        alternatives.push(...this.suggestSwapAlternatives(originalRequest, currentSchedule));
        break;
      case AdjustmentType.CHANGE_FACULTY:
        alternatives.push(...this.suggestFacultyChangeAlternatives(originalRequest, currentSchedule));
        break;
    }

    return alternatives;
  }

  /**
   * Create a batch adjustment for multiple entries
   */
  createBatchAdjustment(
    entries: ScheduleEntry[],
    adjustmentType: AdjustmentType,
    reason: string
  ): AdjustmentRequest[] {
    return entries.map((entry, index) => 
      this.createAdjustmentRequest(
        adjustmentType,
        `Batch adjustment ${index + 1} of ${entries.length}`,
        entry,
        [],
        reason,
        AdjustmentPriority.MEDIUM,
        'batch_operation'
      )
    );
  }

  /**
   * Rollback an adjustment
   */
  rollbackAdjustment(
    originalSchedule: ScheduleEntry[],
    adjustmentResult: AdjustmentResult
  ): ScheduleEntry[] {
    // Simply return the original schedule
    return [...originalSchedule];
  }

  /**
   * Get adjustment history and statistics
   */
  getAdjustmentStatistics(adjustmentResults: AdjustmentResult[]): {
    totalAdjustments: number;
    successfulAdjustments: number;
    failedAdjustments: number;
    averageFeasibilityScore: number;
    commonAdjustmentTypes: Map<AdjustmentType, number>;
    impactSummary: {
      totalEntriesModified: number;
      totalConflictsIntroduced: number;
      totalConflictsResolved: number;
    };
  } {
    const successful = adjustmentResults.filter(r => r.success);
    const failed = adjustmentResults.filter(r => !r.success);

    const typeCount = new Map<AdjustmentType, number>();
    let totalFeasibilityScore = 0;
    let totalEntriesModified = 0;
    let totalConflictsIntroduced = 0;
    let totalConflictsResolved = 0;

    adjustmentResults.forEach(result => {
      totalEntriesModified += result.appliedChanges.length;
      totalConflictsIntroduced += result.newConflicts.length;
      totalConflictsResolved += result.resolvedConflicts.length;

      result.appliedChanges.forEach(change => {
        totalFeasibilityScore += change.impact.feasibilityScore;
      });
    });

    return {
      totalAdjustments: adjustmentResults.length,
      successfulAdjustments: successful.length,
      failedAdjustments: failed.length,
      averageFeasibilityScore: adjustmentResults.length > 0 ? totalFeasibilityScore / adjustmentResults.length : 0,
      commonAdjustmentTypes: typeCount,
      impactSummary: {
        totalEntriesModified,
        totalConflictsIntroduced,
        totalConflictsResolved
      }
    };
  }

  /**
   * Calculate the impact of a proposed change
   */
  private calculateChangeImpact(
    change: Omit<ProposedChange, 'changeId' | 'impact'>,
    targetEntry: ScheduleEntry,
    currentSchedule: ScheduleEntry[],
    batches: Batch[]
  ): ChangeImpact {
    const affectedEntries: ScheduleEntry[] = [];
    let conflictsIntroduced = 0;
    let conflictsResolved = 0;
    let feasibilityScore = 0.5;

    switch (change.field) {
      case ChangeField.TIME_SLOT:
        const newTimeSlot = change.proposedValue as TimeSlot;
        
        // Check for conflicts with the new time slot
        const conflictingEntries = currentSchedule.filter(entry => 
          entry !== targetEntry &&
          this.timeSlotOverlap(entry.timeSlot, newTimeSlot)
        );
        
        affectedEntries.push(...conflictingEntries);
        conflictsIntroduced = conflictingEntries.length;
        
        // Calculate feasibility based on conflicts
        feasibilityScore = conflictingEntries.length === 0 ? 0.9 : 0.3;
        break;

      case ChangeField.FACULTY_ID:
        // Check for faculty conflicts
        const newFacultyId = change.proposedValue as string;
        const facultyConflicts = currentSchedule.filter(entry =>
          entry.facultyId === newFacultyId &&
          entry.timeSlot.day === targetEntry.timeSlot.day &&
          this.timeSlotOverlap(entry.timeSlot, targetEntry.timeSlot)
        );
        
        affectedEntries.push(...facultyConflicts);
        conflictsIntroduced = facultyConflicts.length;
        feasibilityScore = facultyConflicts.length === 0 ? 0.8 : 0.2;
        break;

      case ChangeField.DURATION:
        // Check if new duration fits in the time slot
        const newDuration = change.proposedValue as number;
        const currentDuration = this.timeToMinutes(targetEntry.timeSlot.endTime) - 
                               this.timeToMinutes(targetEntry.timeSlot.startTime);
        
        if (newDuration > currentDuration) {
          // Need to extend the time slot
          const extendedEndTime = this.minutesToTime(
            this.timeToMinutes(targetEntry.timeSlot.startTime) + newDuration
          );
          
          // Check for conflicts with extended time
          const extendedConflicts = currentSchedule.filter(entry =>
            entry !== targetEntry &&
            entry.timeSlot.day === targetEntry.timeSlot.day &&
            this.timeToMinutes(entry.timeSlot.startTime) < this.timeToMinutes(extendedEndTime) &&
            this.timeToMinutes(entry.timeSlot.endTime) > this.timeToMinutes(targetEntry.timeSlot.startTime)
          );
          
          affectedEntries.push(...extendedConflicts);
          conflictsIntroduced = extendedConflicts.length;
        }
        
        feasibilityScore = conflictsIntroduced === 0 ? 0.7 : 0.4;
        break;
    }

    return {
      affectedEntries,
      conflictsIntroduced,
      conflictsResolved,
      feasibilityScore
    };
  }

  /**
   * Apply a single change to the schedule
   */
  private applyChange(
    change: ProposedChange,
    targetIndex: number,
    schedule: ScheduleEntry[]
  ): { success: boolean; modifiedSchedule: ScheduleEntry[]; error?: string } {
    try {
      const modifiedSchedule = [...schedule];
      const targetEntry = { ...modifiedSchedule[targetIndex] };

      switch (change.field) {
        case ChangeField.TIME_SLOT:
          targetEntry.timeSlot = change.proposedValue as TimeSlot;
          break;
        case ChangeField.FACULTY_ID:
          targetEntry.facultyId = change.proposedValue as string;
          break;
        case ChangeField.BATCH_ID:
          targetEntry.batchId = change.proposedValue as string;
          break;
        case ChangeField.SUBJECT_ID:
          targetEntry.subjectId = change.proposedValue as string;
          break;
        case ChangeField.DURATION:
          // Modify the end time based on new duration
          const newDuration = change.proposedValue as number;
          const newEndTime = this.minutesToTime(
            this.timeToMinutes(targetEntry.timeSlot.startTime) + newDuration
          );
          targetEntry.timeSlot = {
            ...targetEntry.timeSlot,
            endTime: newEndTime
          };
          break;
        default:
          return {
            success: false,
            modifiedSchedule: schedule,
            error: `Unsupported change field: ${change.field}`
          };
      }

      modifiedSchedule[targetIndex] = targetEntry;
      return { success: true, modifiedSchedule };

    } catch (error) {
      return {
        success: false,
        modifiedSchedule: schedule,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate the modified schedule
   */
  private validateModifiedSchedule(
    modifiedSchedule: ScheduleEntry[],
    originalSchedule: ScheduleEntry[]
  ): {
    warnings: string[];
    recommendations: string[];
    newConflicts: ConflictReport[];
    resolvedConflicts: ConflictReport[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const newConflicts: ConflictReport[] = [];
    const resolvedConflicts: ConflictReport[] = [];

    // Check for basic conflicts
    const conflicts = this.detectBasicConflicts(modifiedSchedule);
    newConflicts.push(...conflicts);

    if (conflicts.length > 0) {
      warnings.push(`${conflicts.length} conflicts detected after adjustment`);
      recommendations.push('Review the conflicts and consider additional adjustments');
    }

    // Check for schedule integrity
    if (modifiedSchedule.length !== originalSchedule.length) {
      warnings.push('Schedule entry count changed during adjustment');
    }

    return { warnings, recommendations, newConflicts, resolvedConflicts };
  }

  /**
   * Detect basic conflicts in a schedule
   */
  private detectBasicConflicts(schedule: ScheduleEntry[]): ConflictReport[] {
    const conflicts: ConflictReport[] = [];

    // Check for overlapping time slots
    for (let i = 0; i < schedule.length; i++) {
      for (let j = i + 1; j < schedule.length; j++) {
        const entry1 = schedule[i];
        const entry2 = schedule[j];

        if (entry1.batchId === entry2.batchId && 
            this.timeSlotOverlap(entry1.timeSlot, entry2.timeSlot)) {
          
          conflicts.push({
            conflictId: `conflict_${i}_${j}`,
            type: 'time_slot_overlap' as any,
            severity: 'high' as any,
            title: `Time slot overlap detected`,
            description: `Entries ${i} and ${j} have overlapping time slots`,
            affectedEntries: [entry1, entry2],
            suggestedResolutions: [],
            metadata: {
              detectedAt: new Date(),
              batchesAffected: [entry1.batchId],
              facultiesAffected: [entry1.facultyId, entry2.facultyId],
              timeSlotConflicts: [entry1.timeSlot, entry2.timeSlot]
            }
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Suggest reschedule alternatives
   */
  private suggestRescheduleAlternatives(
    originalRequest: AdjustmentRequest,
    currentSchedule: ScheduleEntry[]
  ): AdjustmentRequest[] {
    const alternatives: AdjustmentRequest[] = [];
    const workingDays = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY];

    // Suggest different days
    workingDays.forEach(day => {
      if (day !== originalRequest.targetEntry.timeSlot.day) {
        const alternativeSlot: TimeSlot = {
          ...originalRequest.targetEntry.timeSlot,
          day
        };

        alternatives.push(
          this.createAdjustmentRequest(
            AdjustmentType.RESCHEDULE_LECTURE,
            `Reschedule to ${day}`,
            originalRequest.targetEntry,
            [{
              field: ChangeField.TIME_SLOT,
              currentValue: originalRequest.targetEntry.timeSlot,
              proposedValue: alternativeSlot
            }],
            `Alternative day suggestion: ${day}`,
            AdjustmentPriority.LOW,
            'system_suggestion'
          )
        );
      }
    });

    return alternatives.slice(0, 3); // Limit to 3 alternatives
  }

  /**
   * Suggest swap alternatives
   */
  private suggestSwapAlternatives(
    originalRequest: AdjustmentRequest,
    currentSchedule: ScheduleEntry[]
  ): AdjustmentRequest[] {
    const alternatives: AdjustmentRequest[] = [];
    
    // Find potential swap partners
    const potentialPartners = currentSchedule.filter(entry =>
      entry.batchId !== originalRequest.targetEntry.batchId &&
      entry.facultyId !== originalRequest.targetEntry.facultyId
    );

    potentialPartners.slice(0, 3).forEach((partner, index) => {
      alternatives.push(
        this.createAdjustmentRequest(
          AdjustmentType.SWAP_LECTURES,
          `Swap with ${partner.subjectId}`,
          originalRequest.targetEntry,
          [{
            field: ChangeField.TIME_SLOT,
            currentValue: originalRequest.targetEntry.timeSlot,
            proposedValue: partner.timeSlot
          }],
          `Swap alternative ${index + 1}`,
          AdjustmentPriority.MEDIUM,
          'system_suggestion'
        )
      );
    });

    return alternatives;
  }

  /**
   * Suggest faculty change alternatives
   */
  private suggestFacultyChangeAlternatives(
    originalRequest: AdjustmentRequest,
    currentSchedule: ScheduleEntry[]
  ): AdjustmentRequest[] {
    const alternatives: AdjustmentRequest[] = [];
    
    // Get unique faculty IDs
    const availableFaculties = [...new Set(currentSchedule.map(e => e.facultyId))]
      .filter(id => id !== originalRequest.targetEntry.facultyId);

    availableFaculties.slice(0, 3).forEach((facultyId, index) => {
      alternatives.push(
        this.createAdjustmentRequest(
          AdjustmentType.CHANGE_FACULTY,
          `Assign to ${facultyId}`,
          originalRequest.targetEntry,
          [{
            field: ChangeField.FACULTY_ID,
            currentValue: originalRequest.targetEntry.facultyId,
            proposedValue: facultyId
          }],
          `Faculty alternative ${index + 1}`,
          AdjustmentPriority.MEDIUM,
          'system_suggestion'
        )
      );
    });

    return alternatives;
  }

  /**
   * Utility methods
   */
  private generateAdjustmentId(): string {
    return `adjustment_${++this.adjustmentCounter}`;
  }

  private generateChangeId(): string {
    return `change_${++this.changeCounter}`;
  }

  private entriesEqual(entry1: ScheduleEntry, entry2: ScheduleEntry): boolean {
    return entry1.batchId === entry2.batchId &&
           entry1.subjectId === entry2.subjectId &&
           entry1.facultyId === entry2.facultyId &&
           entry1.timeSlot.day === entry2.timeSlot.day &&
           entry1.timeSlot.startTime === entry2.timeSlot.startTime;
  }

  private timeSlotOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
    if (slot1.day !== slot2.day) {
      return false;
    }

    const start1 = this.timeToMinutes(slot1.startTime);
    const end1 = this.timeToMinutes(slot1.endTime);
    const start2 = this.timeToMinutes(slot2.startTime);
    const end2 = this.timeToMinutes(slot2.endTime);

    return start1 < end2 && start2 < end1;
  }

  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}
