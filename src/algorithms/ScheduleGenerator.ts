import { ScheduleGenerator as IScheduleGenerator } from '../services';
import { Batch, Subject, WeeklySchedule, ScheduleEntry, TimeSlot, DayOfWeek, ConstraintViolation } from '../models';
import { BaseConstraint } from '../services/constraints';
import { ConflictResolver, HolidayConflict } from '../services/ConflictResolver';
import { TimeSlotManager } from './TimeSlotManager';
import { ConstraintPropagator, Domain } from './ConstraintPropagator';
import { ScheduleOptimizer, OptimizationMetrics } from './ScheduleOptimizer';
import { ErrorHandler, ErrorFactory, ErrorCode, TimetableError, ErrorBoundary } from '../errors';
import { ImpossibleScenarioDetector, ConstraintRelaxationService, PartialScheduleGenerator } from '../services';

export interface SchedulingOptions {
  workingDays: DayOfWeek[];
  workingHours: { start: string; end: string };
  slotDuration: number; // in minutes
  breakDuration: number; // in minutes between slots
  maxAttemptsPerLecture: number;
  allowPartialSchedules: boolean;
  prioritizeEvenDistribution: boolean;
}

export interface SchedulingResult {
  schedule: WeeklySchedule;
  success: boolean;
  unscheduledLectures: {
    batchId: string;
    subjectId: string;
    remainingLectures: number;
    reason: string;
  }[];
  statistics: {
    totalLectures: number;
    scheduledLectures: number;
    attempts: number;
    backtrackCount: number;
    executionTimeMs: number;
  };
}

export class ScheduleGenerator implements IScheduleGenerator {
  private timeSlotManager: TimeSlotManager;
  private constraintPropagator: ConstraintPropagator;
  private scheduleOptimizer: ScheduleOptimizer;
  private conflictResolver: ConflictResolver;
  private options: SchedulingOptions;
  private errorHandler: ErrorHandler;
  private errorBoundary: ErrorBoundary;
  private scenarioDetector: ImpossibleScenarioDetector;
  private relaxationService: ConstraintRelaxationService;
  private partialGenerator: PartialScheduleGenerator;

  constructor(options?: Partial<SchedulingOptions>) {
    this.options = {
      workingDays: [
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY
      ],
      workingHours: { start: '08:00', end: '18:00' },
      slotDuration: 60, // 1 hour default
      breakDuration: 15, // 15 minutes between slots
      maxAttemptsPerLecture: 100,
      allowPartialSchedules: true,
      prioritizeEvenDistribution: true,
      ...options
    };

    this.timeSlotManager = new TimeSlotManager();
    this.constraintPropagator = new ConstraintPropagator();
    this.scheduleOptimizer = new ScheduleOptimizer({
      prioritizeEvenDistribution: this.options.prioritizeEvenDistribution
    });
    this.conflictResolver = new ConflictResolver();
    
    // Initialize error handling
    this.errorHandler = new ErrorHandler({
      enableLogging: true,
      enableUserGuidance: false, // Let UI handle user guidance
      enableAutoRecovery: true,
      maxRetryAttempts: 3
    });
    
    this.errorBoundary = new ErrorBoundary({
      component: 'ScheduleGenerator',
      enableRecovery: true,
      maxRecoveryAttempts: 3
    });
    
    // Initialize impossible scenario detection services
    this.scenarioDetector = new ImpossibleScenarioDetector();
    this.relaxationService = new ConstraintRelaxationService();
    this.partialGenerator = new PartialScheduleGenerator();
  }

  /**
   * Generate a complete timetable using backtracking algorithm with holiday conflict resolution
   */
  async generateTimetable(
    batches: Batch[],
    constraints: BaseConstraint[],
    holidays: Date[]
  ): Promise<WeeklySchedule> {
    return await this.errorBoundary.execute(async () => {
      const startTime = Date.now();
      
      // Validate inputs
      this.validateInputs(batches, constraints, holidays);
      
      // Check for impossible scheduling scenarios
      this.checkSchedulingFeasibility(batches, holidays);
      
      try {
        // First, generate initial schedule
        const result = await this.generateScheduleWithBacktracking(batches, constraints, holidays);
        
        // Then, resolve any holiday conflicts
        const conflictResolution = this.resolveHolidayConflictsInSchedule(
          result.schedule.entries,
          holidays,
          constraints,
          batches
        );

        // Combine original conflicts with holiday conflict information
        const allConflicts = [
          ...result.schedule.conflicts,
          ...this.convertHolidayConflictsToViolations(conflictResolution.unresolvableConflicts)
        ];

        const schedule = new WeeklySchedule(
          conflictResolution.resolvedSchedule,
          allConflicts,
          {
            generatedAt: new Date(),
            totalLectures: conflictResolution.resolvedSchedule.length,
            batchCount: batches.length,
            holidayConflictsResolved: conflictResolution.conflicts.length,
            unresolvableHolidayConflicts: conflictResolution.unresolvableConflicts.length,
            generationTimeMs: Date.now() - startTime
          }
        );

        // Validate the generated schedule
        this.validateGeneratedSchedule(schedule);
        
        return schedule;
        
      } catch (error) {
        // Handle scheduling errors with recovery
        const timetableError = this.createSchedulingError(error, batches, constraints, holidays);
        await this.errorHandler.handleError(timetableError, {
          component: 'ScheduleGenerator',
          operation: 'generateTimetable'
        });
        
        // Return empty schedule with error information
        return new WeeklySchedule(
          [],
          [{
            type: 'generation-error',
            message: `Schedule generation failed: ${error.message}`,
            affectedEntries: [],
            severity: 'error'
          }],
          {
            generatedAt: new Date(),
            totalLectures: 0,
            batchCount: batches.length,
            generationTimeMs: Date.now() - startTime,
            error: error.message
          }
        );
      }
    }, 'generateTimetable') || new WeeklySchedule([], [], { generatedAt: new Date(), totalLectures: 0, batchCount: 0 });
  }

  /**
   * Optimize the distribution of lectures in a schedule
   */
  optimizeDistribution(schedule: ScheduleEntry[]): ScheduleEntry[] {
    return this.scheduleOptimizer.optimize(schedule);
  }

  /**
   * Generate schedule using backtracking algorithm with constraint propagation
   */
  private async generateScheduleWithBacktracking(
    batches: Batch[],
    constraints: BaseConstraint[],
    holidays: Date[]
  ): Promise<SchedulingResult> {
    const startTime = Date.now();
    let attempts = 0;
    let backtrackCount = 0;

    // Initialize time slots
    const availableSlots = this.timeSlotManager.initializeSlots(
      this.options.workingDays.map(day => day.toString()),
      this.options.workingHours.start,
      this.options.workingHours.end,
      this.options.slotDuration
    );

    // Exclude holidays
    const workingSlots = this.timeSlotManager.excludeHolidays(availableSlots, holidays);

    // Create lecture requirements
    const lectureRequirements = this.createLectureRequirements(batches);
    const totalLectures = lectureRequirements.length;

    // Create initial domains for constraint propagation
    const domains = this.constraintPropagator.createInitialDomains(
      lectureRequirements.map((req, index) => ({
        lectureId: `lecture_${index}`,
        duration: req.duration
      })),
      workingSlots
    );

    // Apply initial constraint propagation
    this.constraintPropagator.propagateConstraints(domains, constraints, []);

    // Initialize schedule
    const schedule: ScheduleEntry[] = [];
    const unscheduledLectures: {
      batchId: string;
      subjectId: string;
      remainingLectures: number;
      reason: string;
    }[] = [];

    // Enhanced backtracking algorithm with constraint propagation
    const backtrack = (lectureIndex: number, currentDomains: Domain[]): boolean => {
      if (lectureIndex >= lectureRequirements.length) {
        return true; // All lectures scheduled
      }

      // Use most constrained variable heuristic
      const mostConstrained = this.constraintPropagator.findMostConstrainedDomain(currentDomains);
      if (!mostConstrained || mostConstrained.availableSlots.length === 0) {
        return false; // No valid assignments possible
      }

      const lectureIndexToSchedule = currentDomains.indexOf(mostConstrained);
      const lecture = lectureRequirements[lectureIndexToSchedule];

      // Use least constraining value heuristic
      const remainingDomains = currentDomains.filter(d => d !== mostConstrained);
      const orderedSlots = this.constraintPropagator.orderSlotsByLeastConstraining(
        mostConstrained,
        remainingDomains,
        constraints
      );

      for (const slot of orderedSlots) {
        attempts++;
        
        if (attempts > this.options.maxAttemptsPerLecture * totalLectures) {
          break; // Prevent infinite loops
        }

        const entry: ScheduleEntry = {
          batchId: lecture.batchId,
          subjectId: lecture.subjectId,
          facultyId: lecture.facultyId,
          timeSlot: slot
        };

        // Check constraints
        if (this.satisfiesConstraints(entry, schedule, constraints)) {
          schedule.push(entry);

          // Apply forward checking to remaining domains
          const updatedDomains = this.constraintPropagator.forwardCheck(
            entry,
            remainingDomains,
            constraints,
            schedule
          );

          // Check if domains are still consistent
          if (this.constraintPropagator.areDomainsConsistent(updatedDomains)) {
            if (backtrack(lectureIndex + 1, updatedDomains)) {
              return true; // Solution found
            }
          }
          
          // Backtrack
          schedule.pop();
          backtrackCount++;
        }
      }

      // If we can't schedule this lecture and partial schedules are allowed
      if (this.options.allowPartialSchedules) {
        unscheduledLectures.push({
          batchId: lecture.batchId,
          subjectId: lecture.subjectId,
          remainingLectures: 1,
          reason: 'No available time slots that satisfy all constraints'
        });
        
        // Remove this domain and continue
        const remainingDomains = currentDomains.filter(d => d !== mostConstrained);
        return backtrack(lectureIndex + 1, remainingDomains);
      }

      return false; // No solution found
    };

    const success = backtrack(0, domains);
    const executionTime = Date.now() - startTime;

    // Optimize the final schedule
    const optimizedSchedule = this.optimizeDistribution(schedule);

    return {
      schedule: {
        entries: optimizedSchedule,
        conflicts: [],
        metadata: {
          generatedAt: new Date(),
          totalLectures: optimizedSchedule.length,
          batchCount: batches.length
        }
      },
      success,
      unscheduledLectures,
      statistics: {
        totalLectures,
        scheduledLectures: optimizedSchedule.length,
        attempts,
        backtrackCount,
        executionTimeMs: executionTime
      }
    };
  }

  /**
   * Create lecture requirements from batches
   */
  private createLectureRequirements(batches: Batch[]): {
    batchId: string;
    subjectId: string;
    facultyId: string;
    duration: number;
  }[] {
    const requirements: {
      batchId: string;
      subjectId: string;
      facultyId: string;
      duration: number;
    }[] = [];

    batches.forEach(batch => {
      batch.subjects.forEach(subject => {
        // Create one requirement for each lecture per week
        for (let i = 0; i < subject.lecturesPerWeek; i++) {
          requirements.push({
            batchId: batch.id,
            subjectId: subject.id,
            facultyId: subject.facultyId,
            duration: subject.lectureDuration
          });
        }
      });
    });

    // Sort by priority (longer lectures first, then by faculty to group similar lectures)
    requirements.sort((a, b) => {
      if (a.duration !== b.duration) {
        return b.duration - a.duration; // Longer lectures first
      }
      return a.facultyId.localeCompare(b.facultyId);
    });

    return requirements;
  }

  /**
   * Find candidate time slots for a lecture
   */
  private findCandidateSlots(
    lecture: { duration: number; facultyId: string },
    availableSlots: TimeSlot[],
    currentSchedule: ScheduleEntry[]
  ): TimeSlot[] {
    return availableSlots.filter(slot => {
      // Check if slot can accommodate the lecture duration
      if (!this.timeSlotManager.isSlotAvailable(slot, currentSchedule)) {
        return false;
      }

      // Check if slot duration is sufficient
      const slotDuration = this.calculateSlotDuration(slot);
      if (slotDuration < lecture.duration) {
        return false;
      }

      return true;
    });
  }

  /**
   * Check if a schedule entry satisfies all constraints
   */
  private satisfiesConstraints(
    entry: ScheduleEntry,
    currentSchedule: ScheduleEntry[],
    constraints: BaseConstraint[]
  ): boolean {
    return constraints.every(constraint => {
      if (!constraint.isConstraintEnabled()) {
        return true;
      }

      try {
        const violation = constraint.validate(entry, currentSchedule);
        return violation === null;
      } catch (error) {
        // If constraint fails, consider it as not satisfied
        return false;
      }
    });
  }

  /**
   * Space out lectures for better distribution
   */
  private spaceOutLectures(entries: ScheduleEntry[], usedSlots: Set<string>): ScheduleEntry[] {
    if (entries.length <= 1) {
      return entries;
    }

    // Sort entries by day and time
    const sortedEntries = [...entries].sort((a, b) => {
      const dayOrder = Object.values(DayOfWeek);
      const dayA = dayOrder.indexOf(a.timeSlot.day);
      const dayB = dayOrder.indexOf(b.timeSlot.day);
      
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      
      return a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
    });

    // Try to ensure minimum spacing between lectures
    const spacedEntries: ScheduleEntry[] = [];
    const minSpacingDays = Math.max(1, Math.floor(5 / entries.length)); // Spread across week

    for (let i = 0; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];
      
      if (i === 0) {
        spacedEntries.push(entry);
        continue;
      }

      // Check if current entry has adequate spacing from previous ones
      const hasAdequateSpacing = spacedEntries.every(prevEntry => {
        const dayDiff = this.calculateDayDifference(prevEntry.timeSlot.day, entry.timeSlot.day);
        return dayDiff >= minSpacingDays;
      });

      if (hasAdequateSpacing || spacedEntries.length === 0) {
        spacedEntries.push(entry);
      } else {
        // Try to find a better slot for this entry
        // For now, just add it as-is (more sophisticated logic could be added)
        spacedEntries.push(entry);
      }
    }

    return spacedEntries;
  }

  /**
   * Calculate duration of a time slot in minutes
   */
  private calculateSlotDuration(slot: TimeSlot): number {
    const startMinutes = this.timeToMinutes(slot.startTime);
    const endMinutes = this.timeToMinutes(slot.endTime);
    return endMinutes - startMinutes;
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Get unique key for a time slot
   */
  private getSlotKey(slot: TimeSlot): string {
    return `${slot.day}_${slot.startTime}_${slot.endTime}`;
  }

  /**
   * Calculate difference between two days in the week
   */
  private calculateDayDifference(day1: DayOfWeek, day2: DayOfWeek): number {
    const dayOrder = Object.values(DayOfWeek);
    const index1 = dayOrder.indexOf(day1);
    const index2 = dayOrder.indexOf(day2);
    return Math.abs(index2 - index1);
  }

  /**
   * Get scheduling options
   */
  getOptions(): SchedulingOptions {
    return { ...this.options };
  }

  /**
   * Update scheduling options
   */
  setOptions(options: Partial<SchedulingOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get statistics about the last generation attempt
   */
  getLastGenerationStatistics(): {
    totalSlots: number;
    availableSlots: number;
    utilizationRate: number;
  } | null {
    // This would be populated during generation
    // For now, return null as we don't store this state
    return null;
  }

  /**
   * Get optimization metrics for a schedule
   */
  getOptimizationMetrics(schedule: ScheduleEntry[]): OptimizationMetrics {
    return this.scheduleOptimizer.calculateMetrics(schedule);
  }

  /**
   * Get constraint propagation statistics
   */
  getConstraintPropagationStatistics(): {
    totalPropagations: number;
    constraintApplications: number;
    slotsEliminated: number;
  } {
    return this.constraintPropagator.getStatistics();
  }

  /**
   * Reset constraint propagation statistics
   */
  resetConstraintPropagationStatistics(): void {
    this.constraintPropagator.resetStatistics();
  }

  /**
   * Update optimization options
   */
  setOptimizationOptions(options: Partial<{
    prioritizeEvenDistribution: boolean;
    minimizeGaps: boolean;
    balanceFacultyWorkload: boolean;
    preferMorningSlots: boolean;
  }>): void {
    this.scheduleOptimizer.setOptions(options);
  }

  /**
   * Resolve holiday conflicts in an existing schedule
   */
  private resolveHolidayConflictsInSchedule(
    schedule: ScheduleEntry[],
    holidays: Date[],
    constraints: BaseConstraint[],
    batches: Batch[]
  ): {
    conflicts: HolidayConflict[];
    resolvedSchedule: ScheduleEntry[];
    unresolvableConflicts: HolidayConflict[];
  } {
    // Get all available slots for rescheduling
    const availableSlots = this.timeSlotManager.initializeSlots(
      this.options.workingDays.map(day => day.toString()),
      this.options.workingHours.start,
      this.options.workingHours.end,
      this.options.slotDuration
    );

    // Exclude holidays from available slots
    const workingSlots = this.timeSlotManager.excludeHolidays(availableSlots, holidays);

    return this.conflictResolver.resolveHolidayConflicts(
      schedule,
      holidays,
      workingSlots,
      constraints
    );
  }

  /**
   * Convert holiday conflicts to constraint violations for reporting
   */
  private convertHolidayConflictsToViolations(conflicts: HolidayConflict[]): ConstraintViolation[] {
    return conflicts.map(conflict => ({
      type: 'holiday-conflict',
      message: `Holiday conflict on ${conflict.holidayDate.toDateString()} affects ${conflict.affectedEntries.length} lecture(s)`,
      affectedEntries: conflict.affectedEntries,
      severity: 'warning' as const,
      suggestedResolution: conflict.resolutionOptions.length > 0 
        ? `Consider rescheduling to: ${conflict.resolutionOptions[0].suggestedAlternatives.slice(0, 2).map(alt => 
            `${alt.timeSlot.day} ${alt.timeSlot.startTime}`
          ).join(', ')}`
        : 'No automatic resolution available - manual intervention required'
    }));
  }

  /**
   * Get holiday impact analysis
   */
  analyzeHolidayImpact(batches: Batch[], holidays: Date[]): {
    totalLecturesAffected: number;
    affectedDays: DayOfWeek[];
    slotsLost: number;
    alternativesAvailable: number;
    feasibilityScore: number;
  } {
    const availableSlots = this.timeSlotManager.initializeSlots(
      this.options.workingDays.map(day => day.toString()),
      this.options.workingHours.start,
      this.options.workingHours.end,
      this.options.slotDuration
    );

    const holidayInfo = this.timeSlotManager.getHolidayExclusionInfo(availableSlots, holidays);
    const totalLectures = batches.reduce((sum, batch) => sum + batch.getTotalLecturesPerWeek(), 0);
    
    const workingSlots = this.timeSlotManager.excludeHolidays(availableSlots, holidays);
    const alternatives = this.timeSlotManager.findHolidayAlternatives(
      availableSlots,
      holidays,
      60 // Assume 60-minute lectures for analysis
    );

    // Calculate feasibility score (0-100)
    const utilizationAfterHolidays = totalLectures / workingSlots.length;
    const feasibilityScore = Math.max(0, Math.min(100, 
      100 - (utilizationAfterHolidays * 100) + (alternatives.availableAlternatives.length / totalLectures * 20)
    ));

    return {
      totalLecturesAffected: holidayInfo.totalSlotsLost,
      affectedDays: holidayInfo.affectedDays,
      slotsLost: holidayInfo.totalSlotsLost,
      alternativesAvailable: alternatives.availableAlternatives.length,
      feasibilityScore: Math.round(feasibilityScore)
    };
  }

  /**
   * Suggest optimal rescheduling for holiday conflicts
   */
  suggestHolidayRescheduling(
    conflictingEntries: ScheduleEntry[],
    holidays: Date[],
    constraints: BaseConstraint[]
  ): {
    entry: ScheduleEntry;
    suggestions: {
      timeSlot: TimeSlot;
      confidence: number;
      reason: string;
    }[];
  }[] {
    const availableSlots = this.timeSlotManager.initializeSlots(
      this.options.workingDays.map(day => day.toString()),
      this.options.workingHours.start,
      this.options.workingHours.end,
      this.options.slotDuration
    );

    const workingSlots = this.timeSlotManager.excludeHolidays(availableSlots, holidays);

    return conflictingEntries.map(entry => {
      const resolution = this.conflictResolver.findAlternativeSlots(
        entry,
        conflictingEntries,
        workingSlots,
        constraints
      );

      return {
        entry,
        suggestions: resolution.suggestedAlternatives.map(alt => ({
          timeSlot: alt.timeSlot,
          confidence: alt.score / 100,
          reason: alt.reason
        }))
      };
    });
  }

  /**
   * Validate that the given batches can potentially be scheduled
   */
  validateSchedulingFeasibility(batches: Batch[], holidays: Date[]): {
    feasible: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Calculate total lecture requirements
    const totalLectures = batches.reduce((sum, batch) => 
      sum + batch.getTotalLecturesPerWeek(), 0);

    // Calculate available time slots
    const availableSlots = this.timeSlotManager.initializeSlots(
      this.options.workingDays.map(day => day.toString()),
      this.options.workingHours.start,
      this.options.workingHours.end,
      this.options.slotDuration
    );

    const workingSlots = this.timeSlotManager.excludeHolidays(availableSlots, holidays);
    const totalAvailableSlots = workingSlots.length;

    // Check basic capacity
    if (totalLectures > totalAvailableSlots) {
      issues.push(`Total lectures (${totalLectures}) exceed available time slots (${totalAvailableSlots})`);
      recommendations.push('Reduce number of lectures or increase available time slots');
    }

    // Check utilization rate
    const utilizationRate = totalLectures / totalAvailableSlots;
    if (utilizationRate > 0.8) {
      issues.push(`High utilization rate (${Math.round(utilizationRate * 100)}%) may make scheduling difficult`);
      recommendations.push('Consider adding more time slots or reducing lecture requirements');
    }

    // Check faculty workload distribution
    const facultyWorkload = new Map<string, number>();
    batches.forEach(batch => {
      batch.subjects.forEach(subject => {
        const current = facultyWorkload.get(subject.facultyId) || 0;
        facultyWorkload.set(subject.facultyId, current + subject.lecturesPerWeek);
      });
    });

    const maxWorkload = Math.max(...Array.from(facultyWorkload.values()));
    if (maxWorkload > totalAvailableSlots / this.options.workingDays.length) {
      issues.push('Some faculty members have more lectures than available daily slots');
      recommendations.push('Redistribute subjects among faculty or increase working days');
    }

    return {
      feasible: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Validate inputs before processing
   */
  private validateInputs(batches: Batch[], constraints: BaseConstraint[], holidays: Date[]): void {
    // Validate batches
    if (!batches || batches.length === 0) {
      throw ErrorFactory.createValidationError(
        'batches',
        batches,
        ['At least one batch is required'],
        { component: 'ScheduleGenerator', operation: 'validateInputs' }
      );
    }

    // Validate each batch
    batches.forEach((batch, index) => {
      if (!batch || !batch.id || !batch.name) {
        throw ErrorFactory.createValidationError(
          `batches[${index}]`,
          batch,
          ['Batch must have valid ID and name'],
          { component: 'ScheduleGenerator', operation: 'validateInputs' }
        );
      }

      if (batch.subjects.length === 0) {
        throw ErrorFactory.createValidationError(
          `batches[${index}].subjects`,
          batch.subjects,
          ['Batch must have at least one subject'],
          { component: 'ScheduleGenerator', operation: 'validateInputs' }
        );
      }

      // Validate subjects
      batch.subjects.forEach((subject, subjectIndex) => {
        if (!subject.id || !subject.name) {
          throw ErrorFactory.createValidationError(
            `batches[${index}].subjects[${subjectIndex}]`,
            subject,
            ['Subject must have valid ID and name'],
            { component: 'ScheduleGenerator', operation: 'validateInputs' }
          );
        }

        if (subject.lecturesPerWeek <= 0 || subject.lecturesPerWeek > 20) {
          throw ErrorFactory.createValidationError(
            `batches[${index}].subjects[${subjectIndex}].lecturesPerWeek`,
            subject.lecturesPerWeek,
            ['Lectures per week must be between 1 and 20'],
            { component: 'ScheduleGenerator', operation: 'validateInputs' }
          );
        }

        if (subject.lectureDuration <= 0 || subject.lectureDuration > 480) {
          throw ErrorFactory.createValidationError(
            `batches[${index}].subjects[${subjectIndex}].duration`,
            subject.lectureDuration,
            ['Duration must be between 1 and 480 minutes'],
            { component: 'ScheduleGenerator', operation: 'validateInputs' }
          );
        }
      });
    });

    // Validate constraints
    if (constraints) {
      constraints.forEach((constraint, index) => {
        if (!constraint || typeof constraint.validate !== 'function') {
          throw ErrorFactory.createValidationError(
            `constraints[${index}]`,
            constraint,
            ['Constraint must implement validate method'],
            { component: 'ScheduleGenerator', operation: 'validateInputs' }
          );
        }
      });
    }

    // Validate holidays
    if (holidays) {
      holidays.forEach((holiday, index) => {
        if (!(holiday instanceof Date) || isNaN(holiday.getTime())) {
          throw ErrorFactory.createValidationError(
            `holidays[${index}]`,
            holiday,
            ['Holiday must be a valid Date object'],
            { component: 'ScheduleGenerator', operation: 'validateInputs' }
          );
        }
      });
    }
  }

  /**
   * Check if scheduling is feasible with given constraints
   */
  private checkSchedulingFeasibility(batches: Batch[], holidays: Date[]): void {
    const totalLectures = batches.reduce((sum, batch) => 
      sum + batch.subjects.reduce((subSum, subject) => 
        subSum + subject.lecturesPerWeek, 0), 0);

    // Calculate available time slots
    const workingDaysCount = this.options.workingDays.length;
    const holidayDaysCount = holidays ? holidays.filter(h => 
      this.options.workingDays.includes(this.getDateDayOfWeek(h))).length : 0;
    
    const effectiveWorkingDays = Math.max(1, workingDaysCount - (holidayDaysCount / 4)); // Rough estimate
    
    const workingHoursPerDay = this.calculateWorkingHours();
    const slotsPerDay = Math.floor(workingHoursPerDay / (this.options.slotDuration + this.options.breakDuration));
    const totalAvailableSlots = effectiveWorkingDays * slotsPerDay;

    // Check if we have enough slots
    if (totalLectures > totalAvailableSlots * 1.2) { // Allow 20% oversubscription
      const suggestions = [
        'Reduce the number of lectures per week for some subjects',
        'Increase working hours or add more working days',
        'Reduce lecture duration to fit more slots',
        'Enable partial scheduling to generate what\'s possible'
      ];

      throw ErrorFactory.createSchedulingImpossibleError(
        `Not enough time slots available. Need ${totalLectures} slots but only ${totalAvailableSlots} available.`,
        suggestions,
        { 
          component: 'ScheduleGenerator', 
          operation: 'checkSchedulingFeasibility',
          totalLectures,
          totalAvailableSlots,
          workingDaysCount,
          holidayDaysCount
        }
      );
    }

    // Check for faculty conflicts potential
    const facultyMap = new Map<string, number>();
    batches.forEach(batch => {
      batch.subjects.forEach(subject => {
        const current = facultyMap.get(subject.facultyId) || 0;
        facultyMap.set(subject.facultyId, current + subject.lecturesPerWeek);
      });
    });

    const overloadedFaculty = Array.from(facultyMap.entries())
      .filter(([, lectures]) => lectures > totalAvailableSlots * 0.8);

    if (overloadedFaculty.length > 0) {
      const suggestions = [
        'Assign additional faculty to overloaded subjects',
        'Reduce lecture count for overloaded faculty',
        'Distribute subjects more evenly among faculty'
      ];

      throw ErrorFactory.createSchedulingImpossibleError(
        `Faculty overload detected: ${overloadedFaculty.map(([faculty, count]) => `${faculty} (${count} lectures)`).join(', ')}`,
        suggestions,
        { 
          component: 'ScheduleGenerator', 
          operation: 'checkSchedulingFeasibility',
          overloadedFaculty: overloadedFaculty.map(([faculty, count]) => ({ faculty, count }))
        }
      );
    }
  }

  /**
   * Validate the generated schedule
   */
  private validateGeneratedSchedule(schedule: WeeklySchedule): void {
    // Check for data integrity
    if (!schedule.entries || !Array.isArray(schedule.entries)) {
      throw ErrorFactory.createDataIntegrityError(
        'schedule.entries',
        'Array',
        typeof schedule.entries,
        { component: 'ScheduleGenerator', operation: 'validateGeneratedSchedule' }
      );
    }

    // Check for required fields in each entry
    schedule.entries.forEach((entry, index) => {
      if (!entry.batchId || !entry.subjectId || !entry.facultyId || !entry.timeSlot) {
        throw ErrorFactory.createDataIntegrityError(
          `schedule.entries[${index}]`,
          'Complete schedule entry',
          entry,
          { component: 'ScheduleGenerator', operation: 'validateGeneratedSchedule' }
        );
      }

      // Validate time slot
      if (!entry.timeSlot.day || !entry.timeSlot.startTime || !entry.timeSlot.endTime) {
        throw ErrorFactory.createDataIntegrityError(
          `schedule.entries[${index}].timeSlot`,
          'Complete time slot',
          entry.timeSlot,
          { component: 'ScheduleGenerator', operation: 'validateGeneratedSchedule' }
        );
      }

      // Validate time format
      if (!this.isValidTimeFormat(entry.timeSlot.startTime) || !this.isValidTimeFormat(entry.timeSlot.endTime)) {
        throw ErrorFactory.createValidationError(
          `schedule.entries[${index}].timeSlot.time`,
          `${entry.timeSlot.startTime}-${entry.timeSlot.endTime}`,
          ['Time must be in HH:MM format'],
          { component: 'ScheduleGenerator', operation: 'validateGeneratedSchedule' }
        );
      }
    });

    // Check for obvious conflicts
    const facultySchedules = new Map<string, ScheduleEntry[]>();
    schedule.entries.forEach(entry => {
      if (!facultySchedules.has(entry.facultyId)) {
        facultySchedules.set(entry.facultyId, []);
      }
      facultySchedules.get(entry.facultyId)!.push(entry);
    });

    // Check for faculty double-booking
    facultySchedules.forEach((entries, facultyId) => {
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          if (this.timeSlotOverlap(entries[i].timeSlot, entries[j].timeSlot)) {
            throw ErrorFactory.createFacultyConflictError(
              facultyId,
              [entries[i], entries[j]],
              { component: 'ScheduleGenerator', operation: 'validateGeneratedSchedule' }
            );
          }
        }
      }
    });
  }

  /**
   * Create appropriate scheduling error based on the original error
   */
  private createSchedulingError(
    error: Error, 
    batches: Batch[], 
    constraints: BaseConstraint[], 
    holidays: Date[]
  ): TimetableError {
    if (error instanceof TimetableError) {
      return error;
    }

    // Analyze error type and create appropriate TimetableError
    if (error.message.includes('timeout') || error.message.includes('time')) {
      return ErrorFactory.createTimeoutError(
        'generateTimetable',
        30000, // 30 seconds
        { 
          component: 'ScheduleGenerator',
          batchCount: batches.length,
          totalSubjects: batches.reduce((sum, b) => sum + b.subjects.length, 0)
        }
      );
    }

    if (error.message.includes('memory') || error.message.includes('heap')) {
      const memoryUsage = process.memoryUsage();
      return ErrorFactory.createMemoryError(
        Math.round(memoryUsage.heapUsed / 1024 / 1024),
        512, // 512MB limit
        { 
          component: 'ScheduleGenerator',
          batchCount: batches.length
        }
      );
    }

    // Default to scheduling impossible error
    return ErrorFactory.createSchedulingImpossibleError(
      error.message,
      [
        'Check input data for validity',
        'Reduce scheduling complexity',
        'Enable partial scheduling',
        'Adjust working hours or constraints'
      ],
      { 
        component: 'ScheduleGenerator',
        originalError: error.message,
        batchCount: batches.length,
        constraintCount: constraints.length,
        holidayCount: holidays.length
      }
    );
  }

  /**
   * Helper methods
   */
  private calculateWorkingHours(): number {
    const start = this.parseTime(this.options.workingHours.start);
    const end = this.parseTime(this.options.workingHours.end);
    return (end - start) / 60; // Convert minutes to hours
  }

  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private getDateDayOfWeek(date: Date): DayOfWeek {
    const dayIndex = date.getDay();
    const dayMap = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY
    ];
    return dayMap[dayIndex];
  }

  private isValidTimeFormat(time: string): boolean {
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  }

  private timeSlotOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
    if (slot1.day !== slot2.day) {
      return false;
    }

    const start1 = this.parseTime(slot1.startTime);
    const end1 = this.parseTime(slot1.endTime);
    const start2 = this.parseTime(slot2.startTime);
    const end2 = this.parseTime(slot2.endTime);

    return start1 < end2 && start2 < end1;
  }

  /**
   * Validate scheduling feasibility (public method for external use)
   */
  validateSchedulingFeasibility(batches: Batch[], holidays: Date[] = []): {
    feasible: boolean;
    issues: string[];
    recommendations: string[];
  } {
    try {
      this.validateInputs(batches, [], holidays);
      this.checkSchedulingFeasibility(batches, holidays);
      
      return {
        feasible: true,
        issues: [],
        recommendations: []
      };
    } catch (error) {
      if (error instanceof TimetableError) {
        return {
          feasible: false,
          issues: [error.getUserMessage()],
          recommendations: error.getRecoveryActions().map(action => action.description)
        };
      }
      
      return {
        feasible: false,
        issues: [error.message],
        recommendations: ['Check input data and try again']
      };
    }
  }

  /**
   * Comprehensive scenario analysis using the impossible scenario detector
   */
  async analyzeSchedulingScenario(
    batches: Batch[],
    constraints: BaseConstraint[],
    holidays: Date[] = []
  ): Promise<{
    feasible: boolean;
    confidence: number;
    issues: Array<{
      type: string;
      severity: string;
      description: string;
      affectedItems?: string[];
    }>;
    recommendations: Array<{
      type: string;
      description: string;
      priority: number;
      impact: string;
      effort: string;
      actions: string[];
    }>;
    partialSolutionPossible: boolean;
    estimatedSuccessRate: number;
  }> {
    const parameters = {
      workingDays: this.options.workingDays,
      workingHours: this.options.workingHours,
      slotDuration: this.options.slotDuration,
      breakDuration: this.options.breakDuration,
      holidays,
      allowOverlaps: false,
      maxLecturesPerDay: 8,
      maxConsecutiveLectures: 4
    };

    const analysis = await this.scenarioDetector.analyzeScenario(batches, constraints, parameters);

    return {
      feasible: analysis.feasible,
      confidence: analysis.confidence,
      issues: analysis.issues.map(issue => ({
        type: issue.type,
        severity: issue.severity,
        description: issue.description,
        affectedItems: [
          ...(issue.affectedBatches || []),
          ...(issue.affectedSubjects || []),
          ...(issue.affectedFaculty || [])
        ]
      })),
      recommendations: analysis.recommendations.map(rec => ({
        type: rec.type,
        description: rec.description,
        priority: rec.priority,
        impact: rec.impact,
        effort: rec.effort,
        actions: rec.specificActions
      })),
      partialSolutionPossible: analysis.partialSolutionPossible,
      estimatedSuccessRate: analysis.estimatedSuccessRate
    };
  }

  /**
   * Generate partial schedule when full scheduling is impossible
   */
  async generatePartialSchedule(
    batches: Batch[],
    constraints: BaseConstraint[],
    holidays: Date[] = [],
    options: {
      prioritizationStrategy?: 'core-subjects' | 'high-frequency' | 'faculty-availability' | 'batch-importance';
      targetCoverage?: number;
      allowConstraintRelaxation?: boolean;
    } = {}
  ): Promise<{
    schedule: WeeklySchedule;
    coverage: {
      totalLectures: number;
      scheduledLectures: number;
      coveragePercentage: number;
      batchCoverage: { [batchId: string]: number };
      subjectCoverage: { [subjectId: string]: number };
    };
    unscheduledLectures: Array<{
      batchId: string;
      subjectId: string;
      facultyId: string;
      lecturesRemaining: number;
      reason: string;
      priority: string;
    }>;
    recommendations: Array<{
      type: string;
      description: string;
      priority: number;
      effort: string;
      impact: string;
      actions: string[];
    }>;
    metadata: {
      strategy: string;
      relaxationsApplied: string[];
      generationTime: number;
      attempts: number;
    };
  }> {
    const parameters = {
      workingDays: this.options.workingDays,
      workingHours: this.options.workingHours,
      slotDuration: this.options.slotDuration,
      breakDuration: this.options.breakDuration,
      holidays,
      allowOverlaps: false,
      maxLecturesPerDay: 8,
      maxConsecutiveLectures: 4
    };

    const partialOptions = {
      prioritizationStrategy: options.prioritizationStrategy || 'core-subjects',
      maxAttempts: 10,
      allowConstraintRelaxation: options.allowConstraintRelaxation ?? true,
      targetCoverage: options.targetCoverage || 70,
      preserveBalance: true,
      generateAlternatives: false
    };

    const result = await this.partialGenerator.generatePartialSchedule(
      batches,
      constraints,
      parameters,
      partialOptions
    );

    return {
      schedule: result.schedule,
      coverage: {
        totalLectures: result.coverage.totalLectures,
        scheduledLectures: result.coverage.scheduledLectures,
        coveragePercentage: result.coverage.coveragePercentage,
        batchCoverage: Object.fromEntries(result.coverage.batchCoverage),
        subjectCoverage: Object.fromEntries(result.coverage.subjectCoverage)
      },
      unscheduledLectures: result.unscheduledLectures.map(ul => ({
        batchId: ul.batchId,
        subjectId: ul.subjectId,
        facultyId: ul.facultyId,
        lecturesRemaining: ul.lecturesRemaining,
        reason: ul.reason,
        priority: ul.priority
      })),
      recommendations: result.recommendations.map(rec => ({
        type: rec.type,
        description: rec.description,
        priority: rec.priority,
        effort: rec.effort,
        impact: rec.impact,
        actions: rec.specificActions
      })),
      metadata: result.metadata
    };
  }

  /**
   * Apply constraint relaxation to improve scheduling feasibility
   */
  async applyConstraintRelaxation(
    batches: Batch[],
    constraints: BaseConstraint[],
    holidays: Date[] = []
  ): Promise<{
    success: boolean;
    modifiedConstraints: BaseConstraint[];
    modifiedBatches?: Batch[];
    relaxationsApplied: string[];
    estimatedImprovement: number;
    tradeoffs: string[];
  }> {
    const parameters = {
      workingDays: this.options.workingDays,
      workingHours: this.options.workingHours,
      slotDuration: this.options.slotDuration,
      breakDuration: this.options.breakDuration,
      holidays,
      allowOverlaps: false,
      maxLecturesPerDay: 8,
      maxConsecutiveLectures: 4
    };

    // Analyze scenario first
    const analysis = await this.scenarioDetector.analyzeScenario(batches, constraints, parameters);

    // Create relaxation plan
    const relaxationPlan = await this.relaxationService.createRelaxationPlan(
      analysis,
      constraints,
      batches,
      parameters
    );

    // Apply relaxation plan
    const result = await this.relaxationService.applyRelaxationPlan(
      relaxationPlan,
      constraints,
      batches,
      parameters
    );

    return {
      success: result.success,
      modifiedConstraints: result.modifiedConstraints,
      modifiedBatches: result.modifiedBatches,
      relaxationsApplied: result.relaxationApplied,
      estimatedImprovement: result.estimatedImprovement,
      tradeoffs: result.tradeoffs
    };
  }

  /**
   * Get error statistics from the error handler
   */
  getErrorStatistics() {
    return this.errorHandler.getErrorStatistics();
  }

  /**
   * Clear error history
   */
  clearErrorHistory(): void {
    this.errorHandler.clearErrorHistory();
  }
}
