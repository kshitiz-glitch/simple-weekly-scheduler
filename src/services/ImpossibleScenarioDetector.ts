import { Batch, Subject, DayOfWeek } from '../models';
import { BaseConstraint } from './constraints';
import { ErrorFactory, SchedulingError } from '../errors';

export interface ScenarioAnalysis {
  feasible: boolean;
  confidence: number; // 0-1 scale
  issues: ImpossibilityIssue[];
  recommendations: Recommendation[];
  partialSolutionPossible: boolean;
  estimatedSuccessRate: number; // 0-100 percentage
}

export interface ImpossibilityIssue {
  type: ImpossibilityType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedBatches?: string[];
  affectedSubjects?: string[];
  affectedFaculty?: string[];
  quantification?: {
    required: number;
    available: number;
    deficit: number;
  };
}

export interface Recommendation {
  type: RecommendationType;
  priority: number; // 1-10, lower is higher priority
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'easy' | 'moderate' | 'difficult';
  specificActions: string[];
  estimatedImprovement: number; // 0-100 percentage
}

export enum ImpossibilityType {
  INSUFFICIENT_TIME_SLOTS = 'insufficient_time_slots',
  FACULTY_OVERLOAD = 'faculty_overload',
  BATCH_OVERLOAD = 'batch_overload',
  CONFLICTING_CONSTRAINTS = 'conflicting_constraints',
  HOLIDAY_CONFLICTS = 'holiday_conflicts',
  DURATION_MISMATCH = 'duration_mismatch',
  RESOURCE_CONTENTION = 'resource_contention',
  CIRCULAR_DEPENDENCIES = 'circular_dependencies',
  INVALID_TIME_WINDOWS = 'invalid_time_windows',
  EXCESSIVE_COMPLEXITY = 'excessive_complexity'
}

export enum RecommendationType {
  REDUCE_LECTURES = 'reduce_lectures',
  ADD_FACULTY = 'add_faculty',
  EXTEND_HOURS = 'extend_hours',
  ADD_DAYS = 'add_days',
  RELAX_CONSTRAINTS = 'relax_constraints',
  SPLIT_BATCHES = 'split_batches',
  ADJUST_DURATIONS = 'adjust_durations',
  RESCHEDULE_HOLIDAYS = 'reschedule_holidays',
  ENABLE_PARTIAL = 'enable_partial',
  SIMPLIFY_REQUIREMENTS = 'simplify_requirements'
}

export interface SchedulingParameters {
  workingDays: DayOfWeek[];
  workingHours: { start: string; end: string };
  slotDuration: number;
  breakDuration: number;
  holidays: Date[];
  allowOverlaps: boolean;
  maxLecturesPerDay: number;
  maxConsecutiveLectures: number;
}

/**
 * Service for detecting impossible scheduling scenarios and providing recommendations
 */
export class ImpossibleScenarioDetector {
  private readonly TIME_SLOT_UTILIZATION_THRESHOLD = 0.85; // 85% max utilization
  private readonly FACULTY_LOAD_THRESHOLD = 0.8; // 80% max faculty load
  private readonly BATCH_LOAD_THRESHOLD = 8; // Max 8 lectures per day per batch
  private readonly COMPLEXITY_THRESHOLD = 1000; // Max complexity score

  /**
   * Analyze scheduling scenario for impossibility
   */
  async analyzeScenario(
    batches: Batch[],
    constraints: BaseConstraint[],
    parameters: SchedulingParameters
  ): Promise<ScenarioAnalysis> {
    const issues: ImpossibilityIssue[] = [];
    const recommendations: Recommendation[] = [];

    // Perform various impossibility checks
    await this.checkTimeSlotAvailability(batches, parameters, issues, recommendations);
    await this.checkFacultyLoad(batches, parameters, issues, recommendations);
    await this.checkBatchLoad(batches, parameters, issues, recommendations);
    await this.checkConstraintConflicts(batches, constraints, parameters, issues, recommendations);
    await this.checkHolidayImpact(batches, parameters, issues, recommendations);
    await this.checkDurationCompatibility(batches, parameters, issues, recommendations);
    await this.checkResourceContention(batches, parameters, issues, recommendations);
    await this.checkComplexity(batches, constraints, parameters, issues, recommendations);

    // Calculate overall feasibility
    const feasible = issues.filter(i => i.severity === 'critical').length === 0;
    const confidence = this.calculateConfidence(issues);
    const partialSolutionPossible = this.assessPartialSolutionViability(issues);
    const estimatedSuccessRate = this.estimateSuccessRate(issues, recommendations);

    // Sort recommendations by priority
    recommendations.sort((a, b) => a.priority - b.priority);

    return {
      feasible,
      confidence,
      issues,
      recommendations,
      partialSolutionPossible,
      estimatedSuccessRate
    };
  }

  /**
   * Check if there are sufficient time slots available
   */
  private async checkTimeSlotAvailability(
    batches: Batch[],
    parameters: SchedulingParameters,
    issues: ImpossibilityIssue[],
    recommendations: Recommendation[]
  ): Promise<void> {
    const totalLectures = this.calculateTotalLectures(batches);
    const availableSlots = this.calculateAvailableSlots(parameters);
    const utilizationRate = totalLectures / availableSlots;

    if (utilizationRate > 1.0) {
      // Impossible - more lectures than slots
      issues.push({
        type: ImpossibilityType.INSUFFICIENT_TIME_SLOTS,
        severity: 'critical',
        description: `Need ${totalLectures} time slots but only ${availableSlots} available`,
        quantification: {
          required: totalLectures,
          available: availableSlots,
          deficit: totalLectures - availableSlots
        }
      });

      // Add recommendations
      const deficit = totalLectures - availableSlots;
      const lectureReduction = Math.ceil(deficit * 1.1); // 10% buffer

      recommendations.push({
        type: RecommendationType.REDUCE_LECTURES,
        priority: 1,
        description: `Reduce total lectures by ${lectureReduction} per week`,
        impact: 'high',
        effort: 'moderate',
        specificActions: [
          `Identify ${lectureReduction} lectures that can be reduced or combined`,
          'Prioritize core subjects and reduce elective lectures',
          'Consider combining similar subjects or topics'
        ],
        estimatedImprovement: 90
      });

      recommendations.push({
        type: RecommendationType.EXTEND_HOURS,
        priority: 2,
        description: 'Extend working hours to create more time slots',
        impact: 'high',
        effort: 'easy',
        specificActions: [
          'Start classes 1 hour earlier or end 1 hour later',
          'Reduce break duration between lectures',
          'Add evening sessions if feasible'
        ],
        estimatedImprovement: 70
      });

      recommendations.push({
        type: RecommendationType.ADD_DAYS,
        priority: 3,
        description: 'Add Saturday or extend to 6-day week',
        impact: 'high',
        effort: 'difficult',
        specificActions: [
          'Schedule Saturday morning sessions',
          'Distribute load across additional day',
          'Ensure faculty and student availability'
        ],
        estimatedImprovement: 85
      });

    } else if (utilizationRate > this.TIME_SLOT_UTILIZATION_THRESHOLD) {
      // High utilization - risky but possible
      issues.push({
        type: ImpossibilityType.INSUFFICIENT_TIME_SLOTS,
        severity: 'high',
        description: `Very high time slot utilization (${(utilizationRate * 100).toFixed(1)}%)`,
        quantification: {
          required: totalLectures,
          available: availableSlots,
          deficit: 0
        }
      });

      recommendations.push({
        type: RecommendationType.ENABLE_PARTIAL,
        priority: 1,
        description: 'Enable partial scheduling to handle high utilization',
        impact: 'medium',
        effort: 'easy',
        specificActions: [
          'Allow some lectures to remain unscheduled',
          'Prioritize core subjects over electives',
          'Generate best possible partial schedule'
        ],
        estimatedImprovement: 60
      });
    }
  }

  /**
   * Check faculty workload distribution
   */
  private async checkFacultyLoad(
    batches: Batch[],
    parameters: SchedulingParameters,
    issues: ImpossibilityIssue[],
    recommendations: Recommendation[]
  ): Promise<void> {
    const facultyLoads = this.calculateFacultyLoads(batches);
    const maxSlotsPerFaculty = this.calculateAvailableSlots(parameters) * this.FACULTY_LOAD_THRESHOLD;

    const overloadedFaculty = facultyLoads.filter(f => f.totalLectures > maxSlotsPerFaculty);

    if (overloadedFaculty.length > 0) {
      const severity = overloadedFaculty.some(f => f.totalLectures > maxSlotsPerFaculty * 1.5) ? 'critical' : 'high';
      
      issues.push({
        type: ImpossibilityType.FACULTY_OVERLOAD,
        severity,
        description: `${overloadedFaculty.length} faculty members are overloaded`,
        affectedFaculty: overloadedFaculty.map(f => f.facultyId),
        quantification: {
          required: Math.max(...overloadedFaculty.map(f => f.totalLectures)),
          available: Math.floor(maxSlotsPerFaculty),
          deficit: overloadedFaculty.reduce((sum, f) => sum + Math.max(0, f.totalLectures - maxSlotsPerFaculty), 0)
        }
      });

      // Recommendations for faculty overload
      recommendations.push({
        type: RecommendationType.ADD_FACULTY,
        priority: 1,
        description: 'Assign additional faculty to overloaded subjects',
        impact: 'high',
        effort: 'moderate',
        specificActions: [
          ...overloadedFaculty.map(f => `Find additional faculty for ${f.facultyId} (${f.totalLectures} lectures)`),
          'Cross-train faculty to teach multiple subjects',
          'Consider guest lecturers or part-time faculty'
        ],
        estimatedImprovement: 85
      });

      recommendations.push({
        type: RecommendationType.REDUCE_LECTURES,
        priority: 2,
        description: 'Reduce lecture count for overloaded faculty',
        impact: 'medium',
        effort: 'easy',
        specificActions: [
          ...overloadedFaculty.map(f => `Reduce lectures for ${f.facultyId} by ${Math.ceil((f.totalLectures - maxSlotsPerFaculty) * 1.1)}`),
          'Combine similar lectures or topics',
          'Move some lectures to less loaded faculty'
        ],
        estimatedImprovement: 70
      });
    }
  }

  /**
   * Check batch daily load limits
   */
  private async checkBatchLoad(
    batches: Batch[],
    parameters: SchedulingParameters,
    issues: ImpossibilityIssue[],
    recommendations: Recommendation[]
  ): Promise<void> {
    const workingDaysCount = parameters.workingDays.length;
    
    for (const batch of batches) {
      const totalLectures = batch.getTotalLecturesPerWeek();
      const averageLecturesPerDay = totalLectures / workingDaysCount;
      const maxLecturesPerDay = Math.ceil(totalLectures / workingDaysCount * 1.4); // Allow 40% variation

      if (maxLecturesPerDay > this.BATCH_LOAD_THRESHOLD) {
        issues.push({
          type: ImpossibilityType.BATCH_OVERLOAD,
          severity: maxLecturesPerDay > this.BATCH_LOAD_THRESHOLD * 1.5 ? 'critical' : 'high',
          description: `Batch ${batch.name} has excessive daily load (${maxLecturesPerDay} lectures/day)`,
          affectedBatches: [batch.id],
          quantification: {
            required: maxLecturesPerDay,
            available: this.BATCH_LOAD_THRESHOLD,
            deficit: maxLecturesPerDay - this.BATCH_LOAD_THRESHOLD
          }
        });

        recommendations.push({
          type: RecommendationType.SPLIT_BATCHES,
          priority: 2,
          description: `Split ${batch.name} into smaller groups`,
          impact: 'high',
          effort: 'difficult',
          specificActions: [
            `Divide ${batch.name} into 2-3 smaller batches`,
            'Distribute subjects across split batches',
            'Ensure adequate faculty for split batches'
          ],
          estimatedImprovement: 80
        });

        recommendations.push({
          type: RecommendationType.REDUCE_LECTURES,
          priority: 3,
          description: `Reduce lecture count for ${batch.name}`,
          impact: 'medium',
          effort: 'moderate',
          specificActions: [
            `Reduce total lectures for ${batch.name} by ${Math.ceil(maxLecturesPerDay - this.BATCH_LOAD_THRESHOLD)}`,
            'Prioritize core subjects',
            'Consider intensive weekend sessions for some subjects'
          ],
          estimatedImprovement: 65
        });
      }
    }
  }

  /**
   * Check for conflicting constraints
   */
  private async checkConstraintConflicts(
    batches: Batch[],
    constraints: BaseConstraint[],
    parameters: SchedulingParameters,
    issues: ImpossibilityIssue[],
    recommendations: Recommendation[]
  ): Promise<void> {
    // Simulate constraint conflicts by checking common conflict patterns
    const facultySubjects = new Map<string, string[]>();
    
    batches.forEach(batch => {
      batch.subjects.forEach(subject => {
        const facultyId = subject.facultyId;
        if (!facultySubjects.has(facultyId)) {
          facultySubjects.set(facultyId, []);
        }
        facultySubjects.get(facultyId)!.push(`${batch.id}:${subject.id}`);
      });
    });

    // Check for faculty teaching too many different subjects
    const overextendedFaculty = Array.from(facultySubjects.entries())
      .filter(([, subjects]) => subjects.length > 10); // More than 10 different subjects

    if (overextendedFaculty.length > 0) {
      issues.push({
        type: ImpossibilityType.CONFLICTING_CONSTRAINTS,
        severity: 'medium',
        description: `${overextendedFaculty.length} faculty members teaching too many different subjects`,
        affectedFaculty: overextendedFaculty.map(([facultyId]) => facultyId)
      });

      recommendations.push({
        type: RecommendationType.RELAX_CONSTRAINTS,
        priority: 4,
        description: 'Relax faculty-subject assignment constraints',
        impact: 'medium',
        effort: 'easy',
        specificActions: [
          'Allow faculty to teach related subjects',
          'Group similar subjects together',
          'Consider team teaching approaches'
        ],
        estimatedImprovement: 50
      });
    }
  }

  /**
   * Check holiday impact on scheduling
   */
  private async checkHolidayImpact(
    batches: Batch[],
    parameters: SchedulingParameters,
    issues: ImpossibilityIssue[],
    recommendations: Recommendation[]
  ): Promise<void> {
    if (!parameters.holidays || parameters.holidays.length === 0) {
      return;
    }

    const workingDayHolidays = parameters.holidays.filter(holiday => {
      const dayOfWeek = this.getDateDayOfWeek(holiday);
      return parameters.workingDays.includes(dayOfWeek);
    });

    const holidayImpact = workingDayHolidays.length / (parameters.workingDays.length * 4); // Assume 4 weeks
    
    if (holidayImpact > 0.2) { // More than 20% of working days are holidays
      issues.push({
        type: ImpossibilityType.HOLIDAY_CONFLICTS,
        severity: holidayImpact > 0.4 ? 'high' : 'medium',
        description: `${workingDayHolidays.length} holidays significantly impact scheduling (${(holidayImpact * 100).toFixed(1)}% of working days)`,
        quantification: {
          required: parameters.workingDays.length * 4,
          available: parameters.workingDays.length * 4 - workingDayHolidays.length,
          deficit: workingDayHolidays.length
        }
      });

      recommendations.push({
        type: RecommendationType.RESCHEDULE_HOLIDAYS,
        priority: 5,
        description: 'Consider rescheduling some holidays or adding makeup days',
        impact: 'medium',
        effort: 'difficult',
        specificActions: [
          'Schedule makeup classes for holiday periods',
          'Extend semester to compensate for lost days',
          'Use alternative days (Saturday) for critical lectures'
        ],
        estimatedImprovement: 60
      });

      recommendations.push({
        type: RecommendationType.EXTEND_HOURS,
        priority: 3,
        description: 'Extend daily hours to compensate for holiday losses',
        impact: 'medium',
        effort: 'moderate',
        specificActions: [
          'Add extra hour to daily schedule',
          'Reduce break times',
          'Schedule intensive sessions before/after holidays'
        ],
        estimatedImprovement: 55
      });
    }
  }

  /**
   * Check duration compatibility
   */
  private async checkDurationCompatibility(
    batches: Batch[],
    parameters: SchedulingParameters,
    issues: ImpossibilityIssue[],
    recommendations: Recommendation[]
  ): Promise<void> {
    const standardSlotDuration = parameters.slotDuration;
    const incompatibleSubjects: { batchId: string; subjectId: string; duration: number }[] = [];

    batches.forEach(batch => {
      batch.subjects.forEach(subject => {
        const duration = subject.lectureDuration;
        if (duration > standardSlotDuration * 2 || duration < standardSlotDuration * 0.5) {
          incompatibleSubjects.push({
            batchId: batch.id,
            subjectId: subject.id,
            duration
          });
        }
      });
    });

    if (incompatibleSubjects.length > 0) {
      issues.push({
        type: ImpossibilityType.DURATION_MISMATCH,
        severity: 'medium',
        description: `${incompatibleSubjects.length} subjects have incompatible durations`,
        affectedSubjects: incompatibleSubjects.map(s => `${s.batchId}:${s.subjectId}`)
      });

      recommendations.push({
        type: RecommendationType.ADJUST_DURATIONS,
        priority: 4,
        description: 'Standardize lecture durations',
        impact: 'medium',
        effort: 'moderate',
        specificActions: [
          `Adjust ${incompatibleSubjects.length} subjects to standard ${standardSlotDuration}-minute duration`,
          'Split long lectures into multiple sessions',
          'Combine short lectures with related topics'
        ],
        estimatedImprovement: 70
      });
    }
  }

  /**
   * Check for resource contention
   */
  private async checkResourceContention(
    batches: Batch[],
    parameters: SchedulingParameters,
    issues: ImpossibilityIssue[],
    recommendations: Recommendation[]
  ): Promise<void> {
    // Check for peak time contention
    const peakHours = this.identifyPeakHours(parameters);
    const totalLectures = this.calculateTotalLectures(batches);
    const peakCapacity = peakHours.length * parameters.workingDays.length;
    
    if (totalLectures > peakCapacity * 3) { // More than 3x peak capacity
      issues.push({
        type: ImpossibilityType.RESOURCE_CONTENTION,
        severity: 'high',
        description: 'Excessive demand during peak hours',
        quantification: {
          required: totalLectures,
          available: peakCapacity * 3,
          deficit: totalLectures - (peakCapacity * 3)
        }
      });

      recommendations.push({
        type: RecommendationType.SIMPLIFY_REQUIREMENTS,
        priority: 3,
        description: 'Distribute lectures more evenly throughout the day',
        impact: 'medium',
        effort: 'moderate',
        specificActions: [
          'Schedule some lectures during off-peak hours',
          'Use early morning and late afternoon slots',
          'Balance popular and less popular time slots'
        ],
        estimatedImprovement: 65
      });
    }
  }

  /**
   * Check overall complexity
   */
  private async checkComplexity(
    batches: Batch[],
    constraints: BaseConstraint[],
    parameters: SchedulingParameters,
    issues: ImpossibilityIssue[],
    recommendations: Recommendation[]
  ): Promise<void> {
    const complexityScore = this.calculateComplexityScore(batches, constraints, parameters);

    if (complexityScore > this.COMPLEXITY_THRESHOLD) {
      issues.push({
        type: ImpossibilityType.EXCESSIVE_COMPLEXITY,
        severity: complexityScore > this.COMPLEXITY_THRESHOLD * 2 ? 'critical' : 'high',
        description: `Scheduling problem is too complex (score: ${complexityScore})`,
        quantification: {
          required: complexityScore,
          available: this.COMPLEXITY_THRESHOLD,
          deficit: complexityScore - this.COMPLEXITY_THRESHOLD
        }
      });

      recommendations.push({
        type: RecommendationType.SIMPLIFY_REQUIREMENTS,
        priority: 1,
        description: 'Simplify scheduling requirements to reduce complexity',
        impact: 'high',
        effort: 'moderate',
        specificActions: [
          'Reduce number of batches or subjects',
          'Relax some constraints',
          'Use standard time slots and durations',
          'Limit faculty-subject assignments'
        ],
        estimatedImprovement: 80
      });

      recommendations.push({
        type: RecommendationType.ENABLE_PARTIAL,
        priority: 2,
        description: 'Enable partial scheduling for complex scenarios',
        impact: 'medium',
        effort: 'easy',
        specificActions: [
          'Allow incomplete schedules',
          'Prioritize core subjects',
          'Generate best possible partial solution'
        ],
        estimatedImprovement: 60
      });
    }
  }

  /**
   * Generate partial schedule when full schedule is impossible
   */
  async generatePartialSchedule(
    batches: Batch[],
    constraints: BaseConstraint[],
    parameters: SchedulingParameters,
    analysis: ScenarioAnalysis
  ): Promise<{
    prioritizedBatches: Batch[];
    relaxedConstraints: BaseConstraint[];
    modifiedParameters: SchedulingParameters;
    expectedCoverage: number;
  }> {
    // Prioritize batches based on importance (could be configurable)
    const prioritizedBatches = this.prioritizeBatches(batches, analysis);
    
    // Relax constraints based on recommendations
    const relaxedConstraints = this.relaxConstraints(constraints, analysis);
    
    // Modify parameters based on recommendations
    const modifiedParameters = this.modifyParameters(parameters, analysis);
    
    // Estimate coverage
    const expectedCoverage = this.estimatePartialCoverage(prioritizedBatches, analysis);

    return {
      prioritizedBatches,
      relaxedConstraints,
      modifiedParameters,
      expectedCoverage
    };
  }

  // Helper methods
  private calculateTotalLectures(batches: Batch[]): number {
    return batches.reduce((sum, batch) => 
      sum + batch.subjects.reduce((subSum, subject) => 
        subSum + subject.lecturesPerWeek, 0), 0);
  }

  private calculateAvailableSlots(parameters: SchedulingParameters): number {
    const workingHoursPerDay = this.parseTime(parameters.workingHours.end) - 
                              this.parseTime(parameters.workingHours.start);
    const slotsPerDay = Math.floor(workingHoursPerDay / (parameters.slotDuration + parameters.breakDuration));
    return slotsPerDay * parameters.workingDays.length;
  }

  private calculateFacultyLoads(batches: Batch[]): Array<{ facultyId: string; totalLectures: number; subjects: string[] }> {
    const facultyMap = new Map<string, { totalLectures: number; subjects: string[] }>();

    batches.forEach(batch => {
      batch.subjects.forEach(subject => {
        const facultyId = subject.facultyId;
        const current = facultyMap.get(facultyId) || { totalLectures: 0, subjects: [] };
        
        facultyMap.set(facultyId, {
          totalLectures: current.totalLectures + subject.lecturesPerWeek,
          subjects: [...current.subjects, `${batch.id}:${subject.id}`]
        });
      });
    });

    return Array.from(facultyMap.entries()).map(([facultyId, data]) => ({
      facultyId,
      ...data
    }));
  }

  private calculateComplexityScore(
    batches: Batch[],
    constraints: BaseConstraint[],
    parameters: SchedulingParameters
  ): number {
    const batchCount = batches.length;
    const subjectCount = batches.reduce((sum, batch) => sum + batch.subjects.length, 0);
    const lectureCount = this.calculateTotalLectures(batches);
    const facultyCount = new Set(batches.flatMap(batch => 
      batch.subjects.map(subject => subject.facultyId))).size;
    const constraintCount = constraints.length;
    const timeSlotCount = this.calculateAvailableSlots(parameters);

    // Complexity formula (can be adjusted based on experience)
    return (batchCount * 10) + 
           (subjectCount * 5) + 
           (lectureCount * 2) + 
           (facultyCount * 8) + 
           (constraintCount * 15) + 
           (Math.max(0, lectureCount - timeSlotCount) * 50); // Penalty for oversubscription
  }

  private calculateConfidence(issues: ImpossibilityIssue[]): number {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    const lowIssues = issues.filter(i => i.severity === 'low').length;

    // Confidence decreases with severity and number of issues
    const severityPenalty = (criticalIssues * 0.8) + (highIssues * 0.4) + (mediumIssues * 0.2) + (lowIssues * 0.1);
    return Math.max(0, 1 - Math.min(1, severityPenalty));
  }

  private assessPartialSolutionViability(issues: ImpossibilityIssue[]): boolean {
    // Partial solution is viable if there are no critical structural issues
    const structuralIssues = issues.filter(i => 
      i.type === ImpossibilityType.CIRCULAR_DEPENDENCIES ||
      i.type === ImpossibilityType.INVALID_TIME_WINDOWS
    );
    
    return structuralIssues.length === 0;
  }

  private estimateSuccessRate(issues: ImpossibilityIssue[], recommendations: Recommendation[]): number {
    if (issues.filter(i => i.severity === 'critical').length > 0) {
      return 0; // No success possible with critical issues
    }

    const totalImpact = recommendations.reduce((sum, rec) => sum + rec.estimatedImprovement, 0);
    const averageImpact = recommendations.length > 0 ? totalImpact / recommendations.length : 0;
    
    // Base success rate depends on issue severity
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    
    let baseRate = 100 - (highIssues * 20) - (mediumIssues * 10);
    
    // Adjust based on recommendation impact
    return Math.max(0, Math.min(100, baseRate + (averageImpact * 0.3)));
  }

  private prioritizeBatches(batches: Batch[], analysis: ScenarioAnalysis): Batch[] {
    // Simple prioritization - could be made more sophisticated
    return [...batches].sort((a, b) => {
      // Prioritize batches with fewer subjects (easier to schedule)
      const aComplexity = a.subjects.length * a.getTotalLecturesPerWeek();
      const bComplexity = b.subjects.length * b.getTotalLecturesPerWeek();
      return aComplexity - bComplexity;
    });
  }

  private relaxConstraints(constraints: BaseConstraint[], analysis: ScenarioAnalysis): BaseConstraint[] {
    // Return subset of constraints based on recommendations
    const relaxRecommendations = analysis.recommendations.filter(r => 
      r.type === RecommendationType.RELAX_CONSTRAINTS);
    
    if (relaxRecommendations.length > 0) {
      // Remove some constraints (implementation would depend on constraint types)
      return constraints.slice(0, Math.ceil(constraints.length * 0.7));
    }
    
    return constraints;
  }

  private modifyParameters(parameters: SchedulingParameters, analysis: ScenarioAnalysis): SchedulingParameters {
    const modified = { ...parameters };
    
    // Apply parameter modifications based on recommendations
    analysis.recommendations.forEach(rec => {
      switch (rec.type) {
        case RecommendationType.EXTEND_HOURS:
          // Extend working hours by 1 hour
          const startHour = this.parseTime(modified.workingHours.start);
          const endHour = this.parseTime(modified.workingHours.end);
          modified.workingHours.start = this.formatTime(Math.max(480, startHour - 60)); // Not before 8 AM
          modified.workingHours.end = this.formatTime(Math.min(1200, endHour + 60)); // Not after 8 PM
          break;
          
        case RecommendationType.ADD_DAYS:
          if (!modified.workingDays.includes(DayOfWeek.SATURDAY)) {
            modified.workingDays.push(DayOfWeek.SATURDAY);
          }
          break;
      }
    });
    
    return modified;
  }

  private estimatePartialCoverage(batches: Batch[], analysis: ScenarioAnalysis): number {
    const totalLectures = this.calculateTotalLectures(batches);
    const criticalIssues = analysis.issues.filter(i => i.severity === 'critical');
    
    if (criticalIssues.length === 0) {
      return 85; // High coverage expected
    }
    
    // Estimate based on deficit
    const totalDeficit = criticalIssues.reduce((sum, issue) => 
      sum + (issue.quantification?.deficit || 0), 0);
    
    const coverageRate = Math.max(0.3, 1 - (totalDeficit / totalLectures));
    return Math.round(coverageRate * 100);
  }

  private identifyPeakHours(parameters: SchedulingParameters): string[] {
    // Identify typical peak hours (9 AM - 12 PM, 2 PM - 5 PM)
    const peakHours: string[] = [];
    const startHour = this.parseTime(parameters.workingHours.start);
    const endHour = this.parseTime(parameters.workingHours.end);
    
    // Morning peak: 9 AM - 12 PM
    for (let hour = Math.max(startHour, 540); hour < Math.min(endHour, 720); hour += parameters.slotDuration) {
      peakHours.push(this.formatTime(hour));
    }
    
    // Afternoon peak: 2 PM - 5 PM
    for (let hour = Math.max(startHour, 840); hour < Math.min(endHour, 1020); hour += parameters.slotDuration) {
      peakHours.push(this.formatTime(hour));
    }
    
    return peakHours;
  }

  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  private getDateDayOfWeek(date: Date): DayOfWeek {
    const dayIndex = date.getDay();
    const dayMap = [
      DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY
    ];
    return dayMap[dayIndex];
  }
}
