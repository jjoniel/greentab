'use strict';

// ── Theme ─────────────────────────────────────────────────────────────────────
var THEMES = ['light', 'dark', 'black'];

function applyTheme(theme) {
  var html = document.documentElement;
  THEMES.forEach(function(t) { html.classList.remove(t); });
  html.classList.add(theme);
  THEMES.forEach(function(t) {
    var opt = document.getElementById('opt-' + t);
    if (opt) opt.classList.toggle('selected', t === theme);
  });
  localStorage.setItem('gt-theme', theme);
}

(function initTheme() {
  var saved = localStorage.getItem('gt-theme');
  applyTheme(saved || 'dark');
})();

(function initSidebar() {
  var pane = document.getElementById('stats-pane') || document.querySelector('.stats-pane');
  var toggle = document.getElementById('sidebar-toggle');
  if (!pane || !toggle) return;
  var collapsed = localStorage.getItem('gt-sidebar-collapsed') !== '0';
  if (collapsed) {
    pane.classList.add('collapsed');
    document.documentElement.dataset.sidebarCollapsed = '1';
  } else {
    delete document.documentElement.dataset.sidebarCollapsed;
  }
  toggle.addEventListener('click', function() {
    collapsed = pane.classList.toggle('collapsed');
    localStorage.setItem('gt-sidebar-collapsed', collapsed ? '1' : '0');
    if (collapsed) document.documentElement.dataset.sidebarCollapsed = '1';
    else delete document.documentElement.dataset.sidebarCollapsed;
  });
})();

THEMES.forEach(function(t) {
  var opt = document.getElementById('opt-' + t);
  if (opt) opt.addEventListener('click', function() { applyTheme(t); });
});

// ── Settings panel ────────────────────────────────────────────────────────────
var settingsOpen = false;
var settingsBtn    = document.getElementById('settings-btn');
var settingsPanel  = document.getElementById('settings-panel');
var settingsOverlay = document.getElementById('settings-overlay');

function openSettings() {
  settingsOpen = true;
  settingsPanel.classList.add('open');
  settingsOverlay.classList.add('open');
  loadGreenToggles();
}
var expandSidebarOnSettingsClose = false;
function closeSettings() {
  settingsOpen = false;
  settingsPanel.classList.remove('open');
  settingsOverlay.classList.remove('open');
  if (expandSidebarOnSettingsClose) {
    expandSidebarOnSettingsClose = false;
    var pane = document.getElementById('stats-pane');
    if (pane && pane.classList.contains('collapsed')) {
      pane.classList.remove('collapsed');
      delete document.documentElement.dataset.sidebarCollapsed;
      localStorage.setItem('gt-sidebar-collapsed', '0');
    }
  }
}

settingsBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  if (settingsOpen) closeSettings();
  else openSettings();
});
settingsOverlay.addEventListener('click', closeSettings);

// Green feature toggles
var GREEN_FEATURES = [
  { key: 'adBlocking',        label: 'Ad blocking',        desc: 'Block ad networks at the network level' },
  { key: 'trackerBlocking',  label: 'Tracker blocking',  desc: 'Block trackers and analytics at the network level' },
  { key: 'autoplayBlocking',  label: 'Autoplay blocking',  desc: 'Prevent videos from auto-playing on sites' },
  { key: 'youtubeAutoplay',   label: 'YouTube autoplay',   desc: 'Disable autoplay and loop on YouTube' },
  { key: 'youtubeQuality',    label: 'YouTube 720p cap',   desc: 'Limit YouTube to 720p to save bandwidth' },
  { key: 'thirdPartyCookies', label: 'Third-party cookies', desc: 'Block SameSite=None cross-site cookies' },
  { key: 'lazyImages',        label: 'Lazy images',        desc: 'Add loading="lazy" to below-fold images' },
  { key: 'prefetchRemoval',   label: 'Prefetch removal',   desc: 'Remove speculative prefetch and prerender' },
  { key: 'trackingPixels',    label: 'Tracking pixels',    desc: 'Replace tracker pixels with 1x1 placeholder' },
  { key: 'tabSleeping',       label: 'Tab sleeping',       desc: 'Discard inactive tabs after 20 minutes' },
];

var greenSettings = {};

function loadGreenToggles() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, function(s) {
    if (!s) return;
    greenSettings = s;
    var container = document.getElementById('green-toggles');
    container.innerHTML = '';
    GREEN_FEATURES.forEach(function(f) {
      var div = document.createElement('div');
      div.className = 'green-toggle';
      div.innerHTML =
        '<div><div class="green-toggle-label">' + f.label + '</div><div class="green-toggle-desc">' + f.desc + '</div></div>' +
        '<div class="green-toggle-switch' + (s[f.key] ? ' on' : '') + '" data-key="' + f.key + '" role="switch" aria-checked="' + !!s[f.key] + '"></div>';
      div.addEventListener('click', function() {
        var sw = div.querySelector('.green-toggle-switch');
        var key = sw.dataset.key;
        var next = !greenSettings[key];
        greenSettings[key] = next;
        sw.classList.toggle('on', next);
        sw.setAttribute('aria-checked', next);
        chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings: { [key]: next } }, function(updated) {
          if (updated) greenSettings = updated;
        });
      });
      container.appendChild(div);
    });
  });
}

// ── Clock & greetings ──────────────────────────────────────────────────────────
var LATE_NIGHT = ['Dream green', 'Green night', 'Moon powered'];
var MORNING = ['Start green', 'Green start', 'Eco day', 'Save watts', 'Fresh start'];
var AFTERNOON = ['Keep it lean', 'Stay efficient', 'Stay green'];
var EVENING = ['Power down', 'End light', 'Wind down', 'Stay green'];

var lastGreetingHour = -1;
var currentGreeting = '';

function pickGreeting(h) {
  if (h === lastGreetingHour && currentGreeting) return currentGreeting;
  lastGreetingHour = h;
  var arr = h >= 0 && h < 6 ? LATE_NIGHT : h < 12 ? MORNING : h < 17 ? AFTERNOON : EVENING;
  currentGreeting = arr[Math.floor(Math.random() * arr.length)];
  return currentGreeting;
}

function updateClock() {
  var now = new Date(), h = now.getHours(), m = String(now.getMinutes()).padStart(2, '0'), s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clock').textContent = (h % 12 || 12) + ':' + m + ':' + s + (h >= 12 ? ' PM' : ' AM');
  document.getElementById('tod').textContent = pickGreeting(h);
}
updateClock();
setInterval(updateClock, 1000);

// ── Web search ────────────────────────────────────────────────────────────────
function doSearch() {
  var q = document.getElementById('search').value.trim();
  if (q) window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(q) + '&udm=14';
}
document.getElementById('search-btn').addEventListener('click', doSearch);
document.getElementById('search').addEventListener('keydown', function(e) { if (e.key === 'Enter') doSearch(); });
document.getElementById('search').focus();

// ── Tips ──────────────────────────────────────────────────────────────────────
var TIPS = [
  'streaming at 720p uses half the data of 1080p — barely noticeable on most screens',
  'closing unused tabs frees memory and cuts background CPU drain noticeably',
  'dark mode on OLED screens can cut display power by up to 40%',
  'autoplay video is the biggest source of wasted streaming bandwidth per session',
  'screen brightness is the largest single battery drain on laptops and phones',
  'speculative prefetch links load pages you never visit — blocking them saves real data',
  'tracking pixels fire on nearly every page load across hundreds of sites a day',
  'tabs left open overnight with live JS can burn as much as a full page load per hour',
  'charging during off-peak grid hours often uses cleaner, cheaper energy',
  'wifi uses roughly 20x less energy than LTE for the same data — prefer it always',
  'bookmarking heavy sites beats keeping them pinned open as idle tabs all day',
  'the greenest energy is the energy you never use',
  'one closed tab = one small win. add them up.',
  'every autoplay stopped is data and carbon saved',
  'blocking ads cuts data transfer and often speeds up pages',
  'lazy loading images means less wasted bandwidth on stuff you never scroll to',
  'your footprint adds up — small changes compound',
  'search without AI overviews uses a fraction of the server-side compute',
  'prefer text over video when you can — it\'s orders of magnitude lighter',
  'one hour of streaming can emit as much as driving a mile',
  'tab sleeping quietly saves energy while you work in other windows',
  'trackers load on almost every site — blocking them reduces bloat',
  'a dimmer screen is a longer battery and a lighter impact',
  'off-peak charging often means more solar and wind on the grid',
  'fewer tabs = less memory = less CPU = less power',
  'every kilowatt-hour saved is CO₂ that doesn\'t hit the atmosphere',
  'go green, one tab at a time',
  'browsing lean is browsing clean',
  'your choices matter — keep choosing lighter',
  'the best carbon is the carbon you never emit',
  'close what you don\'t need. the planet notices.',
  'small actions, big cumulative impact',
  'sleep those tabs — your battery and the grid will thank you',
  'less data = less energy = less carbon. simple.',
  'you\'re making a difference. keep going.',
  'every blocked tracker is one less request across the web',
  'choose 720p, save half the bits',
  'bookmark it, don\'t leave it open',
  'going green never sleeps — and neither do your small wins',
  'optimize your browsing, shrink your footprint',
];
document.getElementById('tip-body').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];

document.body.classList.remove('gt-loading');

// ── Stats ─────────────────────────────────────────────────────────────────────
function fmt(n) { return n >= 100 ? Math.round(n).toString() : n >= 10 ? n.toFixed(1) : n.toFixed(2); }

var BOTTLES_PER_AI_VISIT = 0.1;
var BOTTLES_PER_AI_MINUTE = 0.05;
var CO2_PER_AI_VISIT = 1;   // ~1g per AI chat visit (inference + cooling)
var CO2_PER_AI_MINUTE = 0.5; // ~0.5g per minute on AI site (streaming, idle inference)

var heroAnimReq = null;
var heroAnimatedThisSession = false;
function animateHeroNum(target, el) {
  if (heroAnimReq) cancelAnimationFrame(heroAnimReq);
  var startVal = 0;
  var startTime = null;
  var dur = 1000;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    var elapsed = timestamp - startTime;
    var p = Math.min(elapsed / dur, 1);
    p = 1 - (1 - p) * (1 - p);
    var val = startVal + (target - startVal) * p;
    el.innerHTML = fmt(val) + '<span class="co2-unit">g CO\u2082</span>';
    if (p < 1) heroAnimReq = requestAnimationFrame(step);
  }
  heroAnimReq = requestAnimationFrame(step);
}
function renderStats(s) {
  var saved = s.totalCo2Saved || 0;
  var aiVisits = s.aiSiteVisits || 0;
  var aiMinutes = s.aiMinutesSpent || 0;
  var co2Added = (aiVisits * CO2_PER_AI_VISIT) + (aiMinutes * CO2_PER_AI_MINUTE);
  var total = Math.max(0, saved - co2Added);
  var el = document.getElementById('hero-num');
  if (el) {
    if (heroAnimatedThisSession) {
      el.innerHTML = fmt(total) + '<span class="co2-unit">g CO\u2082</span>';
    } else {
      heroAnimatedThisSession = true;
      animateHeroNum(total, el);
    }
  }
  document.getElementById('f-searches').textContent  = s.aiOverviewsAvoided  || 0;
  document.getElementById('f-autoplay').textContent  = s.autoplaysBlocked    || 0;
  document.getElementById('f-slept').textContent     = s.tabsSlept           || 0;
  document.getElementById('f-tabs-closed').textContent = s.tabsClosedViaGreenTab || 0;
  document.getElementById('f-images').textContent    = s.lazyImagesSaved     || 0;
  document.getElementById('f-prefetch').textContent  = s.prefetchesRemoved   || 0;
  document.getElementById('f-trackers').textContent  = s.trackingPixelsKilled|| 0;
  document.getElementById('f-ads').textContent       = s.adsBlocked          || 0;
  var bottles = (aiVisits * BOTTLES_PER_AI_VISIT) + (aiMinutes * BOTTLES_PER_AI_MINUTE);
  var fAi = document.getElementById('f-ai-visits'), fBottles = document.getElementById('f-bottles');
  var fCo2 = document.getElementById('f-co2-added');
  if (fAi) fAi.textContent = aiVisits;
  if (fBottles) fBottles.textContent = Math.ceil(bottles);
  if (fCo2) fCo2.textContent = Math.round(co2Added);
  updateDotColor(saved, co2Added, bottles);
}

function getPerformanceLevel(saved, co2Added, bottles) {
  var net = saved - co2Added;
  if (saved === 0 && co2Added === 0) return 'green';
  if (net >= 5 && bottles < 15) return 'green';
  if (net < -20 || bottles >= 25) return 'red';
  return 'amber';
}

function updateDotColor(saved, co2Added, bottles) {
  var perf = getPerformanceLevel(saved, co2Added, bottles);
  var dot = document.getElementById('logo-dot');
  if (dot) {
    dot.classList.remove('perf-green', 'perf-amber', 'perf-red');
    dot.classList.add('perf-' + perf);
  }
}

chrome.runtime.sendMessage({ type: 'GET_STATS' }, function(s) { if (s) renderStats(s); });

// ── First-time intro ───────────────────────────────────────────────────────────
(function initIntro() {
  var overlay = document.getElementById('intro-overlay');
  var btn = document.getElementById('intro-got-it');
  if (!overlay || !btn) return;
  chrome.storage.local.get('gt-seen-intro', function(r) {
    if (!r['gt-seen-intro']) {
      overlay.classList.add('visible');
    }
  });
  btn.addEventListener('click', function() {
    chrome.storage.local.set({ 'gt-seen-intro': true });
    overlay.classList.remove('visible');
    expandSidebarOnSettingsClose = true;
    openSettings();
  });
})();

// ── Open tabs ─────────────────────────────────────────────────────────────────
var recentlyClosedIds = {};
var keptTabIds = {};
var lastTabCount = 0;

function loadKeptTabIds(cb) {
  chrome.storage.local.get('gt-kept-tab-ids', function(r) { cb(r['gt-kept-tab-ids'] || {}); });
}
function addKeptTabId(tabId) {
  keptTabIds[tabId] = true;
  chrome.storage.local.set({ 'gt-kept-tab-ids': keptTabIds });
}
function formatOpenDuration(ms) {
  var s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return d + 'd';
  if (h > 0) return h + 'h';
  if (m > 0) return m + 'm';
  return s + 's';
}
function shortName(title, url) {
  var name = (title && title.trim()) ? title.trim() : '';
  if (!name) {
    try { name = new URL(url).hostname.replace(/^www\./, '') || 'tab'; } catch(e) { name = 'tab'; }
  }
  return name.length > 28 ? name.slice(0, 25) + '…' : name;
}

var SUGGEST_OPEN_MS = 2 * 24 * 60 * 60 * 1000;  // 2 days
var SUGGEST_TITLE_MATCHES = ['google search', 'bing', 'duckduckgo', 'yahoo search', 'ecosia'];
function shouldSuggestClose(t, ms, kept) {
  if (t.active) return false;
  if (kept[t.id]) return false;
  if (t.blank) return true;
  var title = (t.title || '').toLowerCase();
  if (SUGGEST_TITLE_MATCHES.some(function(m) { return title.includes(m); })) return true;
  if (!t.url || !t.url.startsWith('http')) return false;
  return ms >= SUGGEST_OPEN_MS;
}
function loadOpenTabs() {
  loadKeptTabIds(function(kept) {
    keptTabIds = kept;
    chrome.runtime.sendMessage({ type: 'GET_TABS', currentWindow: true }, function(tabs) {
      if (!tabs) return;
      var list = document.getElementById('open-tabs-list');
      if (!list) return;
      tabs = tabs.filter(function(t) { return !recentlyClosedIds[t.id]; });
      var now = Date.now();
      tabs.sort(function(a, b) {
        var suggestA = shouldSuggestClose(a, Math.max(0, now - (a.openedAt || now)), kept);
        var suggestB = shouldSuggestClose(b, Math.max(0, now - (b.openedAt || now)), kept);
        if (suggestA && !suggestB) return -1;
        if (!suggestA && suggestB) return 1;
        return 0;
      });
      list.innerHTML = '';
      tabs.forEach(function(t) {
        var ms = Math.max(0, now - (t.openedAt || now));
        var suggest = shouldSuggestClose(t, ms, kept);
      var row = document.createElement('div');
      row.className = 'tab-row';
      row.dataset.tabId = t.id;
      row.innerHTML =
        '<div class="tab-title-wrap">' +
        '<span class="tab-name" title="' + (t.title || t.url || '').replace(/"/g, '&quot;') + '">' +
        shortName(t.title, t.url) + '</span>' +
        (t.active ? '<span class="tab-current-pill">this tab</span>' : '') +
        '</div>' +
        (suggest ? '' : '<span class="tab-time' + (ms > 5 * 24 * 60 * 60 * 1000 ? ' tab-time-old' : '') + '">' + formatOpenDuration(ms) + '</span>') +
        '<span class="tab-close-wrap">' +
        (suggest
          ? '<span class="tab-suggest-pill" data-tab-id="' + t.id + '" title="suggested to close" aria-label="Close tab">close</span>' +
            '<button class="tab-keep-btn" data-tab-id="' + t.id + '" aria-label="Keep tab">keep</button>'
          : '<button class="tab-close" data-tab-id="' + t.id + '" aria-label="Close tab">×</button>') +
        '</span>';
      list.appendChild(row);
    });
    if (tabs.length === 0) {
      list.innerHTML = '<div class="tab-row" style="color:var(--dim);font-size:10px">no other tabs open</div>';
    }
    lastTabCount = tabs.length;
    var suggestCount = tabs.filter(function(t) {
      var ms = Math.max(0, now - (t.openedAt || now));
      return shouldSuggestClose(t, ms, kept);
    }).length;
    updateTopbarAlert(suggestCount);
  });
  });
}

var lastSuggestCount = 0;
function playSuggestionAlertSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 550;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch (_) {}
}
function playTabCloseSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch (_) {}
}
function playClearSuggestedSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var t = ctx.currentTime;
    function note(start, freq, dur) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur);
    }
    note(t, 523, 0.12);
    note(t + 0.08, 659, 0.14);
    note(t + 0.2, 784, 0.2);
  } catch (_) {}
}
function updateTopbarAlert(suggestCount) {
  var el = document.getElementById('topbar-alert');
  var clearBtn = document.getElementById('btn-clear-idle');
  if (clearBtn) {
    clearBtn.classList.toggle('has-suggestions', suggestCount > 0);
    clearBtn.classList.toggle('no-suggestions', suggestCount === 0);
  }
  if (!el) return;
  if (suggestCount > 0) {
    if (lastSuggestCount === 0) playSuggestionAlertSound();
    lastSuggestCount = suggestCount;
    el.textContent = suggestCount + ' tab' + (suggestCount === 1 ? '' : 's') + ' suggested to close';
    el.classList.remove('hidden');
    el.onclick = function() {
      var pane = document.getElementById('stats-pane');
      if (pane && pane.classList.contains('collapsed')) {
        pane.classList.remove('collapsed');
        delete document.documentElement.dataset.sidebarCollapsed;
        localStorage.setItem('gt-sidebar-collapsed', '0');
      }
    };
  } else {
    lastSuggestCount = 0;
    el.classList.add('hidden');
    el.onclick = null;
  }
}
var openTabsList = document.getElementById('open-tabs-list');
if (openTabsList) openTabsList.addEventListener('click', function(e) {
  var row = e.target.closest('.tab-row[data-tab-id]');
  if (row && !e.target.closest('.tab-close, .tab-suggest-pill, .tab-keep-btn')) {
    var tabId = parseInt(row.dataset.tabId, 10);
    if (tabId) chrome.tabs.update(tabId, { active: true });
    return;
  }
});
if (openTabsList) openTabsList.addEventListener('mousedown', function(e) {
  var keepBtn = e.target.closest('.tab-keep-btn');
  if (keepBtn && e.button === 0) {
    e.preventDefault();
    e.stopPropagation();
    var tabId = parseInt(keepBtn.dataset.tabId, 10);
    if (tabId) addKeptTabId(tabId);
    loadOpenTabs();
    return;
  }
  var btn = e.target.closest('.tab-close');
  var pill = e.target.closest('.tab-suggest-pill');
  var closeTarget = btn || pill;
  if (!closeTarget || e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  var tabId = parseInt(closeTarget.dataset.tabId, 10);
  recentlyClosedIds[tabId] = true;
  setTimeout(function() { delete recentlyClosedIds[tabId]; }, 2000);
  var row = closeTarget.closest('.tab-row');
  var list = document.getElementById('open-tabs-list');
  if (row && list) {
    row.remove();
    if (list.children.length === 0) {
      list.innerHTML = '<div class="tab-row" style="color:var(--dim);font-size:10px">no other tabs open</div>';
    }
  }
  playTabCloseSound();
  chrome.tabs.remove(tabId);
  chrome.runtime.sendMessage({ type: 'TAB_CLOSED_VIA_GREENTAB', count: 1 });
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, function(s) { if (s) renderStats(s); });
});
loadOpenTabs();
function refreshStatsAndTabs() {
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, function(s) { if (s) renderStats(s); });
  loadOpenTabs();
}
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) refreshStatsAndTabs();
});
window.addEventListener('focus', refreshStatsAndTabs);
setInterval(function() { if (!document.hidden) loadOpenTabs(); }, 30000);

document.getElementById('btn-clear-idle').addEventListener('click', function() {
  loadKeptTabIds(function(kept) {
    chrome.runtime.sendMessage({ type: 'GET_TABS', currentWindow: true }, function(tabs) {
      if (!tabs) return;
      var extUrl = chrome.runtime.getURL('pages/newtab.html');
      var now = Date.now();
      var toClose = tabs.filter(function(t) {
        if (t.active || !t.url || t.url === extUrl) return false;
        if (kept[t.id]) return false;
        if (t.blank) return true;
        var title = (t.title || '').toLowerCase();
        if (SUGGEST_TITLE_MATCHES.some(function(m) { return title.includes(m); })) return true;
        if (!t.url.startsWith('http')) return false;
        var ms = Math.max(0, now - (t.openedAt || now));
        return ms >= SUGGEST_OPEN_MS;
      });
      if (toClose.length > 0) {
        playClearSuggestedSound();
        toClose.forEach(function(t) { chrome.tabs.remove(t.id); });
        chrome.runtime.sendMessage({ type: 'TAB_CLOSED_VIA_GREENTAB', count: toClose.length });
        chrome.runtime.sendMessage({ type: 'GET_STATS' }, function(s) { if (s) renderStats(s); });
      }
      loadOpenTabs();
    });
  });
});
// ── Rings ─────────────────────────────────────────────────────────────────────
var CIRC = 201.1;

function setRing(id, pct, stroke) {
  var el = document.getElementById(id);
  if (!el) return;
  el.style.strokeDashoffset = (CIRC - (CIRC * Math.max(0, Math.min(100, pct)) / 100)).toFixed(1);
  if (stroke) el.style.stroke = stroke;
}
function setBadge(id, text, cls) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'ring-badge ' + cls;
}

var currentZone = 'default';
var currentChromePowerMW = null;
var currentRenewablesPct = null;

function applyGridPower(carbonFreePct, zone) {
  var el = document.getElementById('grid-num');
  if (!el) return;
  if (carbonFreePct == null || carbonFreePct < 0) {
    el.textContent = '—';
    setBadge('charge-badge', 'unknown', 'amber');
    setRing('ring-grid', 0, 'var(--amber)');
    currentRenewablesPct = null;
    updateCarbonImpact();
    return;
  }
  var pct = Math.round(Math.min(100, Math.max(0, carbonFreePct)));
  el.textContent = pct;
  var label, cls, stroke;
  if (pct >= 50) {
    label = 'clean';   cls = 'green';  stroke = 'var(--accent)';
  } else if (pct >= 35) {
    label = 'mixed';   cls = 'amber';  stroke = 'var(--amber)';
  } else {
    label = 'unclean'; cls = 'red';    stroke = 'var(--red)';
  }
  setBadge('charge-badge', label, cls);
  setRing('ring-grid', pct, stroke);
  currentRenewablesPct = pct;
  updateCarbonImpact();
}

function setChromePower(mW) {
  var el = document.getElementById('renew-num');
  if (!el) return;
  if (mW == null || mW < 0) { el.textContent = '—'; setBadge('renew-badge', '—', 'amber'); currentChromePowerMW = null; updateCarbonImpact(); return; }
  currentChromePowerMW = mW;
  var w = mW / 1000;
  el.textContent = w.toFixed(1);
  var pct = Math.min(100, (mW / 5000) * 100);
  var color = mW < 1000 ? 'var(--accent)' : mW < 3000 ? 'var(--amber)' : 'var(--red)';
  setRing('ring-renew', pct, color);
  var badge = mW < 1000 ? 'low' : mW < 3000 ? 'moderate' : 'high';
  setBadge('renew-badge', badge, mW < 1000 ? 'green' : mW < 3000 ? 'amber' : 'red');
  updateCarbonImpact();
}

function updateCarbonImpact() {
  var el = document.getElementById('temp-num');
  if (!el) return;
  if (currentChromePowerMW == null || currentRenewablesPct == null) {
    el.textContent = '—';
    setBadge('temp-badge', 'unknown', 'amber');
    setRing('ring-temp', 0, 'var(--amber)');
    return;
  }
  var fossilPct = Math.max(0, 100 - currentRenewablesPct);
  var ciEstimate = 5 * fossilPct;
  var impact = (currentChromePowerMW / 1000) * (ciEstimate / 1000);
  var gPerHr = Math.round(impact * 10) / 10;
  el.textContent = gPerHr;
  var stroke = impact <= 0.5 ? 'var(--accent)' : impact < 1 ? 'var(--amber)' : 'var(--red)';
  var label = impact <= 0.5 ? 'low' : impact < 1 ? 'medium' : 'high';
  var cls = impact <= 0.5 ? 'green' : impact < 1 ? 'amber' : 'red';
  setRing('ring-temp', Math.min(100, (impact / 2) * 100), stroke);
  setBadge('temp-badge', label, cls);
}

var EMAPS_TOKEN = 'EzFC2fkPbUw6zQgaz9s5';
function fetchElectricityMaps(zone) {
  fetch('https://api.electricitymaps.com/v3/carbon-free-energy/latest?zone=' + zone, { headers: { 'auth-token': EMAPS_TOKEN }, signal: AbortSignal.timeout(8000) })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var pct = d.value;
      if (typeof pct === 'number' && pct >= 0) applyGridPower(pct, zone);
      else throw new Error();
    })
    .catch(function() {
      fetchGWF(null);
    });
}

function fetchGrid() {
  fetch('https://ip-api.com/json/?fields=countryCode,timezone,query', { signal: AbortSignal.timeout(5000) })
    .then(function(r) { return r.json(); })
    .then(function(geo) {
      var c = geo.countryCode || '', tz = geo.timezone || '', ip = geo.query || null;
      currentZone = countryToZone(c, tz) || 'default';
      if (currentZone && currentZone !== 'default') {
        fetchElectricityMaps(currentZone);
        return;
      }
      fetchGWF(ip);
    })
    .catch(function() {
      fetch('https://cloudflare.com/cdn-cgi/trace', { signal: AbortSignal.timeout(4000) })
        .then(function(r) { return r.text(); })
        .then(function(t) {
          var m = t.match(/loc=([A-Z]{2})/), c = m ? m[1] : '';
          currentZone = countryToZone(c, '') || 'default';
          if (currentZone && currentZone !== 'default') {
            fetchElectricityMaps(currentZone);
            return;
          }
          fetchGWF(null);
        })
        .catch(function() { fetchGWF(null); });
    });
}

function fetchGWF(ip) {
  fetch('https://api.thegreenwebfoundation.org/api/v3/ip-to-co2intensity/' + (ip || ''), { signal: AbortSignal.timeout(7000) })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var ci = d.carbon_intensity;
      if (typeof ci !== 'number') { applyGridPower(null); return; }
      var pct = Math.max(0, Math.min(100, 100 - ci / 5));
      applyGridPower(pct);
    })
    .catch(function() { applyGridPower(null); });
}

function countryToZone(c, tz) {
  var z = { GB:'GB',DE:'DE',FR:'FR',ES:'ES',IT:'IT',NL:'NL',SE:'SE',NO:'NO',DK:'DK-DK1',PT:'PT',BE:'BE',AT:'AT',CH:'CH',PL:'PL',AU:'AU-NSW',CA:'CA-ON',JP:'JP-TK',BR:'BR-CS',IN:'IN-SO',ZA:'ZA',MX:'MX-CE',SG:'SG',KR:'KR' };
  if (c === 'US') {
    if (tz.includes('Pacific'))  return 'US-CAL-CISO';
    if (tz.includes('Mountain')) return 'US-SW-PNM';
    if (tz.includes('Central'))  return 'US-MIDW-MISO';
    if (tz.includes('Eastern'))  return 'US-NY-NYIS';
    return 'US-MIDA-PJM';
  }
  return z[c] || null;
}

fetchGrid();
setInterval(fetchGrid, 10 * 60 * 1000);  // refresh grid every 10 min

// ── Chrome power (CPU-based estimate or tab fallback) ──────────────────────────
var lastCpuSample = null;
var POWER_BASE_MW = 300;
var POWER_PER_TAB_MW = 50;
var POWER_CPU_SCALE_MW = 4500;

function estimatePowerFromTabs() {
  return POWER_BASE_MW + (lastTabCount * POWER_PER_TAB_MW);
}

function updateChromePower() {
  if (typeof chrome !== 'undefined' && chrome.system && chrome.system.cpu) {
    chrome.system.cpu.getInfo().then(function(info) {
      if (!info || !info.processors || info.processors.length === 0) {
        setChromePower(estimatePowerFromTabs());
        return;
      }
      var user = 0, kernel = 0, total = 0;
      info.processors.forEach(function(p) {
        var u = p.usage || {};
        user += u.user || 0;
        kernel += u.kernel || 0;
        total += u.total || 0;
      });
      if (lastCpuSample && total > lastCpuSample.total) {
        var dUsed = (user - lastCpuSample.user) + (kernel - lastCpuSample.kernel);
        var dTotal = total - lastCpuSample.total;
        var cpuPct = dTotal > 0 ? (dUsed / dTotal) * 100 : 0;
        var mW = POWER_BASE_MW + (cpuPct / 100) * POWER_CPU_SCALE_MW;
        setChromePower(Math.round(mW));
      } else {
        setChromePower(estimatePowerFromTabs());
      }
      lastCpuSample = { user: user, kernel: kernel, total: total };
    }).catch(function() {
      setChromePower(estimatePowerFromTabs());
    });
  } else {
    setChromePower(estimatePowerFromTabs());
  }
}

updateChromePower();
setInterval(updateChromePower, 2500);
