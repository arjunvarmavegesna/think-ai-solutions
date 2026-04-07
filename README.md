# Think AI Solutions — Complete Setup Guide

## Files in this folder

| File | What it is |
|------|------------|
| dashboard.html | Client-facing dashboard (all 5 screens) |
| webhook-server.js | Node.js server that handles WhatsApp replies |
| make-automation.js | Make.com scenario configs + setup guide |
| ../review-pages/positive.html | Page customer lands on after tapping "Great" |
| ../review-pages/negative.html | Page customer lands on after tapping "Not Great" |

---

## Week 1 — Accounts setup

1. **WATI** → wati.io → Start free trial → Register your Jio SIM number
2. **Make.com** → make.com → Free account → You'll use this in Week 2
3. **Bubble.io** → bubble.io → Free account → You'll build dashboard here in Week 3
4. **Netlify** → netlify.com → Drag and drop the review-pages folder → Get public URL
5. **Railway** → railway.app → Deploy webhook-server.js → Get public URL

---

## Week 2 — Deploy webhook server

1. Create a GitHub repo
2. Upload webhook-server.js and package.json
3. Go to Railway → New Project → Connect GitHub repo
4. Add environment variables:
   - WATI_API_KEY (from WATI → Settings → API)
   - WATI_BASE_URL (your WATI server URL)
5. Railway gives you URL like: https://think-ai-webhook.railway.app
6. Paste this URL in WATI → Settings → Webhook URL

---

## Week 2 — Submit WhatsApp template

Go to WATI → Templates → Create New:

Category: UTILITY

Body:
Hi {{1}}! 👋

Thank you for visiting {{2}} today.

How was your experience?

Button 1: "⭐ Great experience"
URL: https://YOUR-NETLIFY-SITE.netlify.app/positive.html?biz={{2}}&link=GOOGLE_LINK

Button 2: "😕 Could be better"  
URL: https://YOUR-NETLIFY-SITE.netlify.app/negative.html?biz={{2}}&wa=919391714623

Submit → Wait 2-3 days

---

## Week 3 — Build Bubble dashboard

1. Open Bubble.io → New app
2. Create these pages:
   - index (login)
   - dashboard
   - send
   - settings
3. In each page, build the screens from dashboard.html as reference
4. Connect "Send" button to your Railway webhook URL:
   POST https://think-ai-webhook.railway.app/api/send-request
   Body: { customer_name, customer_phone, business_name, google_link, owner_phone }

---

## Week 4 — Test the full flow

Test flow on your own phone:
1. Enter your number in dashboard → click Send
2. Receive WhatsApp on your phone
3. Tap "Great experience" → positive.html should open → Google button works ✅
4. Repeat → Tap "Could be better" → negative.html opens → fill form → you get WhatsApp alert ✅

---

## Cost summary

| Tool | Cost |
|------|------|
| Jio SIM | ₹10 one time |
| WATI (after trial) | ₹3,000/month |
| Railway hosting | Free tier |
| Netlify hosting | Free tier |
| Make.com | Free tier |
| Bubble.io | Free tier |
| **Total** | **₹3,010/month** |

Break even: Just 4 clients at ₹799 = ₹3,196/month ✅
