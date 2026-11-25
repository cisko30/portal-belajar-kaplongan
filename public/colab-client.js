/**
 * Portal Belajar — Google Colab SQLite Database Client
 * Replaces Supabase with a direct REST connection to a Google Colab FastAPI + SQLite server.
 * Supports `?colab=https://...` auto-configuration link sharing for students & teachers.
 */
(function(window) {
  'use strict';

  const STORAGE_KEY = 'pb.colab.url';

  function normalizeUrl(u) {
    return String(u || '').trim().replace(/\/+$/, '');
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

  async function req(path, opts = {}) {
    if (!config.url) throw new Error('URL Server Google Colab belum diatur.');
    const headers = Object.assign(
      { 'ngrok-skip-browser-warning': '1' },
      opts.headers || {}
    );
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
    getUrl: () => config.url,
    setUrl: (url) => {
      config.url = normalizeUrl(url);
      if (config.url) localStorage.setItem(STORAGE_KEY, config.url);
      else localStorage.removeItem(STORAGE_KEY);
      return config.url;
    },

    async testConnection(url) {
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
        return req('/api/teacher-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
      },
      async adminLogin(password) {
        return req('/api/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
      },
      async studentLogin(nis, password) {
        return req('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nis, password })
        });
      },
      async verifyTeacherSession(passphrase) {
        return req('/api/teacher-session', {
          cache: 'no-store',
          headers: { 'x-guru-passphrase': passphrase || '' }
        });
      },
      signOut() {
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
      async upload(file, kelas, passphrase) {
        if (!config.url) throw new Error('URL Server Google Colab belum diatur.');
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kelas', kelas || 'ALL');
        const res = await fetch(config.url + '/api/upload', {
          method: 'POST',
          headers: {
            'ngrok-skip-browser-warning': '1',
            'x-guru-passphrase': passphrase || ''
          },
          body: fd
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.detail || j.error || ('Upload gagal (' + res.status + ')'));
        // Make relative links absolute to Colab URL
        ['viewLink', 'previewLink', 'downloadLink'].forEach(k => {
          if (j[k] && j[k].startsWith('/')) j[k] = config.url + j[k];
        });
        return j;
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
