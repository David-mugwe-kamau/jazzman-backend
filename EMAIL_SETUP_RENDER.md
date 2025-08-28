# 📧 Email Setup for Render Deployment

## 🚨 **Current Issue**
Barbers are not receiving booking notifications because email credentials are not configured on Render.

## 🔧 **Solution: Configure Environment Variables on Render**

### **Step 1: Go to Render Dashboard**
1. Visit [render.com](https://render.com) and sign in
2. Find your `jazzman-backend` service
3. Click on it to open the service dashboard

### **Step 2: Add Environment Variables**
1. In the service dashboard, click on **"Environment"** tab
2. Click **"Add Environment Variable"**
3. Add these variables one by one:

```
Key: EMAIL_SERVICE
Value: gmail

Key: EMAIL_USER  
Value: jazzmanhousecalls@gmail.com

Key: EMAIL_PASS
Value: [your-16-character-app-password]
```

### **Step 3: Get Gmail App Password**
1. Go to [Google Account settings](https://myaccount.google.com/)
2. Navigate to **Security** → **2-Step Verification**
3. Click **"App passwords"** at the bottom
4. Generate a new app password for **"Mail"**
5. Copy the 16-character password
6. Paste it as the value for `EMAIL_PASS`

### **Step 4: Redeploy**
1. After adding environment variables, click **"Manual Deploy"**
2. Select **"Clear build cache & deploy"**
3. Wait for deployment to complete

## ✅ **What This Fixes**
- Barbers will receive email notifications when assigned bookings
- No more "Missing credentials for PLAIN" errors
- Email system will work properly on Render

## 🧪 **Test After Setup**
1. Create a new booking through your frontend
2. Check Render logs for email success messages
3. Check barber's email for notification

## 🔍 **If Still Not Working**
- Verify environment variables are set correctly
- Check Render logs for any new error messages
- Ensure Gmail app password is correct
- Make sure 2FA is enabled on Gmail account

---
**After setting up these environment variables, barber notifications will work! 🎉**
