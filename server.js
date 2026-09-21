const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'submissions.json');

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

// Routes for main pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API: Submit Survey
app.post('/api/submit', (req, res) => {
  const {
    q1_relief,      // "yes" | "no" | ""
    q1_level,       // 1-5 (number or null)
    q2_flaws,       // string
    q3_market_gap,  // string
    q4_alternate,   // string
    q5_other_pain,  // string
    name,           // string (optional)
    email,          // string (optional)
    phone           // string (optional)
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
  submissions.unshift(newEntry); // Newest first
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

// API: Get All Submissions (with optional search query)
app.get('/api/submissions', (req, res) => {
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

// API: Aggregated Statistics
app.get('/api/stats', (req, res) => {
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

// API: Delete Submission
app.delete('/api/submissions/:id', (req, res) => {
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

// API: Export CSV
app.get('/api/export', (req, res) => {
  const submissions = readSubmissions();

  const headers = [
    'ID',
    'Date & Time',
    'Respondent Name',
    'Email',
    'Phone/WhatsApp',
    'QN1: Heating Pad Relief? (Yes/No)',
    'QN1: Relief Level (1-5)',
    'QN2: Heating Pad Flaws / Problems',
    'QN3: Market Gap / Missing Product',
    'QN4: Alternate Solution & Why',
    'QN5: Other Pain Areas & Does Heating Pad Work'
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = submissions.map(sub => [
    escapeCSV(sub.id),
    escapeCSV(new Date(sub.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })),
    escapeCSV(sub.name),
    escapeCSV(sub.email),
    escapeCSV(sub.phone),
    escapeCSV(sub.q1_relief ? (sub.q1_relief.toUpperCase()) : 'Not Answered'),
    escapeCSV(sub.q1_level || '-'),
    escapeCSV(sub.q2_flaws || '-'),
    escapeCSV(sub.q3_market_gap || '-'),
    escapeCSV(sub.q4_alternate || '-'),
    escapeCSV(sub.q5_other_pain || '-')
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="Pain_Relief_Survey_Responses.csv"');
  res.send('\uFEFF' + csvContent); // Add UTF-8 BOM for perfect Excel compatibility
});

app.listen(PORT, () => {
  console.log(`🚀 Pain Relief Survey Server running at: http://localhost:${PORT}`);
  console.log(`📋 Public Survey Form: http://localhost:${PORT}/`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
});
