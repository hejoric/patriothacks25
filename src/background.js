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