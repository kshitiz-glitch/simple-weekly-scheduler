// Main application entry point

export * from './models';
export * from './services';
export * from './algorithms';
export * from './ui';
export * from './utils';

// Main application class will be implemented in later tasks
export class TimetableGeneratorApp {
  constructor() {
    // Will be implemented in task 10.2
  }
  
  async run(): Promise<void> {
    // Will be implemented in task 10.2
    console.log('Timetable Generator - Coming Soon!');
  }
}

// For development testing
if (require.main === module) {
  const app = new TimetableGeneratorApp();
  app.run().catch(console.error);
}
