import * as readline from 'readline';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { ScheduleEntry, ConstraintViolation, DayOfWeek } from '../models';
import { ManualAdjustmentService } from '../services/ManualAdjustmentService';
import { ConflictReporter } from '../services/ConflictReporter';

export interface ConflictResolutionOptions {
  enableColors?: boolean;
  autoApplyBestSolution?: boolean;
  showDetailedAnalysis?: boolean;
  maxSuggestionsPerConflict?: number;
}

export interface ResolutionSuggestion {
  type: 'move' | 'swap' | 'remove' | 'reschedule';
  description: string;
  affectedEntries: ScheduleEntry[];
  estimatedImpact: 'low' | 'medium' | 'high';
  feasibilityScore: number; // 0-1 scale
  steps: string[];
}

export interface ConflictAnalysis {
  conflict: ConstraintViolation;
  rootCause: string;
  suggestions: ResolutionSuggestion[];
  complexity: 'simple' | 'moderate' | 'complex';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export class ConflictResolutionInterface {
  private rl: readline.Interface;
  private adjustmentService: ManualAdjustmentService;
  private conflictReporter: ConflictReporter;
  private options: Required<ConflictResolutionOptions>;
  private resolutionHistory: Array<{
    conflict: ConstraintViolation;
    resolution: ResolutionSuggestion;
    timestamp: Date;
    success: boolean;
  }>;

  constructor(options: ConflictResolutionOptions = {}) {
    this.options = {
      enableColors: options.enableColors ?? true,
      autoApplyBestSolution: options.autoApplyBestSolution ?? false,
      showDetailedAnalysis: options.showDetailedAnalysis ?? true,
      maxSuggestionsPerConflict: options.maxSuggestionsPerConflict ?? 5
    };

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.adjustmentService = new ManualAdjustmentService();
    this.conflictReporter = new ConflictReporter();
    this.resolutionHistory = [];
  }

  /**
   * Start interactive conflict resolution process
   */
  async resolveConflicts(schedule: WeeklySchedule): Promise<WeeklySchedule> {
    try {
      await this.displayConflictOverview(schedule);
      
      if (schedule.conflicts.length === 0) {
        console.log(this.colorize('🎉 No conflicts found! Your schedule is perfect.', 'green'));
        return schedule;
      }

      await this.interactiveResolutionLoop(schedule);
      await this.displayResolutionSummary();
      
      return schedule;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Display conflict overview and statistics
   */
  private async displayConflictOverview(schedule: WeeklySchedule): Promise<void> {
    this.clearScreen();
    this.printHeader('CONFLICT RESOLUTION ASSISTANT');
    
    console.log(this.colorize('Analyzing schedule conflicts...', 'cyan'));
    console.log('');

    const conflicts = schedule.conflicts;
    const errorConflicts = schedule.getConflictsBySeverity('error');
    const warningConflicts = schedule.getConflictsBySeverity('warning');

    // Conflict statistics
    console.log(this.colorize('Conflict Summary:', 'yellow'));
    console.log(`Total Conflicts: ${conflicts.length}`);
    console.log(`🚨 Critical (Errors): ${errorConflicts.length}`);
    console.log(`⚠️  Warnings: ${warningConflicts.length}`);
    console.log('');

    // Conflict types breakdown
    const conflictTypes = new Map<string, number>();
    conflicts.forEach(conflict => {
      conflictTypes.set(conflict.type, (conflictTypes.get(conflict.type) || 0) + 1);
    });

    if (conflictTypes.size > 0) {
      console.log(this.colorize('Conflict Types:', 'yellow'));
      Array.from(conflictTypes.entries())
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${count}`);
        });
      console.log('');
    }

    // Impact analysis
    const impactedEntries = new Set<ScheduleEntry>();
    conflicts.forEach(conflict => {
      conflict.affectedEntries.forEach(entry => impactedEntries.add(entry));
    });

    console.log(this.colorize('Impact Analysis:', 'yellow'));
    console.log(`Affected Lectures: ${impactedEntries.size}`);
    console.log(`Total Lectures: ${schedule.entries.length}`);
    console.log(`Impact Percentage: ${((impactedEntries.size / schedule.entries.length) * 100).toFixed(1)}%`);
    console.log('');

    if (conflicts.length > 0) {
      console.log(this.colorize('🔧 Ready to resolve conflicts interactively.', 'cyan'));
      await this.waitForEnter();
    }
  }

  /**
   * Main interactive resolution loop
   */
  private async interactiveResolutionLoop(schedule: WeeklySchedule): Promise<void> {
    while (schedule.conflicts.length > 0) {
      await this.displayConflictMenu(schedule);
      
      const choice = await this.promptNumber('Select an option (1-6): ', 1, 6);
      
      switch (choice) {
        case 1:
          await this.resolveNextCriticalConflict(schedule);
          break;
        case 2:
          await this.resolveSpecificConflict(schedule);
          break;
        case 3:
          await this.autoResolveAllConflicts(schedule);
          break;
        case 4:
          await this.analyzeConflictDetails(schedule);
          break;
        case 5:
          await this.viewResolutionHistory();
          break;
        case 6:
          const exitConfirm = await this.promptYesNo('Exit with unresolved conflicts? (y/n): ');
          if (exitConfirm) return;
          break;
      }
    }

    console.log(this.colorize('🎉 All conflicts resolved successfully!', 'green'));
    await this.waitForEnter();
  }

  /**
   * Display conflict resolution menu
   */
  private displayConflictMenu(schedule: WeeklySchedule): void {
    this.clearScreen();
    this.printSectionHeader('🔧 Conflict Resolution Menu');
    
    const errorConflicts = schedule.getConflictsBySeverity('error');
    const warningConflicts = schedule.getConflictsBySeverity('warning');
    
    console.log(`Remaining conflicts: ${schedule.conflicts.length}`);
    console.log(`🚨 Critical: ${errorConflicts.length} | ⚠️ Warnings: ${warningConflicts.length}`);
    console.log('');
    
    console.log('1. 🎯 Resolve Next Critical Conflict');
    console.log('2. 🔍 Choose Specific Conflict');
    console.log('3. 🤖 Auto-Resolve All Conflicts');
    console.log('4. 📊 Analyze Conflict Details');
    console.log('5. 📜 View Resolution History');
    console.log('6. 🚪 Exit Resolution');
    console.log('');
  }

  /**
   * Resolve the next critical conflict
   */
  private async resolveNextCriticalConflict(schedule: WeeklySchedule): Promise<void> {
    const errorConflicts = schedule.getConflictsBySeverity('error');
    const conflict = errorConflicts.length > 0 ? errorConflicts[0] : schedule.conflicts[0];
    
    await this.resolveConflict(schedule, conflict);
  }

  /**
   * Let user choose a specific conflict to resolve
   */
  private async resolveSpecificConflict(schedule: WeeklySchedule): Promise<void> {
    console.log('\n' + this.colorize('Select Conflict to Resolve:', 'cyan'));
    console.log('='.repeat(60));
    
    schedule.conflicts.forEach((conflict, index) => {
      const severityIcon = conflict.severity === 'error' ? '🚨' : '⚠️';
      console.log(`${index + 1}. ${severityIcon} ${conflict.type}: ${conflict.message}`);
    });
    
    console.log('');
    const choice = await this.promptNumber(
      `Select conflict (1-${schedule.conflicts.length}): `,
      1,
      schedule.conflicts.length
    );
    
    const selectedConflict = schedule.conflicts[choice - 1];
    await this.resolveConflict(schedule, selectedConflict);
  }

  /**
   * Attempt to auto-resolve all conflicts
   */
  private async autoResolveAllConflicts(schedule: WeeklySchedule): Promise<void> {
    console.log('\n' + this.colorize('Auto-Resolving All Conflicts...', 'cyan'));
    
    const totalConflicts = schedule.conflicts.length;
    let resolvedCount = 0;
    let failedCount = 0;
    
    // Process conflicts in order of priority (errors first)
    const sortedConflicts = [...schedule.conflicts].sort((a, b) => {
      if (a.severity === 'error' && b.severity !== 'error') return -1;
      if (a.severity !== 'error' && b.severity === 'error') return 1;
      return 0;
    });
    
    for (let i = 0; i < sortedConflicts.length && schedule.conflicts.length > 0; i++) {
      const conflict = sortedConflicts[i];
      
      // Skip if conflict was already resolved by a previous resolution
      if (!schedule.conflicts.includes(conflict)) continue;
      
      console.log(`Resolving ${i + 1}/${totalConflicts}: ${conflict.type}`);
      
      const analysis = await this.analyzeConflict(schedule, conflict);
      const bestSuggestion = analysis.suggestions[0];
      
      if (bestSuggestion && bestSuggestion.feasibilityScore > 0.7) {
        const success = await this.applySuggestion(schedule, conflict, bestSuggestion);
        if (success) {
          resolvedCount++;
          console.log(this.colorize(`✅ Resolved: ${conflict.type}`, 'green'));
        } else {
          failedCount++;
          console.log(this.colorize(`❌ Failed: ${conflict.type}`, 'red'));
        }
      } else {
        failedCount++;
        console.log(this.colorize(`⏭️ Skipped: ${conflict.type} (low feasibility)`, 'yellow'));
      }
    }
    
    console.log('');
    console.log(this.colorize('Auto-Resolution Summary:', 'cyan'));
    console.log(`✅ Resolved: ${resolvedCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`📊 Success Rate: ${((resolvedCount / totalConflicts) * 100).toFixed(1)}%`);
    
    await this.waitForEnter();
  }

  /**
   * Analyze and display detailed conflict information
   */
  private async analyzeConflictDetails(schedule: WeeklySchedule): Promise<void> {
    console.log('\n' + this.colorize('Detailed Conflict Analysis:', 'cyan'));
    console.log('='.repeat(60));
    
    for (const conflict of schedule.conflicts) {
      const analysis = await this.analyzeConflict(schedule, conflict);
      
      console.log(`\n${this.getConflictIcon(conflict.severity)} ${conflict.type}`);
      console.log(`Message: ${conflict.message}`);
      console.log(`Severity: ${conflict.severity.toUpperCase()}`);
      console.log(`Priority: ${analysis.priority.toUpperCase()}`);
      console.log(`Complexity: ${analysis.complexity}`);
      console.log(`Root Cause: ${analysis.rootCause}`);
      
      if (conflict.affectedEntries.length > 0) {
        console.log('Affected Entries:');
        conflict.affectedEntries.forEach(entry => {
          console.log(`  - ${entry.batchId}: ${entry.subjectId} (${this.getDayName(entry.timeSlot.day)} ${entry.timeSlot.startTime})`);
        });
      }
      
      console.log(`Available Solutions: ${analysis.suggestions.length}`);
      if (analysis.suggestions.length > 0) {
        const bestSolution = analysis.suggestions[0];
        console.log(`Best Solution: ${bestSolution.description} (${(bestSolution.feasibilityScore * 100).toFixed(0)}% feasible)`);
      }
      
      console.log('-'.repeat(40));
    }
    
    await this.waitForEnter();
  }

  /**
   * View resolution history
   */
  private async viewResolutionHistory(): Promise<void> {
    console.log('\n' + this.colorize('Resolution History:', 'cyan'));
    console.log('='.repeat(60));
    
    if (this.resolutionHistory.length === 0) {
      console.log(this.colorize('No resolutions performed yet.', 'yellow'));
    } else {
      this.resolutionHistory.forEach((record, index) => {
        const statusIcon = record.success ? '✅' : '❌';
        console.log(`${index + 1}. ${statusIcon} ${record.conflict.type}`);
        console.log(`   Resolution: ${record.resolution.description}`);
        console.log(`   Time: ${record.timestamp.toLocaleString()}`);
        console.log(`   Impact: ${record.resolution.estimatedImpact}`);
        console.log('');
      });
      
      const successRate = (this.resolutionHistory.filter(r => r.success).length / this.resolutionHistory.length) * 100;
      console.log(this.colorize(`Overall Success Rate: ${successRate.toFixed(1)}%`, 'cyan'));
    }
    
    await this.waitForEnter();
  }

  /**
   * Resolve a specific conflict with user interaction
   */
  private async resolveConflict(schedule: WeeklySchedule, conflict: ConstraintViolation): Promise<void> {
    console.log('\n' + this.colorize(`Resolving: ${conflict.type}`, 'cyan'));
    console.log('='.repeat(60));
    console.log(`Message: ${conflict.message}`);
    console.log(`Severity: ${conflict.severity.toUpperCase()}`);
    console.log('');
    
    // Analyze the conflict
    const analysis = await this.analyzeConflict(schedule, conflict);
    
    if (this.options.showDetailedAnalysis) {
      console.log(this.colorize('Analysis:', 'yellow'));
      console.log(`Root Cause: ${analysis.rootCause}`);
      console.log(`Complexity: ${analysis.complexity}`);
      console.log(`Priority: ${analysis.priority}`);
      console.log('');
    }
    
    if (analysis.suggestions.length === 0) {
      console.log(this.colorize('❌ No automatic solutions available for this conflict.', 'red'));
      console.log('You may need to manually adjust the schedule or modify constraints.');
      await this.waitForEnter();
      return;
    }
    
    // Display suggestions
    console.log(this.colorize('Available Solutions:', 'yellow'));
    analysis.suggestions.slice(0, this.options.maxSuggestionsPerConflict).forEach((suggestion, index) => {
      const feasibilityBar = this.createFeasibilityBar(suggestion.feasibilityScore);
      console.log(`${index + 1}. ${suggestion.description}`);
      console.log(`   Type: ${suggestion.type} | Impact: ${suggestion.estimatedImpact} | Feasibility: ${feasibilityBar}`);
      console.log('');
    });
    
    // Let user choose solution
    const maxChoice = Math.min(analysis.suggestions.length, this.options.maxSuggestionsPerConflict);
    console.log(`${maxChoice + 1}. Skip this conflict`);
    console.log(`${maxChoice + 2}. Manual resolution`);
    console.log('');
    
    const choice = await this.promptNumber(`Select solution (1-${maxChoice + 2}): `, 1, maxChoice + 2);
    
    if (choice <= maxChoice) {
      const selectedSuggestion = analysis.suggestions[choice - 1];
      await this.applySuggestionWithConfirmation(schedule, conflict, selectedSuggestion);
    } else if (choice === maxChoice + 1) {
      console.log(this.colorize('Conflict skipped.', 'yellow'));
    } else {
      await this.manualResolution(schedule, conflict);
    }
  }

  /**
   * Analyze a conflict and generate resolution suggestions
   */
  private async analyzeConflict(schedule: WeeklySchedule, conflict: ConstraintViolation): Promise<ConflictAnalysis> {
    const suggestions: ResolutionSuggestion[] = [];
    
    // Determine root cause and complexity
    const rootCause = this.determineRootCause(conflict);
    const complexity = this.assessComplexity(conflict);
    const priority = this.assessPriority(conflict);
    
    // Generate suggestions based on conflict type
    switch (conflict.type) {
      case 'faculty_conflict':
        suggestions.push(...await this.generateFacultyConflictSuggestions(schedule, conflict));
        break;
      case 'time_slot_overlap':
        suggestions.push(...await this.generateTimeSlotOverlapSuggestions(schedule, conflict));
        break;
      case 'batch_overload':
        suggestions.push(...await this.generateBatchOverloadSuggestions(schedule, conflict));
        break;
      case 'holiday_conflict':
        suggestions.push(...await this.generateHolidayConflictSuggestions(schedule, conflict));
        break;
      default:
        suggestions.push(...await this.generateGenericSuggestions(schedule, conflict));
    }
    
    // Sort suggestions by feasibility score
    suggestions.sort((a, b) => b.feasibilityScore - a.feasibilityScore);
    
    return {
      conflict,
      rootCause,
      suggestions,
      complexity,
      priority
    };
  }

  /**
   * Generate suggestions for faculty conflicts
   */
  private async generateFacultyConflictSuggestions(
    schedule: WeeklySchedule, 
    conflict: ConstraintViolation
  ): Promise<ResolutionSuggestion[]> {
    const suggestions: ResolutionSuggestion[] = [];
    
    if (conflict.affectedEntries.length >= 2) {
      const [entry1, entry2] = conflict.affectedEntries;
      
      // Suggestion 1: Move first entry
      const alternatives1 = await this.adjustmentService.findAlternativeTimeSlots(schedule, entry1);
      if (alternatives1.length > 0) {
        suggestions.push({
          type: 'move',
          description: `Move ${entry1.subjectId} (${entry1.batchId}) to alternative time slot`,
          affectedEntries: [entry1],
          estimatedImpact: 'low',
          feasibilityScore: Math.min(alternatives1.length / 10, 1),
          steps: [
            `Identify alternative time slots for ${entry1.subjectId}`,
            `Move lecture to ${alternatives1[0] ? this.getDayName(alternatives1[0].day) + ' ' + alternatives1[0].startTime : 'available slot'}`,
            'Verify no new conflicts are created'
          ]
        });
      }
      
      // Suggestion 2: Move second entry
      const alternatives2 = await this.adjustmentService.findAlternativeTimeSlots(schedule, entry2);
      if (alternatives2.length > 0) {
        suggestions.push({
          type: 'move',
          description: `Move ${entry2.subjectId} (${entry2.batchId}) to alternative time slot`,
          affectedEntries: [entry2],
          estimatedImpact: 'low',
          feasibilityScore: Math.min(alternatives2.length / 10, 1),
          steps: [
            `Identify alternative time slots for ${entry2.subjectId}`,
            `Move lecture to ${alternatives2[0] ? this.getDayName(alternatives2[0].day) + ' ' + alternatives2[0].startTime : 'available slot'}`,
            'Verify no new conflicts are created'
          ]
        });
      }
      
      // Suggestion 3: Swap with other lectures
      suggestions.push({
        type: 'swap',
        description: 'Swap one of the conflicting lectures with a non-conflicting lecture',
        affectedEntries: conflict.affectedEntries,
        estimatedImpact: 'medium',
        feasibilityScore: 0.6,
        steps: [
          'Identify suitable lectures for swapping',
          'Perform time slot swap',
          'Verify conflict resolution'
        ]
      });
    }
    
    return suggestions;
  }

  /**
   * Generate suggestions for time slot overlaps
   */
  private async generateTimeSlotOverlapSuggestions(
    schedule: WeeklySchedule, 
    conflict: ConstraintViolation
  ): Promise<ResolutionSuggestion[]> {
    const suggestions: ResolutionSuggestion[] = [];
    
    // Similar pattern for other conflict types...
    suggestions.push({
      type: 'move',
      description: 'Move overlapping lectures to different time slots',
      affectedEntries: conflict.affectedEntries,
      estimatedImpact: 'medium',
      feasibilityScore: 0.7,
      steps: [
        'Identify overlapping time periods',
        'Find alternative slots for affected lectures',
        'Reschedule to eliminate overlap'
      ]
    });
    
    return suggestions;
  }

  /**
   * Generate suggestions for batch overload
   */
  private async generateBatchOverloadSuggestions(
    schedule: WeeklySchedule, 
    conflict: ConstraintViolation
  ): Promise<ResolutionSuggestion[]> {
    const suggestions: ResolutionSuggestion[] = [];
    
    suggestions.push({
      type: 'reschedule',
      description: 'Redistribute lectures across different days',
      affectedEntries: conflict.affectedEntries,
      estimatedImpact: 'medium',
      feasibilityScore: 0.8,
      steps: [
        'Identify overloaded days',
        'Find days with lighter schedules',
        'Move some lectures to balance the load'
      ]
    });
    
    return suggestions;
  }

  /**
   * Generate suggestions for holiday conflicts
   */
  private async generateHolidayConflictSuggestions(
    schedule: WeeklySchedule, 
    conflict: ConstraintViolation
  ): Promise<ResolutionSuggestion[]> {
    const suggestions: ResolutionSuggestion[] = [];
    
    suggestions.push({
      type: 'move',
      description: 'Move lectures scheduled on holidays to working days',
      affectedEntries: conflict.affectedEntries,
      estimatedImpact: 'low',
      feasibilityScore: 0.9,
      steps: [
        'Identify lectures scheduled on holidays',
        'Find equivalent time slots on working days',
        'Reschedule affected lectures'
      ]
    });
    
    return suggestions;
  }

  /**
   * Generate generic suggestions for unknown conflict types
   */
  private async generateGenericSuggestions(
    schedule: WeeklySchedule, 
    conflict: ConstraintViolation
  ): Promise<ResolutionSuggestion[]> {
    const suggestions: ResolutionSuggestion[] = [];
    
    if (conflict.affectedEntries.length > 0) {
      suggestions.push({
        type: 'move',
        description: 'Move affected lectures to alternative time slots',
        affectedEntries: conflict.affectedEntries,
        estimatedImpact: 'medium',
        feasibilityScore: 0.5,
        steps: [
          'Analyze conflict details',
          'Find suitable alternative arrangements',
          'Apply changes and verify resolution'
        ]
      });
    }
    
    return suggestions;
  }

  /**
   * Apply a suggestion with user confirmation
   */
  private async applySuggestionWithConfirmation(
    schedule: WeeklySchedule, 
    conflict: ConstraintViolation, 
    suggestion: ResolutionSuggestion
  ): Promise<void> {
    console.log('\n' + this.colorize('Resolution Steps:', 'cyan'));
    suggestion.steps.forEach((step, index) => {
      console.log(`${index + 1}. ${step}`);
    });
    console.log('');
    
    const confirm = await this.promptYesNo('Apply this solution? (y/n): ');
    
    if (confirm) {
      const success = await this.applySuggestion(schedule, conflict, suggestion);
      
      this.resolutionHistory.push({
        conflict,
        resolution: suggestion,
        timestamp: new Date(),
        success
      });
      
      if (success) {
        console.log(this.colorize('✅ Solution applied successfully!', 'green'));
      } else {
        console.log(this.colorize('❌ Failed to apply solution.', 'red'));
      }
    } else {
      console.log(this.colorize('Solution cancelled.', 'yellow'));
    }
    
    await this.waitForEnter();
  }

  /**
   * Apply a resolution suggestion
   */
  private async applySuggestion(
    schedule: WeeklySchedule, 
    conflict: ConstraintViolation, 
    suggestion: ResolutionSuggestion
  ): Promise<boolean> {
    try {
      switch (suggestion.type) {
        case 'move':
          return await this.applyMoveSuggestion(schedule, suggestion);
        case 'swap':
          return await this.applySwapSuggestion(schedule, suggestion);
        case 'remove':
          return await this.applyRemoveSuggestion(schedule, suggestion);
        case 'reschedule':
          return await this.applyRescheduleSuggestion(schedule, suggestion);
        default:
          return false;
      }
    } catch (error) {
      console.log(this.colorize(`Error applying suggestion: ${error.message}`, 'red'));
      return false;
    }
  }

  /**
   * Apply move suggestion
   */
  private async applyMoveSuggestion(schedule: WeeklySchedule, suggestion: ResolutionSuggestion): Promise<boolean> {
    if (suggestion.affectedEntries.length === 0) return false;
    
    const entryToMove = suggestion.affectedEntries[0];
    const alternatives = await this.adjustmentService.findAlternativeTimeSlots(schedule, entryToMove);
    
    if (alternatives.length === 0) return false;
    
    const bestAlternative = alternatives[0];
    return await this.adjustmentService.moveLecture(
      schedule,
      entryToMove,
      bestAlternative.day,
      bestAlternative.startTime
    );
  }

  /**
   * Apply swap suggestion
   */
  private async applySwapSuggestion(schedule: WeeklySchedule, suggestion: ResolutionSuggestion): Promise<boolean> {
    if (suggestion.affectedEntries.length < 2) return false;
    
    const [entry1, entry2] = suggestion.affectedEntries;
    return await this.adjustmentService.swapLectures(schedule, entry1, entry2);
  }

  /**
   * Apply remove suggestion
   */
  private async applyRemoveSuggestion(schedule: WeeklySchedule, suggestion: ResolutionSuggestion): Promise<boolean> {
    if (suggestion.affectedEntries.length === 0) return false;
    
    const entryToRemove = suggestion.affectedEntries[0];
    schedule.removeEntry(entryToRemove);
    return true;
  }

  /**
   * Apply reschedule suggestion
   */
  private async applyRescheduleSuggestion(schedule: WeeklySchedule, suggestion: ResolutionSuggestion): Promise<boolean> {
    // This would implement more complex rescheduling logic
    // For now, try to move the first affected entry
    return await this.applyMoveSuggestion(schedule, suggestion);
  }

  /**
   * Manual resolution interface
   */
  private async manualResolution(schedule: WeeklySchedule, conflict: ConstraintViolation): Promise<void> {
    console.log('\n' + this.colorize('Manual Resolution Options:', 'cyan'));
    console.log('1. Move specific lecture');
    console.log('2. Remove specific lecture');
    console.log('3. Edit lecture details');
    console.log('4. Skip this conflict');
    console.log('');
    
    const choice = await this.promptNumber('Select option (1-4): ', 1, 4);
    
    switch (choice) {
      case 1:
        await this.manualMoveLecture(schedule, conflict);
        break;
      case 2:
        await this.manualRemoveLecture(schedule, conflict);
        break;
      case 3:
        await this.manualEditLecture(schedule, conflict);
        break;
      case 4:
        console.log('Conflict skipped.');
        break;
    }
  }

  /**
   * Manual lecture move
   */
  private async manualMoveLecture(schedule: WeeklySchedule, conflict: ConstraintViolation): Promise<void> {
    if (conflict.affectedEntries.length === 0) return;
    
    console.log('\nSelect lecture to move:');
    conflict.affectedEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.subjectId} (${entry.batchId}) - ${this.getDayName(entry.timeSlot.day)} ${entry.timeSlot.startTime}`);
    });
    
    const choice = await this.promptNumber(`Select lecture (1-${conflict.affectedEntries.length}): `, 1, conflict.affectedEntries.length);
    const selectedEntry = conflict.affectedEntries[choice - 1];
    
    // Get new time slot details
    const newDay = await this.selectDay();
    if (!newDay) return;
    
    const newTime = await this.prompt('New start time (HH:MM): ');
    if (!this.isValidTime(newTime)) {
      console.log(this.colorize('Invalid time format.', 'red'));
      return;
    }
    
    const success = await this.adjustmentService.moveLecture(schedule, selectedEntry, newDay, newTime);
    
    if (success) {
      console.log(this.colorize('✅ Lecture moved successfully!', 'green'));
    } else {
      console.log(this.colorize('❌ Failed to move lecture.', 'red'));
    }
  }

  /**
   * Manual lecture removal
   */
  private async manualRemoveLecture(schedule: WeeklySchedule, conflict: ConstraintViolation): Promise<void> {
    if (conflict.affectedEntries.length === 0) return;
    
    console.log('\nSelect lecture to remove:');
    conflict.affectedEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.subjectId} (${entry.batchId}) - ${this.getDayName(entry.timeSlot.day)} ${entry.timeSlot.startTime}`);
    });
    
    const choice = await this.promptNumber(`Select lecture (1-${conflict.affectedEntries.length}): `, 1, conflict.affectedEntries.length);
    const selectedEntry = conflict.affectedEntries[choice - 1];
    
    const confirm = await this.promptYesNo(`Remove ${selectedEntry.subjectId} (${selectedEntry.batchId})? (y/n): `);
    
    if (confirm) {
      schedule.removeEntry(selectedEntry);
      console.log(this.colorize('✅ Lecture removed successfully!', 'green'));
    }
  }

  /**
   * Manual lecture editing
   */
  private async manualEditLecture(schedule: WeeklySchedule, conflict: ConstraintViolation): Promise<void> {
    console.log(this.colorize('Manual editing not yet implemented.', 'yellow'));
    console.log('This feature would allow editing lecture details like duration, faculty, etc.');
  }

  /**
   * Display resolution summary
   */
  private async displayResolutionSummary(): Promise<void> {
    if (this.resolutionHistory.length === 0) return;
    
    console.log('\n' + this.colorize('Resolution Session Summary:', 'cyan'));
    console.log('='.repeat(60));
    
    const successful = this.resolutionHistory.filter(r => r.success).length;
    const failed = this.resolutionHistory.length - successful;
    
    console.log(`Total Resolutions Attempted: ${this.resolutionHistory.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Success Rate: ${((successful / this.resolutionHistory.length) * 100).toFixed(1)}%`);
    console.log('');
    
    // Resolution type breakdown
    const typeBreakdown = new Map<string, number>();
    this.resolutionHistory.forEach(record => {
      typeBreakdown.set(record.resolution.type, (typeBreakdown.get(record.resolution.type) || 0) + 1);
    });
    
    console.log('Resolution Types Used:');
    Array.from(typeBreakdown.entries()).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    await this.waitForEnter();
  }

  // Helper methods
  private determineRootCause(conflict: ConstraintViolation): string {
    switch (conflict.type) {
      case 'faculty_conflict':
        return 'Faculty member assigned to multiple lectures at the same time';
      case 'time_slot_overlap':
        return 'Multiple lectures scheduled in overlapping time periods';
      case 'batch_overload':
        return 'Too many lectures scheduled for a batch on the same day';
      case 'holiday_conflict':
        return 'Lectures scheduled on designated holidays';
      default:
        return 'Unknown scheduling constraint violation';
    }
  }

  private assessComplexity(conflict: ConstraintViolation): 'simple' | 'moderate' | 'complex' {
    const affectedCount = conflict.affectedEntries.length;
    
    if (affectedCount <= 2) return 'simple';
    if (affectedCount <= 5) return 'moderate';
    return 'complex';
  }

  private assessPriority(conflict: ConstraintViolation): 'low' | 'medium' | 'high' | 'critical' {
    if (conflict.severity === 'error') {
      return conflict.affectedEntries.length > 3 ? 'critical' : 'high';
    } else {
      return conflict.affectedEntries.length > 3 ? 'medium' : 'low';
    }
  }

  private createFeasibilityBar(score: number): string {
    const width = 10;
    const filled = Math.round(width * score);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percentage = (score * 100).toFixed(0);
    
    return `${bar} ${percentage}%`;
  }

  private getConflictIcon(severity: string): string {
    return severity === 'error' ? '🚨' : '⚠️';
  }

  // Utility methods (similar to InteractiveScheduleReviewer)
  private colorize(text: string, color: string): string {
    if (!this.options.enableColors) return text;
    
    const colors: { [key: string]: string } = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      gray: '\x1b[90m',
      reset: '\x1b[0m'
    };
    
    return `${colors[color] || ''}${text}${colors.reset}`;
  }

  private printHeader(title: string): void {
    const width = 80;
    const padding = Math.max(0, (width - title.length) / 2);
    
    console.log('='.repeat(width));
    console.log(' '.repeat(Math.floor(padding)) + title);
    console.log('='.repeat(width));
    console.log('');
  }

  private printSectionHeader(title: string): void {
    console.log('\n' + this.colorize(title, 'cyan'));
    console.log('-'.repeat(title.length));
  }

  private clearScreen(): void {
    console.clear();
  }

  private async waitForEnter(): Promise<void> {
    console.log(this.colorize('\nPress Enter to continue...', 'gray'));
    await this.prompt('');
  }

  private async prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  private async promptYesNo(question: string): Promise<boolean> {
    const answer = await this.prompt(question);
    return answer.toLowerCase().startsWith('y');
  }

  private async promptNumber(question: string, min: number, max: number): Promise<number> {
    while (true) {
      const answer = await this.prompt(question);
      const num = parseInt(answer);
      
      if (isNaN(num) || num < min || num > max) {
        console.log(this.colorize(`Please enter a number between ${min} and ${max}.`, 'red'));
        continue;
      }
      
      return num;
    }
  }

  private async selectDay(): Promise<DayOfWeek | undefined> {
    const days = [
      { name: 'Monday', value: DayOfWeek.MONDAY },
      { name: 'Tuesday', value: DayOfWeek.TUESDAY },
      { name: 'Wednesday', value: DayOfWeek.WEDNESDAY },
      { name: 'Thursday', value: DayOfWeek.THURSDAY },
      { name: 'Friday', value: DayOfWeek.FRIDAY }
    ];

    console.log('\nSelect day:');
    days.forEach((day, index) => {
      console.log(`${index + 1}. ${day.name}`);
    });

    const choice = await this.promptNumber(`Select day (1-${days.length}): `, 1, days.length);
    return days[choice - 1].value;
  }

  private getDayName(day: DayOfWeek): string {
    const dayNames: { [key in DayOfWeek]: string } = {
      [DayOfWeek.MONDAY]: 'Monday',
      [DayOfWeek.TUESDAY]: 'Tuesday',
      [DayOfWeek.WEDNESDAY]: 'Wednesday',
      [DayOfWeek.THURSDAY]: 'Thursday',
      [DayOfWeek.FRIDAY]: 'Friday',
      [DayOfWeek.SATURDAY]: 'Saturday',
      [DayOfWeek.SUNDAY]: 'Sunday'
    };
    return dayNames[day];
  }

  private isValidTime(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  private cleanup(): void {
    this.rl.close();
  }
}
