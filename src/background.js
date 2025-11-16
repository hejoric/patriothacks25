//background service worker for extension functionalities

//Storage keys
const STORAGE_KEYS = {
    SITE_USAGE: 'siteUsage',
    BLOCKED_SITES: 'blockedSites',
    TIMER_STATE: 'timerState'
    BRAIN_BREAK: 'brainBreak'
}

//Tracks active tab and the time spent
let currentTab = null;
let startTime = null;

//Initialize on install
chrome.runtime.onInstalled.addListener(() => {
    console.log('Lock In Extension installed');
    //set up the intial rules
    updateBlockingRules();
    //set up alarms for daily reset
    chrome.alarms.create('dailyReset', { periodInMinutes: 1440 }); // 24 hours
});

// Listen for tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await recordTimeSpent();
  
  const tab = await chrome.tabs.get(activeInfo.tabId);
  startTracking(tab);
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    await recordTimeSpent();
    startTracking(tab);
  }
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    await recordTimeSpent();
    currentTab = null;
    startTime = null;
  } else {
    // Browser gained focus
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      startTracking(tab);
    }
  }
});

// Start tracking time for a tab
function startTracking(tab) {
  if (tab && tab.url) {
    try {
      const url = new URL(tab.url);
      // Only track http and https URLs
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        currentTab = url.hostname;
        startTime = Date.now();
      }
    } catch (e) {
      // Invalid URL, don't track
      currentTab = null;
      startTime = null;
    }
  }
}



// Record time spent on current tab
async function recordTimeSpent() {
  if (!currentTab || !startTime) return;
  
  const endTime = Date.now();
  const timeSpent = Math.floor((endTime - startTime) / 1000); // in seconds
  
  if (timeSpent > 0 && timeSpent < 3600) { // placeholder time to only record if less than 1 hour (sanity check)
    const data = await chrome.storage.local.get(STORAGE_KEYS.SITE_USAGE);
    const siteUsage = data[STORAGE_KEYS.SITE_USAGE] || {};
    
    const today = new Date().toDateString();
    if (!siteUsage[today]) {
      siteUsage[today] = {};
    }
    
    if (!siteUsage[today][currentTab]) {
      siteUsage[today][currentTab] = 0;
    }
    
    siteUsage[today][currentTab] += timeSpent;
    
    await chrome.storage.local.set({ [STORAGE_KEYS.SITE_USAGE]: siteUsage });
  }
  
  currentTab = null;
  startTime = null;
}

//Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_BLOCKED_SITES') {
    updateBlockingRules(message.sites);
  } else if (message.type === 'SHOW_NOTIFICATION') {
    showNotification(message.title, message.message);
  } else if (message.type === 'PLAY_ALARM') {
    playAlarm(message.voicePack);
  } else if (message.type === 'START_TIMER') {
    startTimerAlarm(message.endTime, message.mode);
  } else if (message.type === 'PAUSE_TIMER') {
    chrome.alarms.clear('timerComplete');
  } else if (message.type === 'START_BRAIN_BREAK') {
    startBrainBreak(message.endTime);
  } else if (message.type === 'END_BRAIN_BREAK') {
    endBrainBreak();
  }
});

// Update blocking rules
async function updateBlockingRules(sites) {
  // Check if brain break is active
  const brainBreakData = await chrome.storage.local.get(STORAGE_KEYS.BRAIN_BREAK);
  const brainBreak = brainBreakData[STORAGE_KEYS.BRAIN_BREAK];
  
  if (brainBreak && brainBreak.active) {
    // Don't block sites during brain break
    return;
  }
  
  if (!sites) {
    const data = await chrome.storage.local.get(STORAGE_KEYS.BLOCKED_SITES);
    sites = data[STORAGE_KEYS.BLOCKED_SITES] || [];
  }
  
  // Clear existing rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIds = existingRules.map(rule => rule.id);
  
  if (ruleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds
    });
  }
  
  // Add new rules for blocked sites
  const rules = sites.map((site, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: chrome.runtime.getURL('blocked.html')
      }
    },
    condition: {
      urlFilter: `*://*.${site}/*`,
      resourceTypes: ['main_frame']
    }
  }));
  
  if (rules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules
    });
  }
}


