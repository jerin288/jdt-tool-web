# Render Deployment Guide for JDT PDF Converter

## Quick Deploy to Render

### Option 1: Automatic Deployment (Blueprint) ✨

1. **Push your code to GitHub** (already done!)
   ```bash
   git push origin main
   ```

2. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Sign up or log in with your GitHub account

3. **Create New Blueprint**
   - Click "New +" → "Blueprint"
   - Select your repository: `jerin288/jdt-tool-web`
   - Render will automatically detect `render.yaml`
   - Click "Apply" to create the service

4. **Done!** 🎉
   - Render will automatically build and deploy your app
   - You'll get a URL like: `https://jdt-pdf-converter.onrender.com`

---

### Option 2: Manual Web Service Creation

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `jerin288/jdt-tool-web`

3. **Configure Service Settings**
   - **Name:** `jdt-pdf-converter`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`
   - **Instance Type:** Free (or select paid plan for better performance)

4. **Environment Variables**
   - Click "Advanced" → "Add Environment Variable"
   - Add: `SECRET_KEY` → Click "Generate" (Render will create a secure key)
   - Add: `PYTHON_VERSION` → `3.11.0`

5. **Deploy**
   - Click "Create Web Service"
   - Wait 2-5 minutes for deployment

---

## Auto-Deploy Setup (Continuous Deployment)

With the current setup, **every push to the main branch will automatically deploy**!

```bash
# Make changes to your code
git add .
git commit -m "Your commit message"
git push origin main

# Render will automatically:
# 1. Detect the push
# 2. Build your app
# 3. Deploy the new version
```

---

## Environment Variables on Render

These are automatically configured via `render.yaml`:

| Variable | Value | Description |
|----------|-------|-------------|
| `SECRET_KEY` | Auto-generated | Flask session encryption key |
| `PYTHON_VERSION` | 3.11.0 | Python runtime version |
| `PORT` | 10000 | Port Render assigns (auto-handled) |

---

## Monitoring Your Deployment

### 1. **View Logs**
   - Dashboard → Your Service → "Logs" tab
   - Real-time logs show all activity

### 2. **Health Checks**
   - Render automatically monitors `/` endpoint
   - If app crashes, Render restarts it

### 3. **Deployment History**
   - Dashboard → "Events" tab
   - See all deployments and their status

---

## Important Notes

### File Upload Limits
- Render free tier has disk space limits
- Temporary files are stored in `/tmp`
- Automatic cleanup runs via `/cleanup` endpoint

### Memory & Performance
- **Free Tier:** 512 MB RAM, may spin down after inactivity
- **Paid Tiers:** More RAM, always on, faster performance

### Custom Domain (Optional)
1. Go to Service Settings
2. Click "Custom Domain"
3. Add your domain (e.g., `pdf.yourdomain.com`)
4. Update DNS records as instructed

---

## Troubleshooting

### Issue: App Won't Start
**Solution:** Check logs for errors
```bash
# View recent logs in dashboard or CLI:
render logs -t 100
```

### Issue: Import Errors
**Solution:** Ensure all dependencies in `requirements.txt`
```bash
# The build command should show all packages installing
pip install -r requirements.txt
```

### Issue: Memory Errors
**Solution:** Upgrade to paid tier or optimize:
- Reduce `MAX_CONTENT_LENGTH` in `app.py`
- Process smaller PDFs
- Upgrade Render plan

### Issue: Slow Cold Starts (Free Tier)
**Solution:** 
- Free tier apps sleep after 15 min inactivity
- First request takes 30-60 seconds to wake up
- Upgrade to Starter ($7/month) for always-on

---

## Production Optimizations

### 1. **Set Production Environment**
Add environment variable:
- `FLASK_ENV` → `production`

### 2. **Enable HTTPS (Automatic)**
- Render provides free SSL certificates
- All traffic is automatically encrypted

### 3. **Add Health Check Endpoint**
Already configured in `render.yaml`:
```yaml
healthCheckPath: /
```

### 4. **Schedule Cleanup Jobs**
Use Render Cron Jobs (paid feature) or external cron service:
```bash
# Call cleanup endpoint every hour
curl https://your-app.onrender.com/cleanup
```

---

## Cost Estimates

| Tier | Price | RAM | Always On | Build Time |
|------|-------|-----|-----------|------------|
| **Free** | $0 | 512 MB | No (sleeps) | Slower |
| **Starter** | $7/mo | 512 MB | Yes | Fast |
| **Standard** | $25/mo | 2 GB | Yes | Fastest |

---

## Next Steps After Deployment

1. ✅ Test your live app
2. ✅ Set up custom domain (optional)
3. ✅ Enable notifications for failed deploys
4. ✅ Monitor usage and performance
5. ✅ Consider upgrading if needed

---

## Support & Resources

- **Render Docs:** https://render.com/docs
- **Python on Render:** https://render.com/docs/deploy-flask
- **Support:** https://render.com/support

---

## Quick Commands

```bash
# Push changes and auto-deploy
git add .
git commit -m "Update feature"
git push origin main

# View service info (requires Render CLI)
render services list

# View logs
render logs --tail
```

---

**Your app is now ready for automatic deployment! 🚀**

Every push to GitHub will trigger a new deployment on Render.
