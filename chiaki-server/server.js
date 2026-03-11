const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const app     = express();

app.use(cors());
app.use(express.json());

// ===================================================
// PERSISTENT DISK
// ===================================================
const DATA_DIR  = '/opt/render/project/src/data';
const USAGE_DB  = path.join(DATA_DIR, 'usage.json');
const ORDERS_DB = path.join(DATA_DIR, 'orders_db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ===================================================
// KEYS
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
  "THCOSMETIC1000": 15,
  "CHANG-000F-S1M8-Q5DZ": 15
};

// ===================================================
// HELPERS
// ===================================================
function loadUsage() {
  try { return JSON.parse(fs.readFileSync(USAGE_DB)); } catch (e) { return {}; }
}
function saveUsage(data) { fs.writeFileSync(USAGE_DB, JSON.stringify(data, null, 2)); }

function loadOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS_DB)); } catch (e) { return {}; }
}
function saveOrders(data) { fs.writeFileSync(ORDERS_DB, JSON.stringify(data, null, 2)); }

// ===================================================
// API 1 — Validate key
// ===================================================
app.post('/validate', (req, res) => {
  const { key } = req.body;
  if (!key || !KEYS[key]) return res.json({ valid: false, message: '❌ Key không hợp lệ!' });
  const usage = loadUsage();
  const used  = usage[key] || 0, limit = KEYS[key];
  if (limit - used <= 0) return res.json({ valid: false, message: '❌ Key đã hết lượt!' });
  res.json({ valid: true, used, limit, remaining: limit - used });
});

// ===================================================
// API 2 — Consume
// ===================================================
app.post('/consume', (req, res) => {
  const { key } = req.body;
  if (!key || !KEYS[key]) return res.json({ success: false, message: 'Key không hợp lệ' });
  const usage = loadUsage();
  const used  = (usage[key] || 0) + 1, limit = KEYS[key];
  if (used > limit) return res.json({ success: false, message: '❌ Hết lượt!' });
  usage[key] = used;
  saveUsage(usage);
  res.json({ success: true, used, limit, remaining: limit - used });
});

// ===================================================
// API 3 — Usage
// ===================================================
app.post('/usage', (req, res) => {
  const { key } = req.body;
  if (!key || !KEYS[key]) return res.json({ valid: false });
  const usage = loadUsage();
  const used  = usage[key] || 0, limit = KEYS[key];
  res.json({ valid: true, used, limit, remaining: limit - used });
});

// ===================================================
// API 4 — Lưu đơn hàng từ Extension
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
// API 5 — Xóa 1 đơn (protected bằng ADMIN_SECRET)
// ===================================================
app.delete('/delete-order', (req, res) => {
  if (req.query.secret !== process.env.ADMIN_SECRET)
    return res.status(403).json({ success: false });

  const { code } = req.body;
  if (!code) return res.json({ success: false, message: 'Thiếu mã đơn' });

  const db = loadOrders();
  let deleted = false;
  Object.keys(db).forEach(k => {
    const before = db[k].length;
    db[k] = db[k].filter(o => o.code !== code);
    if (db[k].length < before) deleted = true;
  });

  if (!deleted) return res.json({ success: false, message: 'Không tìm thấy đơn' });
  saveOrders(db);
  res.json({ success: true });
});

// ===================================================
// API 6 — Xóa TẤT CẢ đơn
// ===================================================
app.delete('/delete-all-orders', (req, res) => {
  if (req.query.secret !== process.env.ADMIN_SECRET)
    return res.status(403).json({ success: false });
  saveOrders({});
  res.json({ success: true });
});

// ===================================================
// DASHBOARD — /dashboard?secret=XXX
// ===================================================
app.get('/dashboard', (req, res) => {
  const secret = req.query.secret;
  if (secret !== process.env.ADMIN_SECRET) return res.status(403).send('403 Forbidden');

  const db = loadOrders();
  const allOrders = Object.entries(db)
    .flatMap(([k, orders]) => orders.map(o => ({ ...o, _key: k.substring(0,8)+'...' })))
    .sort((a, b) => new Date(b.savedAt||0) - new Date(a.savedAt||0));

  const rows = allOrders.map((o, i) => {
    const products = (o.items||[]).map(it => it.productName||'?').join('<br>');
    const amounts  = (o.items||[]).map(it => {
      const n = parseFloat(String(it.amount).replace(/[^0-9.]/g,''))||0;
      return n.toLocaleString('vi-VN')+'đ';
    }).join('<br>');
    return `<tr id="row-${o.code}">
      <td>${i+1}</td>
      <td><code style="color:#5856D6;font-weight:700">${o.code||'–'}</code></td>
      <td>${o.fullName||'–'}</td>
      <td style="color:${o.phone?'#1A7F47':'#C07800'};font-weight:700">${o.phone||'⚠️ Chưa có'}</td>
      <td style="font-size:12px">${o.address||'–'}</td>
      <td style="font-size:12px">${products}</td>
      <td style="color:#1A7F47;font-weight:700">${amounts}</td>
      <td style="font-size:11px;color:#8E8E93">${o._key}</td>
      <td style="font-size:11px;color:#8E8E93">${o.time||o.savedAt||'–'}</td>
      <td>
        <button onclick="deleteOrder('${o.code}')"
          style="background:#FFF0EF;color:#FF3B30;border:1.5px solid #FFD5D3;
                 padding:5px 12px;border-radius:8px;cursor:pointer;font-weight:700;
                 font-size:12px;white-space:nowrap">
          🗑️ Xóa
        </button>
      </td>
    </tr>`;
  }).join('');

  res.send(`<!DOCTYPE html>
<html lang="vi"><head><meta charset="UTF-8">
<title>📊 Chiaki Dashboard</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,sans-serif;background:#F5F5F7;color:#1D1D1F;padding:24px}
h1{font-size:22px;font-weight:700;margin-bottom:6px;color:#1D1D1F}
.meta{font-size:13px;color:#6E6E73;margin-bottom:20px}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
input{padding:9px 14px;border:1.5px solid #D1D1D6;border-radius:10px;font-size:13px;
  width:280px;outline:none;background:white}
input:focus{border-color:#5856D6;box-shadow:0 0 0 3px rgba(88,86,214,.1)}
.btn{padding:9px 18px;border-radius:10px;font-size:13px;font-weight:700;
  cursor:pointer;border:none;font-family:inherit}
.btn-export{background:#5856D6;color:white;text-decoration:none;display:inline-flex;align-items:center}
.btn-export:hover{background:#4745C0}
.btn-del-all{background:#FFF0EF;color:#FF3B30;border:1.5px solid #FFD5D3}
.btn-del-all:hover{background:#FFE5E3}
table{width:100%;border-collapse:collapse;background:white;border-radius:16px;
  overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)}
thead{background:#F5F5F7;border-bottom:2px solid #E8E8ED}
th{padding:12px 10px;font-size:11px;font-weight:700;text-align:left;
  color:#6E6E73;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
td{padding:12px 10px;font-size:13px;border-bottom:1px solid #F5F5F7;vertical-align:top}
tr:last-child td{border-bottom:none}
tr:hover td{background:#FAFAFE}
.toast{position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:12px;
  font-weight:600;font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,.15);
  transition:opacity .3s;z-index:999}
.toast.success{background:#D1FAE5;color:#065F46;border:1px solid #6EE7B7}
.toast.error{background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5}
</style></head><body>

<h1>📊 Chiaki Orders Dashboard</h1>
<div class="meta" id="metaCount">
  Tổng: <strong>${allOrders.length}</strong> đơn hàng &nbsp;|&nbsp;
  Cập nhật: ${new Date().toLocaleString('vi-VN')}
</div>

<div class="bar">
  <input type="text" id="searchBox" placeholder="🔍 Tìm theo tên, SĐT, mã đơn..."
    oninput="filterTable(this.value)">
  <a class="btn btn-export" href="/export?secret=${secret}">⬇️ Export CSV</a>
  <button class="btn btn-del-all" onclick="deleteAll()">🗑️ Xóa tất cả</button>
</div>

<table>
  <thead>
    <tr>
      <th>#</th><th>Mã đơn</th><th>Tên KH</th><th>SĐT</th>
      <th>Địa chỉ</th><th>Sản phẩm</th><th>Giá</th>
      <th>Key</th><th>Thời gian</th><th></th>
    </tr>
  </thead>
  <tbody id="tb">${rows}</tbody>
</table>

<script>
const SECRET = '${secret}';

function showToast(msg, type='success') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(), 300); }, 2500);
}

async function deleteOrder(code) {
  if (!confirm('Xóa đơn ' + code + '?')) return;
  const res = await fetch('/delete-order?secret=' + SECRET, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  const data = await res.json();
  if (data.success) {
    document.getElementById('row-' + code)?.remove();
    showToast('✅ Đã xóa đơn ' + code);
    updateCount();
  } else {
    showToast('❌ ' + (data.message || 'Lỗi!'), 'error');
  }
}

async function deleteAll() {
  if (!confirm('Xóa TOÀN BỘ đơn hàng? Không thể khôi phục!')) return;
  const res = await fetch('/delete-all-orders?secret=' + SECRET, { method: 'DELETE' });
  const data = await res.json();
  if (data.success) {
    document.getElementById('tb').innerHTML =
      '<tr><td colspan="10" style="text-align:center;padding:40px;color:#8E8E93">Chưa có đơn hàng nào</td></tr>';
    showToast('✅ Đã xóa toàn bộ đơn hàng');
    updateCount();
  }
}

function updateCount() {
  const visible = document.querySelectorAll('#tb tr[id]').length;
  document.getElementById('metaCount').innerHTML =
    'Tổng: <strong>' + visible + '</strong> đơn hàng';
}

function filterTable(q) {
  document.querySelectorAll('#tb tr').forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}
</script>
</body></html>`);
});

// ===================================================
// EXPORT CSV
// ===================================================
app.get('/export', (req, res) => {
  if (req.query.secret !== process.env.ADMIN_SECRET) return res.status(403).send('403 Forbidden');
  const db = loadOrders();
  const all = Object.entries(db)
    .flatMap(([k,orders]) => orders.map(o => ({...o, _key: k.substring(0,8)+'...'})))
    .sort((a,b) => new Date(b.savedAt||0) - new Date(a.savedAt||0));

  const esc = v => `"${String(v||'').replace(/"/g,'""')}"`;
  const header = ['Mã đơn','Tên KH','SĐT','Địa chỉ','Sản phẩm','Giá','Key','Thời gian'];
  const csvRows = all.map(o => [
    o.code, o.fullName, o.phone, o.address,
    (o.items||[]).map(i=>i.productName).join(' | '),
    (o.items||[]).map(i=>i.amount).join(' | '),
    o._key, o.time||o.savedAt
  ].map(esc).join(','));

  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="chiaki_orders.csv"');
  res.send('\uFEFF' + [header.map(esc).join(','), ...csvRows].join('\n'));
});

// ===================================================
app.get('/', (req, res) => res.send('✅ Chiaki Key Server Running!'));
app.listen(3000, () => console.log('🚀 Server port 3000'));
