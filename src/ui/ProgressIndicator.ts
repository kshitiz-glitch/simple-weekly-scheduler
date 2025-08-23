export interface ProgressOptions {
  total: number;
  current: number;
  label?: string;
  showPercentage?: boolean;
  showETA?: boolean;
  width?: number;
  completeChar?: string;
  incompleteChar?: string;
  enableColors?: boolean;
}

export interface ProgressState {
  startTime: Date;
  lastUpdate: Date;
  estimatedTimeRemaining: number;
  averageSpeed: number;
  isComplete: boolean;
}

export class ProgressIndicator {
  private state: ProgressState;
  private options: Required<ProgressOptions>;

  constructor(total: number, options: Partial<ProgressOptions> = {}) {
    this.options = {
      total,
      current: 0,
      label: options.label || 'Progress',
      showPercentage: options.showPercentage ?? true,
      showETA: options.showETA ?? true,
      width: options.width ?? 40,
      completeChar: options.completeChar ?? '█',
      incompleteChar: options.incompleteChar ?? '░',
      enableColors: options.enableColors ?? true
    };

    this.state = {
      startTime: new Date(),
      lastUpdate: new Date(),
      estimatedTimeRemaining: 0,
      averageSpeed: 0,
      isComplete: false
    };
  }

  /**
   * Update progress to a specific value
   */
  update(current: number, label?: string): void {
    this.options.current = Math.min(current, this.options.total);
    if (label) {
      this.options.label = label;
    }

    this.updateState();
    this.render();
  }

  /**
   * Increment progress by a specific amount
   */
  increment(amount: number = 1, label?: string): void {
    this.update(this.options.current + amount, label);
  }

  /**
   * Mark progress as complete
   */
  complete(label?: string): void {
    this.update(this.options.total, label || 'Complete');
    this.state.isComplete = true;
    console.log(''); // New line after completion
  }

  /**
   * Reset progress to beginning
   */
  reset(): void {
    this.options.current = 0;
    this.state = {
      startTime: new Date(),
      lastUpdate: new Date(),
      estimatedTimeRemaining: 0,
      averageSpeed: 0,
      isComplete: false
    };
  }

  /**
   * Get current progress as percentage
   */
  getPercentage(): number {
    return this.options.total > 0 ? (this.options.current / this.options.total) * 100 : 0;
  }

  /**
   * Get estimated time remaining in milliseconds
   */
  getETA(): number {
    return this.state.estimatedTimeRemaining;
  }

  /**
   * Check if progress is complete
   */
  isComplete(): boolean {
    return this.state.isComplete || this.options.current >= this.options.total;
  }

  private updateState(): void {
    const now = new Date();
    const elapsed = now.getTime() - this.state.startTime.getTime();
    
    if (this.options.current > 0 && elapsed > 0) {
      this.state.averageSpeed = this.options.current / elapsed; // items per millisecond
      
      const remaining = this.options.total - this.options.current;
      this.state.estimatedTimeRemaining = remaining / this.state.averageSpeed;
    }
    
    this.state.lastUpdate = now;
  }

  private render(): void {
    const percentage = this.getPercentage();
    const filled = Math.round(this.options.width * percentage / 100);
    const empty = this.options.width - filled;
    
    let bar = this.options.completeChar.repeat(filled) + this.options.incompleteChar.repeat(empty);
    
    if (this.options.enableColors) {
      const completeColor = percentage === 100 ? '\x1b[32m' : '\x1b[36m'; // Green when complete, cyan otherwise
      const incompleteColor = '\x1b[90m'; // Gray
      const resetColor = '\x1b[0m';
      
      bar = completeColor + this.options.completeChar.repeat(filled) + 
            incompleteColor + this.options.incompleteChar.repeat(empty) + 
            resetColor;
    }

    let output = `\r${this.options.label}: [${bar}]`;
    
    if (this.options.showPercentage) {
      output += ` ${percentage.toFixed(1)}%`;
    }
    
    output += ` (${this.options.current}/${this.options.total})`;
    
    if (this.options.showETA && this.state.estimatedTimeRemaining > 0 && !this.isComplete()) {
      const eta = this.formatTime(this.state.estimatedTimeRemaining);
      output += ` ETA: ${eta}`;
    }

    process.stdout.write(output);
  }

  private formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }
}

export class MultiStepProgress {
  private steps: { name: string; weight: number; progress: ProgressIndicator }[];
  private currentStepIndex: number;
  private totalWeight: number;
  private enableColors: boolean;

  constructor(steps: { name: string; weight?: number; total: number }[], enableColors: boolean = true) {
    this.enableColors = enableColors;
    this.currentStepIndex = 0;
    
    this.steps = steps.map(step => ({
      name: step.name,
      weight: step.weight || 1,
      progress: new ProgressIndicator(step.total, {
        label: step.name,
        enableColors: this.enableColors,
        showETA: false
      })
    }));
    
    this.totalWeight = this.steps.reduce((sum, step) => sum + step.weight, 0);
  }

  /**
   * Update current step progress
   */
  updateCurrentStep(current: number, label?: string): void {
    if (this.currentStepIndex < this.steps.length) {
      this.steps[this.currentStepIndex].progress.update(current, label);
      this.renderOverallProgress();
    }
  }

  /**
   * Move to the next step
   */
  nextStep(): void {
    if (this.currentStepIndex < this.steps.length) {
      this.steps[this.currentStepIndex].progress.complete();
      this.currentStepIndex++;
      
      if (this.currentStepIndex < this.steps.length) {
        console.log(''); // New line before next step
      }
    }
  }

  /**
   * Complete all steps
   */
  complete(): void {
    this.steps.forEach(step => step.progress.complete());
    this.currentStepIndex = this.steps.length;
    this.renderOverallProgress();
    console.log(''); // Final new line
  }

  /**
   * Get overall progress percentage
   */
  getOverallProgress(): number {
    let completedWeight = 0;
    
    this.steps.forEach((step, index) => {
      if (index < this.currentStepIndex) {
        completedWeight += step.weight;
      } else if (index === this.currentStepIndex) {
        const stepProgress = step.progress.getPercentage() / 100;
        completedWeight += step.weight * stepProgress;
      }
    });
    
    return this.totalWeight > 0 ? (completedWeight / this.totalWeight) * 100 : 0;
  }

  private renderOverallProgress(): void {
    const overallPercentage = this.getOverallProgress();
    const currentStepName = this.currentStepIndex < this.steps.length 
      ? this.steps[this.currentStepIndex].name 
      : 'Complete';
    
    const width = 50;
    const filled = Math.round(width * overallPercentage / 100);
    const empty = width - filled;
    
    let bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    if (this.enableColors) {
      const color = overallPercentage === 100 ? '\x1b[32m' : '\x1b[36m';
      const resetColor = '\x1b[0m';
      bar = color + '█'.repeat(filled) + '\x1b[90m' + '░'.repeat(empty) + resetColor;
    }

    const stepInfo = `Step ${this.currentStepIndex + 1}/${this.steps.length}: ${currentStepName}`;
    process.stdout.write(`\rOverall: [${bar}] ${overallPercentage.toFixed(1)}% | ${stepInfo}`);
  }
}

export class StatusIndicator {
  private status: 'idle' | 'working' | 'success' | 'error' | 'warning';
  private message: string;
  private enableColors: boolean;
  private animationFrame: number;
  private animationChars: string[];
  private animationIndex: number;

  constructor(enableColors: boolean = true) {
    this.status = 'idle';
    this.message = '';
    this.enableColors = enableColors;
    this.animationFrame = 0;
    this.animationChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.animationIndex = 0;
  }

  /**
   * Show working status with animation
   */
  showWorking(message: string): void {
    this.status = 'working';
    this.message = message;
    this.startAnimation();
  }

  /**
   * Show success status
   */
  showSuccess(message: string): void {
    this.stopAnimation();
    this.status = 'success';
    this.message = message;
    this.render();
    console.log(''); // New line
  }

  /**
   * Show error status
   */
  showError(message: string): void {
    this.stopAnimation();
    this.status = 'error';
    this.message = message;
    this.render();
    console.log(''); // New line
  }

  /**
   * Show warning status
   */
  showWarning(message: string): void {
    this.stopAnimation();
    this.status = 'warning';
    this.message = message;
    this.render();
    console.log(''); // New line
  }

  /**
   * Clear status
   */
  clear(): void {
    this.stopAnimation();
    this.status = 'idle';
    this.message = '';
    process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line
  }

  private startAnimation(): void {
    this.animationFrame = setInterval(() => {
      this.animationIndex = (this.animationIndex + 1) % this.animationChars.length;
      this.render();
    }, 100) as any;
  }

  private stopAnimation(): void {
    if (this.animationFrame) {
      clearInterval(this.animationFrame);
      this.animationFrame = 0;
    }
  }

  private render(): void {
    let icon = '';
    let color = '';

    switch (this.status) {
      case 'working':
        icon = this.animationChars[this.animationIndex];
        color = 'cyan';
        break;
      case 'success':
        icon = '✅';
        color = 'green';
        break;
      case 'error':
        icon = '❌';
        color = 'red';
        break;
      case 'warning':
        icon = '⚠️';
        color = 'yellow';
        break;
      case 'idle':
      default:
        return;
    }

    const coloredMessage = this.enableColors ? this.colorize(this.message, color) : this.message;
    process.stdout.write(`\r${icon} ${coloredMessage}`);
  }

  private colorize(text: string, color: string): string {
    const colors: { [key: string]: string } = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      cyan: '\x1b[36m',
      reset: '\x1b[0m'
    };
    
    return `${colors[color] || ''}${text}${colors.reset}`;
  }
}
