let allSubmissions = [];
let currentTab = 'all';
let charts = {};

const AUTH_KEY = 'survey_admin_token';

document.addEventListener('DOMContentLoaded', () => {
  const loginModal = document.getElementById('login-modal');
  const adminMain = document.getElementById('admin-main-container');
  const loginForm = document.getElementById('admin-login-form');
  const passInput = document.getElementById('admin-pass-input');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const btnLogout = document.getElementById('btn-logout');
  const btnDownloadCsv = document.getElementById('btn-download-csv');

  // Check existing session
  const existingToken = sessionStorage.getItem(AUTH_KEY);
  if (existingToken) {
    showDashboard();
    fetchData();
  } else {
    showLogin();
  }

  // Handle Login Submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErrorMsg.style.display = 'none';

    const enteredPassword = passInput.value.trim();
    if (!enteredPassword) return;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: enteredPassword })
      });

      const data = await res.json();
      if (data.success && data.token) {
        sessionStorage.setItem(AUTH_KEY, data.token);
        passInput.value = '';
        showDashboard();
        fetchData();
      } else {
        loginErrorMsg.style.display = 'block';
        passInput.focus();
      }
    } catch (err) {
      console.error('Login error:', err);
      loginErrorMsg.textContent = 'Server connection error. Try again.';
      loginErrorMsg.style.display = 'block';
    }
  });

  // Handle Logout
  btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem(AUTH_KEY);
    showLogin();
  });

  // Handle CSV Download
  btnDownloadCsv.addEventListener('click', () => {
    const token = sessionStorage.getItem(AUTH_KEY);
    if (!token) {
      showLogin();
      return;
    }
    window.location.href = `/api/export?auth=${encodeURIComponent(token)}`;
  });

  // Tab switching
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      switchTab(currentTab);
    });
  });

  // Refresh button
  document.getElementById('btn-refresh-data').addEventListener('click', () => {
    fetchData();
  });

  // Live search
  const searchBox = document.getElementById('search-box');
  searchBox.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    renderAllViews(query);
  });
});

function showLogin() {
  document.getElementById('login-modal').style.display = 'flex';
  document.getElementById('admin-main-container').style.display = 'none';
  if (window.feather) feather.replace();
}

function showDashboard() {
  document.getElementById('login-modal').style.display = 'none';
  document.getElementById('admin-main-container').style.display = 'block';
  if (window.feather) feather.replace();
}

function getAuthHeaders() {
  const token = sessionStorage.getItem(AUTH_KEY) || '';
  return {
    'Authorization': `Bearer ${token}`,
    'x-admin-token': token
  };
}

async function fetchData() {
  try {
    const headers = getAuthHeaders();
    const [subRes, statsRes] = await Promise.all([
      fetch('/api/submissions', { headers }),
      fetch('/api/stats', { headers })
    ]);

    if (subRes.status === 401 || statsRes.status === 401) {
      sessionStorage.removeItem(AUTH_KEY);
      showLogin();
      return;
    }

    const subData = await subRes.json();
    const statsData = await statsRes.json();

    if (subData.success) {
      allSubmissions = subData.submissions;
    }

    if (statsData.success) {
      updateKpis(statsData);
      renderAllCharts(statsData);
    }

    const searchQuery = document.getElementById('search-box').value.toLowerCase().trim();
    renderAllViews(searchQuery);

    document.getElementById('last-updated-text').textContent = `Updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (window.feather) feather.replace();
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
  }
}

function updateKpis(stats) {
  const total = stats.total || 0;
  document.getElementById('stat-total-submissions').textContent = total;

  // Q1 Zero Rash rate
  const q1Zero = (stats.questions?.q1 && stats.questions.q1['Bilkul nahi (Zero irritation)']) || 0;
  const q1Rate = total > 0 ? Math.round((q1Zero / total) * 100) : 0;
  document.getElementById('stat-zero-rash-rate').textContent = `${q1Rate}%`;

  // Q7 Zero Leak rate
  const q7Zero = (stats.questions?.q7 && stats.questions.q7['Zero leakage']) || 0;
  const q7Rate = total > 0 ? Math.round((q7Zero / total) * 100) : 0;
  document.getElementById('stat-zero-leak-rate').textContent = `${q7Rate}%`;

  // Q8 Better Experience rate
  const q8Better = (stats.questions?.q8 && stats.questions.q8['Bohot behtar (No rash + fresh feeling)']) || 0;
  const q8Rate = total > 0 ? Math.round((q8Better / total) * 100) : 0;
  document.getElementById('stat-better-exp-rate').textContent = `${q8Rate}%`;

  // Update tab counter badges
  document.getElementById('count-all').textContent = total;
  for (let i = 1; i <= 8; i++) {
    const countEl = document.getElementById(`count-q${i}`);
    if (countEl) {
      countEl.textContent = stats.questionCounts?.[`q${i}`] || total;
    }
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-view').forEach(view => {
    view.style.display = 'none';
  });
  const activeView = document.getElementById(`view-${tabName}`);
  if (activeView) {
    activeView.style.display = 'block';
  }
  if (window.feather) feather.replace();
}

function renderAllViews(query = '') {
  let filtered = allSubmissions;
  if (query) {
    filtered = allSubmissions.filter(item => {
      return (
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.email && item.email.toLowerCase().includes(query)) ||
        (item.q1_rashes && item.q1_rashes.toLowerCase().includes(query)) ||
        (item.q2_stinging && item.q2_stinging.toLowerCase().includes(query)) ||
        (item.q3_dampness && item.q3_dampness.toLowerCase().includes(query)) ||
        (item.q4_skin_texture && item.q4_skin_texture.toLowerCase().includes(query)) ||
        (item.q5_odor_control && item.q5_odor_control.toLowerCase().includes(query)) ||
        (item.q6_absorption && item.q6_absorption.toLowerCase().includes(query)) ||
        (item.q7_leakage && item.q7_leakage.toLowerCase().includes(query)) ||
        (item.q8_overall_experience && item.q8_overall_experience.toLowerCase().includes(query))
      );
    });
  }

  renderAllSubmissionsTab(filtered);
  for (let i = 1; i <= 8; i++) {
    renderQuestionTab(i, filtered);
  }

  if (window.feather) feather.replace();
}

function getBadgeClass(val) {
  if (!val) return 'tag-yellow';
  const v = val.toLowerCase();
  if (v.includes('bilkul nahi') || v.includes('zero') || v.includes('dry') || v.includes('safe') || v.includes('100%') || v.includes('turant') || v.includes('bohot behtar')) {
    return 'tag-green';
  }
  if (v.includes('kam') || v.includes('hadd tak') || v.includes('normal')) {
    return 'tag-blue';
  }
  if (v.includes('moderate') || v.includes('light flow') || v.includes('thoda') || v.includes('thodi') || v.includes('same')) {
    return 'tag-yellow';
  }
  return 'tag-red';
}

// Render ALL Submissions Tab
function renderAllSubmissionsTab(list) {
  const container = document.getElementById('all-submissions-list');
  if (list.length === 0) {
    container.innerHTML = '<div class="empty-box">Abhi tak koi submission record nahi hua hai.</div>';
    return;
  }

  container.innerHTML = list.map(sub => {
    const formattedDate = new Date(sub.createdAt).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata'
    });

    const displayName = sub.email || sub.name || 'Verified Respondent';
    const initial = (displayName[0] || 'V').toUpperCase();

    return `
      <div class="survey-card" style="margin-bottom: 14px;">
        <div class="qn-card-top">
          <div class="user-meta">
            <div class="user-avatar">${initial}</div>
            <div>
              <div class="user-name">${escapeHTML(displayName)}</div>
              <div class="sub-date">${formattedDate}</div>
            </div>
          </div>
          <button class="btn-refresh" style="color: #ef4444; padding: 3px 8px; font-size: 0.76rem;" onclick="deleteSubmission('${sub.id}')">
            <i data-feather="trash-2" style="width: 12px; height: 12px;"></i> Delete
          </button>
        </div>

        <div style="display: grid; gap: 6px; margin-top: 10px;">
          <div class="ans-row">
            <span class="ans-label">Q1 (Rashes/Itch):</span>
            <span class="ans-val-pill ${getBadgeClass(sub.q1_rashes)}">${escapeHTML(sub.q1_rashes || 'N/A')}</span>
          </div>
          <div class="ans-row">
            <span class="ans-label">Q2 (Stinging/Jalan):</span>
            <span class="ans-val-pill ${getBadgeClass(sub.q2_stinging)}">${escapeHTML(sub.q2_stinging || 'N/A')}</span>
          </div>
          <div class="ans-row">
            <span class="ans-label">Q3 (Dampness/Sweat):</span>
            <span class="ans-val-pill ${getBadgeClass(sub.q3_dampness)}">${escapeHTML(sub.q3_dampness || 'N/A')}</span>
          </div>
          <div class="ans-row">
            <span class="ans-label">Q4 (Vulvar Skin):</span>
            <span class="ans-val-pill ${getBadgeClass(sub.q4_skin_texture)}">${escapeHTML(sub.q4_skin_texture || 'N/A')}</span>
          </div>
          <div class="ans-row">
            <span class="ans-label">Q5 (Odor Control):</span>
            <span class="ans-val-pill ${getBadgeClass(sub.q5_odor_control)}">${escapeHTML(sub.q5_odor_control || 'N/A')}</span>
          </div>
          <div class="ans-row">
            <span class="ans-label">Q6 (Absorption Speed):</span>
            <span class="ans-val-pill ${getBadgeClass(sub.q6_absorption)}">${escapeHTML(sub.q6_absorption || 'N/A')}</span>
          </div>
          <div class="ans-row">
            <span class="ans-label">Q7 (Side Leakage):</span>
            <span class="ans-val-pill ${getBadgeClass(sub.q7_leakage)}">${escapeHTML(sub.q7_leakage || 'N/A')}</span>
          </div>
          <div class="ans-row">
            <span class="ans-label">Q8 (Overall VYVIA):</span>
            <span class="ans-val-pill ${getBadgeClass(sub.q8_overall_experience)}">${escapeHTML(sub.q8_overall_experience || 'N/A')}</span>
          </div>
        </div>

        ${(sub.email && sub.email !== displayName) ? `
          <div class="qn-contact-strip" style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #f1f5f9;">
            <span class="contact-pill"><i data-feather="mail" style="width: 11px; height: 11px;"></i> ${escapeHTML(sub.email)}</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

const QUESTION_KEYS = {
  1: 'q1_rashes',
  2: 'q2_stinging',
  3: 'q3_dampness',
  4: 'q4_skin_texture',
  5: 'q5_odor_control',
  6: 'q6_absorption',
  7: 'q7_leakage',
  8: 'q8_overall_experience'
};

function renderQuestionTab(qnNum, list) {
  const container = document.getElementById(`q${qnNum}-submissions-list`);
  if (!container) return;

  const key = QUESTION_KEYS[qnNum];
  const qList = list.filter(s => s[key]);

  if (qList.length === 0) {
    container.innerHTML = `<div class="empty-box">No responses for Q${qnNum} yet.</div>`;
    return;
  }

  container.innerHTML = qList.map(sub => {
    const formattedDate = new Date(sub.createdAt).toLocaleDateString('en-IN');
    const displayName = sub.email || sub.name || 'Verified Respondent';
    const initial = (displayName[0] || 'V').toUpperCase();
    const ansVal = sub[key];

    return `
      <div class="qn-card">
        <div class="qn-card-top">
          <div class="user-meta">
            <div class="user-avatar">${initial}</div>
            <div class="user-name">${escapeHTML(displayName)}</div>
          </div>
          <span class="sub-date">${formattedDate}</span>
        </div>
        <div style="margin-top: 6px;">
          <span class="ans-val-pill ${getBadgeClass(ansVal)}" style="font-size: 0.92rem; padding: 4px 10px;">
            ${escapeHTML(ansVal)}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// Render Chart.js for all questions
function renderAllCharts(stats) {
  const qConfigs = [
    {
      num: 1,
      key: 'q1',
      labels: ['Bilkul nahi (Zero irritation)', 'Bohat kam', 'Moderate (Kabhi kabhi)', 'Severe (Kaafi zyada rashes)'],
      shortLabels: ['Zero Irritation', 'Minimal', 'Moderate', 'Severe Rashes'],
      colors: ['#10b981', '#0ea5e9', '#f59e0b', '#ef4444']
    },
    {
      num: 2,
      key: 'q2',
      labels: ['Bilkul nahi', 'Sirf light flow ke time', 'Pehle din se continuous'],
      shortLabels: ['No Stinging', 'Light Flow Only', 'Continuous'],
      colors: ['#10b981', '#f59e0b', '#ef4444']
    },
    {
      num: 3,
      key: 'q3',
      labels: ['Dry and fresh laga', 'Thoda sa gila-pan tha', 'Bohot zyada pasina/dampness tha'],
      shortLabels: ['Dry & Fresh', 'Mild Dampness', 'Heavy Sweat'],
      colors: ['#10b981', '#f59e0b', '#ef4444']
    },
    {
      num: 4,
      key: 'q4',
      labels: ['Skin normal aur safe rahi', 'Thodi sticky lagi', 'Skin chhil gayi / redness aayi'],
      shortLabels: ['Safe & Normal', 'Slightly Sticky', 'Redness / Chhil gayi'],
      colors: ['#10b981', '#f59e0b', '#ef4444']
    },
    {
      num: 5,
      key: 'q5',
      labels: ['100% koi smell nahi aayi', 'Kaafi hadd tak control thi', 'Regular pads jaisi hi smell thi'],
      shortLabels: ['100% Odorless', 'Well Controlled', 'Like Regular Pads'],
      colors: ['#10b981', '#0ea5e9', '#f59e0b']
    },
    {
      num: 6,
      key: 'q6',
      labels: ['Turant absorb ho gaya (Surface dry raha)', 'Normal time liya', 'Upar hi thehra raha (Slow absorption)'],
      shortLabels: ['Instant Absorption', 'Normal Time', 'Slow / Pooled'],
      colors: ['#10b981', '#0ea5e9', '#ef4444']
    },
    {
      num: 7,
      key: 'q7',
      labels: ['Zero leakage', 'Heavy flow ke din thoda leak hua', 'Kaafi leakage hui'],
      shortLabels: ['Zero Leakage', 'Slight on Heavy Days', 'Frequent Leakage'],
      colors: ['#10b981', '#f59e0b', '#ef4444']
    },
    {
      num: 8,
      key: 'q8',
      labels: ['Bohot behtar (No rash + fresh feeling)', 'Lagbhag same', 'Uncomfortable laga'],
      shortLabels: ['Much Better (Fresh)', 'About The Same', 'Uncomfortable'],
      colors: ['#10b981', '#f59e0b', '#ef4444']
    }
  ];

  qConfigs.forEach(cfg => {
    const canvas = document.getElementById(`chart-q${cfg.num}`);
    if (!canvas) return;

    const counts = stats.questions?.[cfg.key] || {};
    const dataValues = cfg.labels.map(l => counts[l] || 0);

    if (charts[cfg.num]) {
      charts[cfg.num].destroy();
    }

    const ctx = canvas.getContext('2d');
    charts[cfg.num] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: cfg.shortLabels,
        datasets: [{
          label: 'Responses',
          data: dataValues,
          backgroundColor: cfg.colors,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => cfg.labels[items[0].dataIndex]
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, precision: 0 }
          }
        }
      }
    });
  });
}

// Delete submission
async function deleteSubmission(id) {
  if (!confirm('Are you sure you want to delete this submission?')) return;

  try {
    const res = await fetch(`/api/submissions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.success) {
      fetchData();
    } else {
      alert(data.message || 'Failed to delete');
    }
  } catch (err) {
    console.error('Error deleting submission:', err);
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
