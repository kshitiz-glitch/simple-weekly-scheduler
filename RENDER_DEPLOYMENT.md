# Render Deployment Guide

## Quick Deploy Steps

1. **Push your code to GitHub** (if not already done)

   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Create a new Web Service on Render**
   - Go to [render.com](https://render.com) and sign up/login
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select this repository

3. **Configure the service**
   - **Name**: `simple-weekly-scheduler` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid if you prefer)

4. **Deploy**
   - Click "Create Web Service"
   - Render will automatically build and deploy your app
   - You'll get a URL like `https://your-app-name.onrender.com`

## Files Added for Render

- `render.yaml` - Optional configuration file for Render
- Updated `package.json` - Added build script
- Updated `simple-server.js` - Fixed production server startup

## Environment Variables (if needed)

If you need to set environment variables:

- Go to your service dashboard on Render
- Click "Environment" tab
- Add any required variables

## Troubleshooting

- **Build fails**: Check that all dependencies are in `package.json`
- **App doesn't start**: Ensure `npm start` works locally
- **Static files not served**: Make sure files are committed to git

Your app should be accessible at the Render URL once deployment completes!
