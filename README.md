# 📅 Simple Weekly Scheduler

A user-friendly web application for creating and managing weekly schedules with export capabilities.

## ✨ Features

- 🎯 **6-Step Wizard Interface** - Intuitive step-by-step schedule creation
- 🔍 **Smart Conflict Detection** - Automatically identifies and prevents scheduling conflicts
- 📄 **Multiple Export Options** - Export schedules as PDF or Excel/CSV files
- 💾 **Auto-Save Functionality** - Never lose your work with automatic progress saving
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
- 🚀 **No Authentication Required** - Start creating schedules immediately

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open browser to http://localhost:3000
```

### Deploy to Vercel

1. **Push to GitHub** ✅ (Done)
2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will automatically detect the configuration
3. **Deploy**: Click deploy and your app will be live! 🎉

## 📖 How to Use

1. **Institute Setup** - Enter your institution name and basic details
2. **Batch Configuration** - Add batches/classes with their subjects
3. **Faculty Assignment** - Assign teachers to subjects
4. **Time Preferences** - Set working hours and days
5. **Schedule Generation** - Let the system create your optimal schedule
6. **Export Options** - Download as PDF or Excel format

## 🛠️ Technical Details

- **Frontend**: Vanilla JavaScript with modern ES6+ features
- **Backend**: Node.js with Express.js
- **Storage**: Browser localStorage for auto-save functionality
- **Export**: Client-side PDF generation, server-side Excel/CSV export
- **Deployment**: Configured for Vercel serverless deployment

## 📁 File Structure

```
simple-weekly-scheduler/
├── simple-scheduler.html    # Main application interface
├── simple-scheduler.js      # Frontend logic and UI handling
├── simple-server.js         # Backend API server
├── package.json            # Project dependencies and scripts
├── vercel.json             # Vercel deployment configuration
└── README.md              # This file
```

## 🌐 Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 📄 License

MIT License

---

**🎉 Ready for deployment!** The project is now properly configured for Vercel deployment.