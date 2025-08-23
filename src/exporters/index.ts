// Export all exporter classes and interfaces

export * from './ExportInterfaces';
export { CsvExporter } from './CsvExporter';
export { JsonExporter } from './JsonExporter';
export { HtmlExporter } from './HtmlExporter';
export { ScheduleComparator } from './ScheduleComparator';
export { ExportManager } from './ExportManager';

// Export factory for easy creation
export class ExporterFactory {
  static createCsvExporter(options?: import('./ExportInterfaces').ExportOptions): import('./CsvExporter').CsvExporter {
    return new (require('./CsvExporter').CsvExporter)(options || { format: 'csv' as any });
  }

  static createJsonExporter(options?: import('./ExportInterfaces').ExportOptions): import('./JsonExporter').JsonExporter {
    return new (require('./JsonExporter').JsonExporter)(options || { format: 'json' as any });
  }

  static createHtmlExporter(options?: import('./ExportInterfaces').PrintableOptions): import('./HtmlExporter').HtmlExporter {
    return new (require('./HtmlExporter').HtmlExporter)(options || { format: 'html' as any });
  }

  static createExportManager(): import('./ExportManager').ExportManager {
    return new (require('./ExportManager').ExportManager)();
  }

  static createScheduleComparator(): import('./ScheduleComparator').ScheduleComparator {
    return new (require('./ScheduleComparator').ScheduleComparator)();
  }
}
