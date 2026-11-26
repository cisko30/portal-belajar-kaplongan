/**
 * Portal Belajar — Unified Cloud Database Client
 * Priority order:
 * 1. Firebase Cloud Firestore (24/7 Free Spark, realtime onSnapshot, ?fb= / pb.firebase.config / /firebase-config.json)
 * 2. Google Colab SQLite Tunnel (?colab= / pb.colab.url / /colab-config.json)
 * 3. Same-origin /api/health server (if running persistent local server with engine tag)
 * 4. Offline Mode Lokal (localStorage fallback)
 */
(function (window) {
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

  let explicitColabUrl = '';
  try {
    const params = new URLSearchParams(window.location.search);
    const colabParam = params.get('colab');
    if (colabParam !== null) {
      const clean = normalizeUrl(colabParam);
      if (clean === 'reset' || clean === 'auto' || clean === 'local') {
        localStorage.removeItem(STORAGE_KEY);
      } else if (/^https?:\/\//i.test(clean)) {
        localStorage.setItem(STORAGE_KEY, clean);
        explicitColabUrl = clean;
      }
      params.delete('colab');
      const nextUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
      window.history.replaceState(null, '', nextUrl);
    }
  } catch (_) {}

  const savedRemoteUrl = normalizeUrl(window.__COLAB_URL__ || explicitColabUrl || localStorage.getItem(STORAGE_KEY) || '');
  const config = {
    url: savedRemoteUrl,
    sameOrigin: false,
    engine: savedRemoteUrl ? 'Google Colab SQLite' : ''
  };

  function fb() {
    return (window.firebaseDb && window.firebaseDb.isReady()) ? window.firebaseDb : null;
  }

  function ensureFirebaseLoaded() {
    if (window.firebaseDb) return Promise.resolve(window.firebaseDb);
    if (typeof document === 'undefined' || !document.head) return Promise.resolve(null);
    return new Promise((resolve) => {
      const existing = document.querySelector('script[src*="firebase-client.js"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.firebaseDb || null), { once: true });
        existing.addEventListener('error', () => resolve(null), { once: true });
        setTimeout(() => resolve(window.firebaseDb || null), 2000);
        return;
      }
      const s = document.createElement('script');
      s.src = '/firebase-client.js';
      s.async = false;
      s.onload = () => resolve(window.firebaseDb || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }

  async function probeHealthUrl(baseUrl, timeoutMs) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tid = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs || 3500) : null;
    try {
      const r = await fetch((baseUrl || '') + '/api/health', {
        cache: 'no-store',
        headers: { 'ngrok-skip-browser-warning': '1' },
        signal: ctrl ? ctrl.signal : undefined
      });
      const ct = r.headers.get('content-type') || '';
      if (!r.ok || !ct.includes('json')) return null;
      const data = await r.json().catch(() => null);
      if (data && data.ok === true && typeof data.engine === 'string' && data.engine.length > 0) {
        return data;
      }
      return null;
    } catch (_) {
      return null;
    } finally {
      if (tid) clearTimeout(tid);
    }
  }

  const readyPromise = (async () => {
    const fbInst = await ensureFirebaseLoaded();
    if (fbInst && fbInst.whenReady) {
      await fbInst.whenReady();
      if (fbInst.isReady()) return fbInst.getUrl();
    }

    if (config.url) return config.url;

    try {
      const r = await fetch('/colab-config.json', { cache: 'no-store' });
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
        const cfg = await r.json().catch(() => ({}));
        const defUrl = normalizeUrl(cfg.colabUrl);
        if (defUrl && /^https?:\/\//i.test(defUrl)) {
          config.url = defUrl;
          config.sameOrigin = false;
          config.engine = 'Google Colab SQLite';
          localStorage.setItem(STORAGE_KEY, defUrl);
          return config.url;
        }
      }
    } catch (_) {}

    const localHealth = await probeHealthUrl('', 3000);
    if (localHealth) {
      config.sameOrigin = true;
      config.url = window.location.origin;
      config.engine = localHealth.engine || 'Server Lokal';
      return config.url;
    }
    return '';
  })();

  async function req(path, opts = {}) {
    await readyPromise;
    if (!config.url && !config.sameOrigin) throw new Error('Database Cloud belum terhubung (Firebase / Colab belum diatur).');
    const base = config.sameOrigin ? '' : config.url;
    const tok = getToken();
    const baseHeaders = { 'ngrok-skip-browser-warning': '1' };
    if (tok) baseHeaders['Authorization'] = 'Bearer ' + tok;
    const headers = Object.assign(baseHeaders, opts.headers || {});
    const res = await fetch(base + path, Object.assign({}, opts, { headers }));
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('json') ? await res.json().catch(() => ({})) : {};
    if (!res.ok) {
      const err = new Error(data.detail || data.error || ('API error (' + res.status + ')'));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const colabDb = {
    isReady: () => Boolean(fb() || config.sameOrigin || config.url),
    isFirebase: () => Boolean(fb()),
    isSameOrigin: () => Boolean(!fb() && config.sameOrigin),
    whenReady: () => readyPromise,
    getUrl: () => fb() ? fb().getUrl() : (config.sameOrigin ? '' : config.url),
    getEngine: () => fb() ? fb().getEngine() : (config.engine || (config.url ? 'Google Colab SQLite' : '')),
    getModeLabel: () => {
      if (fb()) return fb().getModeLabel();
      if (!config.sameOrigin && !config.url) return 'Mode Lokal';
      const eng = (config.engine || '').toLowerCase();
      if (eng.includes('lokal') || eng.includes('lan')) return 'Server Lokal Aktif';
      return 'Colab SQLite Aktif';
    },
    getToken,
    setToken,

    setFirebaseConfig: (raw) => {
      if (!window.firebaseDb) throw new Error('Modul Firebase belum dimuat.');
      return window.firebaseDb.setConfig(raw);
    },
    getFirebaseConfig: () => window.firebaseDb ? window.firebaseDb.getConfig() : null,
    parseFirebaseConfig: (raw) => window.firebaseDb ? window.firebaseDb.parseConfigInput(raw) : null,
    encodeFirebaseToken: (cfg) => window.firebaseDb ? window.firebaseDb.encodeConfigToken(cfg) : '',

    setUrl: (url) => {
      const clean = normalizeUrl(url);
      if (clean) {
        config.url = clean;
        config.sameOrigin = false;
        config.engine = 'Google Colab SQLite';
        localStorage.setItem(STORAGE_KEY, clean);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        config.url = '';
        config.sameOrigin = false;
        config.engine = '';
      }
      return config.url;
    },

    async testConnection(urlOrConfig) {
      await readyPromise;
      if (urlOrConfig && typeof urlOrConfig === 'object') {
        return window.firebaseDb.testConnection(urlOrConfig);
      }
      if (!urlOrConfig && fb()) {
        return fb().testConnection();
      }
      if (typeof urlOrConfig === 'string' && urlOrConfig.includes('{')) {
        return window.firebaseDb.testConnection(urlOrConfig);
      }
      const target = normalizeUrl(urlOrConfig);
      if (!target && config.sameOrigin) {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) throw new Error('Server merespons status ' + res.status);
        const h = await res.json();
        if (h && h.engine) config.engine = h.engine;
        return h;
      }
      const effectiveTarget = target || (config.sameOrigin ? '' : config.url);
      if (!effectiveTarget && !config.sameOrigin) throw new Error('Konfigurasi Firebase / URL Server wajib diisi.');
      const res = await fetch(effectiveTarget + '/api/health', {
        cache: 'no-store',
        headers: { 'ngrok-skip-browser-warning': '1' }
      });
      if (!res.ok) throw new Error('Server merespons status ' + res.status);
      const h = await res.json();
      if (h && h.engine) config.engine = h.engine;
      return h;
    },

    auth: {
      async teacherLogin(password) {
        if (fb()) return fb().auth.teacherLogin(password);
        const res = await req('/api/teacher-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        if (res && res.token) setToken(res.token);
        return res;
      },
      async adminLogin(password) {
        if (fb()) return fb().auth.adminLogin(password);
        const res = await req('/api/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        if (res && res.token) setToken(res.token);
        return res;
      },
      async studentLogin(nis, password) {
        if (fb()) return fb().auth.studentLogin(nis, password);
        const res = await req('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nis, password })
        });
        if (res && res.token) setToken(res.token);
        return res;
      },
      async changeStudentPassword(nis, currentPassword, newPassword) {
        if (fb()) return fb().auth.changeStudentPassword(nis, currentPassword, newPassword);
        const res = await req('/api/student/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nis, currentPassword, newPassword })
        });
        if (res && res.token) setToken(res.token);
        return res;
      },
      async verifyTeacherSession(passphrase) {
        if (fb()) return fb().auth.verifyTeacherSession(passphrase);
        return req('/api/teacher-session', {
          cache: 'no-store',
          headers: { 'x-guru-passphrase': passphrase || '' }
        });
      },
      async verifyAdminSession(passphrase) {
        if (fb()) return fb().auth.verifyAdminSession(passphrase);
        return req('/api/teacher-session', {
          cache: 'no-store',
          headers: { 'x-guru-passphrase': passphrase || '' }
        });
      },
      async updateStaffCredentials(currentAdminPass, newGuruPass, newAdminPass) {
        if (fb()) return fb().auth.updateStaffCredentials(currentAdminPass, newGuruPass, newAdminPass);
        throw new Error('Ganti password Admin/Guru hanya tersedia saat terhubung ke Firebase Cloud.');
      },
      async verifyToken() {
        if (fb()) return fb().auth.verifyToken();
        return req('/api/auth/verify', { cache: 'no-store' });
      },
      signOut() {
        if (window.firebaseDb) window.firebaseDb.auth.signOut();
        setToken('');
        try {
          localStorage.removeItem('userRole');
          localStorage.removeItem('pb.murid.nis');
          localStorage.removeItem('pb.murid.nama');
          localStorage.removeItem('pb.murid.myClass');
          localStorage.removeItem('pb.guru.passphrase');
          localStorage.removeItem('pb.session.role');
          sessionStorage.clear();
        } catch (_) {}
      }
    },

    catalog: {
      async pull() {
        if (fb()) return fb().catalog.pull();
        return req('/api/catalog', { cache: 'no-store' });
      },
      async publish(payload, passphrase) {
        if (fb()) return fb().catalog.publish(payload, passphrase);
        return req('/api/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guru-passphrase': passphrase || '' },
          body: JSON.stringify(payload)
        });
      }
    },

    activity: {
      async pull() {
        if (fb()) return fb().activity.pull();
        return req('/api/activity', { cache: 'no-store' });
      },
      async publish(payload, passphrase) {
        if (fb()) return fb().activity.publish(payload, passphrase);
        return req('/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guru-passphrase': passphrase || '' },
          body: JSON.stringify(payload)
        });
      }
    },

    submissions: {
      async submit(jenis, itemKey, entry, onProgress) {
        if (fb()) return fb().submissions.submit(jenis, itemKey, entry, onProgress);
        return req('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jenis, itemKey: String(itemKey), entry })
        });
      }
    },

    accounts: {
      async list(passphrase) {
        if (fb()) return fb().accounts.list(passphrase);
        return req('/api/accounts', {
          cache: 'no-store',
          headers: { 'x-guru-passphrase': passphrase || '' }
        });
      },
      async mutate(body, passphrase) {
        if (fb()) return fb().accounts.mutate(body, passphrase);
        return req('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guru-passphrase': passphrase || '' },
          body: JSON.stringify(body)
        });
      }
    },

    topics: {
      async list() {
        if (fb()) return fb().topics.list();
        return req('/api/topics', { cache: 'no-store' });
      },
      async upsert(topics, passphrase) {
        if (fb()) return fb().topics.upsert(topics, passphrase);
        return req('/api/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guru-passphrase': passphrase || '' },
          body: JSON.stringify(Array.isArray(topics) ? { topics } : topics)
        });
      }
    },

    files: {
      async list(kelas) {
        if (fb()) return fb().files.list(kelas);
        const q = kelas && kelas !== 'ALL' ? ('?kelas=' + encodeURIComponent(kelas)) : '';
        const res = await req('/api/files' + q, { cache: 'no-store' });
        const prefix = config.sameOrigin ? '' : config.url;
        if (res && Array.isArray(res.files) && prefix) {
          res.files.forEach(f => {
            ['viewLink', 'previewLink', 'downloadLink'].forEach(k => {
              if (f[k] && f[k].startsWith('/')) f[k] = prefix + f[k];
            });
          });
        }
        return res;
      },
      async upload(file, kelas, passphrase, onProgress) {
        if (fb()) return fb().files.upload(file, kelas, passphrase, onProgress);
        await readyPromise;
        if (!config.sameOrigin && !config.url) throw new Error('Database Cloud belum terhubung.');
        const prefix = config.sameOrigin ? '' : config.url;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kelas', kelas || 'ALL');
        const tok = getToken();
        const headers = { 'ngrok-skip-browser-warning': '1', 'x-guru-passphrase': passphrase || '' };
        if (tok) headers['Authorization'] = 'Bearer ' + tok;
        const res = await fetch(prefix + '/api/upload', { method: 'POST', headers, body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          const err = new Error(j.detail || j.error || ('Upload gagal (' + res.status + ')'));
          err.status = res.status;
          throw err;
        }
        if (prefix) {
          ['viewLink', 'previewLink', 'downloadLink'].forEach(k => {
            if (j[k] && j[k].startsWith('/')) j[k] = prefix + j[k];
          });
        }
        return j;
      },
      async resolveBlobUrl(fileRef) {
        if (fb()) return fb().files.resolveBlobUrl(fileRef);
        return String(fileRef || '');
      },
      async remove(id, passphrase) {
        if (fb()) return fb().files.remove(id, passphrase);
        return req('/api/files/' + encodeURIComponent(String(id || '')), {
          method: 'DELETE',
          headers: { 'x-guru-passphrase': passphrase || '' }
        });
      }
    },

    leaderboard: {
      async get(kelas) {
        if (fb()) return fb().leaderboard.get(kelas);
        const q = kelas && kelas !== 'ALL' ? ('?kelas=' + encodeURIComponent(kelas)) : '';
        return req('/api/leaderboard' + q, { cache: 'no-store' });
      }
    },

    live: {
      async create(payload, passphrase) {
        if (fb()) return fb().live.create(payload, passphrase);
        return req('/api/live/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guru-passphrase': passphrase || '' },
          body: JSON.stringify(payload)
        });
      },
      async get(pin) {
        if (fb()) return fb().live.get(pin);
        return req('/api/live/' + encodeURIComponent(String(pin).trim()), { cache: 'no-store' });
      },
      async join(payload) {
        if (fb()) return fb().live.join(payload);
        return req('/api/live/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      },
      async score(payload) {
        if (fb()) return fb().live.score(payload);
        return req('/api/live/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      },
      async setState(pin, status, passphrase) {
        if (fb()) return fb().live.setState(pin, status, passphrase);
        return req('/api/live/' + encodeURIComponent(String(pin).trim()) + '/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-guru-passphrase': passphrase || '' },
          body: JSON.stringify({ status })
        });
      }
    },

    async migrateAll(payload, passphrase) {
      if (fb()) return fb().migrateAll(payload, passphrase);
      return req('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-guru-passphrase': passphrase || '' },
        body: JSON.stringify(payload)
      });
    },

    async resetAll(passphrase) {
      if (fb()) return fb().resetAll(passphrase);
      return req('/api/reset', {
        method: 'POST',
        headers: { 'x-guru-passphrase': passphrase || '' }
      });
    }
  };

  window.colabDb = colabDb;
})(window);
