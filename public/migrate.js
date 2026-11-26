/**
 * Portal Belajar — Cloud Database Migration Utility (Firebase Firestore & Google Colab SQLite)
 * Migrates all localStorage data (materi, tugas, lkpd, quiz, pengumuman, accounts,
 * submissions, attendance, kelas, bank soal, modules config, skill practice, topics) to Cloud DB.
 */
(function () {
  const MIGRATION_KEY = 'pb.migrated.cloud.v2';

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
    if (!window.colabDb) {
      return { ok: false, skipped: true, reason: 'Client database belum dimuat.' };
    }
    if (window.colabDb.whenReady) await window.colabDb.whenReady();
    if (!window.colabDb.isReady()) {
      return { ok: false, skipped: true, reason: 'Firebase / server cloud belum terhubung.' };
    }
    if (!opts.force && localStorage.getItem(MIGRATION_KEY) === 'done') {
      return { ok: true, alreadyMigrated: true };
    }

    const pass = localStorage.getItem('pb.guru.passphrase') || sessionStorage.getItem('guruPass') || sessionStorage.getItem('pb.guru.pass') || '';
    const tok = window.colabDb.getToken ? window.colabDb.getToken() : (localStorage.getItem('pb.session.token') || '');
    if (opts.silentIfNoAuth && !pass && !tok) {
      return { ok: false, skipped: true, reason: 'Belum ada kredensial guru.' };
    }

    const cachedAccounts = readJSON('pb.cached.accounts', null);
    const absensi = Object.assign({}, readJSON('pb.shared.absensi', {}));
    const modCfg = Object.assign({}, readJSON('pb.modules.config', {}));
    const localKelas = readJSON('pb.guru.kelas', null);
    const localBank = readJSON('pb.guru.bank', null);
    if (Array.isArray(localKelas) && !Array.isArray(modCfg.kelasList)) modCfg.kelasList = localKelas;
    if (Array.isArray(localBank) && !Array.isArray(modCfg.bankSoal)) modCfg.bankSoal = localBank;
    if (Object.keys(modCfg).length > 0) {
      absensi['__CONFIG__|modules'] = Object.assign({}, absensi['__CONFIG__|modules'] || {}, modCfg);
    }

    const payload = {
      preserveRemote: Boolean(opts.preserveRemote),
      catalog: {
        materi: readJSON('pb.guru.materi', []),
        tugas: readJSON('pb.guru.tugas', []),
        lkpd: readJSON('pb.guru.lkpd', []),
        quiz: readJSON('pb.guru.quiz', []),
        pengumuman: readJSON('pb.guru.pengumuman', [])
      },
      accounts: Array.isArray(cachedAccounts) ? cachedAccounts : [],
      submissions: collectSubmissions(),
      absensi,
      modulesConfig: absensi['__CONFIG__|modules'],
      topics: readJSON('jenjangOverrides_v1', {})
    };

    try {
      const res = await window.colabDb.migrateAll(payload, pass);
      if (res && res.ok) {
        localStorage.setItem(MIGRATION_KEY, 'done');
        localStorage.setItem('pb.migrated.colab.v1', 'done');
        localStorage.setItem('pb.guru.remote_catalog_synced', '1');
        if (payload.accounts.length > 0) localStorage.setItem('pb.guru.remote_accounts_synced', '1');
        if (Object.keys(payload.submissions).length > 0 || Object.keys(payload.absensi).length > 0) {
          localStorage.setItem('pb.guru.remote_activity_synced', '1');
        }
        if (typeof window.__fpSync === 'function') await window.__fpSync();
      }
      return res || { ok: true };
    } catch (e) {
      return { ok: false, error: (e && e.message) ? e.message : String(e) };
    }
  };
})();
