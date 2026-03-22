'use strict';

(function() {
  var s = { youtubeAutoplay: true, youtubeQuality: true };
  try {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, function(r) {
      if (r && !chrome.runtime.lastError) {
        s.youtubeAutoplay = r.youtubeAutoplay !== false;
        s.youtubeQuality = r.youtubeQuality !== false;
      }
    });
  } catch(e) {}

  var AUTOPLAY_KEY = 'yt-player-autonavigation';
  var LOOP_KEY = 'yt-player-repeat';

  function disableSettings() {
    if (!s.youtubeAutoplay) return;
    try {
      localStorage.setItem(AUTOPLAY_KEY, '{"data":"0"}');
      localStorage.setItem(LOOP_KEY, '{"data":"0"}');
    } catch(e) {}
  }

  disableSettings();

  var _origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    if (s.youtubeAutoplay && key === AUTOPLAY_KEY) {
      try {
        var parsed = JSON.parse(value);
        if (parsed && parsed.data === '1') {
          _origSetItem.call(this, key, '{"data":"0"}');
          try { chrome.runtime.sendMessage({ type:'SAVING', saving:'autoplayBlocked' }); } catch(e){}
          return;
        }
      } catch(e) {}
    }
    if (s.youtubeAutoplay && key === LOOP_KEY) {
      try {
        var p = JSON.parse(value);
        if (p && (p.data === '1' || p.data === '2')) {
          _origSetItem.call(this, key, '{"data":"0"}');
          return;
        }
      } catch(e) {}
    }
    _origSetItem.apply(this, arguments);
  };

  function findAndDisableAutoplayToggle() {
    if (!s.youtubeAutoplay) return;
    var btn = document.querySelector(
      'button.ytp-autonav-toggle-button[aria-checked="true"],' +
      'ytd-toggle-button-renderer #autoplay button[aria-pressed="true"],' +
      'tp-yt-paper-toggle-button#toggle[aria-checked="true"]'
    );
    if (btn) {
      btn.click();
      try { chrome.runtime.sendMessage({ type:'SAVING', saving:'autoplayBlocked' }); } catch(e){}
    }
  }

  function disableShortsLoop() {
    if (!s.youtubeAutoplay || !location.pathname.startsWith('/shorts')) return;
    var loopBtn = document.querySelector(
      'button[aria-label*="Loop"][aria-pressed="true"],' +
      'ytd-shorts button[aria-label*="loop"][aria-pressed="true"],' +
      '.yt-spec-touch-feedback-shape button[aria-pressed="true"]'
    );
    if (loopBtn) loopBtn.click();
  }

  function setQuality720() {
    if (!s.youtubeQuality) return true;
    var player = document.getElementById('movie_player');
    if (!player) return false;
    try {
      if (typeof player.setPlaybackQualityRange === 'function') {
        player.setPlaybackQualityRange('medium', 'hd720');
        return true;
      }
      if (typeof player.setPlaybackQuality === 'function') {
        player.setPlaybackQuality('hd720');
        return true;
      }
    } catch(e) {}
    return false;
  }

  function trySetQuality(attemptsLeft) {
    if (attemptsLeft <= 0 || !s.youtubeQuality) return;
    if (!setQuality720()) {
      setTimeout(function() { trySetQuality(attemptsLeft - 1); }, 700);
    }
  }

  var lastUrl = '';
  var countedVideos = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  function onVideoPlay(e) {
    if (!s.youtubeAutoplay) return;
    var v = e.target;
    if (v.tagName !== 'VIDEO' || !countedVideos) return;
    if (countedVideos.has(v)) return;
    countedVideos.add(v);
    try { chrome.runtime.sendMessage({ type:'SAVING', saving:'autoplayBlocked', count:1 }); } catch(e){}
  }
  document.addEventListener('play', onVideoPlay, true);
  function onNavigate() {
    var url = location.href;
    if (url === lastUrl) return;
    lastUrl = url;

    disableSettings();

    if (location.pathname.startsWith('/watch')) {
      setTimeout(findAndDisableAutoplayToggle, 1000);
      setTimeout(findAndDisableAutoplayToggle, 3000);
      setTimeout(function() { trySetQuality(6); }, 800);
    }

    if (location.pathname.startsWith('/shorts')) {
      setTimeout(disableShortsLoop, 1000);
      setTimeout(disableShortsLoop, 3000);
    }
  }

  var _push = history.pushState.bind(history);
  history.pushState = function() {
    _push.apply(history, arguments);
    setTimeout(onNavigate, 150);
  };
  var _replace = history.replaceState.bind(history);
  history.replaceState = function() {
    _replace.apply(history, arguments);
    setTimeout(onNavigate, 150);
  };
  window.addEventListener('popstate', function() { setTimeout(onNavigate, 150); });

  onNavigate();

  var obsTarget = document.querySelector('title') || document.head || document.documentElement;
  if (obsTarget && obsTarget.nodeType === 1) {
    new MutationObserver(function() {
      if (location.href !== lastUrl) onNavigate();
    }).observe(obsTarget, {
      childList: true, subtree: true, characterData: true
    });
  }
})();
