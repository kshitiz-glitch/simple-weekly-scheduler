// Export all formatter classes and interfaces

export { 
  BaseScheduleFormatter, 
  TabularScheduleFormatter, 
  CompactScheduleFormatter, 
  DetailedScheduleFormatter,
  FormatterOptions 
} from './ScheduleFormatter';

export { BatchScheduleFormatter } from './BatchScheduleFormatter';
export { FacultyScheduleFormatter } from './FacultyScheduleFormatter';
export { ConflictFormatter } from './ConflictFormatter';
export { StatisticsFormatter } from './StatisticsFormatter';

// Formatter factory for easy creation
export class ScheduleFormatterFactory {
  static createTabular(options?: import('./ScheduleFormatter').FormatterOptions): import('./ScheduleFormatter').TabularScheduleFormatter {
    return new (require('./ScheduleFormatter').TabularScheduleFormatter)(options);
  }

  static createCompact(options?: import('./ScheduleFormatter').FormatterOptions): import('./ScheduleFormatter').CompactScheduleFormatter {
    return new (require('./ScheduleFormatter').CompactScheduleFormatter)(options);
  }

  static createDetailed(options?: import('./ScheduleFormatter').FormatterOptions): import('./ScheduleFormatter').DetailedScheduleFormatter {
    return new (require('./ScheduleFormatter').DetailedScheduleFormatter)(options);
  }

  static createBatch(options?: import('./ScheduleFormatter').FormatterOptions): import('./BatchScheduleFormatter').BatchScheduleFormatter {
    return new (require('./BatchScheduleFormatter').BatchScheduleFormatter)(options);
  }

  static createFaculty(options?: import('./ScheduleFormatter').FormatterOptions): import('./FacultyScheduleFormatter').FacultyScheduleFormatter {
    return new (require('./FacultyScheduleFormatter').FacultyScheduleFormatter)(options);
  }

  static createConflict(options?: import('./ScheduleFormatter').FormatterOptions): import('./ConflictFormatter').ConflictFormatter {
    return new (require('./ConflictFormatter').ConflictFormatter)(options);
  }

  static createStatistics(options?: import('./ScheduleFormatter').FormatterOptions): import('./StatisticsFormatter').StatisticsFormatter {
    return new (require('./StatisticsFormatter').StatisticsFormatter)(options);
  }
}
