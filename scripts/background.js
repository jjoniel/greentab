'use strict';

// ── Green settings (gt-settings in storage.sync) ──────────────────────────────
var SETTINGS_DEFAULTS = {
  adBlocking:        true,
  trackerBlocking:   true,
  autoplayBlocking:  true,
  youtubeAutoplay:   true,
  thirdPartyCookies: true,
  lazyImages:        true,
  prefetchRemoval:   true,
  trackingPixels:    true,
  tabSleeping:       true,
  youtubeQuality:    true,  // cap at 720p
};

function getSettings(cb) {
  chrome.storage.sync.get('gt-settings', function(r) {
    cb(Object.assign({}, SETTINGS_DEFAULTS, r['gt-settings'] || {}));
  });
}

function saveSettings(settings, cb) {
  chrome.storage.sync.set({ 'gt-settings': settings }, cb || function() {});
}

// Apply DNR rulesets based on settings
function applyAdBlocking(enabled) {
  if (typeof chrome.declarativeNetRequest === 'undefined') return;
  var p = enabled
    ? chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ['adblock'] })
    : chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['adblock'] });
  p && p.catch(function() {});
}
function applyTrackerBlocking(enabled) {
  if (typeof chrome.declarativeNetRequest === 'undefined') return;
  var p = enabled
    ? chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ['trackers'] })
    : chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['trackers'] });
  p && p.catch(function() {});
}

// Load settings on startup and apply
getSettings(function(s) {
  applyAdBlocking(s.adBlocking);
  applyTrackerBlocking(s.trackerBlocking);
});

// ── CO2 factors (grams) — IEA, Sustainable Web Design, peer‑reviewed sources ───
// Sources: IEA 2020 (36g/hr streaming), 0.2g/MB data (SWD), Google SGE estimates
var CO2 = {
  aiOverviewAvoided:  0.8,    // ~0.8g per AI overview avoided (Google SGE inference)
  autoplayBlocked:    2.0,    // ~2g per prevented autoplay (IEA: 36g/hr → ~0.6g/min × 3min avg)
  lazyImageSaved:     0.03,   // ~0.1MB/image × 0.2g/MB (SWD per-MB factor)
  tabSlept:           0.15,   // ~0.15g per tab (20min background CPU/network avoided)
  tabClosedViaGT:     0.1,    // ~0.1g per tab closed via GreenTab UI (future drain avoided)
  prefetchRemoved:    0.02,   // ~0.1MB prefetch × 0.2g/MB
  trackingPixelKilled:0.001,  // negligible per 1×1 pixel
  adsBlocked:         0.5,    // ~0.5MB ad × 0.2g/MB (DOM ad unit)
};

var DEFAULTS = {
  totalCo2Saved:        0,
  aiOverviewsAvoided:   0,
  autoplaysBlocked:     0,
  lazyImagesSaved:      0,
  tabsSlept:            0,
  prefetchesRemoved:    0,
  trackingPixelsKilled: 0,
  adsBlocked:           0,
  aiSiteVisits:         0,
  aiMinutesSpent:       0,
  tabsClosedViaGreenTab:0,
  todayDate:            '',
  todayCo2:             0,
  todayAiOverviews:     0,
  todayAutoplays:       0,
  todayTabsSlept:       0,
  todayAiVisits:        0,
  todayAiMinutes:       0,
  todayTabsClosedViaGT: 0,
  weekData:             [0,0,0,0,0,0,0],
};

// AI chat domains — each visit ≈ 0.1 water bottles (cooling / inference)
var AI_DOMAINS = [
  'chat.openai.com', 'chatgpt.com', 'claude.ai', 'claude.com',
  'gemini.google.com', 'bard.google.com', 'perplexity.ai',
  'copilot.microsoft.com', 'poe.com', 'you.com', 'phind.com',
  'character.ai', 'openrouter.ai', 'mistral.ai', 'groq.com', 'together.ai'
];

function isAiSite(hostname) {
  if (!hostname) return false;
  var h = hostname.replace(/^www\./, '');
  return AI_DOMAINS.some(function(d) { return h === d || h.endsWith('.' + d); });
}

function todayKey() { return new Date().toISOString().slice(0,10); }
function dow()      { return (new Date().getDay() + 6) % 7; }

function getStats(cb) {
  chrome.storage.local.get('gt2', function(r) {
    var s = Object.assign({}, DEFAULTS, r.gt2 || {});
    if (s.todayDate !== todayKey()) {
      s.todayDate         = todayKey();
      s.todayCo2          = 0;
      s.todayAiOverviews  = 0;
      s.todayAutoplays    = 0;
      s.todayTabsSlept    = 0;
      s.todayAiVisits     = 0;
      s.todayAiMinutes    = 0;
      s.todayTabsClosedViaGT = 0;
      s.weekData[dow()]   = 0;
    }
    cb(s);
  });
}

function saveStats(s) { chrome.storage.local.set({ gt2: s }); }

function addSaving(type, count) {
  count = count || 1;
  getStats(function(s) {
    var grams = +(((CO2[type] || 0) * count)).toFixed(4);
    s.totalCo2Saved       = +(s.totalCo2Saved + grams).toFixed(4);
    s.todayCo2            = +(s.todayCo2 + grams).toFixed(4);
    s.weekData[dow()]     = +(s.weekData[dow()] + grams).toFixed(4);
    if (type === 'aiOverviewAvoided')   { s.aiOverviewsAvoided   += count; s.todayAiOverviews += count; }
    if (type === 'autoplayBlocked')     { s.autoplaysBlocked     += count; s.todayAutoplays   += count; }
    if (type === 'lazyImageSaved')        s.lazyImagesSaved      += count;
    if (type === 'tabSlept')            { s.tabsSlept            += count; s.todayTabsSlept   += count; }
    if (type === 'tabClosedViaGT')      { s.tabsClosedViaGreenTab += count; s.todayTabsClosedViaGT += count; }
    if (type === 'prefetchRemoved')       s.prefetchesRemoved    += count;
    if (type === 'trackingPixelKilled')   s.trackingPixelsKilled += count;
    if (type === 'adsBlocked')            s.adsBlocked           += count;
    saveStats(s);
  });
}

// ── AI tab session tracking (time spent) ───────────────────────────────────────
var aiTabSessions = {};
var lastActiveTabId = null;

function addAiTime(minutes) {
  if (minutes <= 0) return;
  getStats(function(s) {
    s.aiMinutesSpent = +(s.aiMinutesSpent + minutes).toFixed(4);
    s.todayAiMinutes = +(s.todayAiMinutes + minutes).toFixed(4);
    saveStats(s);
  });
}

chrome.tabs.onActivated.addListener(function(info) {
  var now = Date.now();
  var prevId = lastActiveTabId;
  lastActiveTabId = info.tabId;

  if (prevId && aiTabSessions[prevId]) {
    var mins = (now - aiTabSessions[prevId].enteredAt) / 60000;
    addAiTime(mins);
    delete aiTabSessions[prevId];
  }

  chrome.tabs.get(info.tabId, function(tab) {
    if (chrome.runtime.lastError) return;
    try {
      if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
        var hostname = new URL(tab.url).hostname;
        if (isAiSite(hostname)) {
          aiTabSessions[info.tabId] = { enteredAt: now };
        }
      }
    } catch(e) {}
  });
});

chrome.tabs.onRemoved.addListener(function(tabId) {
  if (lastActiveTabId === tabId) lastActiveTabId = null;
  if (aiTabSessions[tabId]) {
    var mins = (Date.now() - aiTabSessions[tabId].enteredAt) / 60000;
    addAiTime(mins);
    delete aiTabSessions[tabId];
  }
});

// ── AI overview tracking & AI site visit tracking ──────────────────────────────
chrome.webNavigation.onCommitted.addListener(function(details) {
  if (details.frameId !== 0) return;
  try {
    var url = new URL(details.url);
    if (url.hostname.includes('google.') && url.searchParams.get('udm') === '14') {
      addSaving('aiOverviewAvoided');
    }
    if (isAiSite(url.hostname)) {
      aiTabSessions[details.tabId] = { enteredAt: Date.now() };
      getStats(function(s) {
        s.aiSiteVisits = (s.aiSiteVisits || 0) + 1;
        s.todayAiVisits = (s.todayAiVisits || 0) + 1;
        saveStats(s);
      });
    }
  } catch(e) {}
});

// ── Tab sleeping via chrome.tabs.discard() ────────────────────────────────────
var TAB_IDLE_MS = 20 * 60 * 1000;
var tabLastActive = {};

chrome.tabs.onActivated.addListener(function(info) {
  tabLastActive[info.tabId] = Date.now();
});

chrome.tabs.onRemoved.addListener(function(tabId) {
  delete tabLastActive[tabId];
  chrome.storage.local.get('gt-tab-opened', function(r) {
    var opened = r['gt-tab-opened'] || {};
    if (opened[tabId] != null) {
      delete opened[tabId];
      chrome.storage.local.set({ 'gt-tab-opened': opened });
    }
  });
});

chrome.alarms.create('tabSleeper', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name !== 'tabSleeper') return;
  getSettings(function(s) {
    if (!s.tabSleeping) return;
    var now = Date.now();
    chrome.tabs.query({ pinned: false, active: false, audible: false, discarded: false }, function(tabs) {
      tabs.forEach(function(tab) {
        var last = tabLastActive[tab.id] || (now - TAB_IDLE_MS - 1);
        if (now - last >= TAB_IDLE_MS && tab.url && tab.url.startsWith('http')) {
          chrome.tabs.discard(tab.id, function() {
            if (!chrome.runtime.lastError) addSaving('tabSlept');
          });
        }
      });
    });
  });
});

function isBlankUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url === 'about:blank' || url === 'about:newtab' || url.startsWith('chrome://newtab');
}

// Seed last-active times and AI sessions on startup
chrome.tabs.query({}, function(allTabs) {
  var now = Date.now();
  allTabs.forEach(function(t) { if (!tabLastActive[t.id]) tabLastActive[t.id] = now; });
});
chrome.tabs.query({ active: true, lastFocusedWindow: true }, function(tabs) {
  if (tabs[0]) {
    var now = Date.now();
    try {
      var url = tabs[0].url;
      if (url && (url.startsWith('http') || url.startsWith('https'))) {
        var hostname = new URL(url).hostname;
        if (isAiSite(hostname)) {
          lastActiveTabId = tabs[0].id;
          aiTabSessions[tabs[0].id] = { enteredAt: now };
        }
      }
    } catch(e) {}
  }
});

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(function(msg, _sender, sendResponse) {
  if (msg.type === 'GET_STATS') {
    getStats(function(s) { sendResponse(s); });
    return true;
  }
  if (msg.type === 'GET_SETTINGS') {
    getSettings(function(s) { sendResponse(s); });
    return true;
  }
  if (msg.type === 'SET_SETTINGS') {
    getSettings(function(current) {
      var next = Object.assign({}, current, msg.settings);
      saveSettings(next, function() {
        applyAdBlocking(next.adBlocking);
        applyTrackerBlocking(next.trackerBlocking);
        sendResponse(next);
      });
    });
    return true;
  }
  if (msg.type === 'SAVING') {
    addSaving(msg.saving, msg.count || 1);
  }
  if (msg.type === 'TAB_CLOSED_VIA_GREENTAB') {
    addSaving('tabClosedViaGT', msg.count || 1);
  }
  if (msg.type === 'GET_TABS') {
    chrome.tabs.query(msg.currentWindow ? { currentWindow: true } : {}, function(tabs) {
      var extUrl = chrome.runtime.getURL('pages/newtab.html');
      var list = tabs.filter(function(t) {
        if (!t.url || t.url === extUrl) return false;
        return t.url.startsWith('http') || t.url.startsWith('https') || isBlankUrl(t.url);
      }).map(function(t) {
        var blank = isBlankUrl(t.url);
        var title = t.title || (blank ? 'Blank' : '');
        if (!title) { try { title = new URL(t.url).hostname; } catch(e) {} title = title || 'tab'; }
        return { id: t.id, title: title, url: t.url, audible: t.audible || false, active: t.active, blank: blank };
      });
      (function addOpenedAt(tabList) {
        var now = Date.now();
        chrome.storage.local.get('gt-tab-opened', function(r) {
          var opened = r['gt-tab-opened'] || {};
          var changed = false;
          tabList.forEach(function(t) {
            if (opened[t.id] == null) {
              opened[t.id] = now;
              changed = true;
            }
            t.openedAt = opened[t.id];
          });
          if (changed) chrome.storage.local.set({ 'gt-tab-opened': opened });
          sendResponse(tabList);
        });
      })(list);
    });
    return true;
  }
  if (msg.type === 'CLOSE_IDLE_TABS') {
    var now = Date.now();
    var idleMs = (msg.minutes || 20) * 60 * 1000;
    chrome.tabs.query({ pinned: false }, function(tabs) {
      var extUrl = chrome.runtime.getURL('pages/newtab.html');
      var toClose = tabs.filter(function(t) {
        if (t.active || !t.url || t.url === extUrl) return false;
        if (isBlankUrl(t.url)) return true;
        if (!t.url.startsWith('http')) return false;
        var last = tabLastActive[t.id] || now;
        return (now - last) >= idleMs;
      });
      toClose.forEach(function(t) { chrome.tabs.remove(t.id); });
      if (toClose.length > 0) addSaving('tabClosedViaGT', toClose.length);
      sendResponse({ closed: toClose.length });
    });
    return true;
  }
});
