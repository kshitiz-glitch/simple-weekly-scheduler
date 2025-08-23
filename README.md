# 📅 Simple Weekly Scheduler

A user-friendly, web-based weekly timetable generator for educational institutions. Create professional schedules in minutes without complex setup or authentication.

## ✨ Features

- 🎯 **6-Step Guided Process** - From institute info to final schedule
- 👥 **Multi-Batch Support** - Handle multiple classes/grades
- 📚 **Subject Management** - Configure lectures per week and duration
- 👨‍🏫 **Faculty Assignment** - Prevent conflicts automatically
- ⚙️ **Flexible Preferences** - Custom working days and hours
- 📱 **Mobile Responsive** - Works on all devices
- 📄 **Export Options** - PDF and Excel downloads
- 💾 **Auto-Save** - Never lose your progress

## 🚀 Quick Start

### Option 1: One-Click Start (Windows)
```bash
# Double-click the batch file
start-simple-scheduler.bat
```

### Option 2: Manual Start
```bash
# Install dependencies
npm install express cors

# Start the server
node simple-server.js

# Open browser to: http://localhost:3000
```

## 📖 How to Use

1. **Institute Info** - Enter your school/institute details
2. **Add Batches** - Create classes (e.g., "Grade 10A", "CS-101")
3. **Add Subjects** - Configure subjects with lecture requirements
4. **Assign Faculty** - Add teachers and assign subjects
5. **Set Preferences** - Choose working days, hours, and breaks
6. **Generate & Export** - Create schedule and download as PDF/Excel

## 🎯 Perfect For

- **Schools & Colleges** - Quick timetable creation
- **Training Centers** - Course scheduling
- **Departments** - Faculty coordination
- **Small Institutions** - No complex setup needed

## 📚 Documentation

- [📋 Quick Start Guide](SIMPLE_SCHEDULER_QUICK_START.md)
- [📖 Detailed Documentation](SIMPLE_SCHEDULER_README.md)

---

## 🔧 Advanced Features (Full System)

This repository also includes a comprehensive automated timetable generator with advanced features:

## Features

- **Multi-batch Support**: Handle multiple classes/grades with custom names
- **Subject Configuration**: Configure subjects with specific lecture requirements
- **Faculty Conflict Prevention**: Ensure no teacher is double-booked
- **Holiday Management**: Automatically exclude holidays and non-working days
- **Optimal Distribution**: Evenly distribute lectures throughout the week
- **Export Options**: Multiple output formats (CSV, JSON, Console)
- **Input Validation**: Comprehensive error checking and user guidance

## Installation

```bash
npm install
```

## Development

```bash
# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Usage

```bash
# Run the application
npm start
```

## Project Structure

```
src/
├── models/          # Data models and interfaces
├── services/        # Business logic services
├── algorithms/      # Scheduling algorithms
├── ui/             # User interface components
├── utils/          # Utility functions
└── index.ts        # Main application entry point
```

## Requirements

- Node.js 16+
- TypeScript 5+

## License

MIT
