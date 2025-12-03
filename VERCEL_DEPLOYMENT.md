# Deploying to Vercel

## ⚠️ Important Limitations

This Flask application is **NOT optimized for Vercel's serverless architecture**. You will face:

1. **Timeout Issues**: PDF conversions may exceed Vercel's 10-60 second limit
2. **No Background Processing**: Threading won't work in serverless functions
3. **Temporary Storage Issues**: File uploads/conversions need `/tmp` (limited space)
4. **Cold Starts**: First requests will be slow

## Better Alternatives

- ✅ **Render** (already configured with `render.yaml`)
- ✅ **Railway** (already configured with `railway.json`)
- ✅ **Heroku** (supports long-running processes)
- ✅ **DigitalOcean App Platform**
- ✅ **AWS EC2** or **Google Cloud Run**

---

## Vercel Deployment Steps (If you proceed)

### Prerequisites

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Sign up at [vercel.com](https://vercel.com)

### Step 1: Prepare Environment Variables

Create a `.env` file (DO NOT commit this):
```env
SECRET_KEY=your_secret_key_here_minimum_32_characters
DATABASE_URL=postgresql://user:password@host:5432/database
ADMIN_KEY=your_admin_key_here
```

### Step 2: Set up Database

Vercel doesn't provide databases. You need an external PostgreSQL database:

**Option 1: Vercel Postgres (Paid)**
```bash
vercel postgres create
```

**Option 2: External Providers (Free/Paid)**
- [Supabase](https://supabase.com) - Free tier available
- [Neon](https://neon.tech) - Free serverless Postgres
- [Railway](https://railway.app) - Free tier available
- [ElephantSQL](https://www.elephantsql.com) - Free tier available

### Step 3: Deploy to Vercel

```bash
# Login to Vercel
vercel login

# Deploy (from project directory)
cd C:\Users\JERIN\JDT_Tool_Web
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? [Your account]
# - Link to existing project? No
# - What's your project's name? jdt-pdf-converter
# - In which directory is your code located? ./
```

### Step 4: Configure Environment Variables

**Via CLI:**
```bash
vercel env add SECRET_KEY
vercel env add DATABASE_URL
vercel env add ADMIN_KEY
```

**Via Dashboard:**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add:
   - `SECRET_KEY`: Your secret key
   - `DATABASE_URL`: PostgreSQL connection string
   - `ADMIN_KEY`: Your admin key

### Step 5: Production Deployment

```bash
# Deploy to production
vercel --prod
```

---

## Known Issues on Vercel

### 1. PDF Conversion Timeouts
**Problem**: Large PDFs will timeout  
**Solution**: 
- Upgrade to Vercel Pro for 60s timeout
- Or use external processing service (AWS Lambda, etc.)
- Or switch to Render/Railway

### 2. File Storage
**Problem**: Converted files stored in `/tmp` are ephemeral  
**Solution**: 
- Use cloud storage (S3, Cloudinary, etc.)
- Modify code to stream files directly without saving

### 3. Background Threads
**Problem**: `threading.Thread` won't work in serverless  
**Solution**: 
- Use Vercel Cron Jobs for scheduled tasks
- Remove background cleanup thread
- Use external queue service (Bull, RabbitMQ)

### 4. Database Connection Pooling
**Problem**: Each function instance creates new connections  
**Solution**: 
```python
# Update app.py SQLAlchemy config
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_size': 1,
    'max_overflow': 0,
    'pool_pre_ping': True,
    'pool_recycle': 300,
}
```

---

## Monitoring Your Deployment

```bash
# View logs
vercel logs

# Check deployment status
vercel ls

# Get deployment URL
vercel inspect
```

---

## Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your domain (e.g., jdpdftoexcel.com)
3. Configure DNS:
   - Type: `CNAME`
   - Name: `@` or `www`
   - Value: `cname.vercel-dns.com`

---

## Rollback Deployment

```bash
# List deployments
vercel ls

# Promote a previous deployment
vercel promote [deployment-url]
```

---

## Recommended: Deploy to Render Instead

Since you already have `render.yaml`, Render is much better suited:

```bash
# 1. Push code to GitHub
git add .
git commit -m "Prepare for deployment"
git push origin main

# 2. Go to render.com
# 3. Click "New +" → "Web Service"
# 4. Connect your GitHub repository
# 5. Render will auto-detect render.yaml
# 6. Add environment variables in Render dashboard
# 7. Click "Create Web Service"
```

**Render Advantages:**
- ✅ No timeout limits for your use case
- ✅ Persistent storage options
- ✅ Better suited for Flask apps
- ✅ Free tier available (with 512MB RAM)
- ✅ Background workers supported
- ✅ Built-in PostgreSQL database option

---

## Support

For Vercel issues:
- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Python Runtime](https://vercel.com/docs/functions/serverless-functions/runtimes/python)
- [Vercel Discord](https://vercel.com/discord)

For application issues:
- Check your deployment logs: `vercel logs`
- Monitor in Vercel dashboard

