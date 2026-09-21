const ADMIN_PASSWORD = 'Shubham@1003A';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Helper: read submissions from Cloudflare KV
    async function getSubmissions() {
      try {
        const raw = await env.SURVEY_DB.get('submissions_list');
        return raw ? JSON.parse(raw) : [];
      } catch (err) {
        console.error('KV Read Error:', err);
        return [];
      }
    }

    // Helper: save submissions to Cloudflare KV
    async function putSubmissions(list) {
      await env.SURVEY_DB.put('submissions_list', JSON.stringify(list));
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
          q1_relief,
          q1_level,
          q2_flaws,
          q3_market_gap,
          q4_alternate,
          q5_other_pain,
          name,
          email,
          phone
        } = body;

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

        const submissions = await getSubmissions();
        submissions.unshift(newEntry);
        await putSubmissions(submissions);

        return json({
          success: true,
          message: 'Survey response submitted successfully!',
          submission: newEntry
        }, 201);
      } catch (err) {
        return json({ success: false, message: err.message }, 500);
      }
    }

    // Protected Admin Endpoints
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
            (item.q2_flaws && item.q2_flaws.toLowerCase().includes(search)) ||
            (item.q3_market_gap && item.q3_market_gap.toLowerCase().includes(search)) ||
            (item.q4_alternate && item.q4_alternate.toLowerCase().includes(search)) ||
            (item.q5_other_pain && item.q5_other_pain.toLowerCase().includes(search))
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

      return json({
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

    // API: Export CSV (Headers: Person Name, Ans1, Ans2, Ans3, Ans4, Ans5, Email, Phone, Date)
    if (pathname === '/api/export' && request.method === 'GET') {
      const submissions = await getSubmissions();

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

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="Pain_Relief_Survey_Responses.csv"'
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

    return new Response('Survey Worker Running', { status: 200 });
  }
};
