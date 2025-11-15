# Render PostgreSQL Setup Instructions

## Problem
The database keeps resetting to 170 credits because Render is using SQLite on ephemeral storage. Every deployment wipes the database.

## Solution
Set up PostgreSQL database on Render for permanent storage.

## Step-by-Step Instructions

### Method 1: Manual Database Creation (RECOMMENDED)

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com/

2. **Create PostgreSQL Database**
   - Click "New +" button (top right)
   - Select "PostgreSQL"
   - Fill in details:
     * Name: `jdt-postgres`
     * Database: `jdt_database` 
     * User: `jdt_user`
     * Region: Oregon (or closest to you)
     * PostgreSQL Version: 15 or 16
     * **Plan: Free** (sufficient for your needs)
   - Click "Create Database"

3. **Wait for Database Creation**
   - Takes 2-3 minutes
   - Status will change from "Creating" to "Available"

4. **Get Database Connection URL**
   - Open your new database
   - Find "Connections" section
   - Copy the **"External Database URL"**
   - It looks like: `postgresql://user:password@host/database`

5. **Update Web Service Environment**
   - Go back to Dashboard
   - Click on your web service: `jdt-tool-web`
   - Click "Environment" tab (left sidebar)
   - Find or add `DATABASE_URL` variable:
     * If it exists: Click "Edit" 
     * If not: Click "Add Environment Variable"
   - Paste the External Database URL as value
   - Click "Save Changes"

6. **Trigger Manual Deploy**
   - Go to "Manual Deploy" section
   - Click "Clear build cache & deploy"
   - Wait 2-3 minutes for deployment

7. **Verify**
   - Run: `python verify_deployment.py`
   - Credits should persist now!

### Method 2: Blueprint (Alternative)

1. Go to Dashboard → "Blueprints"
2. Click "New Blueprint Instance"
3. Connect your GitHub repo: `jerin288/jdt-tool-web`
4. Render will read `render.yaml` and create everything automatically
5. This creates both web service AND database together

## What This Fixes

- ✅ Credits will persist across deployments
- ✅ User data won't be lost
- ✅ Database won't reset to 170 credits
- ✅ All changes are permanent

## Current Status

- Database: SQLite (ephemeral) ❌
- Target: PostgreSQL (persistent) ✅
- Your credits keep resetting because SQLite file is deleted on each deploy

## After Setup

Once PostgreSQL is connected:
- Initial credits will reset ONE LAST TIME (fresh database)
- Run `python add_credits_remote.py` to add your credits back
- From then on, credits will NEVER reset again!

## Need Help?

If you have issues:
1. Make sure DATABASE_URL is copied correctly (no extra spaces)
2. Database must be "Available" status
3. Use "External Database URL" not "Internal"
4. After changing DATABASE_URL, always trigger a new deploy
