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
    //set up intial rules
    updateBlockingRules();
    //set up alarms for daily reset
    chrome.alarms.create('dailyReset', { periodInMinutes: 1440 }); // 24 hours
});
