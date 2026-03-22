'use strict';

(function() {
  if (!location.href.startsWith('http')) return;

  try {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, function(r) {
      if (chrome.runtime.lastError || (r && r.adBlocking === false)) return;
      run();
    });
  } catch(e) {
    run();
  }

  function run() {
    var AD_SELECTORS = [
      '[id^="ad-"]','[id^="ads-"]','[id^="ad_"]','[class^="ad-"]','[class^="ads-"]',
      '[id*="-ad-"]','[id*="-ads-"]','[class*="-ad-"]','[class*="-ads-"]',
      '[data-ad]','[data-ads]','[data-ad-unit]','[data-adunit]',
      '[aria-label*="advertisement" i]','[aria-label*="sponsored" i]',
      'ins.adsbygoogle','div.adsbygoogle',
      '#google_ads_iframe_0','div[id^="google_ads"]',
      'iframe[src*="googlesyndication"]','iframe[src*="doubleclick"]',
      'iframe[src*="googleadservices"]',
      '.ytp-ad-module','#player-ads','.ytd-display-ad-renderer',
      'ytd-display-ad-renderer','ytd-promoted-sparkles-web-renderer',
      'ytd-search-pyv-renderer','ytd-promoted-video-renderer',
      'ytd-ad-slot-renderer','.ytd-ad-slot-renderer',
      '#masthead-ad','ytd-banner-promo-renderer',
      '.ytp-ad-overlay-container','.ytp-ad-text-overlay',
      '.ytp-ad-player-overlay','ytd-action-companion-ad-renderer',
      '.ytd-companion-slot-renderer','#companion-slot',
      'div[id*="sponsor"]','div[class*="sponsor"]',
      'div[id*="promoted"]','div[class*="promoted"]',
      'div[id*="promo-"]','div[class*="promo-banner"]',
      '[data-testid*="ad"]','[data-module*="Ad"]',
    ];
    var SELECTOR_STRING = AD_SELECTORS.join(',');
    var removed = 0;
    var flushTimer = null;

    function flush() {
      if (removed > 0) {
        try { chrome.runtime.sendMessage({ type:'SAVING', saving:'adsBlocked', count:removed }); } catch(e){}
        removed = 0;
      }
    }
    function sched() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 1500); }

    function removeAds(root) {
      try {
        var els = (root.querySelectorAll || function(){ return []; }).call(root, SELECTOR_STRING);
        els.forEach(function(el) {
          if (el.offsetHeight > 0 || el.offsetWidth > 0) {
            el.remove();
            removed++;
            sched();
          }
        });
      } catch(e) {}
    }

    if (document.body) removeAds(document.body);
    else document.addEventListener('DOMContentLoaded', function() { removeAds(document.body); });

    new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType !== 1) return;
          try {
            if (node.matches && node.matches(SELECTOR_STRING)) {
              if (node.offsetHeight > 0 || node.offsetWidth > 0) {
                node.remove(); removed++; sched(); return;
              }
            }
          } catch(e) {}
          removeAds(node);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
