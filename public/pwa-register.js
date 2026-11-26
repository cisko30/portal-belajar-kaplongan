/* PWA Installer & Service Worker helper */
(function (window) {
  'use strict';
  let deferredPrompt = null;

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const hadController = !!navigator.serviceWorker.controller;
    let refreshing = false;
    const isBusy = () => {
      try {
        return !!document.querySelector('.fp-ov.open, #xS:disabled, #mbUpBtn:disabled, #mAdd:disabled, #tAdd:disabled, #lAdd:disabled');
      } catch (_) { return false; }
    };
    const showUpdateBanner = () => {
      try {
        if (document.getElementById('pb-sw-update')) return;
        const bar = document.createElement('div');
        bar.id = 'pb-sw-update';
        bar.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:10050;display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0f172a;color:#f8fafc;border-radius:12px;box-shadow:0 12px 30px rgba(15,23,42,.35);font:600 13px/1.35 system-ui,-apple-system,sans-serif;max-width:340px';
        bar.innerHTML = '<span>🔄 Versi baru Portal Belajar siap</span><button type="button" id="pb-sw-reload" style="border:0;background:#38bdf8;color:#0f172a;font-weight:700;border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap">Muat Ulang</button>';
        document.body.appendChild(bar);
        const btn = document.getElementById('pb-sw-reload');
        if (btn) btn.onclick = () => location.reload();
      } catch (_) {}
    };

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshing) return;
      if (!isBusy()) {
        refreshing = true;
        location.reload();
      } else {
        showUpdateBanner();
      }
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((reg) => {
        let lastCheck = Date.now();
        const checkUpdate = () => {
          const now = Date.now();
          if (now - lastCheck < 60000) return;
          lastCheck = now;
          reg.update().catch(() => {});
        };
        document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
        setInterval(checkUpdate, 300000);
        reg.update().catch(() => {});
      }).catch(() => {});
    });
  }

  function showInstallButtons(visible) {
    document.querySelectorAll('[data-pwa-install]').forEach((btn) => {
      btn.style.display = visible ? 'inline-flex' : 'none';
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButtons(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showInstallButtons(false);
  });

  window.installPortalApp = async function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      if (choice && choice.outcome === 'accepted') {
        deferredPrompt = null;
        showInstallButtons(false);
      }
      return;
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    alert(
      isIos
        ? 'Di iPhone/iPad: tekan tombol Bagikan (Share) di Safari lalu pilih "Tambahkan ke Layar Utama (Add to Home Screen)".'
        : 'Buka menu browser (⋮) lalu pilih "Install Aplikasi / Tambahkan ke Layar Utama" untuk memasang Portal Belajar.'
    );
  };
})(window);
