# Migration from Email Magic Links to Google OAuth

## What Changed

### Authentication Method
- **Before**: Email magic link authentication (non-functional on Render due to SMTP blocking)
- **After**: Google OAuth 2.0 authentication (works on all platforms, no email needed)

### Files Modified

#### 1. requirements.txt
- **Removed**: `Flask-Mail==0.9.1`, `itsdangerous==2.1.2`
- **Added**: `authlib==1.2.1`, `requests==2.31.0`

#### 2. app.py
- **Removed imports**: `Flask-Mail`, `Message`, `URLSafeTimedSerializer`
- **Added imports**: `authlib.integrations.flask_client.OAuth`, `requests`
- **Removed config**: All `MAIL_*` configuration variables
- **Added config**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- **Removed routes**: 
  - `/auth/send-magic-link` (POST) - Sent email with magic link
  - `/auth/verify/<token>` (GET) - Verified magic link token
- **Added routes**:
  - `/auth/google/login` (GET) - Initiates Google OAuth flow
  - `/auth/google/callback` (GET) - Handles OAuth callback and creates/logs in user
- **Kept route**: `/auth/logout` (POST) - Unchanged

#### 3. templates/index.html
- **Removed**: Email input form, referral code input, "Send Login Link" button
- **Added**: "Sign in with Google" button with Google logo SVG

#### 4. static/style.css
- **Added**: Google button styles (`.google-btn`, `.google-icon`)

#### 5. static/script.js
- **Removed**: Email form submission handler (`loginForm.addEventListener('submit')`)
- **Added**: Google OAuth redirect handler for `googleSignInBtn`
- Referral code now passed via URL query parameter to OAuth flow

#### 6. render.yaml
- **Removed**: `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_EMAIL`
- **Added**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`

## Benefits of Google OAuth

✅ **No SMTP Issues**: Uses HTTPS API calls, not blocked by Render  
✅ **Better UX**: One-click login, no need to check email  
✅ **Faster**: Instant login vs waiting for email  
✅ **More Secure**: Leverages Google's security infrastructure  
✅ **100% Free**: No email service costs  
✅ **Works Everywhere**: No platform restrictions

## Deployment Steps

### 1. Install Dependencies Locally (Optional)
```powershell
pip install authlib==1.2.1 requests==2.31.0
```

### 2. Create Google OAuth Credentials
Follow the guide in `GOOGLE_OAUTH_SETUP.md`:
1. Create Google Cloud project
2. Enable Google+ API
3. Configure OAuth consent screen
4. Create OAuth client ID
5. Get Client ID and Client Secret

### 3. Test Locally (Optional)
```powershell
$env:GOOGLE_CLIENT_ID="your-client-id-here"
$env:GOOGLE_CLIENT_SECRET="your-client-secret-here"
python app.py
```
Visit http://localhost:5000 and test Google Sign In

### 4. Push to Git
```powershell
git add .
git commit -m "Replace email auth with Google OAuth"
git push origin main
```

### 5. Configure Render Environment Variables
1. Go to Render Dashboard → jdt-tool-web service
2. Environment tab
3. Add two variables:
   - `GOOGLE_CLIENT_ID` = (your Client ID from Google Cloud)
   - `GOOGLE_CLIENT_SECRET` = (your Client Secret from Google Cloud)
4. Save Changes (auto-deploys)

### 6. Verify Production
Visit https://jdpdftoexcel.online and click "Sign in with Google"

## Referral System - Still Works!

The referral credit system is **fully preserved**:
- New users still get 3 free credits
- Daily reset still works (3 credits per day)
- Referrals still award +5 credits to referrer
- Referral codes still tracked in database
- Share link format: `https://jdpdftoexcel.online?ref=ABC12345`

The only change is HOW users authenticate - now via Google instead of email.

## Rollback Plan (If Needed)

If you need to rollback to email authentication:
```powershell
git revert HEAD
git push origin main
```

Then re-configure email environment variables in Render dashboard.

## Database - No Changes Required

The User model and database schema are **unchanged**:
- Email field still stores user's Google account email
- Referral codes still work the same way
- Credits system untouched
- No database migration needed

## Testing Checklist

After deployment, test:
- [ ] Click "Sign in with Google" button
- [ ] Google OAuth flow completes successfully
- [ ] User is created in database with correct email
- [ ] User sees correct credit count (3 for new users)
- [ ] Upload and convert a PDF (deducts 1 credit)
- [ ] Daily reset works (next day, credits reset to 3)
- [ ] Referral link works: `?ref=YOURCODE`
- [ ] New referred user gives referrer +5 credits
- [ ] Logout works correctly
- [ ] Referral dashboard displays stats correctly

## Troubleshooting

### "redirect_uri_mismatch" error
- Check authorized redirect URI in Google Cloud Console
- Must be exactly: `https://jdpdftoexcel.online/auth/google/callback`

### "invalid_client" error
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Render
- Make sure no extra spaces when copying

### User not logged in after OAuth
- Check browser console for errors
- Verify `SECRET_KEY` is set in Render
- Check Flask session configuration

### Credits not appearing
- Check database by adding print statements in `/api/credits` route
- Verify user is actually logged in (`current_user.is_authenticated`)

---

**Summary**: We switched from email magic links (broken on Render) to Google OAuth (works everywhere). All referral credit functionality is preserved. Just need to add Google OAuth credentials to Render and it will work!
