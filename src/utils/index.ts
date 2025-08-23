// Utility functions and helpers

export class IdGenerator {
  private static counter = 0;
  
  static generateId(prefix: string = 'id'): string {
    return `${prefix}_${Date.now()}_${++this.counter}`;
  }
  
  static generateBatchId(): string {
    return this.generateId('batch');
  }
  
  static generateSubjectId(): string {
    return this.generateId('subject');
  }
  
  static generateFacultyId(): string {
    return this.generateId('faculty');
  }
}

export class TimeUtils {
  static parseTime(timeStr: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  }
  
  static formatTime(hours: number, minutes: number): string {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  static addMinutes(timeStr: string, minutes: number): string {
    const { hours, minutes: mins } = this.parseTime(timeStr);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMinutes = totalMinutes % 60;
    return this.formatTime(newHours, newMinutes);
  }
  
  static isTimeInRange(time: string, startTime: string, endTime: string): boolean {
    const timeMinutes = this.timeToMinutes(time);
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  }
  
  private static timeToMinutes(timeStr: string): number {
    const { hours, minutes } = this.parseTime(timeStr);
    return hours * 60 + minutes;
  }
}

export class ValidationUtils {
  static isValidBatchName(name: string): boolean {
    return name.trim().length > 0 && name.length <= 50;
  }
  
  static isValidSubjectName(name: string): boolean {
    return name.trim().length > 0 && name.length <= 100;
  }
  
  static isValidLectureCount(count: number): boolean {
    return Number.isInteger(count) && count > 0 && count <= 20;
  }
  
  static isValidLectureDuration(duration: number): boolean {
    return Number.isInteger(duration) && duration >= 30 && duration <= 180;
  }
  
  static isValidFacultyName(name: string): boolean {
    return name.trim().length > 0 && name.length <= 100;
  }
}
