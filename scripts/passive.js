'use strict';

(function() {
  if (!location.href.startsWith('http')) return;
  if (location.hostname.includes('youtube.com')) return;

  var s = {
    thirdPartyCookies: true, autoplayBlocking: true, lazyImages: true,
    prefetchRemoval: true, trackingPixels: true
  };
  try {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, function(r) {
      if (r && !chrome.runtime.lastError) {
        s.thirdPartyCookies = r.thirdPartyCookies !== false;
        s.autoplayBlocking = r.autoplayBlocking !== false;
        s.lazyImages = r.lazyImages !== false;
        s.prefetchRemoval = r.prefetchRemoval !== false;
        s.trackingPixels = r.trackingPixels !== false;
      }
    });
  } catch(e) {}

  try {
    var cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                     Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
    if (cookieDesc && cookieDesc.set) {
      var origCookieSet = cookieDesc.set;
      Object.defineProperty(document, 'cookie', {
        get: cookieDesc.get,
        set: function(val) {
          if (!s.thirdPartyCookies) { origCookieSet.call(document, val); return; }
          var lower = (val || '').toLowerCase();
          if (lower.includes('samesite=none') && !lower.includes('secure=false')) {
            if (!lower.includes('__stripe') && !lower.includes('stripe') &&
                !lower.includes('shopify') && !lower.includes('checkout')) {
              try { chrome.runtime.sendMessage({ type:'SAVING', saving:'trackingPixelKilled', count:1 }); } catch(e){}
              return;
            }
          }
          origCookieSet.call(document, val);
        },
        configurable: true,
      });
    }
  } catch(e) {}

  var counts = { lazy:0, autoplay:0, prefetch:0, tracker:0 };
  var flushTimer = null;
  function flush() {
    if (counts.lazy     > 0) chrome.runtime.sendMessage({ type:'SAVING', saving:'lazyImageSaved',      count:counts.lazy     });
    if (counts.autoplay > 0) chrome.runtime.sendMessage({ type:'SAVING', saving:'autoplayBlocked',     count:counts.autoplay });
    if (counts.prefetch > 0) chrome.runtime.sendMessage({ type:'SAVING', saving:'prefetchRemoved',     count:counts.prefetch });
    if (counts.tracker  > 0) chrome.runtime.sendMessage({ type:'SAVING', saving:'trackingPixelKilled', count:counts.tracker  });
    counts.lazy=0; counts.autoplay=0; counts.prefetch=0; counts.tracker=0;
  }
  function sched() { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 1500); }

  if (s.autoplayBlocking) {
    var _origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() {
      var el = this;
      if (!s.autoplayBlocking) return _origPlay.apply(el, arguments);
      var hasUserGesture = el.dataset.gtUserPlay === '1';
      var isMuted = el.muted || el.volume === 0;
      if (!hasUserGesture && !isMuted) {
        if (!el.dataset.gtBlocked) {
          el.dataset.gtBlocked = '1';
          counts.autoplay++; sched();
        }
        return Promise.resolve();
      }
      return _origPlay.apply(el, arguments);
    };

    document.addEventListener('click', function(e) {
      var t = e.target;
      while (t) {
        if (t.tagName === 'VIDEO' || t.tagName === 'AUDIO') {
          t.dataset.gtUserPlay = '1';
          break;
        }
        if (t.closest) {
          var media = t.closest('video, audio');
          if (media) { media.dataset.gtUserPlay = '1'; break; }
        }
        t = t.parentElement;
      }
    }, true);

    var _origSetAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      if (name === 'autoplay' && (this.tagName === 'VIDEO' || this.tagName === 'AUDIO') && s.autoplayBlocking) {
        if (!this.dataset.gtUserPlay) {
          _origSetAttr.call(this, name, value);
          if (!this.dataset.gtBlocked) {
            this.dataset.gtBlocked = '1';
            counts.autoplay++; sched();
          }
          var self = this;
          setTimeout(function() { self.pause(); }, 0);
          return;
        }
      }
      _origSetAttr.apply(this, arguments);
    };
  }

  var TRACKER_DOMAINS = [
    'doubleclick.net','googleadservices.com','googlesyndication.com',
    'facebook.net','fbcdn.net','scorecardresearch.com','quantserve.com',
    'omtrdc.net','demdex.net','rubiconproject.com','openx.net','adnxs.com',
    'taboola.com','outbrain.com','criteo.com','advertising.com','moatads.com',
    'pixel.wp.com','stats.wp.com','ping.chartbeat.net','beacon.krxd.net',
    'analytics.twitter.com','bat.bing.com','sb.scorecardresearch.com',
    'cm.g.doubleclick.net','pagead2.googlesyndication.com','tpc.googlesyndication.com',
  ];
  function isTracker(src) {
    if (!src) return false;
    try {
      var h = new URL(src).hostname;
      return TRACKER_DOMAINS.some(function(d){ return h===d || h.endsWith('.'+d); });
    } catch(e){ return false; }
  }

  function processImg(img) {
    if (img.dataset.gtDone) return;
    img.dataset.gtDone = '1';
    var isPixel = (img.width<=2 && img.height<=2) || isTracker(img.src) || isTracker(img.dataset.src);
    if (isPixel && s.trackingPixels) {
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      counts.tracker++; sched();
      return;
    }
    if (s.lazyImages && !img.getAttribute('loading')) {
      var rect = img.getBoundingClientRect();
      if (rect.top > window.innerHeight + 100) {
        img.setAttribute('loading', 'lazy');
        counts.lazy++; sched();
      }
    }
  }

  function removePrefetch(root) {
    if (!s.prefetchRemoval) return;
    var sel = 'link[rel="prefetch"],link[rel="prerender"],link[rel="preload"][as="document"]';
    var links = root.querySelectorAll ? root.querySelectorAll(sel) : [];
    links.forEach(function(l) {
      if (l.dataset.gtRemoved) return;
      l.dataset.gtRemoved = '1'; l.remove();
      counts.prefetch++; sched();
    });
    var dns = document.querySelectorAll('link[rel="dns-prefetch"]');
    for (var i = 4; i < dns.length; i++) dns[i].remove();
  }

  document.querySelectorAll('img').forEach(processImg);
  removePrefetch(document);

  if (s.autoplayBlocking) {
    document.querySelectorAll('video[autoplay],audio[autoplay]').forEach(function(v) {
      if (!v.muted && !v.dataset.gtBlocked) {
        v.dataset.gtBlocked = '1';
        v.removeAttribute('autoplay');
        v.pause();
        counts.autoplay++; sched();
      }
    });
  }

  new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG') processImg(node);
        else node.querySelectorAll && node.querySelectorAll('img').forEach(processImg);

        if (s.autoplayBlocking && (node.tagName==='VIDEO'||node.tagName==='AUDIO') && node.hasAttribute('autoplay') && !node.muted && !node.dataset.gtBlocked) {
          node.dataset.gtBlocked='1'; node.removeAttribute('autoplay'); node.pause();
          counts.autoplay++; sched();
        }

        if (node.tagName==='LINK' && (node.rel==='prefetch'||node.rel==='prerender') && !node.dataset.gtRemoved) {
          node.dataset.gtRemoved='1'; node.remove(); counts.prefetch++; sched();
        }
      });
    });
  }).observe(document.documentElement, { childList:true, subtree:true });

})();
