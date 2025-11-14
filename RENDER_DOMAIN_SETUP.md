# 🌐 Render Domain Setup - jdpdftoexcel.online

## Render Custom Domain Configuration

### Step 1: Deploy to Render (If not already deployed)

1. **Connect GitHub Repository**
   - Login to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository: `jerin288/jdt-tool-web`
   - Render will auto-detect the `render.yaml` configuration

2. **Verify Deployment**
   - Wait for initial deployment to complete
   - Note your Render URL (e.g., `jdt-tool-web.onrender.com`)
   - Test that the app works on this URL

---

### Step 2: Add Custom Domain in Render

1. **Navigate to Settings**
   - Go to your service dashboard
   - Click "Settings" tab
   - Scroll to "Custom Domain" section

2. **Add Domain**
   - Click "Add Custom Domain"
   - Enter: `jdpdftoexcel.online`
   - Click "Save"

3. **Add WWW Subdomain (Optional)**
   - Click "Add Custom Domain" again
   - Enter: `www.jdpdftoexcel.online`
   - Click "Save"

4. **Copy DNS Instructions**
   Render will provide specific DNS records. Typically:
   - **For root domain (@):**
     - Type: `A` or `CNAME`
     - Value: Provided by Render
   - **For www subdomain:**
     - Type: `CNAME`
     - Value: Your Render URL or specified target

---

### Step 3: Configure DNS at Your Registrar

Go to your domain registrar where you bought `jdpdftoexcel.online`:

#### DNS Records to Add:

**Root Domain (jdpdftoexcel.online):**
```
Type: A
Name: @
Value: [IP address from Render]
TTL: 3600
```

**OR if Render provides CNAME:**
```
Type: CNAME
Name: @
Value: [CNAME target from Render]
TTL: 3600
```

**WWW Subdomain:**
```
Type: CNAME
Name: www
Value: jdt-tool-web.onrender.com (or as specified by Render)
TTL: 3600
```

---

### Step 4: SSL/HTTPS Configuration

✅ **Automatic SSL Certificate:**
- Render provides free SSL certificates via Let's Encrypt
- Automatically enabled for custom domains
- Auto-renewal handled by Render
- HTTPS redirect enabled by default

**Certificate Status:**
- Check in Render Dashboard → Settings → Custom Domain
- Status should show "Certificate Active"
- May take 5-10 minutes after DNS propagation

---

## DNS Propagation & Verification

### Check DNS Propagation
```powershell
# Check DNS resolution
nslookup jdpdftoexcel.online

# Or use online tool
# https://dnschecker.org
```

⏱️ **Typical Wait Time:** 15 minutes to 48 hours (usually 1-2 hours)

### Verify Domain Works
1. Visit: https://jdpdftoexcel.online
2. Check SSL certificate (🔒 lock icon)
3. Test all app features
4. Verify www subdomain (if configured)

---

## Common Registrar Instructions

### GoDaddy
1. My Products → Domain Settings
2. DNS → Manage Zones
3. Add/Edit records as shown above

### Namecheap
1. Domain List → Manage
2. Advanced DNS
3. Add new records

### Cloudflare
1. DNS tab
2. Add DNS records
3. ⚠️ Set Proxy status to "DNS only" (gray cloud) initially
4. After verification, can enable proxy (orange cloud)

### Google Domains / Squarespace
1. DNS settings
2. Custom records
3. Add records as specified

---

## Render-Specific Features

### Health Checks
Render automatically monitors your service:
- Default: HTTP GET to `/`
- Configure custom health check in Settings if needed

### Auto-Deploy
Render auto-deploys when you push to GitHub:
```bash
git add .
git commit -m "Update for custom domain"
git push origin main
```

### Environment Variables
Already configured in `render.yaml`:
- `PYTHON_VERSION`: 3.11.0
- `SECRET_KEY`: Auto-generated

### Free Tier Considerations
- Free tier services spin down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- Upgrade to paid tier for always-on service

---

## Troubleshooting

### Domain Not Resolving
1. **Verify DNS Records:**
   ```powershell
   nslookup jdpdftoexcel.online
   ```
2. **Check Render Dashboard:**
   - Custom Domain section shows "Active"
   - No error messages
3. **Clear DNS Cache:**
   ```powershell
   ipconfig /flushdns
   ```

### SSL Certificate Pending
- Wait 10-15 minutes after DNS propagates
- Render auto-generates certificate
- Check status in Custom Domain section
- If stuck, try removing and re-adding domain

### 502/503 Errors
- Service may be spinning up (free tier)
- Check Render logs for errors
- Verify `gunicorn app:app` command works

### Domain Shows Old Content
- Clear browser cache: Ctrl+Shift+Delete
- Try incognito/private mode
- Check if DNS is fully propagated

---

## Performance Optimization

### 1. Keep Service Warm (Paid Tier)
Upgrade to prevent spin-downs

### 2. Enable Caching
Add caching headers in `app.py`:
```python
@app.after_request
def add_cache_headers(response):
    if request.path.startswith('/static/'):
        response.headers['Cache-Control'] = 'public, max-age=31536000'
    return response
```

### 3. Monitor Performance
- Use Render's built-in metrics
- Check response times
- Monitor resource usage

---

## Security Best Practices

### 1. HTTPS Only ✅
Render enforces HTTPS automatically

### 2. Security Headers
Add to `app.py`:
```python
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000'
    return response
```

### 3. Keep Dependencies Updated
```bash
pip install --upgrade -r requirements.txt
pip freeze > requirements.txt
```

---

## Monitoring & Maintenance

### Render Dashboard
Monitor:
- Deployment status
- Service logs
- Resource usage
- Custom domain status

### Uptime Monitoring (Optional)
Free services:
- UptimeRobot: https://uptimerobot.com
- Pingdom: https://www.pingdom.com
- StatusCake: https://www.statuscake.com

### Log Monitoring
View logs in Render Dashboard:
- Click on your service
- Go to "Logs" tab
- Filter by time/severity

---

## Quick Reference

| Setting | Value |
|---------|-------|
| **Domain** | jdpdftoexcel.online |
| **Platform** | Render |
| **Service Name** | jdt-tool-web |
| **Default URL** | jdt-tool-web.onrender.com |
| **Custom URL** | https://jdpdftoexcel.online |
| **SSL Provider** | Let's Encrypt (via Render) |
| **Python Version** | 3.11.0 |
| **Start Command** | gunicorn app:app |

---

## Complete Setup Checklist

- [ ] Deploy service to Render
- [ ] Verify app works on Render URL
- [ ] Add custom domain in Render Dashboard
- [ ] Configure DNS records at registrar
- [ ] Wait for DNS propagation (1-2 hours)
- [ ] Verify SSL certificate active
- [ ] Test https://jdpdftoexcel.online
- [ ] Test all app features on custom domain
- [ ] Set up monitoring (optional)
- [ ] Update documentation with live URL ✅

---

## Support Resources

**Render Documentation:**
- Custom Domains: https://render.com/docs/custom-domains
- DNS Configuration: https://render.com/docs/dns-configuration
- SSL Certificates: https://render.com/docs/tls

**Render Support:**
- Community: https://community.render.com
- Support: support@render.com
- Status Page: https://status.render.com

---

*Last Updated: November 14, 2025*
