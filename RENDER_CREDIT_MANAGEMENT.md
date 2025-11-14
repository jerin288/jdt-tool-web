# Adding Credits to Render Deployment

## Method 1: Using the Remote Script (Recommended)

1. **Set up the admin key on Render:**
   - Go to your Render dashboard
   - Select your web service
   - Go to "Environment" tab
   - Add a new environment variable:
     - Key: `ADMIN_KEY`
     - Value: `your_secure_admin_key_here` (choose a strong password)
   - Click "Save Changes" (this will redeploy your app)

2. **Update the remote script:**
   - Open `add_credits_remote.py`
   - Replace `RENDER_URL` with your actual Render URL (e.g., `https://jdt-tool-web.onrender.com`)
   - Replace `ADMIN_KEY` with the same key you set in Render environment variables

3. **Install requests library (if needed):**
   ```bash
   pip install requests
   ```

4. **Run the script:**
   ```bash
   python add_credits_remote.py
   ```

5. **Follow the prompts:**
   - Choose option 1 to add credits to a specific user
   - Choose option 2 to add credits to all users
   - Enter the amount of credits to add

## Method 2: Using Render Shell

1. Go to your Render dashboard
2. Select your web service
3. Click on "Shell" tab
4. Run the add_credits script:
   ```bash
   python add_credits.py
   ```
5. Follow the interactive prompts

## Method 3: Using curl/Postman

Send a POST request to your admin endpoint:

```bash
curl -X POST https://your-app-name.onrender.com/admin/add_credits \
  -H "Content-Type: application/json" \
  -d '{
    "admin_key": "your_secure_admin_key_here",
    "email": "user@example.com",
    "credits": 50
  }'
```

Or to add credits to all users:

```bash
curl -X POST https://your-app-name.onrender.com/admin/add_credits \
  -H "Content-Type: application/json" \
  -d '{
    "admin_key": "your_secure_admin_key_here",
    "add_to_all": true,
    "credits": 50
  }'
```

## Security Notes

- **Keep your ADMIN_KEY secret!** Don't commit it to GitHub
- Use a strong, random key (at least 32 characters)
- You can generate one with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
- The admin endpoint will reject requests without the correct key

## Deployment Steps

After making these changes, commit and push to deploy:

```bash
git add app.py add_credits_remote.py RENDER_CREDIT_MANAGEMENT.md
git commit -m "Add admin endpoint for credit management"
git push origin main
```

Then set the `ADMIN_KEY` environment variable in Render dashboard.
