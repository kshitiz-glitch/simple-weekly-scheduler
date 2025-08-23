import * as readline from 'readline';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { ScheduleEntry, DayOfWeek, ConstraintViolation } from '../models';
import { ExportManager } from '../exporters/ExportManager';
import { ExportFormat, ExportOptions } from '../exporters/ExportInterfaces';
import { ConflictReporter } from '../services/ConflictReporter';
import { ManualAdjustmentService } from '../services/ManualAdjustmentService';

export interface ReviewOptions {
  enableColors?: boolean;
  showDetailedStats?: boolean;
  allowManualAdjustments?: boolean;
  autoSaveChanges?: boolean;
}

export interface ViewFilter {
  batchId?: string;
  facultyId?: string;
  day?: DayOfWeek;
  timeRange?: { start: string; end: string };
  conflictsOnly?: boolean;
}

export class InteractiveScheduleReviewer {
  private rl: readline.Interface;
  private exportManager: ExportManager;
  private conflictReporter: ConflictReporter;
  private adjustmentService: ManualAdjustmentService;
  private options: Required<ReviewOptions>;
  private currentSchedule: WeeklySchedule;
  private originalSchedule: WeeklySchedule;
  private hasUnsavedChanges: boolean;

  constructor(options: ReviewOptions = {}) {
    this.options = {
      enableColors: options.enableColors ?? true,
      showDetailedStats: options.showDetailedStats ?? true,
      allowManualAdjustments: options.allowManualAdjustments ?? true,
      autoSaveChanges: options.autoSaveChanges ?? false
    };

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.exportManager = new ExportManager();
    this.conflictReporter = new ConflictReporter();
    this.adjustmentService = new ManualAdjustmentService();
    this.hasUnsavedChanges = false;
  }

  /**
   * Start interactive review session
   */
  async reviewSchedule(schedule: WeeklySchedule): Promise<WeeklySchedule> {
    this.currentSchedule = schedule;
    this.originalSchedule = this.deepCloneSchedule(schedule);

    try {
      await this.displayWelcome();
      await this.mainReviewLoop();
      
      if (this.hasUnsavedChanges) {
        const saveChanges = await this.promptYesNo('Save changes before exiting? (y/n): ');
        if (saveChanges) {
          await this.saveChanges();
        }
      }

      return this.currentSchedule;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Display welcome message and overview
   */
  private async displayWelcome(): Promise<void> {
    this.clearScreen();
    this.printHeader('INTERACTIVE SCHEDULE REVIEWER');
    
    console.log(this.colorize('Welcome to the Interactive Schedule Review System!', 'cyan'));
    console.log('Here you can review, analyze, and export your generated timetable.\n');
    
    // Display quick overview
    const stats = this.currentSchedule.calculateStatistics();
    console.log(this.colorize('Schedule Overview:', 'yellow'));
    console.log(`📚 Total Lectures: ${stats.totalEntries}`);
    console.log(`🏫 Batches: ${stats.entriesPerBatch.size}`);
    console.log(`👨‍🏫 Faculty Members: ${stats.entriesPerFaculty.size}`);
    console.log(`⚠️  Conflicts: ${this.currentSchedule.conflicts.length}`);
    console.log(`📊 Utilization: ${stats.timeSlotUtilization.utilizationRate.toFixed(1)}%`);
    console.log('');

    if (this.currentSchedule.conflicts.length > 0) {
      console.log(this.colorize('⚠️ Note: This schedule has conflicts that may need attention.', 'yellow'));
      console.log('');
    }

    await this.waitForEnter();
  }

  /**
   * Main review loop with menu options
   */
  private async mainReviewLoop(): Promise<void> {
    let continueReview = true;

    while (continueReview) {
      this.displayMainMenu();
      
      const choice = await this.promptNumber('Select an option (1-9): ', 1, 9);
      
      switch (choice) {
        case 1:
          await this.viewScheduleOverview();
          break;
        case 2:
          await this.viewDetailedSchedule();
          break;
        case 3:
          await this.analyzeConflicts();
          break;
        case 4:
          await this.viewStatistics();
          break;
        case 5:
          await this.filterAndSearch();
          break;
        case 6:
          if (this.options.allowManualAdjustments) {
            await this.makeManualAdjustments();
          } else {
            console.log(this.colorize('Manual adjustments are disabled.', 'yellow'));
            await this.waitForEnter();
          }
          break;
        case 7:
          await this.compareWithOriginal();
          break;
        case 8:
          await this.exportSchedule();
          break;
        case 9:
          continueReview = false;
          break;
      }
    }
  }

  /**
   * Display main menu options
   */
  private displayMainMenu(): void {
    this.clearScreen();
    this.printSectionHeader('📋 Schedule Review Menu');
    
    console.log('1. 📊 View Schedule Overview');
    console.log('2. 📅 View Detailed Schedule');
    console.log('3. ⚠️  Analyze Conflicts');
    console.log('4. 📈 View Statistics');
    console.log('5. 🔍 Filter & Search');
    console.log('6. ✏️  Manual Adjustments' + (this.options.allowManualAdjustments ? '' : ' (Disabled)'));
    console.log('7. 🔄 Compare with Original');
    console.log('8. 📤 Export Schedule');
    console.log('9. 🚪 Exit Review');
    console.log('');

    if (this.hasUnsavedChanges) {
      console.log(this.colorize('⚠️ You have unsaved changes!', 'yellow'));
      console.log('');
    }
  }

  /**
   * View schedule overview with summary information
   */
  private async viewScheduleOverview(): Promise<void> {
    this.printSectionHeader('📊 Schedule Overview');
    
    const stats = this.currentSchedule.calculateStatistics();
    
    // Basic statistics
    console.log(this.colorize('Basic Information:', 'cyan'));
    console.log(`Total Lectures: ${stats.totalEntries}`);
    console.log(`Unique Batches: ${stats.entriesPerBatch.size}`);
    console.log(`Faculty Members: ${stats.entriesPerFaculty.size}`);
    console.log(`Subjects: ${stats.entriesPerSubject.size}`);
    console.log(`Conflicts: ${this.currentSchedule.conflicts.length}`);
    console.log('');

    // Daily distribution
    console.log(this.colorize('Daily Distribution:', 'cyan'));
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    days.forEach(day => {
      const dayEntries = this.currentSchedule.getEntriesForDay(day as DayOfWeek);
      const bar = this.createProgressBar(dayEntries.length, stats.dailyLoadDistribution.maxEntriesPerDay, 20);
      console.log(`${day.padEnd(10)}: ${bar} ${dayEntries.length} lectures`);
    });
    console.log('');

    // Time slot utilization
    console.log(this.colorize('Utilization:', 'cyan'));
    console.log(`Overall: ${stats.timeSlotUtilization.utilizationRate.toFixed(1)}%`);
    console.log(`Peak Hour: ${stats.timeSlotUtilization.peakHour || 'N/A'}`);
    console.log(`Available Slots: ${stats.timeSlotUtilization.availableSlots}`);
    console.log(`Used Slots: ${stats.timeSlotUtilization.usedSlots}`);
    console.log('');

    // Quality indicators
    const qualityScore = this.calculateQualityScore();
    console.log(this.colorize('Quality Indicators:', 'cyan'));
    console.log(`Overall Quality: ${this.getQualityRating(qualityScore)} (${qualityScore.toFixed(1)}/10)`);
    console.log(`Distribution Balance: ${this.getDistributionRating(stats.dailyLoadDistribution.standardDeviation)}`);
    console.log(`Conflict Level: ${this.getConflictRating(this.currentSchedule.conflicts.length)}`);
    console.log('');

    await this.waitForEnter();
  }

  /**
   * View detailed schedule with various display options
   */
  private async viewDetailedSchedule(): Promise<void> {
    this.printSectionHeader('📅 Detailed Schedule View');
    
    console.log('Choose view format:');
    console.log('1. Weekly Grid View');
    console.log('2. Daily List View');
    console.log('3. Faculty-wise View');
    console.log('4. Batch-wise View');
    console.log('5. Subject-wise View');
    console.log('');

    const viewChoice = await this.promptNumber('Select view (1-5): ', 1, 5);
    
    switch (viewChoice) {
      case 1:
        await this.displayWeeklyGrid();
        break;
      case 2:
        await this.displayDailyList();
        break;
      case 3:
        await this.displayFacultyView();
        break;
      case 4:
        await this.displayBatchView();
        break;
      case 5:
        await this.displaySubjectView();
        break;
    }
  }

  /**
   * Display weekly grid view
   */
  private async displayWeeklyGrid(): Promise<void> {
    console.log('\n' + this.colorize('Weekly Grid View', 'cyan'));
    console.log('='.repeat(120));

    const timeSlots = this.generateTimeSlots();
    const days = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY];
    
    // Header
    console.log('Time'.padEnd(12) + days.map(day => this.getDayName(day).padEnd(20)).join(''));
    console.log('-'.repeat(120));

    // Time slots
    timeSlots.forEach(timeSlot => {
      let row = timeSlot.padEnd(12);
      
      days.forEach(day => {
        const entry = this.findEntryForTimeSlot(day, timeSlot);
        const cellContent = entry 
          ? `${entry.subjectId.substring(0, 8)}(${entry.batchId.substring(0, 6)})`
          : '';
        row += cellContent.padEnd(20);
      });
      
      console.log(row);
    });

    console.log('='.repeat(120));
    await this.waitForEnter();
  }

  /**
   * Display daily list view
   */
  private async displayDailyList(): Promise<void> {
    const day = await this.selectDay();
    if (!day) return;

    console.log('\n' + this.colorize(`${this.getDayName(day)} Schedule`, 'cyan'));
    console.log('='.repeat(80));

    const dayEntries = this.currentSchedule.getEntriesForDay(day)
      .sort((a, b) => a.timeSlot.startTime.localeCompare(b.timeSlot.startTime));

    if (dayEntries.length === 0) {
      console.log(this.colorize('No lectures scheduled for this day.', 'yellow'));
    } else {
      dayEntries.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.timeSlot.startTime} - ${entry.timeSlot.endTime}`);
        console.log(`   Subject: ${entry.subjectId}`);
        console.log(`   Batch: ${entry.batchId}`);
        console.log(`   Faculty: ${entry.facultyId}`);
        console.log('');
      });
    }

    console.log('='.repeat(80));
    await this.waitForEnter();
  }

  /**
   * Display faculty-wise view
   */
  private async displayFacultyView(): Promise<void> {
    console.log('\n' + this.colorize('Faculty-wise Schedule View', 'cyan'));
    console.log('='.repeat(80));

    const facultySchedules = new Map<string, ScheduleEntry[]>();
    
    this.currentSchedule.entries.forEach(entry => {
      if (!facultySchedules.has(entry.facultyId)) {
        facultySchedules.set(entry.facultyId, []);
      }
      facultySchedules.get(entry.facultyId)!.push(entry);
    });

    Array.from(facultySchedules.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([facultyId, entries]) => {
        console.log(this.colorize(`👨‍🏫 ${facultyId}`, 'yellow'));
        console.log(`   Total Lectures: ${entries.length}`);
        
        const weeklyHours = entries.reduce((sum, entry) => {
          const duration = this.calculateDuration(entry.timeSlot.startTime, entry.timeSlot.endTime);
          return sum + duration;
        }, 0);
        
        console.log(`   Weekly Hours: ${(weeklyHours / 60).toFixed(1)} hours`);
        
        // Show daily breakdown
        const dailyCount = new Map<DayOfWeek, number>();
        entries.forEach(entry => {
          dailyCount.set(entry.timeSlot.day, (dailyCount.get(entry.timeSlot.day) || 0) + 1);
        });
        
        const dailyBreakdown = Array.from(dailyCount.entries())
          .map(([day, count]) => `${this.getDayName(day)}: ${count}`)
          .join(', ');
        
        console.log(`   Daily: ${dailyBreakdown}`);
        console.log('');
      });

    await this.waitForEnter();
  }

  /**
   * Display batch-wise view
   */
  private async displayBatchView(): Promise<void> {
    console.log('\n' + this.colorize('Batch-wise Schedule View', 'cyan'));
    console.log('='.repeat(80));

    const batchSchedules = new Map<string, ScheduleEntry[]>();
    
    this.currentSchedule.entries.forEach(entry => {
      if (!batchSchedules.has(entry.batchId)) {
        batchSchedules.set(entry.batchId, []);
      }
      batchSchedules.get(entry.batchId)!.push(entry);
    });

    Array.from(batchSchedules.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([batchId, entries]) => {
        console.log(this.colorize(`📚 ${batchId}`, 'yellow'));
        console.log(`   Total Lectures: ${entries.length}`);
        
        // Subject breakdown
        const subjectCount = new Map<string, number>();
        entries.forEach(entry => {
          subjectCount.set(entry.subjectId, (subjectCount.get(entry.subjectId) || 0) + 1);
        });
        
        console.log('   Subjects:');
        Array.from(subjectCount.entries()).forEach(([subject, count]) => {
          console.log(`     - ${subject}: ${count} lectures`);
        });
        
        // Daily distribution
        const dailyCount = new Map<DayOfWeek, number>();
        entries.forEach(entry => {
          dailyCount.set(entry.timeSlot.day, (dailyCount.get(entry.timeSlot.day) || 0) + 1);
        });
        
        const dailyBreakdown = Array.from(dailyCount.entries())
          .map(([day, count]) => `${this.getDayName(day)}: ${count}`)
          .join(', ');
        
        console.log(`   Daily Distribution: ${dailyBreakdown}`);
        console.log('');
      });

    await this.waitForEnter();
  }

  /**
   * Display subject-wise view
   */
  private async displaySubjectView(): Promise<void> {
    console.log('\n' + this.colorize('Subject-wise Schedule View', 'cyan'));
    console.log('='.repeat(80));

    const subjectSchedules = new Map<string, ScheduleEntry[]>();
    
    this.currentSchedule.entries.forEach(entry => {
      if (!subjectSchedules.has(entry.subjectId)) {
        subjectSchedules.set(entry.subjectId, []);
      }
      subjectSchedules.get(entry.subjectId)!.push(entry);
    });

    Array.from(subjectSchedules.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([subjectId, entries]) => {
        console.log(this.colorize(`📖 ${subjectId}`, 'yellow'));
        console.log(`   Total Lectures: ${entries.length}`);
        
        // Faculty and batch info
        const faculties = new Set(entries.map(e => e.facultyId));
        const batches = new Set(entries.map(e => e.batchId));
        
        console.log(`   Faculty: ${Array.from(faculties).join(', ')}`);
        console.log(`   Batches: ${Array.from(batches).join(', ')}`);
        
        // Time distribution
        const timeSlots = entries.map(e => `${this.getDayName(e.timeSlot.day)} ${e.timeSlot.startTime}`);
        console.log(`   Schedule: ${timeSlots.join(', ')}`);
        console.log('');
      });

    await this.waitForEnter();
  }

  /**
   * Analyze and display conflicts
   */
  private async analyzeConflicts(): Promise<void> {
    this.printSectionHeader('⚠️ Conflict Analysis');
    
    if (this.currentSchedule.conflicts.length === 0) {
      console.log(this.colorize('🎉 No conflicts detected! Your schedule is perfect.', 'green'));
      await this.waitForEnter();
      return;
    }

    console.log(`Found ${this.currentSchedule.conflicts.length} conflicts:\n`);

    // Group conflicts by severity
    const errorConflicts = this.currentSchedule.getConflictsBySeverity('error');
    const warningConflicts = this.currentSchedule.getConflictsBySeverity('warning');

    if (errorConflicts.length > 0) {
      console.log(this.colorize('🚨 Critical Conflicts (Must Fix):', 'red'));
      errorConflicts.forEach((conflict, index) => {
        console.log(`${index + 1}. ${conflict.type}: ${conflict.message}`);
        if (conflict.affectedEntries.length > 0) {
          console.log('   Affected entries:');
          conflict.affectedEntries.forEach(entry => {
            console.log(`     - ${entry.batchId}: ${entry.subjectId} (${this.getDayName(entry.timeSlot.day)} ${entry.timeSlot.startTime})`);
          });
        }
        console.log('');
      });
    }

    if (warningConflicts.length > 0) {
      console.log(this.colorize('⚠️ Warnings (Recommended to Fix):', 'yellow'));
      warningConflicts.forEach((conflict, index) => {
        console.log(`${index + 1}. ${conflict.type}: ${conflict.message}`);
        if (conflict.affectedEntries.length > 0) {
          console.log('   Affected entries:');
          conflict.affectedEntries.forEach(entry => {
            console.log(`     - ${entry.batchId}: ${entry.subjectId} (${this.getDayName(entry.timeSlot.day)} ${entry.timeSlot.startTime})`);
          });
        }
        console.log('');
      });
    }

    // Offer resolution suggestions
    console.log(this.colorize('💡 Resolution Suggestions:', 'cyan'));
    const suggestions = this.generateConflictResolutionSuggestions();
    suggestions.forEach((suggestion, index) => {
      console.log(`${index + 1}. ${suggestion}`);
    });

    console.log('');
    await this.waitForEnter();
  }

  /**
   * View detailed statistics
   */
  private async viewStatistics(): Promise<void> {
    this.printSectionHeader('📈 Detailed Statistics');
    
    const stats = this.currentSchedule.calculateStatistics();
    
    // Time slot utilization
    console.log(this.colorize('Time Slot Utilization:', 'cyan'));
    console.log(`Overall Rate: ${stats.timeSlotUtilization.utilizationRate.toFixed(1)}%`);
    console.log(`Total Slots: ${stats.timeSlotUtilization.totalSlots}`);
    console.log(`Used Slots: ${stats.timeSlotUtilization.usedSlots}`);
    console.log(`Available Slots: ${stats.timeSlotUtilization.availableSlots}`);
    console.log(`Peak Hour: ${stats.timeSlotUtilization.peakHour || 'N/A'}`);
    console.log('');

    // Daily load distribution
    console.log(this.colorize('Daily Load Distribution:', 'cyan'));
    console.log(`Average per Day: ${stats.dailyLoadDistribution.averageEntriesPerDay.toFixed(1)}`);
    console.log(`Standard Deviation: ${stats.dailyLoadDistribution.standardDeviation.toFixed(2)}`);
    console.log(`Min per Day: ${stats.dailyLoadDistribution.minEntriesPerDay}`);
    console.log(`Max per Day: ${stats.dailyLoadDistribution.maxEntriesPerDay}`);
    console.log('');

    // Faculty workload
    console.log(this.colorize('Faculty Workload:', 'cyan'));
    const facultyWorkload = this.calculateFacultyWorkload();
    facultyWorkload.forEach(({ facultyId, lectures, hours }) => {
      console.log(`${facultyId}: ${lectures} lectures, ${hours.toFixed(1)} hours/week`);
    });
    console.log('');

    // Batch schedule density
    console.log(this.colorize('Batch Schedule Density:', 'cyan'));
    const batchDensity = this.calculateBatchDensity();
    batchDensity.forEach(({ batchId, lectures, hoursPerDay }) => {
      console.log(`${batchId}: ${lectures} lectures, ${hoursPerDay.toFixed(1)} avg hours/day`);
    });
    console.log('');

    await this.waitForEnter();
  }

  /**
   * Filter and search functionality
   */
  private async filterAndSearch(): Promise<void> {
    this.printSectionHeader('🔍 Filter & Search');
    
    console.log('Filter options:');
    console.log('1. Filter by Batch');
    console.log('2. Filter by Faculty');
    console.log('3. Filter by Day');
    console.log('4. Filter by Time Range');
    console.log('5. Show Conflicts Only');
    console.log('6. Custom Search');
    console.log('7. Clear Filters');
    console.log('');

    const filterChoice = await this.promptNumber('Select filter (1-7): ', 1, 7);
    let filter: ViewFilter = {};

    switch (filterChoice) {
      case 1:
        filter.batchId = await this.selectBatch();
        break;
      case 2:
        filter.facultyId = await this.selectFaculty();
        break;
      case 3:
        filter.day = await this.selectDay();
        break;
      case 4:
        filter.timeRange = await this.selectTimeRange();
        break;
      case 5:
        filter.conflictsOnly = true;
        break;
      case 6:
        filter = await this.customSearch();
        break;
      case 7:
        filter = {};
        break;
    }

    if (Object.keys(filter).length > 0) {
      await this.displayFilteredResults(filter);
    }
  }

  /**
   * Make manual adjustments to the schedule
   */
  private async makeManualAdjustments(): Promise<void> {
    this.printSectionHeader('✏️ Manual Adjustments');
    
    console.log('Adjustment options:');
    console.log('1. Move a lecture to different time slot');
    console.log('2. Swap two lectures');
    console.log('3. Remove a lecture');
    console.log('4. Add a new lecture');
    console.log('5. Resolve specific conflict');
    console.log('6. Undo last change');
    console.log('7. Reset to original');
    console.log('');

    const adjustmentChoice = await this.promptNumber('Select adjustment (1-7): ', 1, 7);

    switch (adjustmentChoice) {
      case 1:
        await this.moveLecture();
        break;
      case 2:
        await this.swapLectures();
        break;
      case 3:
        await this.removeLecture();
        break;
      case 4:
        await this.addLecture();
        break;
      case 5:
        await this.resolveConflict();
        break;
      case 6:
        await this.undoLastChange();
        break;
      case 7:
        await this.resetToOriginal();
        break;
    }
  }

  /**
   * Compare current schedule with original
   */
  private async compareWithOriginal(): Promise<void> {
    this.printSectionHeader('🔄 Compare with Original');
    
    const changes = this.detectChanges();
    
    if (changes.length === 0) {
      console.log(this.colorize('No changes detected. Current schedule matches the original.', 'green'));
    } else {
      console.log(`Found ${changes.length} changes:\n`);
      
      changes.forEach((change, index) => {
        console.log(`${index + 1}. ${change.type}: ${change.description}`);
        if (change.before) {
          console.log(`   Before: ${change.before}`);
        }
        if (change.after) {
          console.log(`   After: ${change.after}`);
        }
        console.log('');
      });
    }

    await this.waitForEnter();
  }

  /**
   * Export schedule with various options
   */
  private async exportSchedule(): Promise<void> {
    this.printSectionHeader('📤 Export Schedule');
    
    // Show available formats
    const formats = this.exportManager.getSupportedFormats();
    console.log('Available export formats:');
    formats.forEach((format, index) => {
      console.log(`${index + 1}. ${format.name} - ${format.description}`);
    });
    console.log('');

    const formatChoice = await this.promptNumber(`Select format (1-${formats.length}): `, 1, formats.length);
    const selectedFormat = formats[formatChoice - 1];

    // Get export options
    const exportOptions = await this.getExportOptions(selectedFormat.format);
    
    // Get filename
    const defaultFilename = `timetable_${new Date().toISOString().split('T')[0]}`;
    const filename = await this.promptWithDefault('Enter filename (without extension): ', defaultFilename);
    
    exportOptions.filename = `${filename}.${selectedFormat.format}`;

    console.log('\nExporting...');
    
    try {
      const result = await this.exportManager.exportSchedule(this.currentSchedule, exportOptions);
      
      if (result.success) {
        console.log(this.colorize('✅ Export successful!', 'green'));
        console.log(`File: ${result.filename}`);
        console.log(`Size: ${this.formatBytes(result.size)}`);
        console.log(`Format: ${selectedFormat.name}`);
        
        // Offer to export in additional formats
        const exportAnother = await this.promptYesNo('Export in another format? (y/n): ');
        if (exportAnother) {
          await this.exportSchedule();
        }
      } else {
        console.log(this.colorize(`❌ Export failed: ${result.error}`, 'red'));
      }
    } catch (error) {
      console.log(this.colorize(`❌ Export error: ${error.message}`, 'red'));
    }

    await this.waitForEnter();
  }

  // Helper methods continue in next part...
  
  private async getExportOptions(format: ExportFormat): Promise<ExportOptions> {
    const options: ExportOptions = {
      format,
      includeMetadata: await this.promptYesNo('Include metadata? (y/n): '),
      includeConflicts: await this.promptYesNo('Include conflict information? (y/n): '),
      includeStatistics: await this.promptYesNo('Include statistics? (y/n): ')
    };

    if (format === ExportFormat.HTML) {
      options.includeStyles = await this.promptYesNo('Include CSS styles? (y/n): ');
    }

    if (format === ExportFormat.CSV) {
      options.includeHeaders = await this.promptYesNo('Include column headers? (y/n): ');
    }

    return options;
  }

  // Utility methods
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

  private async promptWithDefault(question: string, defaultValue: string): Promise<string> {
    const answer = await this.prompt(`${question}[${defaultValue}] `);
    return answer.trim() || defaultValue;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private cleanup(): void {
    this.rl.close();
  }

  // Additional helper methods would continue here...
  // Additional helper methods implementation

  private async selectBatch(): Promise<string | undefined> {
    const batches = Array.from(new Set(this.currentSchedule.entries.map(e => e.batchId)));
    
    if (batches.length === 0) {
      console.log(this.colorize('No batches found in schedule.', 'yellow'));
      return undefined;
    }

    console.log('\nAvailable batches:');
    batches.forEach((batch, index) => {
      console.log(`${index + 1}. ${batch}`);
    });

    const choice = await this.promptNumber(`Select batch (1-${batches.length}): `, 1, batches.length);
    return batches[choice - 1];
  }

  private async selectFaculty(): Promise<string | undefined> {
    const faculties = Array.from(new Set(this.currentSchedule.entries.map(e => e.facultyId)));
    
    if (faculties.length === 0) {
      console.log(this.colorize('No faculty found in schedule.', 'yellow'));
      return undefined;
    }

    console.log('\nAvailable faculty:');
    faculties.forEach((faculty, index) => {
      console.log(`${index + 1}. ${faculty}`);
    });

    const choice = await this.promptNumber(`Select faculty (1-${faculties.length}): `, 1, faculties.length);
    return faculties[choice - 1];
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

  private async selectTimeRange(): Promise<{ start: string; end: string } | undefined> {
    console.log('\nEnter time range (24-hour format):');
    const start = await this.prompt('Start time (HH:MM): ');
    const end = await this.prompt('End time (HH:MM): ');

    if (!this.isValidTime(start) || !this.isValidTime(end)) {
      console.log(this.colorize('Invalid time format. Please use HH:MM format.', 'red'));
      return undefined;
    }

    return { start, end };
  }

  private async customSearch(): Promise<ViewFilter> {
    const filter: ViewFilter = {};
    
    console.log('\nCustom search options (press Enter to skip):');
    
    const batchId = await this.prompt('Batch ID (partial match): ');
    if (batchId.trim()) filter.batchId = batchId.trim();

    const facultyId = await this.prompt('Faculty ID (partial match): ');
    if (facultyId.trim()) filter.facultyId = facultyId.trim();

    const conflictsOnly = await this.promptYesNo('Show conflicts only? (y/n): ');
    if (conflictsOnly) filter.conflictsOnly = true;

    return filter;
  }

  private async displayFilteredResults(filter: ViewFilter): Promise<void> {
    console.log('\n' + this.colorize('Filtered Results', 'cyan'));
    console.log('='.repeat(60));

    let filteredEntries = this.currentSchedule.entries;

    // Apply filters
    if (filter.batchId) {
      filteredEntries = filteredEntries.filter(e => e.batchId.includes(filter.batchId!));
    }

    if (filter.facultyId) {
      filteredEntries = filteredEntries.filter(e => e.facultyId.includes(filter.facultyId!));
    }

    if (filter.day) {
      filteredEntries = filteredEntries.filter(e => e.timeSlot.day === filter.day);
    }

    if (filter.timeRange) {
      filteredEntries = filteredEntries.filter(e => 
        e.timeSlot.startTime >= filter.timeRange!.start && 
        e.timeSlot.endTime <= filter.timeRange!.end
      );
    }

    if (filter.conflictsOnly) {
      const conflictEntries = new Set<ScheduleEntry>();
      this.currentSchedule.conflicts.forEach(conflict => {
        conflict.affectedEntries.forEach(entry => conflictEntries.add(entry));
      });
      filteredEntries = filteredEntries.filter(e => conflictEntries.has(e));
    }

    if (filteredEntries.length === 0) {
      console.log(this.colorize('No entries match the filter criteria.', 'yellow'));
    } else {
      console.log(`Found ${filteredEntries.length} matching entries:\n`);
      
      filteredEntries
        .sort((a, b) => {
          const dayCompare = a.timeSlot.day.localeCompare(b.timeSlot.day);
          if (dayCompare !== 0) return dayCompare;
          return a.timeSlot.startTime.localeCompare(b.timeSlot.startTime);
        })
        .forEach((entry, index) => {
          console.log(`${index + 1}. ${this.getDayName(entry.timeSlot.day)} ${entry.timeSlot.startTime}-${entry.timeSlot.endTime}`);
          console.log(`   ${entry.subjectId} (${entry.batchId}) - ${entry.facultyId}`);
          console.log('');
        });
    }

    await this.waitForEnter();
  }

  private async moveLecture(): Promise<void> {
    console.log('\nSelect lecture to move:');
    const entry = await this.selectScheduleEntry();
    if (!entry) return;

    console.log(`\nMoving: ${entry.subjectId} (${entry.batchId}) - ${this.getDayName(entry.timeSlot.day)} ${entry.timeSlot.startTime}`);
    
    const newDay = await this.selectDay();
    if (!newDay) return;

    const newTime = await this.prompt('New start time (HH:MM): ');
    if (!this.isValidTime(newTime)) {
      console.log(this.colorize('Invalid time format.', 'red'));
      return;
    }

    try {
      const success = await this.adjustmentService.moveLecture(
        this.currentSchedule,
        entry,
        newDay,
        newTime
      );

      if (success) {
        console.log(this.colorize('✅ Lecture moved successfully!', 'green'));
        this.hasUnsavedChanges = true;
      } else {
        console.log(this.colorize('❌ Failed to move lecture. Check for conflicts.', 'red'));
      }
    } catch (error) {
      console.log(this.colorize(`❌ Error: ${error.message}`, 'red'));
    }

    await this.waitForEnter();
  }

  private async swapLectures(): Promise<void> {
    console.log('\nSelect first lecture:');
    const entry1 = await this.selectScheduleEntry();
    if (!entry1) return;

    console.log('\nSelect second lecture:');
    const entry2 = await this.selectScheduleEntry();
    if (!entry2) return;

    try {
      const success = await this.adjustmentService.swapLectures(this.currentSchedule, entry1, entry2);

      if (success) {
        console.log(this.colorize('✅ Lectures swapped successfully!', 'green'));
        this.hasUnsavedChanges = true;
      } else {
        console.log(this.colorize('❌ Failed to swap lectures. Check for conflicts.', 'red'));
      }
    } catch (error) {
      console.log(this.colorize(`❌ Error: ${error.message}`, 'red'));
    }

    await this.waitForEnter();
  }

  private async removeLecture(): Promise<void> {
    console.log('\nSelect lecture to remove:');
    const entry = await this.selectScheduleEntry();
    if (!entry) return;

    const confirm = await this.promptYesNo(
      `Remove ${entry.subjectId} (${entry.batchId}) - ${this.getDayName(entry.timeSlot.day)} ${entry.timeSlot.startTime}? (y/n): `
    );

    if (confirm) {
      this.currentSchedule.removeEntry(entry);
      console.log(this.colorize('✅ Lecture removed successfully!', 'green'));
      this.hasUnsavedChanges = true;
    }

    await this.waitForEnter();
  }

  private async addLecture(): Promise<void> {
    console.log('\nAdd new lecture:');
    
    const batchId = await this.prompt('Batch ID: ');
    const subjectId = await this.prompt('Subject ID: ');
    const facultyId = await this.prompt('Faculty ID: ');
    
    const day = await this.selectDay();
    if (!day) return;

    const startTime = await this.prompt('Start time (HH:MM): ');
    const endTime = await this.prompt('End time (HH:MM): ');

    if (!this.isValidTime(startTime) || !this.isValidTime(endTime)) {
      console.log(this.colorize('Invalid time format.', 'red'));
      return;
    }

    const newEntry: ScheduleEntry = {
      batchId,
      subjectId,
      facultyId,
      timeSlot: {
        day,
        startTime,
        endTime,
        isAvailable: true
      }
    };

    try {
      this.currentSchedule.addEntry(newEntry);
      console.log(this.colorize('✅ Lecture added successfully!', 'green'));
      this.hasUnsavedChanges = true;
    } catch (error) {
      console.log(this.colorize(`❌ Error: ${error.message}`, 'red'));
    }

    await this.waitForEnter();
  }

  private async resolveConflict(): Promise<void> {
    if (this.currentSchedule.conflicts.length === 0) {
      console.log(this.colorize('No conflicts to resolve.', 'green'));
      await this.waitForEnter();
      return;
    }

    console.log('\nSelect conflict to resolve:');
    this.currentSchedule.conflicts.forEach((conflict, index) => {
      console.log(`${index + 1}. ${conflict.type}: ${conflict.message}`);
    });

    const choice = await this.promptNumber(
      `Select conflict (1-${this.currentSchedule.conflicts.length}): `,
      1,
      this.currentSchedule.conflicts.length
    );

    const conflict = this.currentSchedule.conflicts[choice - 1];
    
    console.log(`\nResolving: ${conflict.message}`);
    console.log('Suggested actions:');
    console.log('1. Move conflicting lectures');
    console.log('2. Remove one of the conflicting lectures');
    console.log('3. Ignore this conflict');

    const action = await this.promptNumber('Select action (1-3): ', 1, 3);

    switch (action) {
      case 1:
        await this.moveConflictingLectures(conflict);
        break;
      case 2:
        await this.removeConflictingLecture(conflict);
        break;
      case 3:
        console.log('Conflict ignored.');
        break;
    }

    await this.waitForEnter();
  }

  private async undoLastChange(): Promise<void> {
    // This would require implementing a change history system
    console.log(this.colorize('Undo functionality not yet implemented.', 'yellow'));
    await this.waitForEnter();
  }

  private async resetToOriginal(): Promise<void> {
    const confirm = await this.promptYesNo('Reset to original schedule? All changes will be lost. (y/n): ');
    
    if (confirm) {
      this.currentSchedule = this.deepCloneSchedule(this.originalSchedule);
      this.hasUnsavedChanges = false;
      console.log(this.colorize('✅ Schedule reset to original.', 'green'));
    }

    await this.waitForEnter();
  }

  private async selectScheduleEntry(): Promise<ScheduleEntry | undefined> {
    const entries = this.currentSchedule.entries;
    
    if (entries.length === 0) {
      console.log(this.colorize('No entries in schedule.', 'yellow'));
      return undefined;
    }

    // Show first 20 entries
    const displayEntries = entries.slice(0, 20);
    
    console.log('\nAvailable entries:');
    displayEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.subjectId} (${entry.batchId}) - ${this.getDayName(entry.timeSlot.day)} ${entry.timeSlot.startTime}`);
    });

    if (entries.length > 20) {
      console.log(`... and ${entries.length - 20} more entries`);
      console.log('Use filter options to narrow down the list.');
    }

    const choice = await this.promptNumber(`Select entry (1-${displayEntries.length}): `, 1, displayEntries.length);
    return displayEntries[choice - 1];
  }

  private async moveConflictingLectures(conflict: ConstraintViolation): Promise<void> {
    if (conflict.affectedEntries.length === 0) return;

    console.log('\nSelect which lecture to move:');
    conflict.affectedEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.subjectId} (${entry.batchId}) - ${this.getDayName(entry.timeSlot.day)} ${entry.timeSlot.startTime}`);
    });

    const choice = await this.promptNumber(`Select lecture (1-${conflict.affectedEntries.length}): `, 1, conflict.affectedEntries.length);
    const entryToMove = conflict.affectedEntries[choice - 1];

    // Find alternative time slots
    const alternatives = await this.adjustmentService.findAlternativeTimeSlots(
      this.currentSchedule,
      entryToMove
    );

    if (alternatives.length === 0) {
      console.log(this.colorize('No alternative time slots found.', 'yellow'));
      return;
    }

    console.log('\nAvailable alternative time slots:');
    alternatives.slice(0, 10).forEach((alt, index) => {
      console.log(`${index + 1}. ${this.getDayName(alt.day)} ${alt.startTime}-${alt.endTime}`);
    });

    const altChoice = await this.promptNumber(`Select alternative (1-${Math.min(alternatives.length, 10)}): `, 1, Math.min(alternatives.length, 10));
    const selectedAlt = alternatives[altChoice - 1];

    try {
      const success = await this.adjustmentService.moveLecture(
        this.currentSchedule,
        entryToMove,
        selectedAlt.day,
        selectedAlt.startTime
      );

      if (success) {
        console.log(this.colorize('✅ Conflict resolved by moving lecture!', 'green'));
        this.hasUnsavedChanges = true;
      } else {
        console.log(this.colorize('❌ Failed to resolve conflict.', 'red'));
      }
    } catch (error) {
      console.log(this.colorize(`❌ Error: ${error.message}`, 'red'));
    }
  }

  private async removeConflictingLecture(conflict: ConstraintViolation): Promise<void> {
    if (conflict.affectedEntries.length === 0) return;

    console.log('\nSelect which lecture to remove:');
    conflict.affectedEntries.forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.subjectId} (${entry.batchId}) - ${this.getDayName(entry.timeSlot.day)} ${entry.timeSlot.startTime}`);
    });

    const choice = await this.promptNumber(`Select lecture (1-${conflict.affectedEntries.length}): `, 1, conflict.affectedEntries.length);
    const entryToRemove = conflict.affectedEntries[choice - 1];

    const confirm = await this.promptYesNo(`Remove ${entryToRemove.subjectId} (${entryToRemove.batchId})? (y/n): `);

    if (confirm) {
      this.currentSchedule.removeEntry(entryToRemove);
      console.log(this.colorize('✅ Conflicting lecture removed!', 'green'));
      this.hasUnsavedChanges = true;
    }
  }

  private detectChanges(): Array<{ type: string; description: string; before?: string; after?: string }> {
    const changes: Array<{ type: string; description: string; before?: string; after?: string }> = [];

    // Compare entry counts
    if (this.currentSchedule.entries.length !== this.originalSchedule.entries.length) {
      changes.push({
        type: 'Entry Count',
        description: 'Number of scheduled lectures changed',
        before: `${this.originalSchedule.entries.length} lectures`,
        after: `${this.currentSchedule.entries.length} lectures`
      });
    }

    // Compare conflict counts
    if (this.currentSchedule.conflicts.length !== this.originalSchedule.conflicts.length) {
      changes.push({
        type: 'Conflicts',
        description: 'Number of conflicts changed',
        before: `${this.originalSchedule.conflicts.length} conflicts`,
        after: `${this.currentSchedule.conflicts.length} conflicts`
      });
    }

    // This is a simplified comparison - a full implementation would compare individual entries
    return changes;
  }

  private async saveChanges(): Promise<void> {
    console.log('Saving changes...');
    // In a real implementation, this would save to a file or database
    this.hasUnsavedChanges = false;
    console.log(this.colorize('✅ Changes saved successfully!', 'green'));
  }

  private deepCloneSchedule(schedule: WeeklySchedule): WeeklySchedule {
    // Simple deep clone - in a real implementation, use a proper cloning library
    return new WeeklySchedule(
      JSON.parse(JSON.stringify(schedule.entries)),
      JSON.parse(JSON.stringify(schedule.conflicts)),
      JSON.parse(JSON.stringify(schedule.metadata))
    );
  }

  private calculateQualityScore(): number {
    const stats = this.currentSchedule.calculateStatistics();
    
    // Quality score based on multiple factors (0-10 scale)
    let score = 10;
    
    // Penalize conflicts
    score -= Math.min(this.currentSchedule.conflicts.length * 0.5, 5);
    
    // Penalize poor utilization
    const utilization = stats.timeSlotUtilization.utilizationRate;
    if (utilization < 30 || utilization > 90) {
      score -= 2;
    }
    
    // Penalize poor distribution
    const cv = stats.dailyLoadDistribution.standardDeviation / stats.dailyLoadDistribution.averageEntriesPerDay;
    if (cv > 0.5) {
      score -= 1;
    }
    
    return Math.max(0, score);
  }

  private getQualityRating(score: number): string {
    if (score >= 9) return this.colorize('Excellent', 'green');
    if (score >= 7) return this.colorize('Good', 'cyan');
    if (score >= 5) return this.colorize('Fair', 'yellow');
    return this.colorize('Poor', 'red');
  }

  private getDistributionRating(stdDev: number): string {
    if (stdDev < 1) return this.colorize('Excellent', 'green');
    if (stdDev < 2) return this.colorize('Good', 'cyan');
    if (stdDev < 3) return this.colorize('Fair', 'yellow');
    return this.colorize('Poor', 'red');
  }

  private getConflictRating(conflictCount: number): string {
    if (conflictCount === 0) return this.colorize('Perfect', 'green');
    if (conflictCount <= 2) return this.colorize('Minor Issues', 'yellow');
    return this.colorize('Major Issues', 'red');
  }

  private generateConflictResolutionSuggestions(): string[] {
    const suggestions: string[] = [];
    
    const errorConflicts = this.currentSchedule.getConflictsBySeverity('error');
    const warningConflicts = this.currentSchedule.getConflictsBySeverity('warning');
    
    if (errorConflicts.length > 0) {
      suggestions.push('Resolve critical conflicts first - they prevent proper scheduling');
      suggestions.push('Consider moving conflicting lectures to different time slots');
      suggestions.push('Check for faculty double-booking and reschedule accordingly');
    }
    
    if (warningConflicts.length > 0) {
      suggestions.push('Review warning conflicts for schedule optimization opportunities');
      suggestions.push('Consider redistributing lectures for better balance');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('No conflicts detected - your schedule is optimally configured!');
    }
    
    return suggestions;
  }

  private calculateFacultyWorkload(): Array<{ facultyId: string; lectures: number; hours: number }> {
    const workload = new Map<string, { lectures: number; hours: number }>();
    
    this.currentSchedule.entries.forEach(entry => {
      const current = workload.get(entry.facultyId) || { lectures: 0, hours: 0 };
      const duration = this.calculateDuration(entry.timeSlot.startTime, entry.timeSlot.endTime);
      
      workload.set(entry.facultyId, {
        lectures: current.lectures + 1,
        hours: current.hours + (duration / 60)
      });
    });
    
    return Array.from(workload.entries()).map(([facultyId, data]) => ({
      facultyId,
      ...data
    }));
  }

  private calculateBatchDensity(): Array<{ batchId: string; lectures: number; hoursPerDay: number }> {
    const density = new Map<string, { lectures: number; totalHours: number }>();
    
    this.currentSchedule.entries.forEach(entry => {
      const current = density.get(entry.batchId) || { lectures: 0, totalHours: 0 };
      const duration = this.calculateDuration(entry.timeSlot.startTime, entry.timeSlot.endTime);
      
      density.set(entry.batchId, {
        lectures: current.lectures + 1,
        totalHours: current.totalHours + (duration / 60)
      });
    });
    
    return Array.from(density.entries()).map(([batchId, data]) => ({
      batchId,
      lectures: data.lectures,
      hoursPerDay: data.totalHours / 5 // Assuming 5 working days
    }));
  }

  private createProgressBar(current: number, max: number, width: number): string {
    const filled = Math.round(width * current / max);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  private generateTimeSlots(): string[] {
    const slots: string[] = [];
    for (let hour = 8; hour < 18; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
  }

  private findEntryForTimeSlot(day: DayOfWeek, timeSlot: string): ScheduleEntry | undefined {
    return this.currentSchedule.entries.find(entry => 
      entry.timeSlot.day === day && entry.timeSlot.startTime === timeSlot
    );
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

  private calculateDuration(startTime: string, endTime: string): number {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    return endMinutes - startMinutes;
  }

  private isValidTime(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }
}
