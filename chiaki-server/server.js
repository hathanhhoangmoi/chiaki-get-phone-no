const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const app     = express();

app.use(cors());
app.use(express.json());

// ===================================================
// PERSISTENT DISK — toàn bộ data lưu tại đây
// ===================================================
const DATA_DIR  = '/opt/render/project/src/data';
const USAGE_DB  = path.join(DATA_DIR, 'usage.json');
const ORDERS_DB = path.join(DATA_DIR, 'orders_db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ===================================================
// KEYS (Chỉ bạn thấy trên server)
// ===================================================
const KEYS = {
  "HOANG-0711-2000-2018": 999,
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
};

// ===================================================
// USAGE HELPERS (giữ nguyên logic cũ)
// ===================================================
function loadUsage() {
  try { return JSON.parse(fs.readFileSync(USAGE_DB)); }
  catch (e) { return {}; }
}
function saveUsage(data) {
  fs.writeFileSync(USAGE_DB, JSON.stringify(data, null, 2));
}

// ===================================================
// ORDERS HELPERS (mới)
// ===================================================
function loadOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS_DB)); }
  catch (e) { return {}; } // { [key]: [orders] }
}
function saveOrders(data) {
  fs.writeFileSync(ORDERS_DB, JSON.stringify(data, null, 2));
}

// ===================================================
// API 1: Validate key (giữ nguyên)
// ===================================================
app.post('/validate', (req, res) => {
  const { key } = req.body;
  if (!key || !KEYS[key]) return res.json({ valid: false, message: '❌ Key không hợp lệ!' });

  const usage     = loadUsage();
  const used      = usage[key] || 0;
  const limit     = KEYS[key];
  const remaining = limit - used;

  if (remaining <= 0) return res.json({ valid: false, message: '❌ Key đã hết lượt!' });
  res.json({ valid: true, used, limit, remaining });
});

// ===================================================
// API 2: Trừ 1 lượt (giữ nguyên)
// ===================================================
app.post('/consume', (req, res) => {
  const { key } = req.body;
  if (!key || !KEYS[key]) return res.json({ success: false, message: 'Key không hợp lệ' });

  const usage = loadUsage();
  const used  = (usage[key] || 0) + 1;
  const limit = KEYS[key];

  if (used > limit) return res.json({ success: false, message: '❌ Hết lượt!' });

  usage[key] = used;
  saveUsage(usage);
  res.json({ success: true, used, limit, remaining: limit - used });
});

// ===================================================
// API 3: Check lượt còn lại (giữ nguyên)
// ===================================================
app.post('/usage', (req, res) => {
  const { key } = req.body;
  if (!key || !KEYS[key]) return res.json({ valid: false });

  const usage = loadUsage();
  const used  = usage[key] || 0;
  const limit = KEYS[key];
  res.json({ valid: true, used, limit, remaining: limit - used });
});

// ===================================================
// API 4: Lưu đơn hàng từ Extension (mới)
// ===================================================
app.post('/save-order', (req, res) => {
  const { key, order } = req.body;
  if (!key || !order || !order.code) return res.json({ success: false });
  if (!KEYS[key]) return res.json({ success: false, message: 'Key không hợp lệ' });

  const db = loadOrders();
  if (!db[key]) db[key] = [];

  const idx = db[key].findIndex(o => o.code === order.code);
  if (idx >= 0) {
    if (order.phone && !db[key][idx].phone) db[key][idx].phone = order.phone;
  } else {
    db[key].unshift({ ...order, savedAt: new Date().toISOString() });
    if (db[key].length > 1000) db[key] = db[key].slice(0, 1000);
  }

  saveOrders(db);
  res.json({ success: true });
});

// ===================================================
// DASHBOARD — chỉ bạn xem (dùng ADMIN_SECRET)
// Truy cập: /dashboard?secret=MẬT_KHẨU
// ===================================================
app.get('/dashboard', (req, res) => {
  if (req.query.secret !== process.env.ADMIN_SECRET) return res.status(403).send('403 Forbidden');

  const db = loadOrders();
  const allOrders = Object.entries(db)
    .flatMap(([key, orders]) => orders.map(o => ({ ...o, _key: key.substring(0, 8) + '...' })))
    .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));

  const rows = allOrders.map((o, i) => {
    const products = (o.items || []).map(it => it.productName || '?').join('<br>');
    const amounts  = (o.items || []).map(it => {
      const n = parseFloat(String(it.amount).replace(/[^0-9.]/g, '')) || 0;
      return n.toLocaleString('vi-VN') + 'đ';
    }).join('<br>');
    return `<tr>
      <td>${i + 1}</td>
      <td><code style="color:#4F46E5;font-weight:700">${o.code || '–'}</code></td>
      <td>${o.fullName || '–'}</td>
      <td style="color:${o.phone ? '#059669' : '#F59E0B'};font-weight:700">${o.phone || '⚠️ Chưa có'}</td>
      <td style="font-size:12px">${o.address || '–'}</td>
      <td style="font-size:12px">${products}</td>
      <td style="color:#059669;font-weight:700">${amounts}</td>
      <td style="font-size:11px;color:#94A3B8">${o._key}</td>
      <td style="font-size:11px;color:#94A3B8">${o.time || o.savedAt || '–'}</td>
    </tr>`;
  }).join('');

  res.send(`<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8">
<title>📊 Chiaki Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,sans-serif;background:#F1F5F9;color:#1E293B;padding:24px}
h1{font-size:22px;margin-bottom:6px;color:#4F46E5}
.meta{font-size:13px;color:#64748B;margin-bottom:20px}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:16px}
input{padding:8px 12px;border:1.5px solid #CBD5E1;border-radius:8px;font-size:13px;width:300px;outline:none}
input:focus{border-color:#4F46E5}
a.export{background:#4F46E5;color:white;padding:9px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700}
table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07)}
thead{background:linear-gradient(135deg,#4F46E5,#7C3AED);color:white}
th{padding:12px 10px;font-size:12px;font-weight:700;text-align:left;white-space:nowrap}
td{padding:11px 10px;font-size:13px;border-bottom:1px solid #F1F5F9;vertical-align:top}
tr:last-child td{border-bottom:none}
tr:hover td{background:#F8FAFF}
</style></head><body>
<h1>📊 Chiaki Orders Dashboard</h1>
<div class="meta">Tổng: <strong>${allOrders.length}</strong> đơn | Cập nhật: ${new Date().toLocaleString('vi-VN')}</div>
<div class="bar">
  <input type="text" placeholder="🔍 Tìm theo tên, SĐT, mã đơn..." oninput="filter(this.value)">
  <a class="export" href="/export?secret=${req.query.secret}">⬇️ Export CSV</a>
</div>
<table><thead>
  <tr><th>#</th><th>Mã đơn</th><th>Tên KH</th><th>SĐT</th><th>Địa chỉ</th><th>Sản phẩm</th><th>Giá</th><th>Key</th><th>Thời gian</th></tr>
</thead><tbody id="tb">${rows}</tbody></table>
<script>
function filter(q){
  document.querySelectorAll('#tb tr').forEach(r=>{
    r.style.display=r.textContent.toLowerCase().includes(q.toLowerCase())?'':'none';
  });
}
</script></body></html>`);
});

// ===================================================
// EXPORT CSV — mở bằng Excel
// Truy cập: /export?secret=MẬT_KHẨU
// ===================================================
app.get('/export', (req, res) => {
  if (req.query.secret !== process.env.ADMIN_SECRET) return res.status(403).send('403 Forbidden');

  const db = loadOrders();
  const allOrders = Object.entries(db)
    .flatMap(([key, orders]) => orders.map(o => ({ ...o, _key: key.substring(0, 8) + '...' })))
    .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));

  const esc = v => `"${String(v || '').replace(/"/g, '""')}"`;
  const header = ['Mã đơn','Tên KH','SĐT','Địa chỉ','Sản phẩm','Giá','Key','Thời gian'];
  const csvRows = allOrders.map(o => [
    o.code, o.fullName, o.phone,
    o.address,
    (o.items || []).map(i => i.productName).join(' | '),
    (o.items || []).map(i => i.amount).join(' | '),
    o._key,
    o.time || o.savedAt
  ].map(esc).join(','));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="chiaki_orders.csv"');
  res.send('\uFEFF' + [header.map(esc).join(','), ...csvRows].join('\n'));
});

// ===================================================
app.get('/', (req, res) => res.send('✅ Chiaki Key Server Running!'));
app.listen(3000, () => console.log('🚀 Server port 3000'));
