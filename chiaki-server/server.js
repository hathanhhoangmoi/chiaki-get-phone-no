const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const app     = express();

app.use(cors());
app.use(express.json());

// ===== DATABASE KEYS (Chỉ bạn thấy trên server) =====
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

const DB = './usage.json';

function loadUsage() {
  try { return JSON.parse(fs.readFileSync(DB)); }
  catch (e) { return {}; }
}

function saveUsage(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

// ===== API 1: Validate key =====
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

// ===== API 2: Trừ 1 lượt =====
app.post('/consume', (req, res) => {
  const { key } = req.body;
  if (!key || !KEYS[key]) {
    return res.json({ success: false, message: 'Key không hợp lệ' });
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

// ===== API 3: Check lượt còn lại =====
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

app.get('/', (req, res) => res.send('✅ Chiaki Key Server Running!'));

app.listen(3000, () => console.log('🚀 Server port 3000'));

const express = require('express');
const cors    = require('cors');
const app     = express();

// Fix CORS cho Chrome Extension
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());
