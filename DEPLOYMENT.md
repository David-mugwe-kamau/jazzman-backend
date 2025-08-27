# 🚀 JazzMan Backend - Deployment Guide

## 📋 **Prerequisites**
- GitHub account
- Render.com account

## 🔧 **Deployment Steps**

### **Step 1: Prepare Your Code**
```bash
# Make sure you're in the project directory
cd C:\Users\LENOVO\jazzman-backend

# Initialize git repository
git init

# Add all files
git add .

# Commit your changes
git commit -m "Initial JazzMan backend commit"
```

### **Step 2: Create GitHub Repository**
1. Go to [GitHub.com](https://github.com)
2. Click "New repository"
3. Name it: `jazzman-backend`
4. Make it **Public** (Render.com needs access)
5. Don't initialize with README (we already have one)
6. Click "Create repository"

### **Step 3: Push to GitHub**
```bash
# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/jazzman-backend.git

# Push to GitHub
git push -u origin main
```

### **Step 4: Deploy on Render.com**

1. **Sign up/Login to Render.com**
   - Go to [render.com](https://render.com)
   - Sign up with your GitHub account

2. **Create New Web Service**
   - Click "New +" button
   - Select "Web Service"
   - Connect your GitHub repository

3. **Configure the Service**
   - **Name**: `jazzman-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

4. **Environment Variables** (Add these in Render dashboard)
   ```
   NODE_ENV=production
   PORT=10000
   ```

5. **Click "Create Web Service"**

### **Step 5: Wait for Deployment**
- Render will automatically build and deploy your app
- This takes 2-5 minutes
- You'll get a URL like: `https://jazzman-backend.onrender.com`

## 🌐 **Access Your Deployed App**

### **Customer Frontend:**
- `https://your-app-name.onrender.com/`

### **Admin Dashboard:**
- `https://your-app-name.onrender.com/admin`

### **API Endpoints:**
- Health Check: `https://your-app-name.onrender.com/api/health`
- Bookings: `https://your-app-name.onrender.com/api/bookings`

## 🔧 **Important Notes**

### **Database:**
- Render uses ephemeral storage
- Database will reset on each deployment
- For production, consider using a persistent database

### **Environment Variables:**
- Add sensitive data as environment variables in Render dashboard
- Never commit `.env` files to GitHub

### **Custom Domain:**
- You can add a custom domain later in Render settings
- Example: `jazzmanhousecalls.com`

## 🚨 **Troubleshooting**

### **If deployment fails:**
1. Check the build logs in Render dashboard
2. Make sure all dependencies are in `package.json`
3. Verify the start command is correct
4. Check that `server.js` is the main file

### **If app doesn't work:**
1. Check the logs in Render dashboard
2. Verify environment variables are set
3. Test the health endpoint: `/api/health`

## 📞 **Support**
- Render documentation: [docs.render.com](https://docs.render.com)
- GitHub issues for code problems
- Render support for deployment issues
