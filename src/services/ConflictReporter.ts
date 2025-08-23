import { ScheduleEntry, TimeSlot, DayOfWeek, ConstraintViolation, Batch, Subject } from '../models';
import { BaseConstraint } from './constraints';

export interface ConflictReport {
  conflictId: string;
  type: ConflictType;
  severity: ConflictSeverity;
  title: string;
  description: string;
  affectedEntries: ScheduleEntry[];
  suggestedResolutions: ConflictResolution[];
  metadata: {
    detectedAt: Date;
    batchesAffected: string[];
    facultiesAffected: string[];
    timeSlotConflicts: TimeSlot[];
  };
}

export interface ConflictResolution {
  resolutionId: string;
  type: ResolutionType;
  description: string;
  confidence: number; // 0-1
  effort: ResolutionEffort;
  steps: ResolutionStep[];
  impact: {
    entriesModified: number;
    batchesAffected: string[];
    facultiesAffected: string[];
  };
}

export interface ResolutionStep {
  stepId: string;
  action: ResolutionAction;
  description: string;
  originalEntry?: ScheduleEntry;
  modifiedEntry?: ScheduleEntry;
  parameters?: Record<string, any>;
}

export enum ConflictType {
  FACULTY_DOUBLE_BOOKING = 'faculty_double_booking',
  TIME_SLOT_OVERLAP = 'time_slot_overlap',
  BATCH_OVERLOAD = 'batch_overload',
  HOLIDAY_CONFLICT = 'holiday_conflict',
  CONSTRAINT_VIOLATION = 'constraint_violation',
  RESOURCE_UNAVAILABLE = 'resource_unavailable',
  DISTRIBUTION_IMBALANCE = 'distribution_imbalance',
  EXCESSIVE_GAPS = 'excessive_gaps'
}

export enum ConflictSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export enum ResolutionType {
  RESCHEDULE = 'reschedule',
  SWAP = 'swap',
  SPLIT = 'split',
  MERGE = 'merge',
  REMOVE = 'remove',
  ADJUST_CONSTRAINTS = 'adjust_constraints',
  MANUAL_INTERVENTION = 'manual_intervention'
}

export enum ResolutionEffort {
  AUTOMATIC = 'automatic',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  MANUAL = 'manual'
}

export enum ResolutionAction {
  MOVE_ENTRY = 'move_entry',
  SWAP_ENTRIES = 'swap_entries',
  MODIFY_TIME = 'modify_time',
  CHANGE_FACULTY = 'change_faculty',
  SPLIT_LECTURE = 'split_lecture',
  MERGE_LECTURES = 'merge_lectures',
  REMOVE_ENTRY = 'remove_entry',
  ADD_CONSTRAINT = 'add_constraint',
  RELAX_CONSTRAINT = 'relax_constraint'
}

export interface ConflictAnalysis {
  totalConflicts: number;
  conflictsByType: Map<ConflictType, number>;
  conflictsBySeverity: Map<ConflictSeverity, number>;
  resolutionSummary: {
    automaticResolutions: number;
    manualInterventions: number;
    averageConfidence: number;
  };
  affectedResources: {
    batches: Set<string>;
    faculties: Set<string>;
    timeSlots: Set<string>;
  };
}

export class ConflictReporter {
  private conflictCounter = 0;
  private resolutionCounter = 0;

  /**
   * Generate comprehensive conflict report for a schedule
   */
  generateConflictReport(
    schedule: ScheduleEntry[],
    constraints: BaseConstraint[],
    batches: Batch[],
    holidays: Date[]
  ): ConflictReport[] {
    const conflicts: ConflictReport[] = [];

    // Detect different types of conflicts
    conflicts.push(...this.detectFacultyConflicts(schedule));
    conflicts.push(...this.detectTimeSlotOverlaps(schedule));
    conflicts.push(...this.detectBatchOverloads(schedule, batches));
    conflicts.push(...this.detectHolidayConflicts(schedule, holidays));
    conflicts.push(...this.detectConstraintViolations(schedule, constraints));
    conflicts.push(...this.detectDistributionImbalances(schedule, batches));
    conflicts.push(...this.detectExcessiveGaps(schedule));

    // Generate resolutions for each conflict
    conflicts.forEach(conflict => {
      conflict.suggestedResolutions = this.generateResolutions(conflict, schedule, constraints);
    });

    return conflicts;
  }

  /**
   * Analyze conflicts and provide summary statistics
   */
  analyzeConflicts(conflicts: ConflictReport[]): ConflictAnalysis {
    const conflictsByType = new Map<ConflictType, number>();
    const conflictsBySeverity = new Map<ConflictSeverity, number>();
    const affectedBatches = new Set<string>();
    const affectedFaculties = new Set<string>();
    const affectedTimeSlots = new Set<string>();

    let automaticResolutions = 0;
    let manualInterventions = 0;
    let totalConfidence = 0;
    let resolutionCount = 0;

    conflicts.forEach(conflict => {
      // Count by type
      const typeCount = conflictsByType.get(conflict.type) || 0;
      conflictsByType.set(conflict.type, typeCount + 1);

      // Count by severity
      const severityCount = conflictsBySeverity.get(conflict.severity) || 0;
      conflictsBySeverity.set(conflict.severity, severityCount + 1);

      // Track affected resources
      conflict.metadata.batchesAffected.forEach(batch => affectedBatches.add(batch));
      conflict.metadata.facultiesAffected.forEach(faculty => affectedFaculties.add(faculty));
      conflict.metadata.timeSlotConflicts.forEach(slot => 
        affectedTimeSlots.add(`${slot.day}_${slot.startTime}`)
      );

      // Analyze resolutions
      conflict.suggestedResolutions.forEach(resolution => {
        if (resolution.effort === ResolutionEffort.AUTOMATIC) {
          automaticResolutions++;
        } else if (resolution.effort === ResolutionEffort.MANUAL) {
          manualInterventions++;
        }
        totalConfidence += resolution.confidence;
        resolutionCount++;
      });
    });

    return {
      totalConflicts: conflicts.length,
      conflictsByType,
      conflictsBySeverity,
      resolutionSummary: {
        automaticResolutions,
        manualInterventions,
        averageConfidence: resolutionCount > 0 ? totalConfidence / resolutionCount : 0
      },
      affectedResources: {
        batches: affectedBatches,
        faculties: affectedFaculties,
        timeSlots: affectedTimeSlots
      }
    };
  }

  /**
   * Apply automatic resolutions to conflicts
   */
  applyAutomaticResolutions(
    conflicts: ConflictReport[],
    schedule: ScheduleEntry[],
    confidenceThreshold: number = 0.8
  ): {
    resolvedSchedule: ScheduleEntry[];
    appliedResolutions: ConflictResolution[];
    unresolvedConflicts: ConflictReport[];
  } {
    let currentSchedule = [...schedule];
    const appliedResolutions: ConflictResolution[] = [];
    const unresolvedConflicts: ConflictReport[] = [];

    for (const conflict of conflicts) {
      let resolved = false;

      for (const resolution of conflict.suggestedResolutions) {
        if (resolution.confidence >= confidenceThreshold && 
            resolution.effort === ResolutionEffort.AUTOMATIC) {
          
          const result = this.applyResolution(resolution, currentSchedule);
          if (result.success) {
            currentSchedule = result.modifiedSchedule;
            appliedResolutions.push(resolution);
            resolved = true;
            break;
          }
        }
      }

      if (!resolved) {
        unresolvedConflicts.push(conflict);
      }
    }

    return {
      resolvedSchedule: currentSchedule,
      appliedResolutions,
      unresolvedConflicts
    };
  }

  /**
   * Generate detailed conflict report in text format
   */
  generateTextReport(conflicts: ConflictReport[], analysis: ConflictAnalysis): string {
    const lines: string[] = [];
    
    lines.push('='.repeat(60));
    lines.push('TIMETABLE CONFLICT ANALYSIS REPORT');
    lines.push('='.repeat(60));
    lines.push('');

    // Summary
    lines.push('SUMMARY:');
    lines.push(`Total Conflicts: ${analysis.totalConflicts}`);
    lines.push(`Automatic Resolutions Available: ${analysis.resolutionSummary.automaticResolutions}`);
    lines.push(`Manual Interventions Required: ${analysis.resolutionSummary.manualInterventions}`);
    lines.push(`Average Resolution Confidence: ${(analysis.resolutionSummary.averageConfidence * 100).toFixed(1)}%`);
    lines.push('');

    // Conflicts by type
    lines.push('CONFLICTS BY TYPE:');
    analysis.conflictsByType.forEach((count, type) => {
      lines.push(`  ${type.replace(/_/g, ' ').toUpperCase()}: ${count}`);
    });
    lines.push('');

    // Conflicts by severity
    lines.push('CONFLICTS BY SEVERITY:');
    analysis.conflictsBySeverity.forEach((count, severity) => {
      lines.push(`  ${severity.toUpperCase()}: ${count}`);
    });
    lines.push('');

    // Affected resources
    lines.push('AFFECTED RESOURCES:');
    lines.push(`  Batches: ${analysis.affectedResources.batches.size}`);
    lines.push(`  Faculties: ${analysis.affectedResources.faculties.size}`);
    lines.push(`  Time Slots: ${analysis.affectedResources.timeSlots.size}`);
    lines.push('');

    // Detailed conflicts
    lines.push('DETAILED CONFLICTS:');
    lines.push('-'.repeat(40));
    
    conflicts.forEach((conflict, index) => {
      lines.push(`${index + 1}. ${conflict.title} [${conflict.severity.toUpperCase()}]`);
      lines.push(`   ${conflict.description}`);
      lines.push(`   Affected Entries: ${conflict.affectedEntries.length}`);
      lines.push(`   Suggested Resolutions: ${conflict.suggestedResolutions.length}`);
      
      if (conflict.suggestedResolutions.length > 0) {
        const bestResolution = conflict.suggestedResolutions[0];
        lines.push(`   Best Resolution: ${bestResolution.description} (${(bestResolution.confidence * 100).toFixed(1)}% confidence)`);
      }
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Detect faculty double booking conflicts
   */
  private detectFacultyConflicts(schedule: ScheduleEntry[]): ConflictReport[] {
    const conflicts: ConflictReport[] = [];
    const facultySchedules = new Map<string, ScheduleEntry[]>();

    // Group by faculty
    schedule.forEach(entry => {
      if (!facultySchedules.has(entry.facultyId)) {
        facultySchedules.set(entry.facultyId, []);
      }
      facultySchedules.get(entry.facultyId)!.push(entry);
    });

    // Check for overlaps within each faculty's schedule
    facultySchedules.forEach((entries, facultyId) => {
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          if (this.timeSlotOverlap(entries[i].timeSlot, entries[j].timeSlot)) {
            conflicts.push({
              conflictId: this.generateConflictId(),
              type: ConflictType.FACULTY_DOUBLE_BOOKING,
              severity: ConflictSeverity.CRITICAL,
              title: `Faculty Double Booking: ${facultyId}`,
              description: `Faculty ${facultyId} is scheduled for overlapping lectures on ${entries[i].timeSlot.day} at ${entries[i].timeSlot.startTime} and ${entries[j].timeSlot.startTime}`,
              affectedEntries: [entries[i], entries[j]],
              suggestedResolutions: [],
              metadata: {
                detectedAt: new Date(),
                batchesAffected: [entries[i].batchId, entries[j].batchId],
                facultiesAffected: [facultyId],
                timeSlotConflicts: [entries[i].timeSlot, entries[j].timeSlot]
              }
            });
          }
        }
      }
    });

    return conflicts;
  }

  /**
   * Detect time slot overlaps
   */
  private detectTimeSlotOverlaps(schedule: ScheduleEntry[]): ConflictReport[] {
    const conflicts: ConflictReport[] = [];
    
    for (let i = 0; i < schedule.length; i++) {
      for (let j = i + 1; j < schedule.length; j++) {
        const entry1 = schedule[i];
        const entry2 = schedule[j];
        
        if (entry1.batchId === entry2.batchId && 
            this.timeSlotOverlap(entry1.timeSlot, entry2.timeSlot)) {
          
          conflicts.push({
            conflictId: this.generateConflictId(),
            type: ConflictType.TIME_SLOT_OVERLAP,
            severity: ConflictSeverity.HIGH,
            title: `Time Slot Overlap: Batch ${entry1.batchId}`,
            description: `Batch ${entry1.batchId} has overlapping lectures: ${entry1.subjectId} and ${entry2.subjectId} on ${entry1.timeSlot.day}`,
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
   * Detect batch overload situations
   */
  private detectBatchOverloads(schedule: ScheduleEntry[], batches: Batch[]): ConflictReport[] {
    const conflicts: ConflictReport[] = [];
    const maxLecturesPerDay = 8; // Configurable threshold

    // Group by batch and day
    const batchDailyLoad = new Map<string, Map<DayOfWeek, ScheduleEntry[]>>();
    
    schedule.forEach(entry => {
      if (!batchDailyLoad.has(entry.batchId)) {
        batchDailyLoad.set(entry.batchId, new Map());
      }
      
      const dailyLoad = batchDailyLoad.get(entry.batchId)!;
      if (!dailyLoad.has(entry.timeSlot.day)) {
        dailyLoad.set(entry.timeSlot.day, []);
      }
      
      dailyLoad.get(entry.timeSlot.day)!.push(entry);
    });

    // Check for overloads
    batchDailyLoad.forEach((dailyLoad, batchId) => {
      dailyLoad.forEach((entries, day) => {
        if (entries.length > maxLecturesPerDay) {
          conflicts.push({
            conflictId: this.generateConflictId(),
            type: ConflictType.BATCH_OVERLOAD,
            severity: ConflictSeverity.MEDIUM,
            title: `Batch Overload: ${batchId} on ${day}`,
            description: `Batch ${batchId} has ${entries.length} lectures on ${day}, exceeding the recommended maximum of ${maxLecturesPerDay}`,
            affectedEntries: entries,
            suggestedResolutions: [],
            metadata: {
              detectedAt: new Date(),
              batchesAffected: [batchId],
              facultiesAffected: [...new Set(entries.map(e => e.facultyId))],
              timeSlotConflicts: entries.map(e => e.timeSlot)
            }
          });
        }
      });
    });

    return conflicts;
  }

  /**
   * Detect holiday conflicts
   */
  private detectHolidayConflicts(schedule: ScheduleEntry[], holidays: Date[]): ConflictReport[] {
    const conflicts: ConflictReport[] = [];
    
    if (holidays.length === 0) {
      return conflicts;
    }

    const holidayDays = new Set(holidays.map(date => this.getDateDayOfWeek(date)));
    
    const conflictingEntries = schedule.filter(entry => 
      holidayDays.has(entry.timeSlot.day)
    );

    if (conflictingEntries.length > 0) {
      conflicts.push({
        conflictId: this.generateConflictId(),
        type: ConflictType.HOLIDAY_CONFLICT,
        severity: ConflictSeverity.HIGH,
        title: `Holiday Conflicts`,
        description: `${conflictingEntries.length} lectures are scheduled on holiday days`,
        affectedEntries: conflictingEntries,
        suggestedResolutions: [],
        metadata: {
          detectedAt: new Date(),
          batchesAffected: [...new Set(conflictingEntries.map(e => e.batchId))],
          facultiesAffected: [...new Set(conflictingEntries.map(e => e.facultyId))],
          timeSlotConflicts: conflictingEntries.map(e => e.timeSlot)
        }
      });
    }

    return conflicts;
  }

  /**
   * Detect constraint violations
   */
  private detectConstraintViolations(schedule: ScheduleEntry[], constraints: BaseConstraint[]): ConflictReport[] {
    const conflicts: ConflictReport[] = [];

    for (const entry of schedule) {
      const otherEntries = schedule.filter(e => e !== entry);
      
      for (const constraint of constraints) {
        if (!constraint.isConstraintEnabled()) {
          continue;
        }

        const violation = constraint.validate(entry, otherEntries);
        if (violation) {
          conflicts.push({
            conflictId: this.generateConflictId(),
            type: ConflictType.CONSTRAINT_VIOLATION,
            severity: violation.severity === 'error' ? ConflictSeverity.HIGH : ConflictSeverity.MEDIUM,
            title: `Constraint Violation: ${violation.type}`,
            description: violation.message,
            affectedEntries: [entry, ...violation.affectedEntries],
            suggestedResolutions: [],
            metadata: {
              detectedAt: new Date(),
              batchesAffected: [entry.batchId],
              facultiesAffected: [entry.facultyId],
              timeSlotConflicts: [entry.timeSlot]
            }
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect distribution imbalances
   */
  private detectDistributionImbalances(schedule: ScheduleEntry[], batches: Batch[]): ConflictReport[] {
    const conflicts: ConflictReport[] = [];

    // Group by subject
    const subjectGroups = new Map<string, ScheduleEntry[]>();
    schedule.forEach(entry => {
      const key = `${entry.batchId}_${entry.subjectId}`;
      if (!subjectGroups.has(key)) {
        subjectGroups.set(key, []);
      }
      subjectGroups.get(key)!.push(entry);
    });

    // Check for poor distribution
    subjectGroups.forEach((entries, key) => {
      if (entries.length > 2) {
        const days = new Set(entries.map(e => e.timeSlot.day));
        const distributionRatio = days.size / entries.length;
        
        if (distributionRatio < 0.5) { // More than half on same days
          conflicts.push({
            conflictId: this.generateConflictId(),
            type: ConflictType.DISTRIBUTION_IMBALANCE,
            severity: ConflictSeverity.LOW,
            title: `Poor Distribution: ${key}`,
            description: `Subject ${key} has poor distribution across weekdays (${days.size} days for ${entries.length} lectures)`,
            affectedEntries: entries,
            suggestedResolutions: [],
            metadata: {
              detectedAt: new Date(),
              batchesAffected: [entries[0].batchId],
              facultiesAffected: [...new Set(entries.map(e => e.facultyId))],
              timeSlotConflicts: entries.map(e => e.timeSlot)
            }
          });
        }
      }
    });

    return conflicts;
  }

  /**
   * Detect excessive gaps in schedules
   */
  private detectExcessiveGaps(schedule: ScheduleEntry[]): ConflictReport[] {
    const conflicts: ConflictReport[] = [];
    const maxAcceptableGap = 180; // 3 hours

    // Group by batch and day
    const batchDailySchedules = new Map<string, Map<DayOfWeek, ScheduleEntry[]>>();
    
    schedule.forEach(entry => {
      if (!batchDailySchedules.has(entry.batchId)) {
        batchDailySchedules.set(entry.batchId, new Map());
      }
      
      const dailySchedules = batchDailySchedules.get(entry.batchId)!;
      if (!dailySchedules.has(entry.timeSlot.day)) {
        dailySchedules.set(entry.timeSlot.day, []);
      }
      
      dailySchedules.get(entry.timeSlot.day)!.push(entry);
    });

    // Check for excessive gaps
    batchDailySchedules.forEach((dailySchedules, batchId) => {
      dailySchedules.forEach((entries, day) => {
        if (entries.length > 1) {
          const sortedEntries = entries.sort((a, b) => 
            this.timeToMinutes(a.timeSlot.startTime) - this.timeToMinutes(b.timeSlot.startTime)
          );

          for (let i = 1; i < sortedEntries.length; i++) {
            const gap = this.calculateGapBetweenEntries(sortedEntries[i-1], sortedEntries[i]);
            
            if (gap > maxAcceptableGap) {
              conflicts.push({
                conflictId: this.generateConflictId(),
                type: ConflictType.EXCESSIVE_GAPS,
                severity: ConflictSeverity.LOW,
                title: `Excessive Gap: ${batchId} on ${day}`,
                description: `Batch ${batchId} has a ${Math.round(gap/60)} hour gap between lectures on ${day}`,
                affectedEntries: [sortedEntries[i-1], sortedEntries[i]],
                suggestedResolutions: [],
                metadata: {
                  detectedAt: new Date(),
                  batchesAffected: [batchId],
                  facultiesAffected: [sortedEntries[i-1].facultyId, sortedEntries[i].facultyId],
                  timeSlotConflicts: [sortedEntries[i-1].timeSlot, sortedEntries[i].timeSlot]
                }
              });
            }
          }
        }
      });
    });

    return conflicts;
  }

  /**
   * Generate resolutions for a conflict
   */
  private generateResolutions(
    conflict: ConflictReport, 
    schedule: ScheduleEntry[], 
    constraints: BaseConstraint[]
  ): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];

    switch (conflict.type) {
      case ConflictType.FACULTY_DOUBLE_BOOKING:
        resolutions.push(...this.generateFacultyConflictResolutions(conflict, schedule));
        break;
      case ConflictType.TIME_SLOT_OVERLAP:
        resolutions.push(...this.generateOverlapResolutions(conflict, schedule));
        break;
      case ConflictType.BATCH_OVERLOAD:
        resolutions.push(...this.generateOverloadResolutions(conflict, schedule));
        break;
      case ConflictType.HOLIDAY_CONFLICT:
        resolutions.push(...this.generateHolidayResolutions(conflict, schedule));
        break;
      case ConflictType.DISTRIBUTION_IMBALANCE:
        resolutions.push(...this.generateDistributionResolutions(conflict, schedule));
        break;
      case ConflictType.EXCESSIVE_GAPS:
        resolutions.push(...this.generateGapResolutions(conflict, schedule));
        break;
    }

    return resolutions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate resolutions for faculty conflicts
   */
  private generateFacultyConflictResolutions(
    conflict: ConflictReport, 
    schedule: ScheduleEntry[]
  ): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];
    const [entry1, entry2] = conflict.affectedEntries;

    // Resolution 1: Reschedule one of the entries
    resolutions.push({
      resolutionId: this.generateResolutionId(),
      type: ResolutionType.RESCHEDULE,
      description: `Reschedule ${entry2.subjectId} to a different time slot`,
      confidence: 0.8,
      effort: ResolutionEffort.AUTOMATIC,
      steps: [{
        stepId: '1',
        action: ResolutionAction.MOVE_ENTRY,
        description: `Move ${entry2.subjectId} from ${entry2.timeSlot.startTime} to an available slot`,
        originalEntry: entry2,
        modifiedEntry: undefined // Would be determined during application
      }],
      impact: {
        entriesModified: 1,
        batchesAffected: [entry2.batchId],
        facultiesAffected: [entry2.facultyId]
      }
    });

    // Resolution 2: Swap with another entry
    resolutions.push({
      resolutionId: this.generateResolutionId(),
      type: ResolutionType.SWAP,
      description: `Swap time slots between conflicting entries`,
      confidence: 0.6,
      effort: ResolutionEffort.LOW,
      steps: [{
        stepId: '1',
        action: ResolutionAction.SWAP_ENTRIES,
        description: `Swap time slots of ${entry1.subjectId} and ${entry2.subjectId}`,
        originalEntry: entry1,
        modifiedEntry: entry2
      }],
      impact: {
        entriesModified: 2,
        batchesAffected: [entry1.batchId, entry2.batchId],
        facultiesAffected: [entry1.facultyId]
      }
    });

    return resolutions;
  }

  /**
   * Generate resolutions for overlap conflicts
   */
  private generateOverlapResolutions(
    conflict: ConflictReport, 
    schedule: ScheduleEntry[]
  ): ConflictResolution[] {
    return this.generateFacultyConflictResolutions(conflict, schedule);
  }

  /**
   * Generate resolutions for overload conflicts
   */
  private generateOverloadResolutions(
    conflict: ConflictReport, 
    schedule: ScheduleEntry[]
  ): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];

    resolutions.push({
      resolutionId: this.generateResolutionId(),
      type: ResolutionType.RESCHEDULE,
      description: `Redistribute lectures across different days`,
      confidence: 0.7,
      effort: ResolutionEffort.MEDIUM,
      steps: [{
        stepId: '1',
        action: ResolutionAction.MOVE_ENTRY,
        description: `Move some lectures to less loaded days`,
        parameters: { targetDays: ['tuesday', 'wednesday', 'thursday'] }
      }],
      impact: {
        entriesModified: Math.ceil(conflict.affectedEntries.length / 2),
        batchesAffected: conflict.metadata.batchesAffected,
        facultiesAffected: conflict.metadata.facultiesAffected
      }
    });

    return resolutions;
  }

  /**
   * Generate resolutions for holiday conflicts
   */
  private generateHolidayResolutions(
    conflict: ConflictReport, 
    schedule: ScheduleEntry[]
  ): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];

    resolutions.push({
      resolutionId: this.generateResolutionId(),
      type: ResolutionType.RESCHEDULE,
      description: `Reschedule all holiday-conflicting lectures to working days`,
      confidence: 0.9,
      effort: ResolutionEffort.AUTOMATIC,
      steps: conflict.affectedEntries.map((entry, index) => ({
        stepId: (index + 1).toString(),
        action: ResolutionAction.MOVE_ENTRY,
        description: `Move ${entry.subjectId} from holiday to working day`,
        originalEntry: entry
      })),
      impact: {
        entriesModified: conflict.affectedEntries.length,
        batchesAffected: conflict.metadata.batchesAffected,
        facultiesAffected: conflict.metadata.facultiesAffected
      }
    });

    return resolutions;
  }

  /**
   * Generate resolutions for distribution conflicts
   */
  private generateDistributionResolutions(
    conflict: ConflictReport, 
    schedule: ScheduleEntry[]
  ): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];

    resolutions.push({
      resolutionId: this.generateResolutionId(),
      type: ResolutionType.RESCHEDULE,
      description: `Redistribute lectures evenly across weekdays`,
      confidence: 0.6,
      effort: ResolutionEffort.MEDIUM,
      steps: [{
        stepId: '1',
        action: ResolutionAction.MOVE_ENTRY,
        description: `Spread lectures across different days for better distribution`
      }],
      impact: {
        entriesModified: Math.ceil(conflict.affectedEntries.length / 2),
        batchesAffected: conflict.metadata.batchesAffected,
        facultiesAffected: conflict.metadata.facultiesAffected
      }
    });

    return resolutions;
  }

  /**
   * Generate resolutions for gap conflicts
   */
  private generateGapResolutions(
    conflict: ConflictReport, 
    schedule: ScheduleEntry[]
  ): ConflictResolution[] {
    const resolutions: ConflictResolution[] = [];

    resolutions.push({
      resolutionId: this.generateResolutionId(),
      type: ResolutionType.RESCHEDULE,
      description: `Move lectures closer together to reduce gaps`,
      confidence: 0.5,
      effort: ResolutionEffort.LOW,
      steps: [{
        stepId: '1',
        action: ResolutionAction.MOVE_ENTRY,
        description: `Reschedule one lecture to reduce the gap`
      }],
      impact: {
        entriesModified: 1,
        batchesAffected: conflict.metadata.batchesAffected,
        facultiesAffected: conflict.metadata.facultiesAffected
      }
    });

    return resolutions;
  }

  /**
   * Apply a resolution to the schedule
   */
  private applyResolution(
    resolution: ConflictResolution, 
    schedule: ScheduleEntry[]
  ): { success: boolean; modifiedSchedule: ScheduleEntry[]; error?: string } {
    try {
      let modifiedSchedule = [...schedule];

      for (const step of resolution.steps) {
        switch (step.action) {
          case ResolutionAction.MOVE_ENTRY:
            if (step.originalEntry) {
              // Find a new time slot for the entry
              const newSlot = this.findAlternativeTimeSlot(step.originalEntry, modifiedSchedule);
              if (newSlot) {
                const entryIndex = modifiedSchedule.findIndex(e => 
                  e.batchId === step.originalEntry!.batchId &&
                  e.subjectId === step.originalEntry!.subjectId &&
                  e.timeSlot.startTime === step.originalEntry!.timeSlot.startTime
                );
                
                if (entryIndex !== -1) {
                  modifiedSchedule[entryIndex] = {
                    ...step.originalEntry,
                    timeSlot: newSlot
                  };
                }
              }
            }
            break;
          
          case ResolutionAction.SWAP_ENTRIES:
            if (step.originalEntry && step.modifiedEntry) {
              const index1 = modifiedSchedule.findIndex(e => 
                e.batchId === step.originalEntry!.batchId &&
                e.subjectId === step.originalEntry!.subjectId
              );
              const index2 = modifiedSchedule.findIndex(e => 
                e.batchId === step.modifiedEntry!.batchId &&
                e.subjectId === step.modifiedEntry!.subjectId
              );
              
              if (index1 !== -1 && index2 !== -1) {
                const temp = modifiedSchedule[index1].timeSlot;
                modifiedSchedule[index1].timeSlot = modifiedSchedule[index2].timeSlot;
                modifiedSchedule[index2].timeSlot = temp;
              }
            }
            break;
        }
      }

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
   * Find alternative time slot for an entry
   */
  private findAlternativeTimeSlot(entry: ScheduleEntry, schedule: ScheduleEntry[]): TimeSlot | null {
    const workingDays = [
      DayOfWeek.MONDAY, 
      DayOfWeek.TUESDAY, 
      DayOfWeek.WEDNESDAY, 
      DayOfWeek.THURSDAY, 
      DayOfWeek.FRIDAY
    ];

    const occupiedSlots = new Set(
      schedule.map(e => `${e.timeSlot.day}_${e.timeSlot.startTime}`)
    );

    for (const day of workingDays) {
      for (let hour = 8; hour < 17; hour++) {
        const startTime = `${hour.toString().padStart(2, '0')}:00`;
        const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
        const slotKey = `${day}_${startTime}`;

        if (!occupiedSlots.has(slotKey)) {
          return {
            day,
            startTime,
            endTime,
            isAvailable: true
          };
        }
      }
    }

    return null;
  }

  /**
   * Utility methods
   */
  private generateConflictId(): string {
    return `conflict_${++this.conflictCounter}`;
  }

  private generateResolutionId(): string {
    return `resolution_${++this.resolutionCounter}`;
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

  private calculateGapBetweenEntries(entry1: ScheduleEntry, entry2: ScheduleEntry): number {
    const end1 = this.timeToMinutes(entry1.timeSlot.endTime);
    const start2 = this.timeToMinutes(entry2.timeSlot.startTime);
    return Math.max(0, start2 - end1);
  }

  private getDateDayOfWeek(date: Date): DayOfWeek {
    const dayIndex = date.getDay();
    switch (dayIndex) {
      case 0: return DayOfWeek.SUNDAY;
      case 1: return DayOfWeek.MONDAY;
      case 2: return DayOfWeek.TUESDAY;
      case 3: return DayOfWeek.WEDNESDAY;
      case 4: return DayOfWeek.THURSDAY;
      case 5: return DayOfWeek.FRIDAY;
      case 6: return DayOfWeek.SATURDAY;
      default: return DayOfWeek.MONDAY;
    }
  }
}
