# MongoDB Connection Issue - FIXED ✅

## Problem
The backend was trying to connect to MongoDB with TLS enabled, but:
1. MongoDB is not installed locally on your machine
2. The `.env` file was missing `MONGO_URI` and `JWT_SECRET`

## What I Fixed

### 1. Updated `backend/.env`
Added missing environment variables:
```env
EMAIL_USER=roopkumar3244@gmail.com
EMAIL_PASS=rkdyrhwsbkdcnedf
MONGO_URI=mongodb://localhost:27017/placeera
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
PORT=5000
```

### 2. Fixed MongoDB Connection Logic
Updated `backend/src/server.js` to:
- Automatically detect if using Atlas (cloud) or local MongoDB
- Only use TLS for Atlas connections
- Provide better error messages

## Solution: Choose One Option

### **Option 1: Use MongoDB Atlas (Cloud) - RECOMMENDED** ⭐

**Pros:** No local installation needed, free tier available, always accessible

**Steps:**
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create a free account
3. Create a new cluster (Free M0 tier)
4. Click "Connect" → "Connect your application"
5. Copy the connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/`)
6. Update `backend/.env`:
   ```env
   MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/placeera?retryWrites=true&w=majority
   ```
7. Restart the backend server

**Time:** ~5 minutes

---

### **Option 2: Install MongoDB Locally**

**Pros:** Full control, works offline

**Steps:**

#### For Windows:
1. Download MongoDB Community Server: https://www.mongodb.com/try/download/community
2. Run the installer (choose "Complete" installation)
3. Install as a Windows Service (check the box during installation)
4. MongoDB will start automatically

#### Verify Installation:
```bash
mongod --version
```

#### Start MongoDB (if not running as service):
```bash
# Windows
net start MongoDB

# Or manually
mongod --dbpath C:\data\db
```

5. Keep `backend/.env` as is (already configured for localhost)
6. Restart the backend server

**Time:** ~10-15 minutes

---

## Quick Test After Fix

### Restart Backend Server
```bash
# Stop current server (Ctrl+C in the terminal)
cd backend
npm run dev
```

### Expected Output:
```
Server started on port 5000
✅ MongoDB Connected: Local
```
OR
```
✅ MongoDB Connected: Atlas (Cloud)
```

### Test Login:
1. Go to `http://localhost:5173/login`
2. Try to login or register
3. Should work without timeout errors

---

## Current Status

✅ Code fixed and ready
⏳ **Waiting for you to choose Option 1 (Atlas) or Option 2 (Local)**

**Recommendation:** Use **MongoDB Atlas** (Option 1) for fastest setup.

---

## If You Choose Atlas (Detailed Steps)

1. **Sign up:** https://www.mongodb.com/cloud/atlas/register
2. **Create Organization** → Name it anything (e.g., "PlaceEra")
3. **Create Project** → Name it "PlaceEra"
4. **Build a Database** → Choose FREE (M0) tier
5. **Choose Cloud Provider** → AWS, Region: Closest to you
6. **Create Cluster** (takes 1-3 minutes)
7. **Security Setup:**
   - Create Database User (username + password) - **SAVE THESE!**
   - Add IP Address: Click "Add My Current IP Address" or use `0.0.0.0/0` (allow all - for development only)
8. **Connect:**
   - Click "Connect" button
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your actual password
9. **Update `.env`:**
   ```env
   MONGO_URI=mongodb+srv://username:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/placeera?retryWrites=true&w=majority
   ```
10. **Restart backend** → Should see "✅ MongoDB Connected: Atlas (Cloud)"

---

## Troubleshooting

### Still getting timeout?
- **Atlas:** Check IP whitelist (add `0.0.0.0/0` for testing)
- **Local:** Make sure MongoDB service is running
- **Both:** Check `.env` file is in `backend/` folder (not root)

### "Invalid connection string"?
- Make sure you replaced `<password>` in the Atlas connection string
- Check for extra spaces in `.env` file

### Need help?
Share the error message and I'll help debug!
