// ============================================================
// THINK AI SOLUTIONS — WATI WEBHOOK HANDLER
// ============================================================
// Deploy this on any Node.js server (Railway, Render, etc.)
// Set this URL in WATI dashboard → Settings → Webhook URL
// ============================================================

const express = require('express');
const app = express();
app.use(express.json());

// ============================================================
// CONFIG — fill these in
// ============================================================
const CONFIG = {
  WATI_API_KEY: process.env.WATI_API_KEY || 'YOUR_WATI_API_KEY',
  WATI_BASE_URL: process.env.WATI_BASE_URL || 'https://live-server-XXXXX.wati.io',
  MAKE_NEGATIVE_WEBHOOK: process.env.MAKE_WEBHOOK || 'https://hook.eu1.make.com/YOUR_ID',
  PORT: process.env.PORT || 3000,
};

// ============================================================
// IN-MEMORY STORE (replace with a real DB later)
// Stores pending review requests: phone → {business, googleLink, ownerPhone}
// ============================================================
const pendingRequests = new Map();

// ============================================================
// ROUTE 1 — Store a new review request (called by Bubble)
// POST /api/send-request
// Body: { customer_name, customer_phone, business_name, google_link, owner_phone }
// ============================================================
app.post('/api/send-request', async (req, res) => {
  const { customer_name, customer_phone, business_name, google_link, owner_phone } = req.body;

  if (!customer_phone || !business_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const phone = customer_phone.replace(/\D/g, ''); // strip non-digits

  // Store context for when customer replies
  pendingRequests.set(phone, {
    customer_name,
    business_name,
    google_link,
    owner_phone,
    sent_at: new Date().toISOString()
  });

  // Send WhatsApp template via WATI
  try {
    const response = await fetch(`${CONFIG.WATI_BASE_URL}/api/v1/sendTemplateMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.WATI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template_name: 'post_visit_feedback',
        broadcast_name: `review_${Date.now()}`,
        receivers: [{
          whatsappNumber: phone,
          customParams: [
            { name: '1', value: customer_name || 'there' },
            { name: '2', value: business_name },
          ]
        }]
      })
    });

    const data = await response.json();
    console.log(`[SENT] ${customer_name} (${phone}) — ${business_name}`);
    res.json({ success: true, wati_response: data });

  } catch (err) {
    console.error('[ERROR] Send request failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ROUTE 2 — WATI Webhook (incoming WhatsApp messages)
// POST /webhook/wati
// Set this URL in WATI → Settings → Webhook
// ============================================================
app.post('/webhook/wati', async (req, res) => {
  res.sendStatus(200); // Always respond 200 immediately to WATI

  const event = req.body;

  // Only process incoming messages
  if (event.type !== 'message' || event.message?.type !== 'button') return;

  const phone = event.waId; // customer's phone number
  const buttonText = event.message?.button?.text || '';
  const context = pendingRequests.get(phone);

  if (!context) {
    console.log(`[SKIP] No pending request for ${phone}`);
    return;
  }

  console.log(`[REPLY] ${phone} tapped: "${buttonText}"`);

  // The button text maps to positive or negative
  const isPositive = buttonText.toLowerCase().includes('great');

  if (isPositive) {
    await handlePositive(phone, context);
  } else {
    await handleNegative(phone, context);
  }

  // Clean up after handling
  pendingRequests.delete(phone);
});

// ============================================================
// HANDLE POSITIVE — send Google review link
// ============================================================
async function handlePositive(phone, context) {
  try {
    const message = `Thank you so much! 🙏\n\nWould you mind leaving us a quick Google review? It takes just 30 seconds and means the world to us!\n\n👉 ${context.google_link}`;

    await sendWatiMessage(phone, message);
    console.log(`[POSITIVE] Sent Google link to ${phone}`);

  } catch (err) {
    console.error('[ERROR] handlePositive:', err.message);
  }
}

// ============================================================
// HANDLE NEGATIVE — send private form link + alert business owner
// ============================================================
async function handleNegative(phone, context) {
  try {
    // 1. Send private feedback form link to customer
    const negativeFormUrl = `https://YOUR-NETLIFY-SITE.netlify.app/negative.html?biz=${encodeURIComponent(context.business_name)}&wa=${context.owner_phone}`;
    const customerMsg = `We're really sorry to hear that 😔\n\nPlease tell us what went wrong — we'll make it right:\n\n👉 ${negativeFormUrl}\n\nYour feedback goes directly to the owner, not Google.`;

    await sendWatiMessage(phone, customerMsg);

    // 2. Alert the business owner on WhatsApp
    const ownerMsg = `⚠️ *Negative Feedback Alert!*\n\n*Business:* ${context.business_name}\n*Customer phone:* +${phone}\n*Customer:* ${context.customer_name || 'Unknown'}\n\n🔴 They tapped "Could be better". Follow up immediately!\n\nThink AI Solutions`;

    if (context.owner_phone) {
      await sendWatiMessage(context.owner_phone.replace(/\D/g, ''), ownerMsg);
    }

    // 3. Trigger Make.com for logging (optional)
    await fetch(CONFIG.MAKE_NEGATIVE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_name: context.business_name,
        customer_phone: phone,
        customer_name: context.customer_name,
        owner_phone: context.owner_phone,
        timestamp: new Date().toISOString()
      })
    }).catch(() => {}); // Don't fail if Make.com is down

    console.log(`[NEGATIVE] Alerted owner for ${phone} — ${context.business_name}`);

  } catch (err) {
    console.error('[ERROR] handleNegative:', err.message);
  }
}

// ============================================================
// HELPER — send a plain text WATI message
// ============================================================
async function sendWatiMessage(phone, message) {
  const response = await fetch(`${CONFIG.WATI_BASE_URL}/api/v1/sendSessionMessage/${phone}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.WATI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messageText: message })
  });
  return response.json();
}

// ============================================================
// ROUTE 3 — Health check
// ============================================================
app.get('/', (req, res) => {
  res.json({
    status: 'Think AI Solutions webhook server running',
    pending_requests: pendingRequests.size,
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(CONFIG.PORT, () => {
  console.log(`Think AI Solutions webhook server running on port ${CONFIG.PORT}`);
});

// ============================================================
// DEPLOYMENT — deploy this free on Railway.app
// 1. Go to railway.app → New Project → Deploy from GitHub
// 2. Upload this file as server.js
// 3. Add package.json (below)
// 4. Set environment variables in Railway dashboard
// 5. Railway gives you a public URL → paste in WATI webhook settings
// ============================================================

/*
package.json:
{
  "name": "think-ai-webhook",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": { "start": "node server.js" },
  "dependencies": { "express": "^4.18.2" }
}
*/

/*
Environment variables to set in Railway:
WATI_API_KEY=your_actual_wati_api_key
WATI_BASE_URL=https://live-server-XXXXX.wati.io
MAKE_WEBHOOK=https://hook.eu1.make.com/your_scenario_id
PORT=3000
*/
