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

// API: Submit VYVIA Survey (Public)
app.post('/api/submit', (req, res) => {
  const {
    q1_rashes,
    q2_stinging,
    q3_dampness,
    q4_skin_texture,
    q5_odor_control,
    q6_absorption,
    q7_leakage,
    q8_overall_experience,
    name,
    email,
    phone
  } = req.body;

  const newEntry = {
    id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    createdAt: new Date().toISOString(),
    q1_rashes: (q1_rashes || '').trim(),
    q2_stinging: (q2_stinging || '').trim(),
    q3_dampness: (q3_dampness || '').trim(),
    q4_skin_texture: (q4_skin_texture || '').trim(),
    q5_odor_control: (q5_odor_control || '').trim(),
    q6_absorption: (q6_absorption || '').trim(),
    q7_leakage: (q7_leakage || '').trim(),
    q8_overall_experience: (q8_overall_experience || '').trim(),
    name: (name || '').trim() || 'Verified User',
    email: (email || '').trim(),
    phone: (phone || '').trim()
  };

  const submissions = readSubmissions();
  submissions.unshift(newEntry);
  const saved = saveSubmissions(submissions);

  if (saved) {
    return res.status(201).json({
      success: true,
      message: 'VYVIA survey response submitted successfully!',
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
        (item.q1_rashes && item.q1_rashes.toLowerCase().includes(search)) ||
        (item.q2_stinging && item.q2_stinging.toLowerCase().includes(search)) ||
        (item.q3_dampness && item.q3_dampness.toLowerCase().includes(search)) ||
        (item.q4_skin_texture && item.q4_skin_texture.toLowerCase().includes(search)) ||
        (item.q5_odor_control && item.q5_odor_control.toLowerCase().includes(search)) ||
        (item.q6_absorption && item.q6_absorption.toLowerCase().includes(search)) ||
        (item.q7_leakage && item.q7_leakage.toLowerCase().includes(search)) ||
        (item.q8_overall_experience && item.q8_overall_experience.toLowerCase().includes(search))
      );
    });
  }

  res.json({
    success: true,
    total: submissions.length,
    submissions
  });
});

// API: Aggregated Statistics for Q1–Q8 (Protected)
app.get('/api/stats', requireAdmin, (req, res) => {
  const submissions = readSubmissions();
  const total = submissions.length;

  const questions = {
    q1: {},
    q2: {},
    q3: {},
    q4: {},
    q5: {},
    q6: {},
    q7: {},
    q8: {}
  };

  const questionCounts = {
    q1: 0,
    q2: 0,
    q3: 0,
    q4: 0,
    q5: 0,
    q6: 0,
    q7: 0,
    q8: 0
  };

  submissions.forEach(sub => {
    for (let i = 1; i <= 8; i++) {
      const field = [
        '',
        'q1_rashes',
        'q2_stinging',
        'q3_dampness',
        'q4_skin_texture',
        'q5_odor_control',
        'q6_absorption',
        'q7_leakage',
        'q8_overall_experience'
      ][i];

      const val = sub[field];
      if (val) {
        questionCounts[`q${i}`]++;
        questions[`q${i}`][val] = (questions[`q${i}`][val] || 0) + 1;
      }
    }
  });

  res.json({
    success: true,
    total,
    questionCounts,
    questions
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
    'Respondent Email',
    'Q1 (Rashes/Itching)',
    'Q2 (Burning/Stinging)',
    'Q3 (Dampness/Sweat)',
    'Q4 (Vulvar Skin Health)',
    'Q5 (Odor Control - ZnO)',
    'Q6 (Absorption Speed)',
    'Q7 (Side Leakage)',
    'Q8 (Overall VYVIA vs Regular)',
    'Submission Date & Time'
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = submissions.map(sub => [
    escapeCSV(sub.email || '-'),
    escapeCSV(sub.q1_rashes || '-'),
    escapeCSV(sub.q2_stinging || '-'),
    escapeCSV(sub.q3_dampness || '-'),
    escapeCSV(sub.q4_skin_texture || '-'),
    escapeCSV(sub.q5_odor_control || '-'),
    escapeCSV(sub.q6_absorption || '-'),
    escapeCSV(sub.q7_leakage || '-'),
    escapeCSV(sub.q8_overall_experience || '-'),
    escapeCSV(new Date(sub.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="VYVIA_Survey_Responses.csv"');
  res.send('\uFEFF' + csvContent);
});

app.listen(PORT, () => {
  console.log(`🚀 VYVIA Survey Server running at: http://localhost:${PORT}`);
});
