//background service worker for extension functionalities

//Storage keys
const STORAGE_KEYS = {
  SITE_USAGE: 'siteUsage',
  BLOCKED_SITES: 'blockedSites',
  TIMER_STATE: 'timerState',
  BRAIN_BREAK: 'brainBreak'
}

//Tracks active tab and the time spent
let currentTab = null;
let startTime = null;
let trackingInterval = null;

//Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Locked In Extension installed');
  //set up the intial rules
  updateBlockingRules();
  //set up alarms for daily reset
  chrome.alarms.create('dailyReset', { periodInMinutes: 1440 }); // 24 hours

  // Start periodic tracking
  startPeriodicTracking();
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

// Periodic tracking to update time every 10 seconds
function startPeriodicTracking() {
  if (trackingInterval) {
    clearInterval(trackingInterval);
  }

  trackingInterval = setInterval(async () => {
    if (currentTab && startTime) {
      const now = Date.now();
      const timeSpent = Math.floor((now - startTime) / 1000);

      if (timeSpent >= 10) { // Record every 10 seconds
        await recordTimeSpent();
        // Restart tracking for the same tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          startTracking(tabs[0]);
        }
      }
    }
  }, 10000); // Check every 10 seconds
}



// Record time spent on current tab
async function recordTimeSpent() {
  if (!currentTab || !startTime) return;

  const endTime = Date.now();
  const timeSpent = Math.floor((endTime - startTime) / 1000); // in seconds

  if (timeSpent > 0 && timeSpent < 7200) { // Only record if less than 2 hours (sanity check)
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

    console.log(`Recorded ${timeSpent}s for ${currentTab}`);
  }

  currentTab = null;
  startTime = null;
}

//Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', message.type);

  if (message.type === 'UPDATE_BLOCKED_SITES') {
    console.log('🔄 Updating blocked sites:', message.sites);
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
  } else if (message.type === 'OPEN_POPUP') {
    chrome.action.openPopup();
  }
});

// Update blocking rules
async function updateBlockingRules(sites) {
  // Check if brain break is active
  const brainBreakData = await chrome.storage.local.get(STORAGE_KEYS.BRAIN_BREAK);
  const brainBreak = brainBreakData[STORAGE_KEYS.BRAIN_BREAK];
  console.log('🧠 Brain break state:', brainBreak);

  if (brainBreak && brainBreak.active) {
    // Don't block sites during brain break
    console.log('⚠️ Brain break active - skipping block rules update');
    return;
  }

  if (!sites) {
    const data = await chrome.storage.local.get(STORAGE_KEYS.BLOCKED_SITES);
    sites = data[STORAGE_KEYS.BLOCKED_SITES] || [];
  }

  console.log('Updating blocking rules for sites:', sites);

  // Clear existing rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIds = existingRules.map(rule => rule.id);

  if (ruleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds
    });
  }

  // Add new rules for blocked sites
  const rules = [];
  sites.forEach((site, index) => {
    const baseId = index * 4;
    
    // Rule 1: Match www version with path
    rules.push({
      id: baseId + 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          extensionPath: '/assets/blocked.html'
        }
      },
      condition: {
        urlFilter: `*://www.${site}/*`,
        resourceTypes: ['main_frame']
      }
    });
    
    // Rule 2: Match www version without path
    rules.push({
      id: baseId + 2,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          extensionPath: '/assets/blocked.html'
        }
      },
      condition: {
        urlFilter: `*://www.${site}`,
        resourceTypes: ['main_frame']
      }
    });
    
    // Rule 3: Match non-www version with path
    rules.push({
      id: baseId + 3,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          extensionPath: '/assets/blocked.html'
        }
      },
      condition: {
        urlFilter: `*://${site}/*`,
        resourceTypes: ['main_frame']
      }
    });
    
    // Rule 4: Match non-www version without path
    rules.push({
      id: baseId + 4,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          extensionPath: '/assets/blocked.html'
        }
      },
      condition: {
        urlFilter: `*://${site}`,
        resourceTypes: ['main_frame']
      }
    });
  });

  if (rules.length > 0) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules
      });
      console.log('✅ Blocking rules updated successfully:', sites.length, 'sites,', rules.length, 'rules created');
      console.log('📋 Sites being blocked:', sites);
      console.log('🔧 Sample rules for', sites[0] + ':', JSON.stringify(rules.slice(0, 4), null, 2));

      // Verify rules were actually added
      const verifyRules = await chrome.declarativeNetRequest.getDynamicRules();
      console.log('✔️ Verified dynamic rules count:', verifyRules.length);
      
      if (verifyRules.length === 0) {
        console.error('⚠️ WARNING: No rules are active! Check manifest permissions.');
      }
    } catch (error) {
      console.error('❌ Error updating blocking rules:', error);
      console.error('Failed rules:', JSON.stringify(rules, null, 2));
    }
  } else {
    console.log('⚠️ No sites to block - sites array is empty');
  }
}// Show notification
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/icons/icon128.png'),
    title: title,
    message: message,
    priority: 2
  });
}

// Play alarm sound
function playAlarm(voicePack) {
  // In a real implementation, this would play different sounds based on voicePack
  // For now, we'll just show a notification
  showNotification('⏰ Timer Complete!', 'Time to take a break or start a new session!');
}

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dailyReset') {
    // Clean up old usage data (keep only last 30 days)
    cleanupOldData();
  } else if (alarm.name === 'timerComplete') {
    // Timer completed
    showNotification('⏰ Timer Complete!', 'Your focus session is done!');
    playAlarm('beep');

    // Notify popup if open
    chrome.runtime.sendMessage({ type: 'TIMER_COMPLETE' });
  } else if (alarm.name === 'brainBreakEnd') {
    // Brain break ended
    endBrainBreak();
  }
});


// Timer alarm management
async function startTimerAlarm(endTime, mode) {
  await chrome.alarms.create('timerComplete', { when: endTime });

  await chrome.storage.local.set({
    [STORAGE_KEYS.TIMER_STATE]: {
      endTime: endTime,
      mode: mode,
      isRunning: true
    }
  });
}

// Brain break management
async function startBrainBreak(endTime) {
  await chrome.alarms.create('brainBreakEnd', { when: endTime });

  // Clear all blocking rules
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const ruleIds = existingRules.map(rule => rule.id);

  if (ruleIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: ruleIds
    });
  }
}

async function endBrainBreak() {
  await chrome.alarms.clear('brainBreakEnd');

  await chrome.storage.local.set({
    [STORAGE_KEYS.BRAIN_BREAK]: {
      active: false,
      endTime: null
    }
  });

  // Re-enable blocking
  await updateBlockingRules();

  showNotification('🎯 Brain Break Complete!', 'Back to work! Blocked sites are active again.');

  // Notify popup if open
  chrome.runtime.sendMessage({ type: 'BRAIN_BREAK_ENDED' });
}

// Clean up old usage data
async function cleanupOldData() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SITE_USAGE);
  const siteUsage = data[STORAGE_KEYS.SITE_USAGE] || {};

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const cleanedUsage = {};

  for (const [date, usage] of Object.entries(siteUsage)) {
    const dateObj = new Date(date);
    if (dateObj >= thirtyDaysAgo) {
      cleanedUsage[date] = usage;
    }
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.SITE_USAGE]: cleanedUsage });
}