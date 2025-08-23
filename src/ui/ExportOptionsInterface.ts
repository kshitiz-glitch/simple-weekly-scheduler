import * as readline from 'readline';
import { WeeklySchedule } from '../models/WeeklySchedule';
import { ExportManager } from '../exporters/ExportManager';
import { ExportFormat, ExportOptions } from '../exporters/ExportInterfaces';

export interface ExportSession {
  schedule: WeeklySchedule;
  selectedFormats: ExportFormat[];
  customOptions: Map<ExportFormat, ExportOptions>;
  outputDirectory: string;
  batchExport: boolean;
}

export class ExportOptionsInterface {
  private rl: readline.Interface;
  private exportManager: ExportManager;
  private enableColors: boolean;

  constructor(enableColors: boolean = true) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.exportManager = new ExportManager();
    this.enableColors = enableColors;
  }

  /**
   * Start interactive export configuration
   */
  async configureExport(schedule: WeeklySchedule): Promise<ExportSession> {
    const session: ExportSession = {
      schedule,
      selectedFormats: [],
      customOptions: new Map(),
      outputDirectory: './exports',
      batchExport: false
    };

    try {
      await this.displayExportWelcome(schedule);
      await this.selectExportFormats(session);
      await this.configureFormatOptions(session);
      await this.configureOutputOptions(session);
      await this.confirmExportSettings(session);
      
      return session;
    } finally {
      // Don't close readline here as it might be used by parent interface
    }
  }

  /**
   * Execute the configured export
   */
  async executeExport(session: ExportSession): Promise<void> {
    console.log(this.colorize('\n📤 Starting Export Process...', 'cyan'));
    console.log('='.repeat(50));

    const results: Array<{ format: ExportFormat; success: boolean; filename?: string; error?: string }> = [];

    for (const format of session.selectedFormats) {
      console.log(`\nExporting to ${format.toUpperCase()}...`);
      
      const options = session.customOptions.get(format) || { format };
      
      try {
        const result = await this.exportManager.exportSchedule(session.schedule, options);
        
        if (result.success) {
          console.log(this.colorize(`✅ ${format.toUpperCase()} export successful`, 'green'));
          console.log(`   File: ${result.filename}`);
          console.log(`   Size: ${this.formatBytes(result.size)}`);
          
          results.push({ format, success: true, filename: result.filename });
        } else {
          console.log(this.colorize(`❌ ${format.toUpperCase()} export failed: ${result.error}`, 'red'));
          results.push({ format, success: false, error: result.error });
        }
      } catch (error) {
        console.log(this.colorize(`❌ ${format.toUpperCase()} export error: ${error.message}`, 'red'));
        results.push({ format, success: false, error: error.message });
      }
    }

    await this.displayExportSummary(results);
  }

  /**
   * Display export welcome and overview
   */
  private async displayExportWelcome(schedule: WeeklySchedule): Promise<void> {
    this.clearScreen();
    this.printHeader('EXPORT CONFIGURATION');
    
    console.log(this.colorize('Configure export settings for your timetable.', 'cyan'));
    console.log('');

    // Schedule overview
    const stats = schedule.calculateStatistics();
    console.log(this.colorize('Schedule Overview:', 'yellow'));
    console.log(`📚 Total Lectures: ${stats.totalEntries}`);
    console.log(`🏫 Batches: ${stats.entriesPerBatch.size}`);
    console.log(`👨‍🏫 Faculty: ${stats.entriesPerFaculty.size}`);
    console.log(`⚠️  Conflicts: ${schedule.conflicts.length}`);
    console.log('');

    // Available formats
    const formats = this.exportManager.getSupportedFormats();
    console.log(this.colorize('Available Export Formats:', 'yellow'));
    formats.forEach(format => {
      console.log(`📄 ${format.name}: ${format.description}`);
    });
    console.log('');

    await this.waitForEnter();
  }

  /**
   * Select export formats
   */
  private async selectExportFormats(session: ExportSession): Promise<void> {
    console.log(this.colorize('📋 Format Selection', 'cyan'));
    console.log('-'.repeat(30));

    const formats = this.exportManager.getSupportedFormats();
    const selectedIndices: number[] = [];

    while (true) {
      console.log('\nAvailable formats:');
      formats.forEach((format, index) => {
        const selected = selectedIndices.includes(index) ? '✅' : '⬜';
        console.log(`${selected} ${index + 1}. ${format.name} - ${format.description}`);
      });

      if (selectedIndices.length > 0) {
        console.log(`\n${selectedIndices.length + 1}. ✅ Continue with selected formats`);
      }

      console.log('');
      const maxChoice = selectedIndices.length > 0 ? formats.length + 1 : formats.length;
      const choice = await this.promptNumber(`Select format (1-${maxChoice}): `, 1, maxChoice);

      if (selectedIndices.length > 0 && choice === formats.length + 1) {
        break; // Continue with selected formats
      }

      const formatIndex = choice - 1;
      if (selectedIndices.includes(formatIndex)) {
        // Deselect
        const index = selectedIndices.indexOf(formatIndex);
        selectedIndices.splice(index, 1);
        console.log(this.colorize(`Deselected ${formats[formatIndex].name}`, 'yellow'));
      } else {
        // Select
        selectedIndices.push(formatIndex);
        console.log(this.colorize(`Selected ${formats[formatIndex].name}`, 'green'));
      }
    }

    session.selectedFormats = selectedIndices.map(index => formats[index].format);
    console.log(this.colorize(`\n✅ Selected ${session.selectedFormats.length} format(s)`, 'green'));
  }

  /**
   * Configure options for each selected format
   */
  private async configureFormatOptions(session: ExportSession): Promise<void> {
    console.log('\n' + this.colorize('⚙️ Format Configuration', 'cyan'));
    console.log('-'.repeat(30));

    for (const format of session.selectedFormats) {
      console.log(`\nConfiguring ${format.toUpperCase()} export options:`);
      
      const options: ExportOptions = { format };
      
      // Common options
      options.includeMetadata = await this.promptYesNo('Include metadata? (y/n): ');
      options.includeConflicts = await this.promptYesNo('Include conflict information? (y/n): ');
      options.includeStatistics = await this.promptYesNo('Include statistics? (y/n): ');
      
      // Format-specific options
      switch (format) {
        case ExportFormat.HTML:
          options.includeStyles = await this.promptYesNo('Include CSS styles? (y/n): ');
          options.responsive = await this.promptYesNo('Make responsive design? (y/n): ');
          break;
          
        case ExportFormat.CSV:
          options.includeHeaders = await this.promptYesNo('Include column headers? (y/n): ');
          options.delimiter = await this.promptWithDefault('Field delimiter: ', ',');
          break;
          
        case ExportFormat.JSON:
          options.prettyPrint = await this.promptYesNo('Pretty print JSON? (y/n): ');
          options.includeSchema = await this.promptYesNo('Include JSON schema? (y/n): ');
          break;
      }
      
      // Filename
      const defaultFilename = `timetable_${new Date().toISOString().split('T')[0]}.${format}`;
      options.filename = await this.promptWithDefault(`Filename for ${format.toUpperCase()}: `, defaultFilename);
      
      session.customOptions.set(format, options);
      console.log(this.colorize(`✅ ${format.toUpperCase()} configured`, 'green'));
    }
  }

  /**
   * Configure output options
   */
  private async configureOutputOptions(session: ExportSession): Promise<void> {
    console.log('\n' + this.colorize('📁 Output Configuration', 'cyan'));
    console.log('-'.repeat(30));

    // Output directory
    session.outputDirectory = await this.promptWithDefault('Output directory: ', './exports');
    
    // Batch export option
    if (session.selectedFormats.length > 1) {
      session.batchExport = await this.promptYesNo('Create batch export archive? (y/n): ');
    }

    // Additional options
    const createTimestampFolder = await this.promptYesNo('Create timestamped subfolder? (y/n): ');
    if (createTimestampFolder) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      session.outputDirectory = `${session.outputDirectory}/${timestamp}`;
    }

    console.log(this.colorize(`✅ Output configured: ${session.outputDirectory}`, 'green'));
  }

  /**
   * Confirm export settings
   */
  private async confirmExportSettings(session: ExportSession): Promise<void> {
    console.log('\n' + this.colorize('📋 Export Summary', 'cyan'));
    console.log('='.repeat(50));

    console.log(this.colorize('Selected Formats:', 'yellow'));
    session.selectedFormats.forEach(format => {
      const options = session.customOptions.get(format);
      console.log(`📄 ${format.toUpperCase()}`);
      console.log(`   Filename: ${options?.filename || 'default'}`);
      console.log(`   Metadata: ${options?.includeMetadata ? 'Yes' : 'No'}`);
      console.log(`   Conflicts: ${options?.includeConflicts ? 'Yes' : 'No'}`);
      console.log(`   Statistics: ${options?.includeStatistics ? 'Yes' : 'No'}`);
      console.log('');
    });

    console.log(this.colorize('Output Settings:', 'yellow'));
    console.log(`📁 Directory: ${session.outputDirectory}`);
    console.log(`📦 Batch Export: ${session.batchExport ? 'Yes' : 'No'}`);
    console.log('');

    const proceed = await this.promptYesNo('Proceed with export? (y/n): ');
    if (!proceed) {
      throw new Error('Export cancelled by user');
    }
  }

  /**
   * Display export summary
   */
  private async displayExportSummary(results: Array<{ format: ExportFormat; success: boolean; filename?: string; error?: string }>): Promise<void> {
    console.log('\n' + this.colorize('📊 Export Summary', 'cyan'));
    console.log('='.repeat(50));

    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    console.log(`Total Exports: ${results.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Success Rate: ${((successful / results.length) * 100).toFixed(1)}%`);
    console.log('');

    if (successful > 0) {
      console.log(this.colorize('Successful Exports:', 'green'));
      results.filter(r => r.success).forEach(result => {
        console.log(`✅ ${result.format.toUpperCase()}: ${result.filename}`);
      });
      console.log('');
    }

    if (failed > 0) {
      console.log(this.colorize('Failed Exports:', 'red'));
      results.filter(r => !r.success).forEach(result => {
        console.log(`❌ ${result.format.toUpperCase()}: ${result.error}`);
      });
      console.log('');
    }

    console.log(this.colorize('🎉 Export process completed!', 'cyan'));
    await this.waitForEnter();
  }

  /**
   * Quick export with minimal configuration
   */
  async quickExport(schedule: WeeklySchedule, format: ExportFormat): Promise<void> {
    console.log(this.colorize(`\n⚡ Quick Export to ${format.toUpperCase()}`, 'cyan'));
    
    const defaultFilename = `timetable_${new Date().toISOString().split('T')[0]}.${format}`;
    const filename = await this.promptWithDefault('Filename: ', defaultFilename);
    
    const options: ExportOptions = {
      format,
      filename,
      includeMetadata: true,
      includeConflicts: true,
      includeStatistics: false
    };

    try {
      const result = await this.exportManager.exportSchedule(schedule, options);
      
      if (result.success) {
        console.log(this.colorize('✅ Quick export successful!', 'green'));
        console.log(`File: ${result.filename}`);
        console.log(`Size: ${this.formatBytes(result.size)}`);
      } else {
        console.log(this.colorize(`❌ Quick export failed: ${result.error}`, 'red'));
      }
    } catch (error) {
      console.log(this.colorize(`❌ Export error: ${error.message}`, 'red'));
    }

    await this.waitForEnter();
  }

  /**
   * Batch export all supported formats
   */
  async exportAllFormats(schedule: WeeklySchedule): Promise<void> {
    console.log(this.colorize('\n📦 Batch Export All Formats', 'cyan'));
    
    const formats = this.exportManager.getSupportedFormats();
    const timestamp = new Date().toISOString().split('T')[0];
    
    console.log(`Exporting to ${formats.length} formats...`);
    
    const results: Array<{ format: ExportFormat; success: boolean; filename?: string }> = [];
    
    for (const formatInfo of formats) {
      const options: ExportOptions = {
        format: formatInfo.format,
        filename: `timetable_${timestamp}.${formatInfo.format}`,
        includeMetadata: true,
        includeConflicts: true,
        includeStatistics: true
      };
      
      try {
        const result = await this.exportManager.exportSchedule(schedule, options);
        results.push({
          format: formatInfo.format,
          success: result.success,
          filename: result.filename
        });
        
        if (result.success) {
          console.log(this.colorize(`✅ ${formatInfo.format.toUpperCase()}`, 'green'));
        } else {
          console.log(this.colorize(`❌ ${formatInfo.format.toUpperCase()}`, 'red'));
        }
      } catch (error) {
        console.log(this.colorize(`❌ ${formatInfo.format.toUpperCase()}: ${error.message}`, 'red'));
        results.push({ format: formatInfo.format, success: false });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    console.log(`\n📊 Batch export completed: ${successful}/${formats.length} successful`);
    
    await this.waitForEnter();
  }

  // Utility methods
  private colorize(text: string, color: string): string {
    if (!this.enableColors) return text;
    
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

  cleanup(): void {
    this.rl.close();
  }
}
