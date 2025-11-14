# Google OAuth Setup Guide

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Project name: `JDT PDF Converter`
4. Click "Create"

## Step 2: Enable Google+ API

1. In the left menu, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and click "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select "External" user type → Click "Create"
3. Fill in required fields:
   - **App name**: JDT PDF to Excel Converter
   - **User support email**: Jerinad123@gmail.com
   - **Developer contact**: Jerinad123@gmail.com
4. Click "Save and Continue"
5. On "Scopes" page, click "Add or Remove Scopes"
   - Select: `.../auth/userinfo.email`
   - Select: `.../auth/userinfo.profile`
   - Select: `openid`
6. Click "Update" → "Save and Continue"
7. On "Test users" page, add your email: `Jerinad123@gmail.com`
8. Click "Save and Continue" → "Back to Dashboard"

## Step 4: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: **Web application**
4. Name: `JDT PDF Converter`
5. **Authorized JavaScript origins**:
   - Add: `https://jdpdftoexcel.online`
   - Add: `http://localhost:5000` (for local testing)
6. **Authorized redirect URIs**:
   - Add: `https://jdpdftoexcel.online/auth/google/callback`
   - Add: `http://localhost:5000/auth/google/callback` (for local testing)
7. Click "Create"

## Step 5: Copy Credentials

You'll see a dialog with:
- **Client ID** (looks like: `123456789-abc123def456.apps.googleusercontent.com`)
- **Client Secret** (looks like: `GOCSPX-abc123def456_xyz789`)

**Copy both values!**

## Step 6: Add Credentials to Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Select your `jdt-tool-web` service
3. Go to "Environment" tab
4. Add these environment variables:
   - **Key**: `GOOGLE_CLIENT_ID`
     - **Value**: Paste your Client ID
   - **Key**: `GOOGLE_CLIENT_SECRET`
     - **Value**: Paste your Client Secret
5. Click "Save Changes"

Render will automatically redeploy with the new credentials.

## Step 7: Test Locally (Optional)

If you want to test on localhost first:

1. Set environment variables in PowerShell:
   ```powershell
   $env:GOOGLE_CLIENT_ID="your-client-id"
   $env:GOOGLE_CLIENT_SECRET="your-client-secret"
   $env:FLASK_APP="app.py"
   python -m flask run
   ```

2. Visit: http://localhost:5000
3. Click "Sign in with Google"
4. Test the OAuth flow

## Step 8: Verify Production

1. Visit: https://jdpdftoexcel.online
2. Click "Sign in with Google"
3. Select your Google account
4. You should be logged in and see your credits!

## Troubleshooting

### Error: "redirect_uri_mismatch"
- Make sure you added the exact redirect URI: `https://jdpdftoexcel.online/auth/google/callback`
- Check for typos (http vs https, trailing slashes)

### Error: "Access blocked: This app's request is invalid"
- Make sure you enabled Google+ API
- Check OAuth consent screen is configured
- Add yourself as a test user

### Error: "invalid_client"
- Double-check Client ID and Client Secret in Render
- Make sure no extra spaces when copying

## Publishing the App (Optional - For Public Use)

Currently the app is in "Testing" mode (only you can log in). To allow anyone to log in:

1. Go to "OAuth consent screen"
2. Click "Publish App"
3. Click "Confirm"

Note: Google may require verification if you publish the app. For personal use, "Testing" mode is fine.

---

## Summary

You need TWO things from Google Cloud Console:
1. **GOOGLE_CLIENT_ID** → Add to Render Environment Variables
2. **GOOGLE_CLIENT_SECRET** → Add to Render Environment Variables

Once added, your app will use Google OAuth instead of email magic links!
