const ADMIN_PASSWORD = 'Shubham@1003A';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Helper: read submissions from Cloudflare KV
    async function getSubmissions() {
      try {
        const raw = await env.SURVEY_DB.get('vyvia_submissions_list');
        if (raw) {
          return JSON.parse(raw);
        }
        // One-time automatic migration: separate VYVIA entries from legacy shared key
        const legacyRaw = await env.SURVEY_DB.get('submissions_list');
        if (legacyRaw) {
          const legacyList = JSON.parse(legacyRaw);
          const vyviaEntries = legacyList.filter(item => item && (item.q1_rashes !== undefined || item.q8_overall_experience !== undefined));
          if (vyviaEntries.length > 0) {
            await env.SURVEY_DB.put('vyvia_submissions_list', JSON.stringify(vyviaEntries));
            return vyviaEntries;
          }
        }
        return [];
      } catch (err) {
        console.error('KV Read Error:', err);
        return [];
      }
    }

    // Helper: save submissions to Cloudflare KV
    async function putSubmissions(list) {
      await env.SURVEY_DB.put('vyvia_submissions_list', JSON.stringify(list));
    }

    // JSON response helper with CORS
    function json(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token'
        }
      });
    }

    // Auth checker
    function isAuthorized() {
      const authHeader = request.headers.get('Authorization') || '';
      const customHeader = request.headers.get('x-admin-token') || '';
      const queryAuth = url.searchParams.get('auth') || '';

      const token = authHeader.replace(/^Bearer\s+/i, '') || customHeader || queryAuth;
      return token === ADMIN_PASSWORD;
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token'
        }
      });
    }

    // API: Login
    if (pathname === '/api/login' && request.method === 'POST') {
      try {
        const body = await request.json();
        if (body.password === ADMIN_PASSWORD) {
          return json({ success: true, token: ADMIN_PASSWORD });
        } else {
          return json({ success: false, message: 'Incorrect password' }, 401);
        }
      } catch (err) {
        return json({ success: false, message: 'Invalid request' }, 400);
      }
    }

    // API: Submit Survey (Public)
    if (pathname === '/api/submit' && request.method === 'POST') {
      try {
        const body = await request.json();
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
        } = body;

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
          name: (name || '').trim() || 'Verified Respondent',
          email: (email || '').trim(),
          phone: (phone || '').trim()
        };

        const submissions = await getSubmissions();
        submissions.unshift(newEntry);
        await putSubmissions(submissions);

        return json({
          success: true,
          message: 'VYVIA research response submitted successfully!',
          submission: newEntry
        }, 201);
      } catch (err) {
        return json({ success: false, message: err.message }, 500);
      }
    }

    // Protected Admin Endpoints Check
    if (pathname === '/api/submissions' || pathname === '/api/stats' || pathname.startsWith('/api/submissions/') || pathname === '/api/export') {
      if (!isAuthorized()) {
        return json({ success: false, message: 'Unauthorized: Password required' }, 401);
      }
    }

    // API: Get all submissions
    if (pathname === '/api/submissions' && request.method === 'GET') {
      const search = (url.searchParams.get('search') || '').toLowerCase().trim();
      let submissions = await getSubmissions();

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

      return json({
        success: true,
        total: submissions.length,
        submissions
      });
    }

    // API: Stats
    if (pathname === '/api/stats' && request.method === 'GET') {
      const submissions = await getSubmissions();
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

      return json({
        success: true,
        total,
        questionCounts,
        questions
      });
    }

    // API: Delete submission
    if (pathname.startsWith('/api/submissions/') && request.method === 'DELETE') {
      const id = pathname.replace('/api/submissions/', '');
      let submissions = await getSubmissions();
      const initialLength = submissions.length;
      submissions = submissions.filter(item => item.id !== id);

      if (submissions.length === initialLength) {
        return json({ success: false, message: 'Submission not found' }, 404);
      }

      await putSubmissions(submissions);
      return json({ success: true, message: 'Submission deleted' });
    }

    // API: Export CSV
    if (pathname === '/api/export' && request.method === 'GET') {
      const submissions = await getSubmissions();

      const headers = [
        'Respondent Email',
        'Q1 (Rashes/Chafing with Current Pads)',
        'Q2 (Burning/Stinging in Intimate Area)',
        'Q3 (Dampness/Sweat & Breathability)',
        'Q4 (Vulvar Skin Health & Chafing)',
        'Q5 (Period Odor & Bacterial Breakdown)',
        'Q6 (Absorption Speed & Clot Handling)',
        'Q7 (Side Leakage & Staining Frequency)',
        'Q8 (pH Pad Need & Switching Interest)',
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

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="VYVIA_PreLaunch_Research_Responses.csv"'
        }
      });
    }

    // Handle Static Assets Routing
    if (pathname === '/admin') {
      const adminUrl = new URL('/admin.html', request.url);
      if (env.ASSETS) return env.ASSETS.fetch(new Request(adminUrl, request));
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('VYVIA Research Survey Worker Running', { status: 200 });
  }
};
