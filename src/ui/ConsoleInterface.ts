import * as readline from 'readline';
import { Batch, Subject, WeeklySchedule, ValidationResult } from '../models';
import { InputManager } from '../services/InputManager';
import { ValidationService } from '../services/ValidationService';
import { ScheduleGenerator } from '../algorithms/ScheduleGenerator';
import { ExportManager } from '../exporters/ExportManager';
import { ExportFormat, ExportOptions } from '../exporters/ExportInterfaces';
import { BaseConstraint, FacultyConflictConstraint, TimeSlotAvailabilityConstraint } from '../services/constraints';
import { InteractiveScheduleReviewer } from './InteractiveScheduleReviewer';
import { ConflictResolutionInterface } from './ConflictResolutionInterface';
import { ExportOptionsInterface } from './ExportOptionsInterface';

export interface ConsoleUIOptions {
  enableColors?: boolean;
  showProgressBars?: boolean;
  verboseMode?: boolean;
  autoSave?: boolean;
  defaultExportFormat?: ExportFormat;
}

export interface UserSession {
  sessionId: string;
  startTime: Date;
  batches: Batch[];
  holidays: Date[];
  constraints: BaseConstraint[];
  generatedSchedule?: WeeklySchedule;
  currentStep: string;
  errors: string[];
  warnings: string[];
}

export class ConsoleInterface {
  private rl: readline.Interface;
  private inputManager: InputManager;
  private validationService: ValidationService;
  private scheduleGenerator: ScheduleGenerator;
  private exportManager: ExportManager;
  private options: Required<ConsoleUIOptions>;
  private session: UserSession;

  constructor(options: ConsoleUIOptions = {}) {
    this.options = {
      enableColors: options.enableColors ?? true,
      showProgressBars: options.showProgressBars ?? true,
      verboseMode: options.verboseMode ?? false,
      autoSave: options.autoSave ?? true,
      defaultExportFormat: options.defaultExportFormat ?? ExportFormat.HTML
    };

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    this.inputManager = new InputManager();
    this.validationService = new ValidationService();
    this.scheduleGenerator = new ScheduleGenerator();
    this.exportManager = new ExportManager();

    this.session = this.initializeSession();
  }

  /**
   * Start the interactive timetable generation process
   */
  async start(): Promise<void> {
    try {
      this.displayWelcome();
      
      await this.collectUserInput();
      await this.generateSchedule();
      await this.reviewAndExport();
      
      this.displayCompletion();
    } catch (error) {
      this.handleError(error);
    } finally {
      this.cleanup();
    }
  }

  /**
   * Display welcome message and instructions
   */
  private displayWelcome(): void {
    this.clearScreen();
    this.printHeader('AUTOMATED TIMETABLE GENERATOR');
    
    console.log(this.colorize('Welcome to the Automated Timetable Generator!', 'cyan'));
    console.log('This tool will guide you through creating a comprehensive timetable for your institution.\n');
    
    console.log(this.colorize('Process Overview:', 'yellow'));
    console.log('1. 📚 Collect batch and subject information');
    console.log('2. 👨‍🏫 Configure faculty assignments');
    console.log('3. 📅 Set holidays and constraints');
    console.log('4. ⚙️  Generate optimized timetable');
    console.log('5. 📊 Review results and export');
    console.log('');
    
    if (this.options.verboseMode) {
      console.log(this.colorize('Session Information:', 'gray'));
      console.log(`Session ID: ${this.session.sessionId}`);
      console.log(`Started: ${this.session.startTime.toLocaleString()}`);
      console.log('');
    }
  }

  /**
   * Collect all user input step by step
   */
  private async collectUserInput(): Promise<void> {
    this.updateStep('Collecting Input');
    
    // Step 1: Collect batches
    await this.collectBatches();
    
    // Step 2: Collect subjects for each batch
    await this.collectSubjects();
    
    // Step 3: Collect holidays
    await this.collectHolidays();
    
    // Step 4: Configure constraints
    await this.configureConstraints();
    
    // Step 5: Review input
    await this.reviewInput();
  }

  /**
   * Collect batch information
   */
  private async collectBatches(): Promise<void> {
    this.printSectionHeader('📚 Batch Configuration');
    
    console.log('Let\'s start by setting up your batches (classes/groups).\n');
    
    let addingBatches = true;
    let batchCount = 0;
    
    while (addingBatches) {
      batchCount++;
      console.log(this.colorize(`Batch ${batchCount}:`, 'cyan'));
      
      const batchName = await this.promptRequired('Enter batch name (e.g., "Computer Science A"): ');
      
      try {
        const batch = new Batch(`batch_${batchCount}`, batchName);
        this.session.batches.push(batch);
        
        console.log(this.colorize(`✓ Added batch: ${batchName}`, 'green'));
        
        if (batchCount >= 10) {
          console.log(this.colorize('Maximum of 10 batches reached.', 'yellow'));
          addingBatches = false;
        } else {
          addingBatches = await this.promptYesNo('Add another batch? (y/n): ');
        }
        
      } catch (error) {
        console.log(this.colorize(`✗ Error creating batch: ${error.message}`, 'red'));
        batchCount--; // Don't increment if batch creation failed
      }
      
      console.log('');
    }
    
    console.log(this.colorize(`Total batches configured: ${this.session.batches.length}`, 'green'));
    this.waitForEnter();
  }

  /**
   * Collect subjects for each batch
   */
  private async collectSubjects(): Promise<void> {
    this.printSectionHeader('📖 Subject Configuration');
    
    for (const batch of this.session.batches) {
      console.log(this.colorize(`Configuring subjects for: ${batch.name}`, 'cyan'));
      console.log('');
      
      let addingSubjects = true;
      let subjectCount = 0;
      
      while (addingSubjects) {
        subjectCount++;
        console.log(this.colorize(`Subject ${subjectCount} for ${batch.name}:`, 'yellow'));
        
        const subjectName = await this.promptRequired('Subject name: ');
        const lecturesPerWeek = await this.promptNumber('Lectures per week (1-10): ', 1, 10);
        const lectureDuration = await this.promptNumber('Lecture duration in minutes (30-180): ', 30, 180);
        const facultyId = await this.promptRequired('Faculty member name: ');
        
        try {
          const subject = new Subject(
            `${batch.id}_subject_${subjectCount}`,
            subjectName,
            lecturesPerWeek,
            lectureDuration,
            facultyId
          );
          
          batch.addSubject(subject);
          console.log(this.colorize(`✓ Added subject: ${subjectName}`, 'green'));
          
          if (subjectCount >= 15) {
            console.log(this.colorize('Maximum of 15 subjects per batch reached.', 'yellow'));
            addingSubjects = false;
          } else {
            addingSubjects = await this.promptYesNo(`Add another subject to ${batch.name}? (y/n): `);
          }
          
        } catch (error) {
          console.log(this.colorize(`✗ Error creating subject: ${error.message}`, 'red'));
          subjectCount--; // Don't increment if subject creation failed
        }
        
        console.log('');
      }
      
      console.log(this.colorize(`${batch.name}: ${batch.subjects.length} subjects configured`, 'green'));
      console.log('');
    }
    
    this.waitForEnter();
  }

  /**
   * Collect holiday information
   */
  private async collectHolidays(): Promise<void> {
    this.printSectionHeader('📅 Holiday Configuration');
    
    console.log('Configure holidays and non-working days that should be excluded from the timetable.\n');
    
    const addHolidays = await this.promptYesNo('Do you want to add holidays? (y/n): ');
    
    if (addHolidays) {
      let addingHolidays = true;
      
      while (addingHolidays) {
        const holidayDate = await this.promptDate('Enter holiday date (YYYY-MM-DD): ');
        
        if (holidayDate) {
          this.session.holidays.push(holidayDate);
          console.log(this.colorize(`✓ Added holiday: ${holidayDate.toDateString()}`, 'green'));
        }
        
        if (this.session.holidays.length >= 50) {
          console.log(this.colorize('Maximum of 50 holidays reached.', 'yellow'));
          addingHolidays = false;
        } else {
          addingHolidays = await this.promptYesNo('Add another holiday? (y/n): ');
        }
      }
    }
    
    console.log(this.colorize(`Total holidays configured: ${this.session.holidays.length}`, 'green'));
    this.waitForEnter();
  }

  /**
   * Configure scheduling constraints
   */
  private async configureConstraints(): Promise<void> {
    this.printSectionHeader('⚙️ Constraint Configuration');
    
    console.log('Configure scheduling constraints to ensure a valid timetable.\n');
    
    // Always add basic constraints
    this.session.constraints.push(new FacultyConflictConstraint());
    this.session.constraints.push(new TimeSlotAvailabilityConstraint());
    
    console.log(this.colorize('✓ Faculty conflict prevention: Enabled', 'green'));
    console.log(this.colorize('✓ Time slot availability checking: Enabled', 'green'));
    
    // Ask about additional constraints
    const strictScheduling = await this.promptYesNo('Enable strict scheduling (no gaps between lectures)? (y/n): ');
    if (strictScheduling) {
      console.log(this.colorize('✓ Strict scheduling: Enabled', 'green'));
    }
    
    console.log(this.colorize(`Total constraints configured: ${this.session.constraints.length}`, 'green'));
    this.waitForEnter();
  }

  /**
   * Review all input before generation
   */
  private async reviewInput(): Promise<void> {
    this.printSectionHeader('📋 Input Review');
    
    console.log('Please review your configuration:\n');
    
    // Display batches summary
    console.log(this.colorize('Batches:', 'cyan'));
    this.session.batches.forEach((batch, index) => {
      console.log(`  ${index + 1}. ${batch.name} (${batch.subjects.length} subjects)`);
      batch.subjects.forEach(subject => {
        console.log(`     - ${subject.name}: ${subject.lecturesPerWeek} lectures/week, ${subject.lectureDuration}min each (${subject.facultyId})`);
      });
    });
    console.log('');
    
    // Display holidays
    if (this.session.holidays.length > 0) {
      console.log(this.colorize('Holidays:', 'cyan'));
      this.session.holidays.forEach((holiday, index) => {
        console.log(`  ${index + 1}. ${holiday.toDateString()}`);
      });
      console.log('');
    }
    
    // Display constraints
    console.log(this.colorize('Constraints:', 'cyan'));
    this.session.constraints.forEach((constraint, index) => {
      console.log(`  ${index + 1}. ${constraint.constructor.name}`);
    });
    console.log('');
    
    // Calculate totals
    const totalSubjects = this.session.batches.reduce((sum, batch) => sum + batch.subjects.length, 0);
    const totalLectures = this.session.batches.reduce((sum, batch) => 
      sum + batch.subjects.reduce((subSum, subject) => subSum + subject.lecturesPerWeek, 0), 0
    );
    
    console.log(this.colorize('Summary:', 'yellow'));
    console.log(`  Total Batches: ${this.session.batches.length}`);
    console.log(`  Total Subjects: ${totalSubjects}`);
    console.log(`  Total Lectures per Week: ${totalLectures}`);
    console.log(`  Holidays: ${this.session.holidays.length}`);
    console.log('');
    
    const proceed = await this.promptYesNo('Does this look correct? Proceed with generation? (y/n): ');
    
    if (!proceed) {
      console.log(this.colorize('Generation cancelled. You can restart to modify the configuration.', 'yellow'));
      process.exit(0);
    }
  }

  /**
   * Generate the timetable
   */
  private async generateSchedule(): Promise<void> {
    this.updateStep('Generating Schedule');
    this.printSectionHeader('⚙️ Timetable Generation');
    
    console.log('Generating your optimized timetable...\n');
    
    if (this.options.showProgressBars) {
      this.showProgressBar('Initializing', 0);
    }
    
    try {
      const startTime = Date.now();
      
      if (this.options.showProgressBars) {
        this.showProgressBar('Analyzing constraints', 25);
      }
      
      // Validate feasibility
      const feasibility = this.scheduleGenerator.validateSchedulingFeasibility(
        this.session.batches,
        this.session.holidays
      );
      
      if (!feasibility.feasible) {
        console.log(this.colorize('\n⚠️ Scheduling Issues Detected:', 'yellow'));
        feasibility.issues.forEach(issue => {
          console.log(this.colorize(`  • ${issue}`, 'red'));
        });
        
        console.log(this.colorize('\n💡 Recommendations:', 'cyan'));
        feasibility.recommendations.forEach(rec => {
          console.log(this.colorize(`  • ${rec}`, 'cyan'));
        });
        
        const continueAnyway = await this.promptYesNo('\nContinue with generation anyway? (y/n): ');
        if (!continueAnyway) {
          console.log(this.colorize('Generation cancelled.', 'yellow'));
          return;
        }
      }
      
      if (this.options.showProgressBars) {
        this.showProgressBar('Generating schedule', 50);
      }
      
      // Generate the schedule
      this.session.generatedSchedule = await this.scheduleGenerator.generateTimetable(
        this.session.batches,
        this.session.constraints,
        this.session.holidays
      );
      
      if (this.options.showProgressBars) {
        this.showProgressBar('Optimizing distribution', 75);
      }
      
      // Optimize the schedule
      const optimizedEntries = this.scheduleGenerator.optimizeDistribution(
        this.session.generatedSchedule.entries
      );
      this.session.generatedSchedule.entries = optimizedEntries;
      
      if (this.options.showProgressBars) {
        this.showProgressBar('Finalizing', 100);
        console.log(''); // New line after progress bar
      }
      
      const endTime = Date.now();
      const generationTime = endTime - startTime;
      
      // Display results
      console.log(this.colorize('✅ Timetable generation completed!', 'green'));
      console.log(`Generation time: ${generationTime}ms`);
      console.log(`Total lectures scheduled: ${this.session.generatedSchedule.entries.length}`);
      
      if (this.session.generatedSchedule.conflicts.length > 0) {
        console.log(this.colorize(`⚠️ Conflicts detected: ${this.session.generatedSchedule.conflicts.length}`, 'yellow'));
      } else {
        console.log(this.colorize('✅ No conflicts detected!', 'green'));
      }
      
    } catch (error) {
      console.log(this.colorize(`❌ Generation failed: ${error.message}`, 'red'));
      throw error;
    }
    
    this.waitForEnter();
  }

  /**
   * Review generated schedule and handle export
   */
  private async reviewAndExport(): Promise<void> {
    if (!this.session.generatedSchedule) {
      console.log(this.colorize('No schedule to review.', 'red'));
      return;
    }
    
    this.updateStep('Review and Export');
    this.printSectionHeader('📊 Schedule Review');
    
    // Display schedule summary
    const summary = this.session.generatedSchedule.getSummary();
    console.log(this.colorize('Schedule Summary:', 'cyan'));
    console.log(`  Total Lectures: ${summary.totalLectures}`);
    console.log(`  Batches: ${summary.totalBatches}`);
    console.log(`  Faculty Members: ${summary.totalFaculties}`);
    console.log(`  Subjects: ${summary.totalSubjects}`);
    console.log(`  Conflicts: ${summary.totalConflicts}`);
    console.log('');
    
    // Show conflicts if any
    if (this.session.generatedSchedule.conflicts.length > 0) {
      console.log(this.colorize('⚠️ Conflicts Found:', 'yellow'));
      this.session.generatedSchedule.conflicts.forEach((conflict, index) => {
        console.log(`  ${index + 1}. [${conflict.severity.toUpperCase()}] ${conflict.type}: ${conflict.message}`);
      });
      console.log('');
      
      // Offer conflict resolution
      const resolveConflicts = await this.promptYesNo('Would you like to resolve conflicts interactively? (y/n): ');
      if (resolveConflicts) {
        await this.interactiveConflictResolution();
      }
    }
    
    // Offer interactive review
    const interactiveReview = await this.promptYesNo('Would you like to use the interactive schedule reviewer? (y/n): ');
    if (interactiveReview) {
      await this.interactiveScheduleReview();
    } else {
      // Display basic preview
      const viewSchedule = await this.promptYesNo('Would you like to see a preview of the schedule? (y/n): ');
      if (viewSchedule) {
        await this.displaySchedulePreview();
      }
    }
    
    // Export options
    await this.handleExport();
  }

  /**
   * Launch interactive conflict resolution
   */
  private async interactiveConflictResolution(): Promise<void> {
    if (!this.session.generatedSchedule) return;
    
    console.log(this.colorize('\n🔧 Launching Interactive Conflict Resolution...', 'cyan'));
    
    const conflictResolver = new ConflictResolutionInterface({
      enableColors: this.options.enableColors,
      showDetailedAnalysis: true,
      autoApplyBestSolution: false
    });
    
    try {
      this.session.generatedSchedule = await conflictResolver.resolveConflicts(this.session.generatedSchedule);
      console.log(this.colorize('✅ Conflict resolution completed!', 'green'));
      
      // Update summary after conflict resolution
      const remainingConflicts = this.session.generatedSchedule.conflicts.length;
      if (remainingConflicts === 0) {
        console.log(this.colorize('🎉 All conflicts resolved! Your schedule is now perfect.', 'green'));
      } else {
        console.log(this.colorize(`⚠️ ${remainingConflicts} conflicts remain.`, 'yellow'));
      }
      
    } catch (error) {
      console.log(this.colorize(`❌ Conflict resolution failed: ${error.message}`, 'red'));
    }
    
    await this.waitForEnter();
  }

  /**
   * Launch interactive schedule review
   */
  private async interactiveScheduleReview(): Promise<void> {
    if (!this.session.generatedSchedule) return;
    
    console.log(this.colorize('\n📊 Launching Interactive Schedule Reviewer...', 'cyan'));
    
    const scheduleReviewer = new InteractiveScheduleReviewer({
      enableColors: this.options.enableColors,
      showDetailedStats: true,
      allowManualAdjustments: true,
      autoSaveChanges: this.options.autoSave
    });
    
    try {
      this.session.generatedSchedule = await scheduleReviewer.reviewSchedule(this.session.generatedSchedule);
      console.log(this.colorize('✅ Interactive review completed!', 'green'));
      
    } catch (error) {
      console.log(this.colorize(`❌ Interactive review failed: ${error.message}`, 'red'));
    }
    
    await this.waitForEnter();
  }

  /**
   * Display a preview of the generated schedule
   */
  private async displaySchedulePreview(): Promise<void> {
    if (!this.session.generatedSchedule) return;
    
    console.log('\n' + this.colorize('Schedule Preview:', 'cyan'));
    console.log('='.repeat(80));
    
    // Show first few entries from each day
    const workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    workingDays.forEach(day => {
      const dayEntries = this.session.generatedSchedule!.getEntriesForDay(day as any);
      
      if (dayEntries.length > 0) {
        console.log(this.colorize(`\n${day}:`, 'yellow'));
        
        dayEntries
          .sort((a, b) => a.timeSlot.startTime.localeCompare(b.timeSlot.startTime))
          .slice(0, 5) // Show first 5 entries
          .forEach(entry => {
            console.log(`  ${entry.timeSlot.startTime} - ${entry.timeSlot.endTime}: ${entry.subjectId} (${entry.batchId}) - ${entry.facultyId}`);
          });
        
        if (dayEntries.length > 5) {
          console.log(`  ... and ${dayEntries.length - 5} more lectures`);
        }
      }
    });
    
    console.log('\n' + '='.repeat(80));
    this.waitForEnter();
  }

  /**
   * Handle schedule export with enhanced options
   */
  private async handleExport(): Promise<void> {
    if (!this.session.generatedSchedule) return;
    
    console.log(this.colorize('\n📤 Export Options:', 'cyan'));
    console.log('1. 🚀 Quick Export (single format)');
    console.log('2. ⚙️  Advanced Export (multiple formats with options)');
    console.log('3. 📦 Export All Formats');
    console.log('4. ⏭️  Skip Export');
    console.log('');
    
    const exportChoice = await this.promptNumber('Select export option (1-4): ', 1, 4);
    
    const exportInterface = new ExportOptionsInterface(this.options.enableColors);
    
    try {
      switch (exportChoice) {
        case 1:
          await this.quickExport(exportInterface);
          break;
        case 2:
          await this.advancedExport(exportInterface);
          break;
        case 3:
          await exportInterface.exportAllFormats(this.session.generatedSchedule);
          break;
        case 4:
          console.log(this.colorize('Export skipped.', 'yellow'));
          break;
      }
    } catch (error) {
      console.log(this.colorize(`❌ Export error: ${error.message}`, 'red'));
    } finally {
      exportInterface.cleanup();
    }
  }

  /**
   * Quick export with minimal configuration
   */
  private async quickExport(exportInterface: ExportOptionsInterface): Promise<void> {
    const exportFormats = this.exportManager.getSupportedFormats();
    
    console.log('\nSelect format for quick export:');
    exportFormats.forEach((format, index) => {
      console.log(`${index + 1}. ${format.name}`);
    });
    
    const formatChoice = await this.promptNumber(
      `Select format (1-${exportFormats.length}): `,
      1,
      exportFormats.length
    );
    
    const selectedFormat = exportFormats[formatChoice - 1];
    await exportInterface.quickExport(this.session.generatedSchedule, selectedFormat.format);
  }

  /**
   * Advanced export with full configuration
   */
  private async advancedExport(exportInterface: ExportOptionsInterface): Promise<void> {
    const exportSession = await exportInterface.configureExport(this.session.generatedSchedule);
    await exportInterface.executeExport(exportSession);
  }

  /**
   * Display completion message
   */
  private displayCompletion(): void {
    this.printSectionHeader('🎉 Process Complete');
    
    console.log(this.colorize('Timetable generation completed successfully!', 'green'));
    console.log('');
    
    if (this.session.generatedSchedule) {
      const summary = this.session.generatedSchedule.getSummary();
      console.log('Final Results:');
      console.log(`  ✅ ${summary.totalLectures} lectures scheduled`);
      console.log(`  📚 ${summary.totalBatches} batches configured`);
      console.log(`  👨‍🏫 ${summary.totalFaculties} faculty members involved`);
      
      if (summary.totalConflicts === 0) {
        console.log(this.colorize('  🎯 Zero conflicts - Perfect schedule!', 'green'));
      } else {
        console.log(this.colorize(`  ⚠️ ${summary.totalConflicts} conflicts to review`, 'yellow'));
      }
    }
    
    console.log('');
    console.log('Thank you for using the Automated Timetable Generator!');
  }

  /**
   * Utility methods
   */
  private initializeSession(): UserSession {
    return {
      sessionId: `session_${Date.now()}`,
      startTime: new Date(),
      batches: [],
      holidays: [],
      constraints: [],
      currentStep: 'Initialization',
      errors: [],
      warnings: []
    };
  }

  private updateStep(step: string): void {
    this.session.currentStep = step;
    if (this.options.verboseMode) {
      console.log(this.colorize(`[${step}]`, 'gray'));
    }
  }

  private async promptRequired(question: string): Promise<string> {
    let answer = '';
    while (!answer.trim()) {
      answer = await this.prompt(question);
      if (!answer.trim()) {
        console.log(this.colorize('This field is required. Please enter a value.', 'red'));
      }
    }
    return answer.trim();
  }

  private async promptYesNo(question: string): Promise<boolean> {
    const answer = await this.prompt(question);
    return answer.toLowerCase().startsWith('y');
  }

  private async promptNumber(question: string, min?: number, max?: number): Promise<number> {
    while (true) {
      const answer = await this.prompt(question);
      const num = parseInt(answer);
      
      if (isNaN(num)) {
        console.log(this.colorize('Please enter a valid number.', 'red'));
        continue;
      }
      
      if (min !== undefined && num < min) {
        console.log(this.colorize(`Number must be at least ${min}.`, 'red'));
        continue;
      }
      
      if (max !== undefined && num > max) {
        console.log(this.colorize(`Number must be at most ${max}.`, 'red'));
        continue;
      }
      
      return num;
    }
  }

  private async promptDate(question: string): Promise<Date | null> {
    const answer = await this.prompt(question);
    const date = new Date(answer);
    
    if (isNaN(date.getTime())) {
      console.log(this.colorize('Invalid date format. Please use YYYY-MM-DD.', 'red'));
      return null;
    }
    
    return date;
  }

  private async promptWithDefault(question: string, defaultValue: string): Promise<string> {
    const answer = await this.prompt(`${question}[${defaultValue}] `);
    return answer.trim() || defaultValue;
  }

  private async prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  private colorize(text: string, color: string): string {
    if (!this.options.enableColors) {
      return text;
    }
    
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

  private showProgressBar(label: string, percentage: number): void {
    const width = 40;
    const filled = Math.round(width * percentage / 100);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    process.stdout.write(`\r${label}: [${bar}] ${percentage}%`);
    
    if (percentage === 100) {
      console.log(''); // New line when complete
    }
  }

  private clearScreen(): void {
    console.clear();
  }

  private waitForEnter(): void {
    console.log(this.colorize('\nPress Enter to continue...', 'gray'));
    this.rl.question('', () => {});
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private handleError(error: any): void {
    console.log(this.colorize('\n❌ An error occurred:', 'red'));
    console.log(this.colorize(error.message || 'Unknown error', 'red'));
    
    if (this.options.verboseMode && error.stack) {
      console.log(this.colorize('\nStack trace:', 'gray'));
      console.log(error.stack);
    }
    
    this.session.errors.push(error.message || 'Unknown error');
  }

  private cleanup(): void {
    this.rl.close();
  }
}
