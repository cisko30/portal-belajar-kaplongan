/**
 * Portal Belajar — Google Colab SQLite Database Client
 * Replaces Supabase with a direct REST connection to a Google Colab FastAPI + SQLite server.
 * Supports `?colab=https://...` auto-configuration link sharing for students & teachers.
 */
(function(window) {
  'use strict';

  const STORAGE_KEY = 'pb.colab.url';
  const TOKEN_KEY = 'pb.session.token';

  function normalizeUrl(u) {
    return String(u || '').trim().replace(/\/+$/, '');
  }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; }
  }

  function setToken(tok) {
    try {
      if (tok) localStorage.setItem(TOKEN_KEY, String(tok));
      else localStorage.removeItem(TOKEN_KEY);
    } catch (_) {}
  }

  // Allow 1-click connection via ?colab=https://xxxx.trycloudflare.com
  try {
    const params = new URLSearchParams(window.location.search);
    const colabParam = params.get('colab');
    if (colabParam) {
      const clean = normalizeUrl(colabParam);
      if (/^https?:\/\//i.test(clean)) {
        localStorage.setItem(STORAGE_KEY, clean);
        params.delete('colab');
        const nextUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
        window.history.replaceState(null, '', nextUrl);
      }
    }
  } catch (_) {}

  const config = {
    url: normalizeUrl(window.__COLAB_URL__ || localStorage.getItem(STORAGE_KEY) || '')
  };

  // Auto-load permanent Named Tunnel URL from /colab-config.json if configured
  const readyPromise = (async () => {
    if (config.url) return config.url;
    try {
      const r = await fetch('/colab-config.json', { cache: 'no-store' });
      if (r.ok) {
        const cfg = await r.json().catch(() => ({}));
        const defUrl = normalizeUrl(cfg.colabUrl);
        if (defUrl && /^https?:\/\//i.test(defUrl)) {
          config.url = defUrl;
          localStorage.setItem(STORAGE_KEY, defUrl);
        }
      }
    } catch (_) {}
    return config.url;
  })();

  async function req(path, opts = {}) {
    await readyPromise;
    if (!config.url) throw new Error('URL Server Google Colab belum diatur.');
    const tok = getToken();
    const baseHeaders = { 'ngrok-skip-browser-warning': '1' };
    if (tok) baseHeaders['Authorization'] = 'Bearer ' + tok;
    const headers = Object.assign(baseHeaders, opts.headers || {});
    const res = await fetch(config.url + path, Object.assign({}, opts, { headers }));
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json().catch(() => ({})) : {};
    if (!res.ok) {
      const err = new Error(data.detail || data.error || ('Colab API error (' + res.status + ')'));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const colabDb = {
    isReady: () => Boolean(config.url),
    whenReady: () => readyPromise,
    getUrl: () => config.url,
    getToken,
    setToken,
    setUrl: (url) => {
      config.url = normalizeUrl(url);
      if (config.url) localStorage.setItem(STORAGE_KEY, config.url);
      else localStorage.removeItem(STORAGE_KEY);
      return config.url;
    },

    async testConnection(url) {
      await readyPromise;
      const target = normalizeUrl(url || config.url);
      if (!target) throw new Error('URL Google Colab wajib diisi.');
      const res = await fetch(target + '/api/health', {
        cache: 'no-store',
        headers: { 'ngrok-skip-browser-warning': '1' }
      });
      if (!res.ok) throw new Error('Server Colab merespons status ' + res.status);
      return res.json();
    },

    auth: {
      async teacherLogin(password) {
        const res = await req('/api/teacher-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        if (res && res.token) setToken(res.token);
        return res;
      },
      async adminLogin(password) {
        const res = await req('/api/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        if (res && res.token) setToken(res.token);
        return res;
      },
      async studentLogin(nis, password) {
        const res = await req('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nis, password })
        });
        if (res && res.token) setToken(res.token);
        return res;
      },
      async verifyTeacherSession(passphrase) {
        return req('/api/teacher-session', {
          cache: 'no-store',
          headers: { 'x-guru-passphrase': passphrase || '' }
        });
      },
      async verifyToken() {
        return req('/api/auth/verify', { cache: 'no-store' });
      },
      signOut() {
        setToken('');
        localStorage.removeItem('userRole');
        localStorage.removeItem('pb.murid.nis');
        localStorage.removeItem('pb.murid.nama');
        localStorage.removeItem('pb.murid.myClass');
        localStorage.removeItem('pb.guru.passphrase');
        localStorage.removeItem('pb.session.role');
        sessionStorage.clear();
      }
    },

    catalog: {
      async pull() {
        return req('/api/catalog', { cache: 'no-store' });
      },
      async publish(payload, passphrase) {
        return req('/api/catalog', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-guru-passphrase': passphrase || ''
          },
          body: JSON.stringify(payload)
        });
      }
    },

    activity: {
      async pull() {
        return req('/api/activity', { cache: 'no-store' });
      },
      async publish(payload, passphrase) {
        return req('/api/activity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-guru-passphrase': passphrase || ''
          },
          body: JSON.stringify(payload)
        });
      }
    },

    submissions: {
      async submit(jenis, itemKey, entry) {
        return req('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jenis, itemKey: String(itemKey), entry })
        });
      }
    },

    accounts: {
      async list(passphrase) {
        return req('/api/accounts', {
          cache: 'no-store',
          headers: { 'x-guru-passphrase': passphrase || '' }
        });
      },
      async mutate(body, passphrase) {
        return req('/api/accounts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-guru-passphrase': passphrase || ''
          },
          body: JSON.stringify(body)
        });
      }
    },

    topics: {
      async list() {
        return req('/api/topics', { cache: 'no-store' });
      },
      async upsert(topics, passphrase) {
        return req('/api/topics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-guru-passphrase': passphrase || ''
          },
          body: JSON.stringify(Array.isArray(topics) ? { topics } : topics)
        });
      }
    },

    files: {
      async list(kelas) {
        const q = kelas && kelas !== 'ALL' ? ('?kelas=' + encodeURIComponent(kelas)) : '';
        const res = await req('/api/files' + q, { cache: 'no-store' });
        if (res && Array.isArray(res.files)) {
          res.files.forEach(f => {
            ['viewLink', 'previewLink', 'downloadLink'].forEach(k => {
              if (f[k] && f[k].startsWith('/')) f[k] = config.url + f[k];
            });
          });
        }
        return res;
      },
      async upload(file, kelas, passphrase) {
        await readyPromise;
        if (!config.url) throw new Error('URL Server Google Colab belum diatur.');
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kelas', kelas || 'ALL');
        const tok = getToken();
        const headers = {
          'ngrok-skip-browser-warning': '1',
          'x-guru-passphrase': passphrase || ''
        };
        if (tok) headers['Authorization'] = 'Bearer ' + tok;
        const res = await fetch(config.url + '/api/upload', {
          method: 'POST',
          headers,
          body: fd
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.detail || j.error || ('Upload gagal (' + res.status + ')'));
        ['viewLink', 'previewLink', 'downloadLink'].forEach(k => {
          if (j[k] && j[k].startsWith('/')) j[k] = config.url + j[k];
        });
        return j;
      }
    },

    leaderboard: {
      async get(kelas) {
        const q = kelas && kelas !== 'ALL' ? ('?kelas=' + encodeURIComponent(kelas)) : '';
        return req('/api/leaderboard' + q, { cache: 'no-store' });
      }
    },

    live: {
      async create(payload, passphrase) {
        return req('/api/live/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guru-passphrase': passphrase || '' },
          body: JSON.stringify(payload)
        });
      },
      async get(pin) {
        return req('/api/live/' + encodeURIComponent(String(pin).trim()), { cache: 'no-store' });
      },
      async join(payload) {
        return req('/api/live/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      },
      async score(payload) {
        return req('/api/live/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      },
      async setState(pin, status, passphrase) {
        return req('/api/live/' + encodeURIComponent(String(pin).trim()) + '/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guru-passphrase': passphrase || '' },
          body: JSON.stringify({ status })
        });
      }
    },

    async migrateAll(payload, passphrase) {
      return req('/api/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-guru-passphrase': passphrase || ''
        },
        body: JSON.stringify(payload)
      });
    },

    async resetAll(passphrase) {
      return req('/api/reset', {
        method: 'POST',
        headers: { 'x-guru-passphrase': passphrase || '' }
      });
    }
  };

  window.colabDb = colabDb;
})(window);
