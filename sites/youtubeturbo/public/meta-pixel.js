'use strict';

const pixelId = '370580138940482';
const preferenceKey = 'youtubeturbo-meta-consent-v1';
const banner = document.querySelector('[data-meta-consent]');
let preference;
let initialized = false;

try {
  preference = localStorage.getItem(preferenceKey);
} catch {
  // The choice still works in memory if the browser blocks storage.
}

function enablePixel() {
  if (initialized) {
    window.fbq('consent', 'grant');
    window.fbq('track', 'PageView');
    return;
  }

  const fbq = function () {
    if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
    else fbq.queue.push(arguments);
  };
  window.fbq = window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  fbq('consent', 'grant');
  fbq('init', pixelId);
  fbq('track', 'PageView');

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.append(script);
  initialized = true;
}

function selectPreference(value) {
  if (value !== preference) {
    if (value === 'accepted') enablePixel();
    else if (initialized) window.fbq('consent', 'revoke');
  }
  preference = value;
  try {
    localStorage.setItem(preferenceKey, value);
  } catch {
    // Keep the current page's preference even without storage.
  }
  banner.hidden = true;
}

banner.querySelector('[data-meta-accept]').addEventListener('click', () => selectPreference('accepted'));
banner.querySelector('[data-meta-reject]').addEventListener('click', () => selectPreference('rejected'));
document.querySelector('[data-meta-settings]').addEventListener('click', () => {
  banner.hidden = false;
  banner.querySelector('[data-meta-reject]').focus();
});
document.querySelector('[data-checkout]').addEventListener('click', () => {
  if (preference === 'accepted' && initialized) window.fbq('trackCustom', 'CheckoutClick');
});

if (preference === 'accepted') enablePixel();
else if (preference !== 'rejected') banner.hidden = false;
