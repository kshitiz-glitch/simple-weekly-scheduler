import { WeeklySchedule } from '../models/WeeklySchedule';
import { ScheduleEntry, DayOfWeek } from '../models';

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
  includeConflicts?: boolean;
  includeStatistics?: boolean;
  filename?: string;
  dateFormat?: 'ISO' | 'US' | 'EU';
  timeFormat?: '12h' | '24h';
  encoding?: 'utf8' | 'utf16' | 'ascii';
  delimiter?: string; // For CSV
  pretty?: boolean; // For JSON
  pageSize?: 'A4' | 'Letter' | 'A3'; // For printable formats
  orientation?: 'portrait' | 'landscape';
  includeHeaders?: boolean;
  filterBy?: ExportFilter;
  sortBy?: ExportSort;
  groupBy?: ExportGrouping;
}

export interface ExportFilter {
  batches?: string[];
  faculties?: string[];
  subjects?: string[];
  days?: DayOfWeek[];
  timeRange?: {
    start: string;
    end: string;
  };
  conflictsOnly?: boolean;
}

export interface ExportSort {
  field: 'time' | 'batch' | 'faculty' | 'subject' | 'day';
  order: 'asc' | 'desc';
  secondary?: {
    field: 'time' | 'batch' | 'faculty' | 'subject' | 'day';
    order: 'asc' | 'desc';
  };
}

export interface ExportGrouping {
  primary: 'batch' | 'faculty' | 'subject' | 'day';
  secondary?: 'batch' | 'faculty' | 'subject' | 'day';
}

export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  XML = 'xml',
  HTML = 'html',
  PDF = 'pdf',
  EXCEL = 'xlsx',
  TEXT = 'txt',
  MARKDOWN = 'md',
  ICAL = 'ics'
}

export interface ExportResult {
  success: boolean;
  data?: string | Buffer;
  filename: string;
  mimeType: string;
  size: number;
  error?: string;
  warnings?: string[];
  metadata: {
    exportedAt: Date;
    format: ExportFormat;
    entriesCount: number;
    processingTimeMs: number;
  };
}

export interface ComparisonOptions {
  scheduleA: WeeklySchedule;
  scheduleB: WeeklySchedule;
  labelA?: string;
  labelB?: string;
  highlightDifferences?: boolean;
  showOnlyDifferences?: boolean;
  compareBy?: 'entries' | 'conflicts' | 'statistics' | 'all';
}

export interface ComparisonResult {
  differences: {
    addedEntries: ScheduleEntry[];
    removedEntries: ScheduleEntry[];
    modifiedEntries: {
      original: ScheduleEntry;
      modified: ScheduleEntry;
      changes: string[];
    }[];
    conflictChanges: {
      added: number;
      removed: number;
      modified: number;
    };
  };
  summary: {
    totalDifferences: number;
    similarityScore: number; // 0-1
    majorChanges: number;
    minorChanges: number;
  };
  report: string;
}

export abstract class BaseExporter {
  protected options: Required<ExportOptions>;

  constructor(options: ExportOptions) {
    this.options = {
      format: options.format,
      includeMetadata: options.includeMetadata ?? true,
      includeConflicts: options.includeConflicts ?? true,
      includeStatistics: options.includeStatistics ?? false,
      filename: options.filename ?? this.generateDefaultFilename(options.format),
      dateFormat: options.dateFormat ?? 'ISO',
      timeFormat: options.timeFormat ?? '24h',
      encoding: options.encoding ?? 'utf8',
      delimiter: options.delimiter ?? ',',
      pretty: options.pretty ?? true,
      pageSize: options.pageSize ?? 'A4',
      orientation: options.orientation ?? 'portrait',
      includeHeaders: options.includeHeaders ?? true,
      filterBy: options.filterBy ?? {},
      sortBy: options.sortBy ?? { field: 'day', order: 'asc' },
      groupBy: options.groupBy ?? { primary: 'day' }
    };
  }

  abstract export(schedule: WeeklySchedule): Promise<ExportResult>;

  protected filterEntries(entries: ScheduleEntry[]): ScheduleEntry[] {
    let filtered = [...entries];

    if (this.options.filterBy.batches?.length) {
      filtered = filtered.filter(entry => 
        this.options.filterBy.batches!.includes(entry.batchId)
      );
    }

    if (this.options.filterBy.faculties?.length) {
      filtered = filtered.filter(entry => 
        this.options.filterBy.faculties!.includes(entry.facultyId)
      );
    }

    if (this.options.filterBy.subjects?.length) {
      filtered = filtered.filter(entry => 
        this.options.filterBy.subjects!.includes(entry.subjectId)
      );
    }

    if (this.options.filterBy.days?.length) {
      filtered = filtered.filter(entry => 
        this.options.filterBy.days!.includes(entry.timeSlot.day)
      );
    }

    if (this.options.filterBy.timeRange) {
      const { start, end } = this.options.filterBy.timeRange;
      filtered = filtered.filter(entry => {
        const entryTime = this.timeToMinutes(entry.timeSlot.startTime);
        const startTime = this.timeToMinutes(start);
        const endTime = this.timeToMinutes(end);
        return entryTime >= startTime && entryTime <= endTime;
      });
    }

    return filtered;
  }

  protected sortEntries(entries: ScheduleEntry[]): ScheduleEntry[] {
    return [...entries].sort((a, b) => {
      const primary = this.compareByField(a, b, this.options.sortBy.field, this.options.sortBy.order);
      
      if (primary !== 0 || !this.options.sortBy.secondary) {
        return primary;
      }

      return this.compareByField(
        a, 
        b, 
        this.options.sortBy.secondary.field, 
        this.options.sortBy.secondary.order
      );
    });
  }

  protected groupEntries(entries: ScheduleEntry[]): Map<string, ScheduleEntry[]> {
    const groups = new Map<string, ScheduleEntry[]>();

    entries.forEach(entry => {
      const primaryKey = this.getGroupKey(entry, this.options.groupBy.primary);
      const secondaryKey = this.options.groupBy.secondary 
        ? this.getGroupKey(entry, this.options.groupBy.secondary)
        : '';
      
      const groupKey = secondaryKey ? `${primaryKey}_${secondaryKey}` : primaryKey;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(entry);
    });

    return groups;
  }

  protected formatTime(time: string): string {
    if (this.options.timeFormat === '12h') {
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
    return time;
  }

  protected formatDate(date: Date): string {
    switch (this.options.dateFormat) {
      case 'US':
        return date.toLocaleDateString('en-US');
      case 'EU':
        return date.toLocaleDateString('en-GB');
      case 'ISO':
      default:
        return date.toISOString().split('T')[0];
    }
  }

  protected generateDefaultFilename(format: ExportFormat): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    return `timetable_${timestamp}.${format}`;
  }

  private compareByField(
    a: ScheduleEntry, 
    b: ScheduleEntry, 
    field: string, 
    order: 'asc' | 'desc'
  ): number {
    let comparison = 0;

    switch (field) {
      case 'day':
        const dayOrder = Object.values(DayOfWeek);
        comparison = dayOrder.indexOf(a.timeSlot.day) - dayOrder.indexOf(b.timeSlot.day);
        break;
      case 'time':
        comparison = this.timeToMinutes(a.timeSlot.startTime) - this.timeToMinutes(b.timeSlot.startTime);
        break;
      case 'batch':
        comparison = a.batchId.localeCompare(b.batchId);
        break;
      case 'faculty':
        comparison = a.facultyId.localeCompare(b.facultyId);
        break;
      case 'subject':
        comparison = a.subjectId.localeCompare(b.subjectId);
        break;
    }

    return order === 'desc' ? -comparison : comparison;
  }

  private getGroupKey(entry: ScheduleEntry, groupBy: string): string {
    switch (groupBy) {
      case 'batch':
        return entry.batchId;
      case 'faculty':
        return entry.facultyId;
      case 'subject':
        return entry.subjectId;
      case 'day':
        return entry.timeSlot.day;
      default:
        return 'default';
    }
  }

  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
}

export interface PrintableOptions extends ExportOptions {
  title?: string;
  subtitle?: string;
  headerText?: string;
  footerText?: string;
  showPageNumbers?: boolean;
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  fontSize?: number;
  fontFamily?: string;
  colorScheme?: 'color' | 'grayscale' | 'blackwhite';
  logoUrl?: string;
  watermark?: string;
}

export interface ScheduleComparisonExporter {
  compareSchedules(options: ComparisonOptions): Promise<ComparisonResult>;
  exportComparison(comparison: ComparisonResult, exportOptions: ExportOptions): Promise<ExportResult>;
}
