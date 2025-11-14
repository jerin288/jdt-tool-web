# 🌐 Domain Setup Guide - jdpdftoexcel.online

## Domain Configuration Steps

### Step 1: Railway Dashboard Configuration

1. **Login to Railway Dashboard**
   - Go to https://railway.app
   - Select your `jdt-tool-web` project

2. **Add Custom Domain**
   - Click on your service
   - Go to "Settings" tab
   - Scroll to "Domains" section
   - Click "Add Domain"
   - Enter: `jdpdftoexcel.online`
   - Click "Add Domain"

3. **Get Railway DNS Details**
   Railway will provide you with:
   - A CNAME record target (usually: `your-app.up.railway.app`)
   - Or an A record IP address

---

### Step 2: Domain Registrar DNS Configuration

Configure your DNS settings at your domain registrar where you purchased `jdpdftoexcel.online`:

#### Option A: CNAME Record (Recommended)
```
Type: CNAME
Name: @ (or root)
Value: your-app.up.railway.app (from Railway)
TTL: 3600 (or Auto)
```

#### Option B: A Record (Alternative)
```
Type: A
Name: @ (or root)
Value: [IP address from Railway]
TTL: 3600 (or Auto)
```

#### WWW Subdomain (Optional but Recommended)
```
Type: CNAME
Name: www
Value: jdpdftoexcel.online
TTL: 3600 (or Auto)
```

---

### Step 3: SSL/HTTPS Configuration

Railway automatically provides SSL certificates:
- ✅ Free SSL certificate via Let's Encrypt
- ✅ Auto-renewal
- ✅ HTTPS enabled by default
- ✅ HTTP to HTTPS redirect

**No additional configuration needed!**

---

## DNS Propagation

⏱️ **Waiting Time:**
- DNS changes can take 5 minutes to 48 hours to propagate globally
- Usually completes within 1-2 hours
- Check status: https://dnschecker.org

**Check Propagation:**
```bash
# Windows PowerShell
nslookup jdpdftoexcel.online

# Or use online tool
# Visit: https://dnschecker.org
```

---

## Verification Steps

### 1. Test Domain Access
Once DNS propagates:
- Visit: https://jdpdftoexcel.online
- Should redirect to your Railway app
- SSL should be active (🔒 lock icon in browser)

### 2. Check Both Versions
- https://jdpdftoexcel.online (main domain)
- https://www.jdpdftoexcel.online (www subdomain, if configured)

### 3. Verify HTTPS
- URL should show `https://` not `http://`
- Click lock icon to view certificate
- Should be valid and issued by Let's Encrypt

---

## Common Domain Registrars - Specific Instructions

### GoDaddy
1. Go to Domain Settings → Manage DNS
2. Add/Edit DNS Records as shown above
3. Save changes

### Namecheap
1. Go to Domain List → Manage
2. Advanced DNS tab
3. Add DNS records
4. Save changes

### Cloudflare (If using)
1. DNS tab in Cloudflare dashboard
2. Add DNS records
3. Set proxy status to "DNS only" (gray cloud) initially
4. After verification, can enable proxy (orange cloud)

### Google Domains
1. DNS tab
2. Custom records section
3. Add records as shown above

---

## Troubleshooting

### Domain Not Working After 24 Hours
1. **Verify DNS Records:**
   ```bash
   nslookup jdpdftoexcel.online
   ```
2. **Check Railway Dashboard:**
   - Domain shows as "Active"
   - No error messages

3. **Clear DNS Cache:**
   ```bash
   ipconfig /flushdns
   ```

### SSL Certificate Issues
- Railway handles this automatically
- If issues persist, remove and re-add domain in Railway
- Wait 10-15 minutes for certificate generation

### WWW vs Non-WWW
- Both should work if configured
- Railway can handle both automatically
- Set up redirect in Railway if needed

---

## Update Application URLs

After domain is live, update these locations:

### 1. README.md ✅
Already updated with: https://jdpdftoexcel.online

### 2. Social Media / Marketing Materials
Update any promotional materials with new domain

### 3. Google Search Console (Optional)
- Add property: https://jdpdftoexcel.online
- Submit sitemap if needed
- Verify ownership

### 4. Analytics (If using)
- Update Google Analytics domain
- Update any tracking pixels

---

## Security Recommendations

### 1. Enable HTTPS Only
Railway does this automatically ✅

### 2. Security Headers (Optional Enhancement)
Add to `app.py` if desired:

```python
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response
```

### 3. Regular Updates
- Keep dependencies updated: `pip install --upgrade -r requirements.txt`
- Monitor Railway logs for any issues

---

## Monitoring

### Check Application Health
- Visit: https://jdpdftoexcel.online/health (if health endpoint exists)
- Monitor Railway dashboard for errors
- Check Railway logs for any issues

### Set Up Uptime Monitoring (Optional)
Free services:
- UptimeRobot: https://uptimerobot.com
- Pingdom: https://www.pingdom.com
- StatusCake: https://www.statuscake.com

---

## Quick Reference

| Item | Value |
|------|-------|
| Domain | jdpdftoexcel.online |
| Primary URL | https://jdpdftoexcel.online |
| WWW URL | https://www.jdpdftoexcel.online |
| SSL Provider | Let's Encrypt (via Railway) |
| Hosting | Railway |
| DNS TTL | 3600 seconds (1 hour) |

---

## Next Steps

1. ✅ Configure DNS records at your registrar
2. ⏱️ Wait for DNS propagation (1-2 hours typically)
3. ✅ Verify domain works: https://jdpdftoexcel.online
4. ✅ Test all features on live domain
5. 📢 Share your new domain!

---

## Support

**Railway Support:**
- Docs: https://docs.railway.app
- Discord: https://discord.gg/railway

**DNS Issues:**
- Contact your domain registrar's support
- Use DNS checker: https://dnschecker.org

---

*Last Updated: November 14, 2025*
