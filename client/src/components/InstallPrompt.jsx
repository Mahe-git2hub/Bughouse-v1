import React, { useState, useEffect } from 'react';

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone === true;

    if (isStandalone) {
      return;
    }

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Check if user dismissed the banner before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < oneWeek) {
        return;
      }
    }

    // For iOS, show custom instructions
    if (iOS) {
      // Show banner after a delay
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // For Android/Chrome, listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showBanner) return null;

  return (
    <div className="install-banner">
      <div className="install-banner-content">
        <span className="install-banner-icon">♞</span>
        <div className="install-banner-text">
          <h4>Install Bughouse Chess</h4>
          {isIOS ? (
            <p>Tap the share button and "Add to Home Screen"</p>
          ) : (
            <p>Add to your home screen for the best experience</p>
          )}
        </div>
      </div>
      <div className="install-banner-actions">
        {!isIOS && deferredPrompt && (
          <button className="btn btn-primary" onClick={handleInstall}>
            Install
          </button>
        )}
        <button className="install-banner-close" onClick={handleDismiss}>
          ×
        </button>
      </div>
    </div>
  );
}

export default InstallPrompt;
