# Vercel Deployment Checklist ✅

## Pre-Deployment Verification

### ✅ Configuration Files
- [x] `vercel.json` - Configured with proper routes and builds
- [x] `.vercelignore` - Excludes unnecessary files
- [x] `api/index.py` - Serverless function entry point
- [x] `requirements.txt` - All dependencies listed

### ✅ Code Changes for Vercel
- [x] Upload folder uses `/tmp` on Vercel
- [x] Database connection pool optimized for serverless (pool_size=1)
- [x] Background threads disabled on Vercel
- [x] PostgreSQL required (SQLite fallback disabled in production)

### ⚠️ Known Limitations
- [ ] **Timeout**: PDF conversions may timeout on free tier (10s) or Pro (60s)
- [ ] **No Background Tasks**: Automatic cleanup thread disabled
- [ ] **Ephemeral Storage**: Files in `/tmp` are deleted after function execution
- [ ] **Cold Starts**: First request may be slow

---

## Required Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

### Required:
- [ ] `SECRET_KEY` - Flask secret key (minimum 32 characters)
- [ ] `DATABASE_URL` - PostgreSQL connection string (REQUIRED - SQLite won't work)

### Optional:
- [ ] `ADMIN_KEY` - Admin panel access key
- [ ] `FLASK_ENV` - Set to `production` (already in vercel.json)

---

## Database Setup

Vercel doesn't provide databases. You need an external PostgreSQL:

### Recommended Options:
1. **Vercel Postgres** (Paid) - Integrated with Vercel
2. **Supabase** (Free tier available) - https://supabase.com
3. **Neon** (Free serverless Postgres) - https://neon.tech
4. **Railway** (Free tier available) - https://railway.app
5. **ElephantSQL** (Free tier available) - https://www.elephantsql.com

### Database Connection String Format:
```
postgresql://user:password@host:5432/database
```

---

## Deployment Steps

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy (from project directory)
```bash
cd C:\Users\JERIN\JDT_Tool_Web
vercel
```

Follow prompts:
- Set up and deploy? **Yes**
- Which scope? **[Your account]**
- Link to existing project? **No**
- What's your project's name? **jdt-pdf-converter** (or your choice)
- In which directory is your code located? **./**

### 4. Set Environment Variables

**Via CLI:**
```bash
vercel env add SECRET_KEY
vercel env add DATABASE_URL
vercel env add ADMIN_KEY
```

**Via Dashboard:**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Settings → Environment Variables
4. Add all required variables

### 5. Deploy to Production
```bash
vercel --prod
```

---

## Post-Deployment Verification

### Test These Endpoints:
- [ ] `https://your-project.vercel.app/` - Home page loads
- [ ] `https://your-project.vercel.app/static/style.css` - Static files work
- [ ] `https://your-project.vercel.app/api/user-status` - API endpoints work
- [ ] Database connection works (check logs)

### Check Logs:
```bash
vercel logs
```

### Monitor:
- Function execution time
- Memory usage
- Error rates

---

## Troubleshooting

### Issue: Timeout Errors
**Solution**: 
- Upgrade to Vercel Pro for 60s timeout
- Or optimize PDF processing (process fewer pages)
- Or use external processing service

### Issue: Database Connection Errors
**Solution**:
- Verify `DATABASE_URL` is set correctly
- Check database allows connections from Vercel IPs
- Ensure connection string uses `postgresql://` not `postgres://`

### Issue: Static Files Not Loading
**Solution**:
- Check `vercel.json` routes configuration
- Ensure files are in `static/` directory
- Verify file paths in templates use `url_for('static', ...)`

### Issue: Import Errors
**Solution**:
- Check `requirements.txt` includes all dependencies
- Verify Python version compatibility
- Check build logs for missing packages

---

## Important Notes

1. **SQLite Won't Work**: Vercel's filesystem is read-only except `/tmp`. You MUST use PostgreSQL.

2. **File Storage**: Converted files stored in `/tmp` are ephemeral. Consider:
   - Using cloud storage (S3, Cloudinary) for permanent storage
   - Streaming files directly to user without saving
   - Using Vercel Blob Storage (paid)

3. **Background Tasks**: The automatic cleanup thread is disabled on Vercel. Consider:
   - Using Vercel Cron Jobs for scheduled cleanup
   - Using external queue service (Bull, RabbitMQ)
   - Manual cleanup via admin endpoint

4. **Session Storage**: Flask sessions use cookies by default, which should work on Vercel. If you need server-side sessions, use Redis or database-backed sessions.

---

## Alternative: Better Platforms for This App

If you encounter too many limitations on Vercel, consider:

- ✅ **Render** - Better suited for Flask apps with long-running processes
- ✅ **Railway** - Good balance of features and simplicity
- ✅ **Heroku** - Classic platform for Flask apps
- ✅ **DigitalOcean App Platform** - Good performance
- ✅ **AWS EC2** or **Google Cloud Run** - More control

---

## Support

- Vercel Docs: https://vercel.com/docs
- Vercel Python Runtime: https://vercel.com/docs/functions/serverless-functions/runtimes/python
- Vercel Discord: https://vercel.com/discord

