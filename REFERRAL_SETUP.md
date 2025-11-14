# 🚀 Referral Credits System - Setup Guide

## What's Been Implemented

✅ **Email Magic Link Authentication** - Passwordless login system
✅ **Referral Credit System** - Users earn +5 credits per successful referral
✅ **Daily Free Credits** - 3 free conversions per day (resets at midnight)
✅ **Credits Tracking** - SQLite database for persistent storage
✅ **Viral Growth Mechanics** - Share links on Twitter, WhatsApp, LinkedIn
✅ **User Dashboard** - View credits, referrals, and conversion history

---

## Configuration Required

### 1. Email Service Setup (Required for Magic Links)

Add these environment variables to Render:

```bash
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-specific-password
MAIL_FROM_EMAIL=noreply@jdpdftoexcel.online
```

#### Gmail Setup Steps:
1. Go to Google Account Settings → Security
2. Enable 2-Step Verification
3. Generate an App Password for "Mail"
4. Use that app password in `MAIL_PASSWORD`

#### Alternative: SendGrid (Recommended for Production)
```bash
MAIL_SERVER=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USERNAME=apikey
MAIL_PASSWORD=your-sendgrid-api-key
MAIL_FROM_EMAIL=noreply@jdpdftoexcel.online
```

---

## How It Works

### For Users:

1. **First Visit** → Click "Login" → Enter email → Receive magic link
2. **New Users** → Get 3 starting credits automatically
3. **Daily Reset** → Credits reset to 3 at midnight if below 3
4. **Referral Bonus** → Share referral link → Friend signs up → Get +5 credits
5. **Unlimited Growth** → No limit on referral credits earned

### Credit System:

- **Free Daily Credits**: 3 conversions/day
- **Referral Reward**: +5 credits per successful signup
- **Credits Never Expire**: Accumulate over time
- **Usage**: 1 credit = 1 PDF conversion

---

## Testing Locally

### 1. Install Dependencies
```bash
cd c:\Users\JERIN\JDT_Tool_Web\data
pip install -r requirements.txt
```

### 2. Set Environment Variables (Windows PowerShell)
```powershell
$env:MAIL_SERVER="smtp.gmail.com"
$env:MAIL_PORT="587"
$env:MAIL_USERNAME="your-email@gmail.com"
$env:MAIL_PASSWORD="your-app-password"
$env:MAIL_FROM_EMAIL="noreply@jdpdftoexcel.online"
```

### 3. Run Application
```bash
python app.py
```

### 4. Test Flow
1. Open http://localhost:5000
2. Click "Login" button
3. Enter your email
4. Check email for magic link
5. Click link to login
6. Try converting a PDF (uses 1 credit)
7. Check "Get More Credits" to see referral link

---

## Deployment to Render

### 1. Update render.yaml (Already Done)
```yaml
services:
  - type: web
    name: jdt-tool-web
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
      - key: SECRET_KEY
        generateValue: true
      - key: MAIL_SERVER
        value: smtp.gmail.com
      - key: MAIL_PORT
        value: 587
      - key: MAIL_USERNAME
        sync: false  # Set in dashboard
      - key: MAIL_PASSWORD
        sync: false  # Set in dashboard
      - key: MAIL_FROM_EMAIL
        value: noreply@jdpdftoexcel.online
```

### 2. Add Environment Variables in Render Dashboard
1. Go to your service → Environment
2. Add `MAIL_USERNAME` (your Gmail address)
3. Add `MAIL_PASSWORD` (your app-specific password)
4. Deploy

### 3. Database Persistence Note
⚠️ **Important**: SQLite file (`jdt_users.db`) is stored in the app directory on Render. 

**Ephemeral Storage**: Render's free tier uses ephemeral storage, so database may reset on deploys.

**For Production**: Consider upgrading to:
- Render PostgreSQL addon ($7/month) - Persistent storage
- Or keep SQLite but accept occasional resets (acceptable for MVP)

---

## Features Included

### 🎯 Core Features
- ✅ Email magic link authentication
- ✅ 3 daily free conversion credits
- ✅ +5 credits per referral signup
- ✅ Credits badge in header
- ✅ User menu with logout
- ✅ Out-of-credits modal with share buttons

### 📊 Referral Dashboard
- ✅ Available credits display
- ✅ Total referrals count
- ✅ Credits earned from referrals
- ✅ Referral link with copy button
- ✅ Social share buttons (Twitter, WhatsApp, LinkedIn)
- ✅ List of referred users

### 🔒 Security
- ✅ Magic link tokens expire in 15 minutes
- ✅ User isolation (only see own data)
- ✅ Credit refunds on conversion errors
- ✅ Referral abuse prevention (same email check)

---

## User Growth Strategy

### Viral Loop Design:
1. User converts PDF → Uses credit
2. Runs out of credits → See "Share for +5 credits" modal
3. Shares referral link on social media
4. Friends sign up → User gets +5 credits
5. Cycle repeats

### Growth Multiplier:
- Average user refers 2 friends = 10 credits earned
- Each friend refers 2 more = Exponential growth
- Target: 100 users → 200 referrals → 400 users in 30 days

---

## Monitoring & Analytics

### Track These Metrics:
1. **Signup Rate**: How many new users per day
2. **Referral Conversion**: % of users who refer others
3. **Credit Usage**: Average conversions per user
4. **Viral Coefficient**: (Referrals per user) × (Conversion rate)

### Access User Data:
```python
# In Python console or create admin endpoint
from app import db, User, ReferralLog, Conversion

# Total users
User.query.count()

# Total referrals
ReferralLog.query.filter_by(credited=True).count()

# Total conversions
Conversion.query.count()

# Top referrers
db.session.query(User.email, db.func.count(ReferralLog.id))\
    .join(ReferralLog, User.id == ReferralLog.referrer_id)\
    .group_by(User.email)\
    .order_by(db.func.count(ReferralLog.id).desc())\
    .limit(10).all()
```

---

## Troubleshooting

### Issue: Magic link emails not sending
**Solution**: 
- Check Gmail App Password is correct
- Enable "Less secure app access" (if needed)
- Check Render logs for email errors
- Try SendGrid instead (more reliable)

### Issue: Database resets on Render deploy
**Solution**: 
- Expected behavior with SQLite on ephemeral storage
- Upgrade to Render PostgreSQL for persistence
- Or accept resets for MVP phase

### Issue: Credits not updating
**Solution**:
- Check browser console for API errors
- Verify user is logged in
- Check `/api/credits` endpoint response

### Issue: Referral not credited
**Solution**:
- Ensure referee used referral link before signup
- Check ReferralLog table for entry
- Verify `credited=True` flag

---

## Next Steps (Optional Enhancements)

### Phase 2 Features:
1. **Email Notifications**: Send confirmation when someone uses your referral
2. **Leaderboard**: Show top 10 referrers with bonus rewards
3. **Milestone Rewards**: 10 referrals = 50 bonus credits
4. **Weekly Digest**: Email with credits earned and usage stats
5. **Paid Tier**: ₹99/month for unlimited conversions (upgrade path)

### Phase 3 Features:
1. **PostgreSQL Migration**: For persistent data
2. **Admin Dashboard**: View all users, credits, referrals
3. **Analytics Dashboard**: Charts and growth metrics
4. **Email Campaigns**: Automated drip campaigns
5. **A/B Testing**: Test different referral incentives

---

## Support

**Questions?** Open an issue on GitHub
**Updates?** Check this file for configuration changes

---

**Implementation Complete!** 🎉

All code changes are done. Just configure email environment variables and deploy to Render.

**Estimated Setup Time**: 15 minutes
**Ready for Production**: Yes (with email config)
