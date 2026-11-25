/**
 * Portal Belajar — Google Colab SQLite Migration Utility
 * Migrates localStorage data (materi, tugas, lkpd, quiz, pengumuman, accounts,
 * submissions, attendance, jenjang overrides) into Google Colab SQLite + Google Drive.
 */
(function () {
  const MIGRATION_KEY = 'pb.migrated.colab.v1';

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function collectSubmissions() {
    const subs = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith('pb.submissions.')) {
          const jenis = k.replace('pb.submissions.', '');
          const data = readJSON(k, {});
          if (data && typeof data === 'object' && Object.keys(data).length > 0) {
            subs[jenis] = data;
          }
        }
      }
      // Also capture legacy pb.murid.sub:* keys if present
      const legacyMap = { tugas: {}, lkpd: {}, quiz: {} };
      let hasLegacy = false;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('pb.murid.sub:')) continue;
        const val = readJSON(k, null);
        if (!val) continue;
        const suffix = k.replace('pb.murid.sub:', '');
        const parts = suffix.split(':');
        const jenis = ['tugas', 'lkpd', 'quiz'].includes(parts[0]) ? parts[0] : 'tugas';
        const itemKey = parts.length > 1 ? parts.slice(1).join(':') : suffix;
        const uid = val.userId || val.nis || val.name || 'anon';
        legacyMap[jenis][itemKey] = legacyMap[jenis][itemKey] || {};
        legacyMap[jenis][itemKey][uid] = val;
        hasLegacy = true;
      }
      if (hasLegacy) {
        ['tugas', 'lkpd', 'quiz'].forEach((j) => {
          if (Object.keys(legacyMap[j]).length > 0) {
            subs[j] = Object.assign({}, legacyMap[j], subs[j] || {});
          }
        });
      }
    } catch (_) {}
    return subs;
  }

  window.runMigration = async function (opts) {
    opts = opts || {};
    if (!window.colabDb || !window.colabDb.isReady()) {
      return { ok: false, skipped: true, reason: 'Google Colab server belum terhubung.' };
    }
    if (!opts.force && localStorage.getItem(MIGRATION_KEY) === 'done') {
      return { ok: true, alreadyMigrated: true };
    }

    const pass = localStorage.getItem('pb.guru.passphrase') || sessionStorage.getItem('guruPass') || sessionStorage.getItem('pb.guru.pass') || '';
    const cachedAccounts = readJSON('pb.cached.accounts', null);

    const payload = {
      catalog: {
        materi: readJSON('pb.guru.materi', []),
        tugas: readJSON('pb.guru.tugas', []),
        lkpd: readJSON('pb.guru.lkpd', []),
        quiz: readJSON('pb.guru.quiz', []),
        pengumuman: readJSON('pb.guru.pengumuman', [])
      },
      accounts: Array.isArray(cachedAccounts) ? cachedAccounts : [],
      submissions: collectSubmissions(),
      absensi: readJSON('pb.shared.absensi', {}),
      topics: readJSON('jenjangOverrides_v1', {})
    };

    try {
      const res = await window.colabDb.migrateAll(payload, pass);
      if (res && res.ok) {
        localStorage.setItem(MIGRATION_KEY, 'done');
        if (typeof window.__fpSync === 'function') window.__fpSync();
      }
      return res || { ok: true };
    } catch (e) {
      return { ok: false, error: (e && e.message) ? e.message : String(e) };
    }
  };
})();
