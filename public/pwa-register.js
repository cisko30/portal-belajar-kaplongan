/* PWA Installer & Service Worker helper */
(function (window) {
  'use strict';
  let deferredPrompt = null;

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
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
