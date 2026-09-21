const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'submissions.json');
const ADMIN_PASSWORD = 'Shubham@1003A';

// Ensure data folder and file exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
}

// Helpers for reading/writing DB safely
function readSubmissions() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading submissions:', err);
    return [];
  }
}

function saveSubmissions(submissions) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving submissions:', err);
    return false;
  }
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware for protected admin APIs
function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const customHeader = req.headers['x-admin-token'] || '';
  const queryAuth = req.query.auth || '';

  const token = authHeader.replace(/^Bearer\s+/i, '') || customHeader || queryAuth;
  if (token === ADMIN_PASSWORD) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized: Password required' });
}

// Routes for main pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API: Login
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    return res.status(401).json({ success: false, message: 'Incorrect password' });
  }
});

// API: Submit Survey (Public)
app.post('/api/submit', (req, res) => {
  const {
    q1_relief,
    q1_level,
    q2_flaws,
    q3_market_gap,
    q4_alternate,
    q5_other_pain,
    name,
    email,
    phone
  } = req.body;

  const newEntry = {
    id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    createdAt: new Date().toISOString(),
    q1_relief: q1_relief || null,
    q1_level: q1_relief === 'yes' && q1_level ? Number(q1_level) : null,
    q2_flaws: (q2_flaws || '').trim(),
    q3_market_gap: (q3_market_gap || '').trim(),
    q4_alternate: (q4_alternate || '').trim(),
    q5_other_pain: (q5_other_pain || '').trim(),
    name: (name || '').trim() || 'Anonymous',
    email: (email || '').trim(),
    phone: (phone || '').trim()
  };

  const submissions = readSubmissions();
  submissions.unshift(newEntry);
  const saved = saveSubmissions(submissions);

  if (saved) {
    return res.status(201).json({
      success: true,
      message: 'Survey response submitted successfully!',
      submission: newEntry
    });
  } else {
    return res.status(500).json({
      success: false,
      message: 'Failed to save survey response'
    });
  }
});

// API: Get All Submissions (Protected)
app.get('/api/submissions', requireAdmin, (req, res) => {
  const search = (req.query.search || '').toLowerCase().trim();
  let submissions = readSubmissions();

  if (search) {
    submissions = submissions.filter(item => {
      return (
        (item.name && item.name.toLowerCase().includes(search)) ||
        (item.email && item.email.toLowerCase().includes(search)) ||
        (item.phone && item.phone.toLowerCase().includes(search)) ||
        (item.q2_flaws && item.q2_flaws.toLowerCase().includes(search)) ||
        (item.q3_market_gap && item.q3_market_gap.toLowerCase().includes(search)) ||
        (item.q4_alternate && item.q4_alternate.toLowerCase().includes(search)) ||
        (item.q5_other_pain && item.q5_other_pain.toLowerCase().includes(search))
      );
    });
  }

  res.json({
    success: true,
    total: submissions.length,
    submissions
  });
});

// API: Aggregated Statistics (Protected)
app.get('/api/stats', requireAdmin, (req, res) => {
  const submissions = readSubmissions();
  const total = submissions.length;

  let q1_yes = 0;
  let q1_no = 0;
  let q1_ratings = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let ratingSum = 0;
  let ratingCount = 0;

  let contactCount = 0;
  let q2_count = 0;
  let q3_count = 0;
  let q4_count = 0;
  let q5_count = 0;

  submissions.forEach(sub => {
    if (sub.q1_relief === 'yes') {
      q1_yes++;
      if (sub.q1_level && sub.q1_level >= 1 && sub.q1_level <= 5) {
        q1_ratings[String(sub.q1_level)]++;
        ratingSum += sub.q1_level;
        ratingCount++;
      }
    } else if (sub.q1_relief === 'no') {
      q1_no++;
    }

    if (sub.name !== 'Anonymous' || sub.email || sub.phone) contactCount++;
    if (sub.q2_flaws) q2_count++;
    if (sub.q3_market_gap) q3_count++;
    if (sub.q4_alternate) q4_count++;
    if (sub.q5_other_pain) q5_count++;
  });

  const avgReliefScore = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : 0;

  res.json({
    success: true,
    total,
    contactCount,
    q1: {
      yes: q1_yes,
      no: q1_no,
      unanswered: total - (q1_yes + q1_no),
      ratings: q1_ratings,
      avgScore: avgReliefScore
    },
    questionResponseCounts: {
      q1: q1_yes + q1_no,
      q2: q2_count,
      q3: q3_count,
      q4: q4_count,
      q5: q5_count
    }
  });
});

// API: Delete Submission (Protected)
app.delete('/api/submissions/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  let submissions = readSubmissions();
  const initialLength = submissions.length;
  submissions = submissions.filter(item => item.id !== id);

  if (submissions.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Submission not found' });
  }

  saveSubmissions(submissions);
  res.json({ success: true, message: 'Submission deleted successfully' });
});

// API: Export CSV (Protected)
app.get('/api/export', requireAdmin, (req, res) => {
  const submissions = readSubmissions();

  const headers = [
    'Person Name',
    'Ans1 (Heating Pad Relief & Level)',
    'Ans2 (Flaws & Drawbacks)',
    'Ans3 (Market Gap / Missing Product)',
    'Ans4 (Alternate Solution & Why)',
    'Ans5 (Other Pain Areas & Efficacy)',
    'Email',
    'Phone/WhatsApp',
    'Date & Time',
    'Submission ID'
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const formatAns1 = (sub) => {
    if (sub.q1_relief === 'yes') {
      return sub.q1_level ? `Yes (Level ${sub.q1_level}/5)` : 'Yes (Relief Milta Hai)';
    } else if (sub.q1_relief === 'no') {
      return 'No (Relief Nahi Milta)';
    }
    return 'Not Answered';
  };

  const rows = submissions.map(sub => [
    escapeCSV(sub.name || 'Anonymous'),
    escapeCSV(formatAns1(sub)),
    escapeCSV(sub.q2_flaws || '-'),
    escapeCSV(sub.q3_market_gap || '-'),
    escapeCSV(sub.q4_alternate || '-'),
    escapeCSV(sub.q5_other_pain || '-'),
    escapeCSV(sub.email || '-'),
    escapeCSV(sub.phone || '-'),
    escapeCSV(new Date(sub.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })),
    escapeCSV(sub.id)
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="Pain_Relief_Survey_Responses.csv"');
  res.send('\uFEFF' + csvContent);
});

app.listen(PORT, () => {
  console.log(`🚀 Pain Relief Survey Server running at: http://localhost:${PORT}`);
});
