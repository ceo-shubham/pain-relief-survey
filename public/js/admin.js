let allSubmissions = [];
let currentTab = 'all';
let q1ChartInstance = null;

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
      renderQ1Chart(statsData);
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
  document.getElementById('stat-total-submissions').textContent = stats.total || 0;
  document.getElementById('stat-q1-yes-count').textContent = stats.q1?.yes || 0;
  document.getElementById('stat-q1-avg-score').textContent = stats.q1?.avgScore ? `${stats.q1.avgScore} / 5` : '0.0';
  document.getElementById('stat-contact-shared').textContent = stats.contactCount || 0;

  // Update tab counter badges
  document.getElementById('count-all').textContent = stats.total || 0;
  document.getElementById('count-q1').textContent = stats.questionResponseCounts?.q1 || 0;
  document.getElementById('count-q2').textContent = stats.questionResponseCounts?.q2 || 0;
  document.getElementById('count-q3').textContent = stats.questionResponseCounts?.q3 || 0;
  document.getElementById('count-q4').textContent = stats.questionResponseCounts?.q4 || 0;
  document.getElementById('count-q5').textContent = stats.questionResponseCounts?.q5 || 0;
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
        (item.phone && item.phone.toLowerCase().includes(query)) ||
        (item.q2_flaws && item.q2_flaws.toLowerCase().includes(query)) ||
        (item.q3_market_gap && item.q3_market_gap.toLowerCase().includes(query)) ||
        (item.q4_alternate && item.q4_alternate.toLowerCase().includes(query)) ||
        (item.q5_other_pain && item.q5_other_pain.toLowerCase().includes(query)) ||
        (item.q1_relief && item.q1_relief.toLowerCase().includes(query))
      );
    });
  }

  renderAllSubmissionsTab(filtered);
  renderQ1Tab(filtered);
  renderQ2Tab(filtered);
  renderQ3Tab(filtered);
  renderQ4Tab(filtered);
  renderQ5Tab(filtered);

  if (window.feather) feather.replace();
}

// Render ALL tab
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

    let q1Display = '<span style="color: #94a3b8;">Not answered</span>';
    if (sub.q1_relief === 'yes') {
      q1Display = `<span style="color: #059669; font-weight: 700;">👍 Yes, Relief milta hai</span> ${
        sub.q1_level ? `<span style="background: #ffe4e6; color: #e11d48; padding: 2px 7px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; margin-left: 6px;">Level ${sub.q1_level} / 5</span>` : ''
      }`;
    } else if (sub.q1_relief === 'no') {
      q1Display = '<span style="color: #dc2626; font-weight: 700;">👎 No, Relief nahi milta</span>';
    }

    const displayName = sub.email || sub.name || 'Anonymous User';
    const initial = (displayName[0] || 'U').toUpperCase();

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

        <div style="display: grid; gap: 8px; margin-top: 10px; font-size: 0.88rem;">
          <div>
            <strong style="color: #64748b; font-size: 0.78rem;">Ans1 (Heating Pad Relief):</strong>
            <div style="margin-top: 2px;">${q1Display}</div>
          </div>

          <div>
            <strong style="color: #64748b; font-size: 0.78rem;">Ans2 (Flaws / Problems):</strong>
            <div class="${sub.q2_flaws ? 'qn-answer-text' : ''}" style="margin-top: 2px;">
              ${sub.q2_flaws ? escapeHTML(sub.q2_flaws) : '<span style="color: #94a3b8;">No response</span>'}
            </div>
          </div>

          <div>
            <strong style="color: #64748b; font-size: 0.78rem;">Ans3 (Market Gap / Wishlist):</strong>
            <div class="${sub.q3_market_gap ? 'qn-answer-text' : ''}" style="margin-top: 2px; border-left-color: #6366f1;">
              ${sub.q3_market_gap ? escapeHTML(sub.q3_market_gap) : '<span style="color: #94a3b8;">No response</span>'}
            </div>
          </div>

          <div>
            <strong style="color: #64748b; font-size: 0.78rem;">Ans4 (Alternate Solution & Why):</strong>
            <div class="${sub.q4_alternate ? 'qn-answer-text' : ''}" style="margin-top: 2px; border-left-color: #10b981;">
              ${sub.q4_alternate ? escapeHTML(sub.q4_alternate) : '<span style="color: #94a3b8;">No response</span>'}
            </div>
          </div>

          <div>
            <strong style="color: #64748b; font-size: 0.78rem;">Ans5 (Other Pain Areas & Heating Pad Efficacy):</strong>
            <div class="${sub.q5_other_pain ? 'qn-answer-text' : ''}" style="margin-top: 2px; border-left-color: #f59e0b;">
              ${sub.q5_other_pain ? escapeHTML(sub.q5_other_pain) : '<span style="color: #94a3b8;">No response</span>'}
            </div>
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

// Render QN1 tab
function renderQ1Tab(list) {
  const container = document.getElementById('q1-submissions-list');
  const q1List = list.filter(s => s.q1_relief);

  if (q1List.length === 0) {
    container.innerHTML = '<div class="empty-box">No responses for QN1 yet.</div>';
    return;
  }

  container.innerHTML = q1List.map(sub => {
    const formattedDate = new Date(sub.createdAt).toLocaleDateString('en-IN');
    const displayName = sub.email || sub.name || 'Anonymous User';
    const initial = (displayName[0] || 'U').toUpperCase();

    let ratingBadge = '';
    if (sub.q1_relief === 'yes') {
      ratingBadge = `
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 8px 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px;">
          <span>👍</span>
          <div>
            <strong style="color: #065f46; font-size: 0.88rem;">Yes, Relief milta hai</strong>
            ${sub.q1_level ? `<div style="color: #e11d48; font-weight: 700; font-size: 0.82rem;">Relief Level: ${sub.q1_level} out of 5</div>` : ''}
          </div>
        </div>
      `;
    } else {
      ratingBadge = `
        <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 8px; display: inline-flex; align-items: center; gap: 8px;">
          <span>👎</span>
          <strong style="color: #991b1b; font-size: 0.88rem;">No, Relief nahi milta</strong>
        </div>
      `;
    }

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
          ${ratingBadge}
        </div>
      </div>
    `;
  }).join('');
}

// Render QN2 tab
function renderQ2Tab(list) {
  const container = document.getElementById('q2-submissions-list');
  const q2List = list.filter(s => s.q2_flaws);

  if (q2List.length === 0) {
    container.innerHTML = '<div class="empty-box">No written feedback for QN2 yet.</div>';
    return;
  }

  container.innerHTML = q2List.map(sub => renderTextResponseCard(sub, sub.q2_flaws, '#e11d48')).join('');
}

// Render QN3 tab
function renderQ3Tab(list) {
  const container = document.getElementById('q3-submissions-list');
  const q3List = list.filter(s => s.q3_market_gap);

  if (q3List.length === 0) {
    container.innerHTML = '<div class="empty-box">No written feedback for QN3 yet.</div>';
    return;
  }

  container.innerHTML = q3List.map(sub => renderTextResponseCard(sub, sub.q3_market_gap, '#6366f1')).join('');
}

// Render QN4 tab
function renderQ4Tab(list) {
  const container = document.getElementById('q4-submissions-list');
  const q4List = list.filter(s => s.q4_alternate);

  if (q4List.length === 0) {
    container.innerHTML = '<div class="empty-box">No written feedback for QN4 yet.</div>';
    return;
  }

  container.innerHTML = q4List.map(sub => renderTextResponseCard(sub, sub.q4_alternate, '#10b981')).join('');
}

// Render QN5 tab
function renderQ5Tab(list) {
  const container = document.getElementById('q5-submissions-list');
  const q5List = list.filter(s => s.q5_other_pain);

  if (q5List.length === 0) {
    container.innerHTML = '<div class="empty-box">No written feedback for QN5 yet.</div>';
    return;
  }

  container.innerHTML = q5List.map(sub => renderTextResponseCard(sub, sub.q5_other_pain, '#f59e0b')).join('');
}

function renderTextResponseCard(sub, textContent, accentColor) {
  const formattedDate = new Date(sub.createdAt).toLocaleDateString('en-IN');
  const displayName = sub.email || sub.name || 'Anonymous User';
  const initial = (displayName[0] || 'U').toUpperCase();

  return `
    <div class="qn-card">
      <div class="qn-card-top">
        <div class="user-meta">
          <div class="user-avatar">${initial}</div>
          <div class="user-name">${escapeHTML(displayName)}</div>
        </div>
        <span class="sub-date">${formattedDate}</span>
      </div>
      <div class="qn-answer-text" style="border-left-color: ${accentColor};">
        ${escapeHTML(textContent)}
      </div>
    </div>
  `;
}

// Render Chart for Q1 Ratings
function renderQ1Chart(stats) {
  const canvas = document.getElementById('q1RatingChart');
  if (!canvas) return;

  const ratings = stats.q1?.ratings || { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  const noCount = stats.q1?.no || 0;

  const labels = ['L1 (Mild)', 'L2 (Slight)', 'L3 (Moderate)', 'L4 (Good)', 'L5 (Complete)', 'No Relief'];
  const data = [
    ratings['1'] || 0,
    ratings['2'] || 0,
    ratings['3'] || 0,
    ratings['4'] || 0,
    ratings['5'] || 0,
    noCount
  ];

  if (q1ChartInstance) {
    q1ChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');
  q1ChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Responses',
        data: data,
        backgroundColor: [
          '#fda4af',
          '#fb7185',
          '#f43f5e',
          '#e11d48',
          '#be123c',
          '#94a3b8'
        ],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 }
        }
      }
    }
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
