// User interface interfaces and types

import { Batch, Subject, WeeklySchedule, ValidationResult } from '../models';

export interface UserInterface {
  displayWelcome(): void;
  promptForBatchCount(): Promise<number>;
  promptForBatchName(index: number): Promise<string>;
  promptForSubjectCount(batchName: string): Promise<number>;
  promptForSubjectDetails(batchName: string, subjectIndex: number): Promise<SubjectInput>;
  promptForHolidays(): Promise<Date[]>;
  displayProgress(message: string, percentage?: number): void;
  displaySchedule(schedule: WeeklySchedule): void;
  displayError(error: string): void;
  displayValidationResult(result: ValidationResult): void;
  promptForExportFormat(): Promise<ExportFormat>;
}

export interface SubjectInput {
  name: string;
  lecturesPerWeek: number;
  lectureDuration: number;
  facultyName: string;
}

export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  CONSOLE = 'console'
}

export interface ProgressTracker {
  start(totalSteps: number): void;
  update(currentStep: number, message: string): void;
  complete(): void;
}

// Export UI components
export { ConsoleInterface } from './ConsoleInterface';
export { ProgressIndicator } from './ProgressIndicator';
export { InteractiveScheduleReviewer } from './InteractiveScheduleReviewer';
export { ConflictResolutionInterface } from './ConflictResolutionInterface';
export { ExportOptionsInterface } from './ExportOptionsInterface';
