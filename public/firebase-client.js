/**
 * Portal Belajar SMA NU Kaplongan — Firebase Cloud Firestore Database Client
 * Provides 24/7 cross-device real-time persistence on Firebase Spark (Free Tier):
 * - Firestore collections: portal_catalog, portal_accounts, portal_submissions,
 *   portal_attendance, portal_topics, portal_files (+ chunked subcollection),
 *   portal_live_rooms, portal_settings
 * - Real-time cross-device sync via Firestore onSnapshot
 * - Chunked file storage inside Firestore so uploads work even without Blaze Storage
 * - Salted PBKDF2-SHA256 student password hashing & HMAC-SHA256 JWT staff tokens
 * - Supports ?fb=<base64-json>, localStorage['pb.firebase.config'], and /firebase-config.json
 */
(function (window) {
  'use strict';

  const CONFIG_LS_KEY = 'pb.firebase.config';
  const TOKEN_KEY = 'pb.session.token';
  const PASS_KEY = 'pb.guru.passphrase';
  const LEGACY_GURU = 'guru-kaplongan';
  const LEGACY_ADMIN = 'admin-kaplongan';
  const FIREBASE_SDK_BASE = 'https://www.gstatic.com/firebasejs/11.6.0/';
  const CHUNK_BYTES = 340000; // ~454KB base64 per chunk doc (safely < 1MB Firestore limit)
  const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB max per attachment

  function isValidConfig(cfg) {
    return Boolean(cfg && typeof cfg === 'object' && String(cfg.apiKey || '').trim() && String(cfg.projectId || '').trim());
  }

  /** Parse either JSON or raw `const firebaseConfig = { apiKey: "...", ... }` copied from Firebase Console. */
  function parseConfigInput(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return isValidConfig(raw) ? raw : null;
    let txt = String(raw || '').trim();
    if (!txt) return null;
    try {
      const direct = JSON.parse(txt);
      if (isValidConfig(direct)) return direct;
    } catch (_) {}

    // Support URL-safe base64 from ?fb=
    if (!txt.includes('{') && /^[A-Za-z0-9+/_=-]{20,}$/.test(txt)) {
      try {
        const b64 = txt.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (txt.length % 4)) % 4);
        const decoded = decodeURIComponent(escape(atob(b64)));
        const obj = JSON.parse(decoded);
        if (isValidConfig(obj)) return obj;
      } catch (_) {}
    }

    // Extract {...} block from JS snippet (`const firebaseConfig = { ... };`)
    const braceStart = txt.indexOf('{');
    const braceEnd = txt.lastIndexOf('}');
    if (braceStart >= 0 && braceEnd > braceStart) {
      let body = txt.slice(braceStart, braceEnd + 1);
      // Strip single-line // comments and /* ... */ comments safely outside quotes
      body = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      // Replace single-quoted strings with double-quoted strings
      body = body.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => '"' + inner.replace(/"/g, '\\"') + '"');
      // Quote unquoted keys (`apiKey:` -> `"apiKey":`)
      body = body.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":');
      // Remove trailing commas
      body = body.replace(/,\s*([}\]])/g, '$1');
      try {
        const obj = JSON.parse(body);
        if (isValidConfig(obj)) return obj;
      } catch (_) {}
    }
    return null;
  }

  function encodeConfigToken(cfg) {
    const clean = pickConfigFields(cfg);
    const jsonStr = JSON.stringify(clean);
    return btoa(unescape(encodeURIComponent(jsonStr))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function pickConfigFields(cfg) {
    const out = {};
    ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'].forEach((k) => {
      if (cfg && cfg[k]) out[k] = String(cfg[k]).trim();
    });
    return out;
  }

  function safeDocId(raw) {
    const s = String(raw || '').trim();
    if (!s) return '_empty_';
    return encodeURIComponent(s).replace(/\./g, '%2E').slice(0, 240);
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

  // Allow 1-click connection via ?fb=<base64-json> or ?fb=reset
  let explicitUrlConfig = null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fbParam = params.get('fb');
    if (fbParam !== null) {
      const cleaned = fbParam.trim();
      if (cleaned === 'reset' || cleaned === 'local' || cleaned === 'clear') {
        localStorage.removeItem(CONFIG_LS_KEY);
      } else {
        const parsed = parseConfigInput(cleaned);
        if (parsed) {
          explicitUrlConfig = pickConfigFields(parsed);
          localStorage.setItem(CONFIG_LS_KEY, JSON.stringify(explicitUrlConfig));
        }
      }
      params.delete('fb');
      const nextUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
      window.history.replaceState(null, '', nextUrl);
    }
  } catch (_) {}

  let activeConfig = null;
  try {
    activeConfig = parseConfigInput(window.__FIREBASE_CONFIG__ || explicitUrlConfig || localStorage.getItem(CONFIG_LS_KEY) || '');
  } catch (_) {}

  let sdkCache = null;
  let dbInstance = null;
  let dbConfigSignature = '';
  let liveUnsubs = [];
  const blobUrlCache = Object.create(null);

  const readyPromise = (async () => {
    if (activeConfig) return activeConfig;
    try {
      const r = await fetch('/firebase-config.json', { cache: 'no-store' });
      const ct = r.headers.get('content-type') || '';
      if (r.ok && ct.includes('json')) {
        const cfg = await r.json().catch(() => null);
        const valid = parseConfigInput(cfg);
        if (valid) {
          activeConfig = pickConfigFields(valid);
          try { localStorage.setItem(CONFIG_LS_KEY, JSON.stringify(activeConfig)); } catch (_) {}
          return activeConfig;
        }
      }
    } catch (_) {}
    return null;
  })();

  async function ensureFirestore() {
    await readyPromise;
    if (!isValidConfig(activeConfig)) {
      throw new Error('Konfigurasi Firebase belum diatur. Buka Cloud & Sync atau isi public/firebase-config.json.');
    }
    const sig = JSON.stringify(pickConfigFields(activeConfig));
    if (dbInstance && dbConfigSignature === sig) return { db: dbInstance, fs: sdkCache.fs };

    if (!sdkCache) {
      if (window.__FIREBASE_SDKS__) {
        sdkCache = window.__FIREBASE_SDKS__;
      } else {
        const [appMod, fsMod] = await Promise.all([
          import(FIREBASE_SDK_BASE + 'firebase-app.js'),
          import(FIREBASE_SDK_BASE + 'firebase-firestore.js')
        ]);
        sdkCache = { appMod, fs: fsMod };
      }
    }

    const { appMod, fs } = sdkCache;
    const apps = typeof appMod.getApps === 'function' ? appMod.getApps() : [];
    const appName = 'pb-' + (activeConfig.projectId || 'default');
    let app = apps.find((a) => a.name === appName);
    if (!app) app = appMod.initializeApp(pickConfigFields(activeConfig), appName);

    try {
      if (typeof fs.initializeFirestore === 'function' && typeof fs.persistentLocalCache === 'function') {
        dbInstance = fs.initializeFirestore(app, {
          localCache: fs.persistentLocalCache(
            typeof fs.persistentMultipleTabManager === 'function'
              ? { tabManager: fs.persistentMultipleTabManager() }
              : {}
          )
        });
      } else {
        dbInstance = fs.getFirestore(app);
      }
    } catch (_) {
      dbInstance = fs.getFirestore(app);
    }
    dbConfigSignature = sig;
    return { db: dbInstance, fs };
  }

  // ── Web Crypto Helpers (PBKDF2-SHA256 & HMAC-SHA256 JWT) ──
  function toHex(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let out = '';
    for (let i = 0; i < b.length; i++) out += b[i].toString(16).padStart(2, '0');
    return out;
  }

  function timingSafeEqual(a, b) {
    const s1 = String(a || '');
    const s2 = String(b || '');
    if (!s1 || s1.length !== s2.length) return false;
    let diff = 0;
    for (let i = 0; i < s1.length; i++) diff |= s1.charCodeAt(i) ^ s2.charCodeAt(i);
    return diff === 0;
  }

  async function sha256Hex(txt) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(txt || '')));
    return toHex(buf);
  }

  async function hashPassword(password) {
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const salt = toHex(saltBytes);
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      key,
      256
    );
    return salt + '$' + toHex(bits);
  }

  async function verifyPassword(password, storedHash) {
    if (!storedHash) return true;
    if (!storedHash.includes('$')) return timingSafeEqual(password, storedHash);
    const parts = storedHash.split('$');
    const salt = parts[0];
    const expected = parts[1];
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      key,
      256
    );
    return timingSafeEqual(toHex(bits), expected);
  }

  function b64uEncode(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function b64uDecode(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function tokenSigningSecret() {
    const pid = (activeConfig && activeConfig.projectId) || 'pb-kaplongan';
    return sha256Hex('pb-firebase-jwt:' + pid + ':' + ((activeConfig && activeConfig.apiKey) || ''));
  }

  async function createSessionToken(role, subject, ttlSec) {
    const ttl = ttlSec || 60 * 60 * 24 * 7;
    const secret = await tokenSigningSecret();
    const nowTs = Math.floor(Date.now() / 1000);
    const expTs = nowTs + ttl;
    const enc = new TextEncoder();
    const header = b64uEncode(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
    const payload = b64uEncode(enc.encode(JSON.stringify({ role, sub: subject, iat: nowTs, exp: expTs })));
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(header + '.' + payload));
    return { token: header + '.' + payload + '.' + b64uEncode(new Uint8Array(sigBuf)), expiresAt: expTs };
  }

  async function verifySessionToken(token) {
    if (!token) return null;
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    try {
      const secret = await tokenSigningSecret();
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const expectedBuf = await crypto.subtle.sign('HMAC', key, enc.encode(parts[0] + '.' + parts[1]));
      if (!timingSafeEqual(parts[2], b64uEncode(new Uint8Array(expectedBuf)))) return null;
      const data = JSON.parse(new TextDecoder().decode(b64uDecode(parts[1])));
      if (!data || Number(data.exp || 0) < Math.floor(Date.now() / 1000)) return null;
      return data;
    } catch (_) {
      return null;
    }
  }

  async function getSecurityHashes(db, fs) {
    const ref = fs.doc(db, 'portal_settings', 'security');
    const snap = await fs.getDoc(ref);
    const defaultGuruHash = await sha256Hex('pb-staff:' + LEGACY_GURU);
    const defaultAdminHash = await sha256Hex('pb-staff:' + LEGACY_ADMIN);
    if (snap.exists()) {
      const d = snap.data() || {};
      return {
        guruHash: d.guruHash || defaultGuruHash,
        adminHash: d.adminHash || defaultAdminHash,
        seeded: true
      };
    }
    const payload = { guruHash: defaultGuruHash, adminHash: defaultAdminHash, updatedAt: new Date().toISOString() };
    try { await fs.setDoc(ref, payload); } catch (_) {}
    return { guruHash: defaultGuruHash, adminHash: defaultAdminHash, seeded: false };
  }

  async function verifyStaffCredential(passphrase, requiredRole) {
    const { db, fs } = await ensureFirestore();
    const given = String(passphrase || '');
    if (given) {
      const hashes = await getSecurityHashes(db, fs);
      const givenHash = await sha256Hex('pb-staff:' + given);
      const isAdmin = timingSafeEqual(givenHash, hashes.adminHash) || timingSafeEqual(given, LEGACY_ADMIN);
      const isGuru = timingSafeEqual(givenHash, hashes.guruHash) || timingSafeEqual(given, LEGACY_GURU);
      if (requiredRole === 'admin') {
        if (isAdmin) return 'admin';
      } else if (isAdmin || isGuru) {
        return isAdmin ? 'admin' : 'guru';
      }
    }
    const tok = await verifySessionToken(getToken());
    if (tok && (tok.role === 'admin' || (requiredRole !== 'admin' && tok.role === 'guru'))) {
      return tok.role;
    }
    return null;
  }

  async function requireStaff(passphrase) {
    const role = await verifyStaffCredential(passphrase || localStorage.getItem(PASS_KEY) || '', 'guru');
    if (!role) {
      const err = new Error('Passphrase guru / password admin atau token sesi tidak valid.');
      err.status = 401;
      throw err;
    }
    return role;
  }

  // ── Sanitizers & File Chunk Helpers ──
  function sanitizeJson(v) {
    if (v === undefined) return null;
    try { return JSON.parse(JSON.stringify(v)); } catch (_) { return null; }
  }

  function bytesToBase64(bytes) {
    let bin = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    }
    return btoa(bin);
  }

  function base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function dataUrlToBytes(dataUrl) {
    const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    return { mime: m[1] || 'application/octet-stream', bytes: base64ToBytes(m[2]) };
  }

  async function storeBinaryFile(db, fs, name, mime, bytes, kelas) {
    if (bytes.length > MAX_FILE_BYTES) {
      throw new Error('Berkas terlalu besar (maksimal 8 MB per lampiran di Firebase Firestore).');
    }
    const fileId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : ('f_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8));
    const safeName = String(name || 'materi').replace(/["\\\r\n/]/g, '_');
    const chunkCount = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES));
    const createdAt = new Date().toISOString();

    await fs.setDoc(fs.doc(db, 'portal_files', fileId), {
      id: fileId,
      name: safeName,
      mime_type: mime || 'application/octet-stream',
      size: bytes.length,
      kelas: String(kelas || 'ALL'),
      chunk_count: chunkCount,
      created_at: createdAt
    });

    const batch = fs.writeBatch(db);
    for (let idx = 0; idx < chunkCount; idx++) {
      const slice = bytes.subarray(idx * CHUNK_BYTES, (idx + 1) * CHUNK_BYTES);
      batch.set(fs.doc(db, 'portal_files', fileId, 'chunks', String(idx)), {
        idx,
        data_b64: bytesToBase64(slice)
      });
    }
    await batch.commit();

    return {
      id: fileId,
      name: safeName,
      mimeType: mime || 'application/octet-stream',
      size: bytes.length,
      firebaseFile: true,
      viewLink: 'pbfile://' + fileId,
      previewLink: 'pbfile://' + fileId,
      downloadLink: 'pbfile://' + fileId + '?download=1'
    };
  }

  async function offloadAttachmentIfLarge(db, fs, item, kelasHint) {
    if (!item || typeof item !== 'object' || !item.f || typeof item.f !== 'object') return item;
    const f = item.f;
    if (typeof f.data === 'string' && f.data.startsWith('data:') && f.data.length > 120000) {
      const parsed = dataUrlToBytes(f.data);
      if (parsed) {
        const up = await storeBinaryFile(db, fs, f.name || 'lampiran', parsed.mime || f.type, parsed.bytes, kelasHint || item.k || 'ALL');
        return Object.assign({}, item, {
          f: {
            id: up.id,
            name: up.name,
            size: up.size,
            type: up.mimeType,
            firebaseFile: true,
            data: up.viewLink,
            preview: up.previewLink,
            download: up.downloadLink
          }
        });
      }
    }
    return item;
  }

  // ── Catalog Operations ──
  const KINDS = ['materi', 'tugas', 'lkpd', 'quiz', 'pengumuman'];

  async function readCatalog(db, fs) {
    const snap = await fs.getDocs(fs.collection(db, 'portal_catalog'));
    const out = { materi: [], tugas: [], lkpd: [], quiz: [], pengumuman: [], updatedAt: undefined };
    snap.forEach((docSnap) => {
      const id = docSnap.id;
      const d = docSnap.data() || {};
      if (id === 'meta') {
        if (typeof d.updatedAt === 'string') out.updatedAt = d.updatedAt;
      } else if (id === 'shared') {
        KINDS.forEach((k) => { if (Array.isArray(d[k])) out[k] = d[k]; });
        if (typeof d.updatedAt === 'string' && !out.updatedAt) out.updatedAt = d.updatedAt;
      } else if (KINDS.includes(id)) {
        out[id] = Array.isArray(d.items) ? d.items : [];
        if (typeof d.updatedAt === 'string' && !out.updatedAt) out.updatedAt = d.updatedAt;
      }
    });
    return out;
  }

  async function writeCatalog(db, fs, payload) {
    const metaRef = fs.doc(db, 'portal_catalog', 'meta');
    const metaSnap = await fs.getDoc(metaRef);
    const currentRev = metaSnap.exists() ? (metaSnap.data().updatedAt || null) : null;
    if (payload.updatedAt !== undefined && !payload.force) {
      const expRev = typeof payload.updatedAt === 'string' ? payload.updatedAt : null;
      if (currentRev !== null && currentRev !== expRev) {
        const err = new Error('Katalog sudah diperbarui oleh perangkat lain. Muat ulang sebelum menyimpan.');
        err.status = 409;
        throw err;
      }
    }

    const ts = new Date().toISOString();
    const cleanOut = { updatedAt: ts };
    const batch = fs.writeBatch(db);

    for (const k of KINDS) {
      const rawArr = Array.isArray(payload[k]) ? payload[k] : [];
      const prepared = [];
      for (let i = 0; i < rawArr.length; i++) {
        const cleaned = sanitizeJson(await offloadAttachmentIfLarge(db, fs, rawArr[i], rawArr[i] && rawArr[i].k));
        if (cleaned !== null) prepared.push(cleaned);
      }
      cleanOut[k] = prepared;
      batch.set(fs.doc(db, 'portal_catalog', k), { items: prepared, updatedAt: ts });
    }
    batch.set(metaRef, { updatedAt: ts });
    await batch.commit();
    return cleanOut;
  }

  // ── Activity & Submissions Operations ──
  async function readActivity(db, fs) {
    const out = { tugas: {}, lkpd: {}, quiz: {}, absensi: {}, updatedAt: undefined };
    const [subSnap, attSnap] = await Promise.all([
      fs.getDocs(fs.collection(db, 'portal_submissions')),
      fs.getDocs(fs.collection(db, 'portal_attendance'))
    ]);
    subSnap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      const jenis = d.jenis;
      const itemKey = String(d.itemKey ?? '').trim();
      if (!['tugas', 'lkpd', 'quiz'].includes(jenis) || !itemKey) return;
      let entry = d.entry || null;
      if (!entry && typeof d.entryJson === 'string') {
        try { entry = JSON.parse(d.entryJson); } catch (_) {}
      }
      if (!entry || typeof entry !== 'object') return;
      out[jenis][itemKey] = out[jenis][itemKey] || [];
      out[jenis][itemKey].push(entry);
    });
    attSnap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      const k = String(d.key || docSnap.id);
      let val = d.data;
      if (val === undefined && typeof d.dataJson === 'string') {
        try { val = JSON.parse(d.dataJson); } catch (_) {}
      }
      if (val !== undefined) out.absensi[k] = val;
    });
    return out;
  }

  async function saveActivityPayload(db, fs, payload) {
    const ts = new Date().toISOString();
    const ops = [];
    for (const jenis of ['tugas', 'lkpd', 'quiz']) {
      const bucketMap = payload && payload[jenis];
      if (!bucketMap || typeof bucketMap !== 'object' || Array.isArray(bucketMap)) continue;
      for (const [itemKey, entries] of Object.entries(bucketMap)) {
        if (!Array.isArray(entries)) continue;
        for (const rawEntry of entries) {
          if (!rawEntry || typeof rawEntry !== 'object') continue;
          const cleaned = sanitizeJson(await offloadAttachmentIfLarge(db, fs, rawEntry, rawEntry.kelas));
          const uid = String(cleaned.userId || cleaned.nis || cleaned.nama || ('anon_' + Math.random().toString(36).slice(2, 8)));
          const id = `${jenis}__${safeDocId(itemKey)}__${safeDocId(uid)}`;
          ops.push({
            ref: fs.doc(db, 'portal_submissions', id),
            data: {
              id,
              jenis,
              itemKey: String(itemKey),
              userId: uid,
              nama: String(cleaned.nama || 'Siswa'),
              kelas: String(cleaned.kelas || ''),
              entryJson: JSON.stringify(cleaned),
              updatedAt: ts
            }
          });
        }
      }
    }
    const absMap = payload && payload.absensi;
    if (absMap && typeof absMap === 'object' && !Array.isArray(absMap)) {
      for (const [k, val] of Object.entries(absMap)) {
        const parts = String(k).split('|', 2);
        ops.push({
          ref: fs.doc(db, 'portal_attendance', safeDocId(k)),
          data: {
            key: String(k),
            kelas: parts[0] || '',
            tanggal: parts[1] || '',
            dataJson: JSON.stringify(val ?? {}),
            updatedAt: ts
          }
        });
      }
    }
    for (let i = 0; i < ops.length; i += 400) {
      const batch = fs.writeBatch(db);
      ops.slice(i, i + 400).forEach((op) => batch.set(op.ref, op.data));
      await batch.commit();
    }
    return readActivity(db, fs);
  }

  function cleanSubmission(jenis, entry) {
    const safe = Object.assign({}, entry || {});
    ['nilai', 'catatan', 'status', 'dinilaiPada'].forEach((f) => delete safe[f]);
    if (!String(safe.userId || '').trim()) {
      const err = new Error('Identitas siswa wajib diisi.');
      err.status = 400;
      throw err;
    }
    if (jenis === 'quiz') {
      const total = Number(safe.total);
      const benar = Number(safe.benar);
      if (!Number.isInteger(total) || total < 1 || !Number.isInteger(benar) || benar < 0 || benar > total) {
        const err = new Error('Jumlah jawaban quiz tidak valid.');
        err.status = 400;
        throw err;
      }
      safe.nilai = Math.round((benar / total) * 100);
      safe.status = 'Selesai';
    }
    return safe;
  }

  async function listAccounts(db, fs) {
    const snap = await fs.getDocs(fs.collection(db, 'portal_accounts'));
    const list = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() || {};
      if (!d.nis) return;
      list.push({
        nis: String(d.nis),
        nama: String(d.nama || ''),
        kelas: String(d.kelas || ''),
        terakhirMasuk: d.terakhirMasuk ?? undefined
      });
    });
    list.sort((a, b) => (a.kelas + a.nama).localeCompare(b.kelas + b.nama));
    return { accounts: list };
  }

  async function listTopics(db, fs) {
    const snap = await fs.getDocs(fs.collection(db, 'portal_topics'));
    const topics = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      if (d && d.id) topics.push(d);
    });
    return { topics };
  }

  // ── Live Snapshot Cache Helpers for Instant Sync ──
  function applyCatalogSnapshot(cat) {
    try {
      const hasRemote = !!cat.updatedAt || KINDS.some((k) => Array.isArray(cat[k]) && cat[k].length > 0);
      if (hasRemote) {
        localStorage.setItem('pb.guru.remote_catalog_synced', '1');
        KINDS.forEach((k) => {
          if (Array.isArray(cat[k])) localStorage.setItem('pb.guru.' + k, JSON.stringify(cat[k]));
        });
      }
    } catch (_) {}
  }

  function applyActivitySnapshot(act) {
    try {
      const LKEY = { tugas: 'pb.submissions.tugas', lkpd: 'pb.submissions.lkpd', quiz: 'pb.submissions.quiz' };
      ['tugas', 'lkpd', 'quiz'].forEach((k) => {
        if (act[k] && typeof act[k] === 'object') {
          if (k === 'quiz') {
            Object.values(act[k]).forEach((arr) => {
              (arr || []).forEach((e) => {
                if (e && e.total > 0 && e.benar >= 0 && e.benar <= e.total && e.nilai == null) {
                  e.nilai = Math.round((e.benar / e.total) * 100);
                }
              });
            });
          }
          localStorage.setItem(LKEY[k], JSON.stringify(act[k]));
        }
      });
      if (act.absensi && typeof act.absensi === 'object') {
        localStorage.setItem('pb.shared.absensi', JSON.stringify(act.absensi));
        if (act.absensi['__CONFIG__|modules'] && typeof act.absensi['__CONFIG__|modules'] === 'object') {
          const cfg = act.absensi['__CONFIG__|modules'];
          localStorage.setItem('pb.modules.config', JSON.stringify(cfg));
          if (Array.isArray(cfg.kelasList)) localStorage.setItem('pb.guru.kelas', JSON.stringify(cfg.kelasList));
          if (Array.isArray(cfg.bankSoal)) localStorage.setItem('pb.guru.bank', JSON.stringify(cfg.bankSoal));
        }
      }
    } catch (_) {}
  }

  function emitFirebaseSync(extraEvent) {
    try { window.dispatchEvent(new CustomEvent('pb:sync')); } catch (_) {}
    if (extraEvent) {
      try { window.dispatchEvent(new CustomEvent(extraEvent)); } catch (_) {}
    }
  }

  async function startRealtimeListeners() {
    if (liveUnsubs.length > 0) return;
    const { db, fs } = await ensureFirestore();
    if (typeof fs.onSnapshot !== 'function') return;

    let firstCat = true, firstSub = true, firstAtt = true, firstTop = true, firstAcc = true;

    liveUnsubs.push(fs.onSnapshot(fs.collection(db, 'portal_catalog'), (snap) => {
      const cat = { materi: [], tugas: [], lkpd: [], quiz: [], pengumuman: [], updatedAt: undefined };
      snap.forEach((docSnap) => {
        const id = docSnap.id;
        const d = docSnap.data() || {};
        if (id === 'meta' && typeof d.updatedAt === 'string') cat.updatedAt = d.updatedAt;
        else if (KINDS.includes(id)) {
          cat[id] = Array.isArray(d.items) ? d.items : [];
          if (typeof d.updatedAt === 'string' && !cat.updatedAt) cat.updatedAt = d.updatedAt;
        }
      });
      applyCatalogSnapshot(cat);
      if (!firstCat) emitFirebaseSync();
      firstCat = false;
    }, () => {}));

    const refreshActivityFromDocs = (subDocs, attDocs, notify) => {
      readActivity(db, fs).then((act) => {
        applyActivitySnapshot(act);
        if (notify) emitFirebaseSync();
      }).catch(() => {});
    };

    liveUnsubs.push(fs.onSnapshot(fs.collection(db, 'portal_submissions'), () => {
      refreshActivityFromDocs(null, null, !firstSub);
      firstSub = false;
    }, () => {}));

    liveUnsubs.push(fs.onSnapshot(fs.collection(db, 'portal_attendance'), () => {
      refreshActivityFromDocs(null, null, !firstAtt);
      firstAtt = false;
    }, () => {}));

    liveUnsubs.push(fs.onSnapshot(fs.collection(db, 'portal_topics'), (snap) => {
      const ovr = {};
      snap.forEach((docSnap) => {
        const t = docSnap.data() || {};
        if (t.id) {
          ovr[t.id] = {};
          if (t.video_url) ovr[t.id].video = t.video_url;
          if (t.deskripsi) ovr[t.id].desc = t.deskripsi;
        }
      });
      if (Object.keys(ovr).length > 0) {
        try {
          const cur = JSON.parse(localStorage.getItem('jenjangOverrides_v1') || '{}');
          localStorage.setItem('jenjangOverrides_v1', JSON.stringify(Object.assign({}, cur, ovr)));
        } catch (_) {}
      }
      if (!firstTop) emitFirebaseSync('pb:topics');
      firstTop = false;
    }, () => {}));

    const role = (localStorage.getItem('userRole') || '').replace(/^"|"$/g, '');
    if (role === 'guru' || role === 'admin') {
      liveUnsubs.push(fs.onSnapshot(fs.collection(db, 'portal_accounts'), (snap) => {
        const list = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() || {};
          if (!d.nis) return;
          list.push({ nis: String(d.nis), nama: String(d.nama || ''), kelas: String(d.kelas || ''), terakhirMasuk: d.terakhirMasuk ?? undefined });
        });
        if (list.length > 0 || localStorage.getItem('pb.guru.remote_catalog_synced') === '1') {
          try {
            localStorage.setItem('pb.accounts.seeded_v2', '1');
            localStorage.setItem('pb.cached.accounts', JSON.stringify(list));
          } catch (_) {}
        }
        if (!firstAcc) emitFirebaseSync();
        firstAcc = false;
      }, () => {}));
    }
  }

  function stopRealtimeListeners() {
    while (liveUnsubs.length) {
      const fn = liveUnsubs.pop();
      try { if (typeof fn === 'function') fn(); } catch (_) {}
    }
  }

  // ── Public API (100% compatible with colabDb contract + Firebase extras) ──
  const firebaseDb = {
    isReady: () => isValidConfig(activeConfig),
    whenReady: () => readyPromise,
    parseConfigInput,
    encodeConfigToken,
    getConfig: () => activeConfig ? pickConfigFields(activeConfig) : null,
    getUrl: () => (activeConfig && activeConfig.projectId) ? ('firebase://' + activeConfig.projectId) : '',
    getEngine: () => isValidConfig(activeConfig) ? 'Firebase Firestore' : '',
    getModeLabel: () => isValidConfig(activeConfig) ? 'Firebase Cloud Aktif' : 'Mode Lokal',
    getToken,
    setToken,
    startRealtime: startRealtimeListeners,
    stopRealtime: stopRealtimeListeners,

    setConfig: (rawInput) => {
      stopRealtimeListeners();
      dbInstance = null;
      dbConfigSignature = '';
      if (!rawInput || (typeof rawInput === 'string' && !rawInput.trim())) {
        activeConfig = null;
        try { localStorage.removeItem(CONFIG_LS_KEY); } catch (_) {}
        return null;
      }
      const parsed = parseConfigInput(rawInput);
      if (!parsed) throw new Error('Format Firebase Config tidak valid. Pastikan berisi apiKey dan projectId.');
      activeConfig = pickConfigFields(parsed);
      try { localStorage.setItem(CONFIG_LS_KEY, JSON.stringify(activeConfig)); } catch (_) {}
      return activeConfig;
    },

    async testConnection(rawInput) {
      if (rawInput) firebaseDb.setConfig(rawInput);
      const { db, fs } = await ensureFirestore();
      await getSecurityHashes(db, fs);
      const [accSnap, subSnap, topSnap, cat] = await Promise.all([
        fs.getDocs(fs.collection(db, 'portal_accounts')),
        fs.getDocs(fs.collection(db, 'portal_submissions')),
        fs.getDocs(fs.collection(db, 'portal_topics')),
        readCatalog(db, fs)
      ]);
      startRealtimeListeners().catch(() => {});
      return {
        ok: true,
        engine: 'Firebase Firestore',
        projectId: activeConfig.projectId,
        counts: {
          materi: cat.materi.length,
          tugas: cat.tugas.length,
          lkpd: cat.lkpd.length,
          quiz: cat.quiz.length,
          accounts: accSnap.size,
          submissions: subSnap.size,
          topics: topSnap.size
        },
        updatedAt: cat.updatedAt || null
      };
    },

    auth: {
      async teacherLogin(password) {
        const role = await verifyStaffCredential(password, 'guru');
        if (!role) {
          const err = new Error('Akun siswa tidak dapat masuk sebagai guru. Password guru/admin salah.');
          err.status = 401;
          throw err;
        }
        const tok = await createSessionToken(role, role);
        setToken(tok.token);
        startRealtimeListeners().catch(() => {});
        return { ok: true, role, token: tok.token, expiresAt: tok.expiresAt };
      },

      async adminLogin(password) {
        const role = await verifyStaffCredential(password, 'admin');
        if (!role) {
          const err = new Error('Password admin salah.');
          err.status = 401;
          throw err;
        }
        const tok = await createSessionToken('admin', 'admin');
        setToken(tok.token);
        startRealtimeListeners().catch(() => {});
        return { ok: true, role: 'admin', token: tok.token, expiresAt: tok.expiresAt };
      },

      async studentLogin(nis, password) {
        const cleanNis = String(nis || '').trim();
        const pw = String(password || '');
        if (!cleanNis || !pw) throw new Error('NIS dan password wajib diisi.');
        const { db, fs } = await ensureFirestore();
        const ref = fs.doc(db, 'portal_accounts', safeDocId(cleanNis));
        const snap = await fs.getDoc(ref);
        if (!snap.exists()) {
          const err = new Error('NIS belum terdaftar atau password salah.');
          err.status = 401;
          throw err;
        }
        const d = snap.data() || {};
        const ok = await verifyPassword(pw, d.passwordHash || null);
        if (!ok) {
          const err = new Error('NIS atau password salah.');
          err.status = 401;
          throw err;
        }
        const tsMs = Date.now();
        await fs.setDoc(ref, { terakhirMasuk: tsMs, updatedAt: new Date().toISOString() }, { merge: true });
        const tok = await createSessionToken('siswa', cleanNis);
        setToken(tok.token);
        startRealtimeListeners().catch(() => {});
        return {
          ok: true,
          role: 'siswa',
          token: tok.token,
          expiresAt: tok.expiresAt,
          account: { nis: d.nis, nama: d.nama, kelas: d.kelas, terakhirMasuk: tsMs }
        };
      },

      async verifyTeacherSession(passphrase) {
        await requireStaff(passphrase);
        return { ok: true };
      },

      async verifyToken() {
        const tok = await verifySessionToken(getToken());
        if (!tok) {
          const err = new Error('Token sesi kedaluwarsa atau tidak valid.');
          err.status = 401;
          throw err;
        }
        return { ok: true, role: tok.role, sub: tok.sub, expiresAt: tok.exp };
      },

      async updateStaffCredentials(currentPass, newGuruPass, newAdminPass) {
        await requireStaff(currentPass);
        const { db, fs } = await ensureFirestore();
        const cur = await getSecurityHashes(db, fs);
        const nextGuruHash = newGuruPass ? await sha256Hex('pb-staff:' + newGuruPass) : cur.guruHash;
        const nextAdminHash = newAdminPass ? await sha256Hex('pb-staff:' + newAdminPass) : cur.adminHash;
        await fs.setDoc(fs.doc(db, 'portal_settings', 'security'), {
          guruHash: nextGuruHash,
          adminHash: nextAdminHash,
          updatedAt: new Date().toISOString()
        });
        return { ok: true };
      },

      signOut() {
        setToken('');
        stopRealtimeListeners();
        try {
          localStorage.removeItem('userRole');
          localStorage.removeItem('pb.murid.nis');
          localStorage.removeItem('pb.murid.nama');
          localStorage.removeItem('pb.murid.myClass');
          localStorage.removeItem(PASS_KEY);
          localStorage.removeItem('pb.session.role');
          sessionStorage.clear();
        } catch (_) {}
      }
    },

    catalog: {
      async pull() {
        const { db, fs } = await ensureFirestore();
        startRealtimeListeners().catch(() => {});
        return readCatalog(db, fs);
      },
      async publish(payload, passphrase) {
        await requireStaff(passphrase);
        const { db, fs } = await ensureFirestore();
        return writeCatalog(db, fs, payload || {});
      }
    },

    activity: {
      async pull() {
        const { db, fs } = await ensureFirestore();
        startRealtimeListeners().catch(() => {});
        return readActivity(db, fs);
      },
      async publish(payload, passphrase) {
        await requireStaff(passphrase);
        const { db, fs } = await ensureFirestore();
        return saveActivityPayload(db, fs, payload || {});
      }
    },

    submissions: {
      async submit(jenis, itemKey, entry) {
        if (!['tugas', 'lkpd', 'quiz'].includes(jenis)) throw new Error('Jenis pengumpulan tidak dikenal.');
        const keyStr = String(itemKey ?? '').trim();
        if (!keyStr) throw new Error('Item tidak valid.');
        const safe = cleanSubmission(jenis, entry);
        const { db, fs } = await ensureFirestore();
        const cleaned = sanitizeJson(await offloadAttachmentIfLarge(db, fs, safe, safe.kelas));
        const uid = String(cleaned.userId);
        const docId = `${jenis}__${safeDocId(keyStr)}__${safeDocId(uid)}`;
        await fs.setDoc(fs.doc(db, 'portal_submissions', docId), {
          id: docId,
          jenis,
          itemKey: keyStr,
          userId: uid,
          nama: String(cleaned.nama || 'Siswa'),
          kelas: String(cleaned.kelas || ''),
          entryJson: JSON.stringify(cleaned),
          updatedAt: new Date().toISOString()
        });
        return readActivity(db, fs);
      }
    },

    accounts: {
      async list(passphrase) {
        await requireStaff(passphrase);
        const { db, fs } = await ensureFirestore();
        return listAccounts(db, fs);
      },
      async mutate(body, passphrase) {
        await requireStaff(passphrase);
        const { db, fs } = await ensureFirestore();
        const action = String((body && (body.action || body.op)) || '');
        const ts = new Date().toISOString();

        if (action === 'delete') {
          const nis = String(body.nis || '').trim();
          if (!nis) throw new Error('NIS tidak valid.');
          await fs.deleteDoc(fs.doc(db, 'portal_accounts', safeDocId(nis)));
          return listAccounts(db, fs);
        }

        if (action === 'bulk' && Array.isArray(body.accounts)) {
          for (let i = 0; i < body.accounts.length; i += 200) {
            const batch = fs.writeBatch(db);
            for (const row of body.accounts.slice(i, i + 200)) {
              const nis = String((row && row.nis) || '').trim();
              if (!nis) continue;
              const rec = {
                nis,
                nama: String(row.nama || nis).slice(0, 80),
                kelas: String(row.kelas || 'X-1').slice(0, 20),
                updatedAt: ts
              };
              if (row.password) rec.passwordHash = await hashPassword(String(row.password));
              if (row.terakhirMasuk) rec.terakhirMasuk = row.terakhirMasuk;
              batch.set(fs.doc(db, 'portal_accounts', safeDocId(nis)), rec, { merge: true });
            }
            await batch.commit();
          }
          return listAccounts(db, fs);
        }

        const nis = String((body && body.nis) || '').trim();
        if (!nis) throw new Error('NIS wajib diisi.');
        const rec = {
          nis,
          nama: String((body && body.nama) || nis).slice(0, 80),
          kelas: String((body && body.kelas) || 'X-1').slice(0, 20),
          updatedAt: ts
        };
        if (body && body.password) rec.passwordHash = await hashPassword(String(body.password));
        await fs.setDoc(fs.doc(db, 'portal_accounts', safeDocId(nis)), rec, { merge: true });
        return listAccounts(db, fs);
      }
    },

    topics: {
      async list() {
        const { db, fs } = await ensureFirestore();
        return listTopics(db, fs);
      },
      async upsert(topics, passphrase) {
        await requireStaff(passphrase);
        const { db, fs } = await ensureFirestore();
        const items = Array.isArray(topics) ? topics : (topics && Array.isArray(topics.topics) ? topics.topics : [topics]);
        const ts = new Date().toISOString();
        const batch = fs.writeBatch(db);
        items.forEach((t) => {
          if (!t || !t.id) return;
          const tid = String(t.id);
          batch.set(fs.doc(db, 'portal_topics', safeDocId(tid)), {
            id: tid,
            jenjang: String(t.jenjang || 'SMA'),
            kelas: String(t.kelas || 'ALL'),
            judul: String(t.judul || tid),
            deskripsi: String(t.deskripsi || ''),
            video_url: t.video_url || null,
            updatedAt: ts
          });
        });
        await batch.commit();
        return listTopics(db, fs);
      }
    },

    files: {
      async list(kelas) {
        const { db, fs } = await ensureFirestore();
        const snap = await fs.getDocs(fs.collection(db, 'portal_files'));
        const kf = String(kelas || '').trim().toUpperCase();
        const out = [];
        snap.forEach((docSnap) => {
          const r = docSnap.data() || {};
          const rk = String(r.kelas || 'ALL').trim().toUpperCase();
          if (kf && kf !== 'ALL' && rk !== 'ALL' && rk !== kf) return;
          const fid = r.id || docSnap.id;
          out.push({
            id: fid,
            name: r.name || 'materi',
            mimeType: r.mime_type || 'application/octet-stream',
            size: Number(r.size || 0),
            kelas: r.kelas || 'ALL',
            createdAt: r.created_at || '',
            firebaseFile: true,
            viewLink: 'pbfile://' + fid,
            previewLink: 'pbfile://' + fid,
            downloadLink: 'pbfile://' + fid + '?download=1'
          });
        });
        out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        return { files: out };
      },

      async upload(file, kelas, passphrase) {
        await requireStaff(passphrase);
        if (!file) throw new Error('Berkas tidak valid.');
        const { db, fs } = await ensureFirestore();
        const buf = await file.arrayBuffer();
        return storeBinaryFile(db, fs, file.name || 'materi', file.type || 'application/octet-stream', new Uint8Array(buf), kelas || 'ALL');
      },

      async resolveBlobUrl(fileRef) {
        const cleanId = String(fileRef || '').replace(/^pbfile:\/\//, '').split('?')[0].trim();
        if (!cleanId) throw new Error('ID berkas tidak valid.');
        if (blobUrlCache[cleanId]) return blobUrlCache[cleanId];
        blobUrlCache[cleanId] = (async () => {
          const { db, fs } = await ensureFirestore();
          const metaSnap = await fs.getDoc(fs.doc(db, 'portal_files', cleanId));
          if (!metaSnap.exists()) throw new Error('Berkas tidak ditemukan di Firebase.');
          const meta = metaSnap.data() || {};
          const chunkSnap = await fs.getDocs(fs.collection(db, 'portal_files', cleanId, 'chunks'));
          const parts = [];
          chunkSnap.forEach((c) => {
            const d = c.data() || {};
            parts.push({ idx: Number(d.idx ?? c.id), b64: d.data_b64 || '' });
          });
          parts.sort((a, b) => a.idx - b.idx);
          const decoded = parts.map((p) => base64ToBytes(p.b64));
          const total = decoded.reduce((s, arr) => s + arr.length, 0);
          const out = new Uint8Array(total);
          let off = 0;
          for (const arr of decoded) {
            out.set(arr, off);
            off += arr.length;
          }
          const blob = new Blob([out], { type: meta.mime_type || 'application/octet-stream' });
          return URL.createObjectURL(blob);
        })();
        return blobUrlCache[cleanId];
      },

      async remove(fileId, passphrase) {
        await requireStaff(passphrase);
        const cleanId = String(fileId || '').replace(/^pbfile:\/\//, '').split('?')[0].trim();
        if (!cleanId) return;
        const { db, fs } = await ensureFirestore();
        const chunkSnap = await fs.getDocs(fs.collection(db, 'portal_files', cleanId, 'chunks'));
        const batch = fs.writeBatch(db);
        chunkSnap.forEach((c) => batch.delete(c.ref));
        batch.delete(fs.doc(db, 'portal_files', cleanId));
        await batch.commit();
        delete blobUrlCache[cleanId];
      }
    },

    leaderboard: {
      async get(kelas) {
        const { db, fs } = await ensureFirestore();
        const [act, accRes] = await Promise.all([readActivity(db, fs), listAccounts(db, fs)]);
        const board = new Map();
        (accRes.accounts || []).forEach((a) => {
          board.set(a.nis, { nis: a.nis, nama: a.nama, kelas: a.kelas, xp: 0, tugasDone: 0, lkpdDone: 0, quizDone: 0, scores: [] });
        });
        ['tugas', 'lkpd', 'quiz'].forEach((jenis) => {
          Object.entries(act[jenis] || {}).forEach(([ik, entries]) => {
            (entries || []).forEach((e) => {
              if (!e || typeof e !== 'object') return;
              const uid = String(e.userId || e.nis || '').trim();
              if (!uid || uid === 'me') return;
              let rec = board.get(uid);
              if (!rec) {
                rec = { nis: uid, nama: String(e.nama || 'Siswa'), kelas: String(e.kelas || '-'), xp: 0, tugasDone: 0, lkpdDone: 0, quizDone: 0, scores: [] };
                board.set(uid, rec);
              }
              if (jenis === 'lkpd' && ik === 'game-progress') {
                rec.xp = Math.max(rec.xp, Number(e.xp || 0));
              } else {
                if (jenis === 'tugas') rec.tugasDone += 1;
                else if (jenis === 'lkpd') rec.lkpdDone += 1;
                else if (jenis === 'quiz') rec.quizDone += 1;
                if (e.nilai != null && !Number.isNaN(Number(e.nilai))) rec.scores.push(Number(e.nilai));
              }
            });
          });
        });
        const kf = String(kelas || '').trim().toUpperCase();
        const rowsOut = [];
        board.forEach((rec) => {
          if (kf && kf !== 'ALL' && String(rec.kelas || '').toUpperCase() !== kf) return;
          const doneTotal = rec.tugasDone + rec.lkpdDone + rec.quizDone;
          const avg = rec.scores.length ? Math.round((rec.scores.reduce((a, b) => a + b, 0) / rec.scores.length) * 10) / 10 : 0;
          const pts = rec.xp + doneTotal * 25 + Math.round(avg);
          const badges = [];
          if (rec.xp >= 100) badges.push('🎮 Master Game');
          if (doneTotal >= 3) badges.push('🔥 Rajin Belajar');
          if (avg >= 85 && rec.scores.length) badges.push('⭐ Nilai Tinggi');
          if (rec.quizDone >= 1) badges.push('⚡ Penakluk Quiz');
          rowsOut.push({ nis: rec.nis, nama: rec.nama, kelas: rec.kelas, xp: rec.xp, doneCount: doneTotal, avgScore: avg, points: pts, badges });
        });
        rowsOut.sort((a, b) => b.points - a.points || b.xp - a.xp || b.avgScore - a.avgScore);
        return { leaderboard: rowsOut, updatedAt: new Date().toISOString() };
      }
    },

    live: {
      async create(payload, passphrase) {
        await requireStaff(passphrase);
        const { db, fs } = await ensureFirestore();
        const pin = String(100000 + Math.floor(Math.random() * 900000));
        const ts = new Date().toISOString();
        const room = {
          pin,
          host_name: String((payload && payload.hostName) || 'Guru'),
          mode: String((payload && payload.mode) || 'gold'),
          kelas: String((payload && payload.kelas) || 'ALL'),
          quiz_json: JSON.stringify((payload && payload.quiz) || {}),
          status: 'waiting',
          players_json: '{}',
          created_at: ts,
          updated_at: ts
        };
        await fs.setDoc(fs.doc(db, 'portal_live_rooms', pin), room);
        return {
          ok: true,
          pin,
          hostName: room.host_name,
          mode: room.mode,
          kelas: room.kelas,
          status: 'waiting',
          quiz: (payload && payload.quiz) || {},
          players: [],
          updatedAt: ts
        };
      },

      async get(pin) {
        const { db, fs } = await ensureFirestore();
        const snap = await fs.getDoc(fs.doc(db, 'portal_live_rooms', String(pin || '').trim()));
        if (!snap.exists()) {
          const err = new Error('Room PIN tidak ditemukan atau sudah ditutup.');
          err.status = 404;
          throw err;
        }
        const r = snap.data() || {};
        const playersMap = JSON.parse(r.players_json || '{}');
        const players = Object.values(playersMap).sort((a, b) => (b.score || 0) - (a.score || 0) || (b.streak || 0) - (a.streak || 0));
        return {
          ok: true,
          pin: r.pin,
          hostName: r.host_name,
          mode: r.mode,
          kelas: r.kelas,
          status: r.status,
          quiz: JSON.parse(r.quiz_json || '{}'),
          players,
          updatedAt: r.updated_at
        };
      },

      async join(payload) {
        const pin = String((payload && payload.pin) || '').trim();
        const uid = String((payload && (payload.userId || payload.nis || payload.nama)) || '').trim();
        if (!pin || !uid) throw new Error('PIN dan identitas siswa wajib diisi.');
        const { db, fs } = await ensureFirestore();
        const ref = fs.doc(db, 'portal_live_rooms', pin);
        await fs.runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists()) throw new Error('PIN kelas tidak ditemukan.');
          const r = snap.data() || {};
          const map = JSON.parse(r.players_json || '{}');
          const cur = map[uid] || {};
          const ts = new Date().toISOString();
          map[uid] = {
            userId: uid,
            nama: String(payload.nama || cur.nama || 'Siswa').slice(0, 60),
            kelas: String(payload.kelas || cur.kelas || '').slice(0, 20),
            ava: String(payload.ava || cur.ava || '🦊').slice(0, 8),
            score: Number(cur.score || 0),
            streak: Number(cur.streak || 0),
            answered: Number(cur.answered || 0),
            finished: Boolean(cur.finished || false),
            joinedAt: cur.joinedAt || ts
          };
          tx.update(ref, { players_json: JSON.stringify(map), updated_at: ts });
        });
        return firebaseDb.live.get(pin);
      },

      async score(payload) {
        const pin = String((payload && payload.pin) || '').trim();
        const uid = String((payload && (payload.userId || payload.nis || payload.nama)) || '').trim();
        if (!pin || !uid) throw new Error('PIN dan userId wajib diisi.');
        const { db, fs } = await ensureFirestore();
        const ref = fs.doc(db, 'portal_live_rooms', pin);
        await fs.runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists()) throw new Error('PIN kelas tidak ditemukan.');
          const r = snap.data() || {};
          const map = JSON.parse(r.players_json || '{}');
          const cur = map[uid] || { userId: uid, nama: String(payload.nama || 'Siswa'), kelas: String(payload.kelas || ''), ava: '🦊' };
          cur.score = Math.max(0, Number(payload.score || 0));
          cur.streak = Math.max(0, Number(payload.streak || 0));
          cur.answered = Math.max(0, Number(payload.answered || 0));
          cur.finished = Boolean(payload.finished || false);
          map[uid] = cur;
          tx.update(ref, { players_json: JSON.stringify(map), updated_at: new Date().toISOString() });
        });
        return firebaseDb.live.get(pin);
      },

      async setState(pin, status, passphrase) {
        await requireStaff(passphrase);
        if (!['waiting', 'playing', 'finished'].includes(status)) throw new Error('Status room tidak valid.');
        const { db, fs } = await ensureFirestore();
        const ref = fs.doc(db, 'portal_live_rooms', String(pin || '').trim());
        await fs.updateDoc(ref, { status, updated_at: new Date().toISOString() });
        return firebaseDb.live.get(pin);
      }
    },

    async migrateAll(payload, passphrase) {
      await requireStaff(passphrase);
      const { db, fs } = await ensureFirestore();
      const stats = { catalog: 0, accounts: 0, submissions: 0, absensi: 0, topics: 0 };
      const ts = new Date().toISOString();

      if (payload && payload.catalog && typeof payload.catalog === 'object') {
        const cur = await readCatalog(db, fs);
        const merged = { force: true };
        KINDS.forEach((k) => {
          const inc = payload.catalog[k];
          merged[k] = Array.isArray(inc) && inc.length > 0 ? inc : cur[k];
          stats.catalog += merged[k].length;
        });
        await writeCatalog(db, fs, merged);
      }

      if (payload && Array.isArray(payload.accounts) && payload.accounts.length > 0) {
        await firebaseDb.accounts.mutate({ action: 'bulk', accounts: payload.accounts }, passphrase);
        stats.accounts = payload.accounts.length;
      }

      const actPayload = {};
      if (payload && payload.activity && typeof payload.activity === 'object') {
        Object.assign(actPayload, payload.activity);
      }
      if (payload && payload.submissions && typeof payload.submissions === 'object') {
        ['tugas', 'lkpd', 'quiz'].forEach((j) => {
          if (payload.submissions[j] && !actPayload[j]) actPayload[j] = payload.submissions[j];
        });
      }
      if (payload && payload.absensi && typeof payload.absensi === 'object') {
        actPayload.absensi = Object.assign({}, payload.absensi, actPayload.absensi || {});
      }
      if (payload && payload.modulesConfig && typeof payload.modulesConfig === 'object') {
        actPayload.absensi = actPayload.absensi || {};
        if (!actPayload.absensi['__CONFIG__|modules']) actPayload.absensi['__CONFIG__|modules'] = payload.modulesConfig;
      }
      if (Object.keys(actPayload).length > 0) {
        await saveActivityPayload(db, fs, actPayload);
        ['tugas', 'lkpd', 'quiz'].forEach((j) => {
          Object.values(actPayload[j] || {}).forEach((arr) => {
            if (Array.isArray(arr)) stats.submissions += arr.length;
          });
        });
        stats.absensi = Object.keys(actPayload.absensi || {}).length;
      }

      if (payload && payload.topics) {
        let topicRows = [];
        if (Array.isArray(payload.topics)) {
          topicRows = payload.topics;
        } else if (typeof payload.topics === 'object') {
          topicRows = Object.entries(payload.topics).map(([tid, data]) => {
            const parts = String(tid).split('::');
            return {
              id: tid,
              jenjang: String(parts[0] || 'SMA').toUpperCase(),
              kelas: 'ALL',
              judul: parts[1] || tid,
              deskripsi: (data && data.desc) || '',
              video_url: (data && data.video) || null
            };
          });
        }
        if (topicRows.length > 0) {
          await firebaseDb.topics.upsert(topicRows, passphrase);
          stats.topics = topicRows.length;
        }
      }

      return { ok: true, stats, updatedAt: ts };
    },

    async resetAll(passphrase) {
      await requireStaff(passphrase);
      const { db, fs } = await ensureFirestore();
      const cols = ['portal_catalog', 'portal_accounts', 'portal_submissions', 'portal_attendance', 'portal_topics', 'portal_live_rooms'];
      for (const colName of cols) {
        const snap = await fs.getDocs(fs.collection(db, colName));
        const docs = snap.docs || [];
        for (let i = 0; i < docs.length; i += 400) {
          const batch = fs.writeBatch(db);
          docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
      const filesSnap = await fs.getDocs(fs.collection(db, 'portal_files'));
      for (const fDoc of filesSnap.docs || []) {
        const ch = await fs.getDocs(fs.collection(db, 'portal_files', fDoc.id, 'chunks'));
        const batch = fs.writeBatch(db);
        ch.forEach((c) => batch.delete(c.ref));
        batch.delete(fDoc.ref);
        await batch.commit();
      }
      return { ok: true };
    }
  };

  window.firebaseDb = firebaseDb;
})(window);
