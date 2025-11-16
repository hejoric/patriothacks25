// Storage keys
const STORAGE_KEYS = {
  TODOS: 'todos',
  DAILY_TASKS: 'dailyTasks',
  STREAK: 'streak',
  STREAK_HISTORY: 'streakHistory',
  LAST_VISIT: 'lastVisit',
  BLOCKED_SITES: 'blockedSites',
  SITE_USAGE: 'siteUsage',
  AVATAR_SETTINGS: 'avatarSettings',
  NOTIFICATIONS_ENABLED: 'notificationsEnabled',
  VOICE_PACK: 'voicePack',
  TIMER_STATE: 'timerState',
  TIMER_MODE: 'timerMode',
  BRAIN_BREAK: 'brainBreak',
  SECTION_COLLAPSED: 'sectionCollapsed'
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  await initializeExtension();
  setupEventListeners();
  updateUI();
  await loadTimerState();
  checkBrainBreak();
});

// Initialize extension data
async function initializeExtension() {
  await updateStreak();
  await loadTodos();
  await loadDailyTasks();
  await loadBlockedSites();
  await loadUsageStats();
  await loadAvatarSettings();
  await loadSectionStates();
  updateMood();
}

// Setup all event listeners
function setupEventListeners() {
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const tabName = e.currentTarget.dataset.tab;
      switchTab(tabName);
    });
  });

  document.getElementById('addTodo').addEventListener('click', addTodo);
  document.getElementById('todoInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTodo();
  });

  // Daily task button toggle
  document.getElementById('dailyTaskBtn').addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT') {
      const checkbox = document.getElementById('isDailyTask');
      checkbox.checked = !checkbox.checked;
    }
  });

  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', (e) => {
      toggleSection(e.currentTarget.dataset.section);
    });
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = e.currentTarget.dataset.mode;
      const minutes = parseInt(e.currentTarget.dataset.minutes, 10);
      setTimerMode(mode, minutes);
    });
  });

  document.getElementById('startTimer').addEventListener('click', startTimer);
  document.getElementById('pauseTimer').addEventListener('click', pauseTimer);
  document.getElementById('resetTimer').addEventListener('click', resetTimer);

  document.querySelectorAll('.brain-break-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const minutes = parseInt(e.currentTarget.dataset.minutes, 10);
      startBrainBreak(minutes);
    });
  });

  document.getElementById('endBrainBreak').addEventListener('click', () => {
    endBrainBreak();
  });

  document.getElementById('voicePack').addEventListener('change', (e) => {
    saveVoicePack(e.target.value);
  });

  document.getElementById('addBlockedSite').addEventListener('click', addBlockedSite);
  document.getElementById('blockedSiteInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addBlockedSite();
  });

  document.getElementById('avatarColor').addEventListener('change', (e) => {
    updateAvatarSetting('color', e.target.value);
  });

  document.getElementById('avatarStyle').addEventListener('change', (e) => {
    updateAvatarSetting('style', e.target.value);
  });

  document.getElementById('avatarEmoji').addEventListener('change', (e) => {
    updateAvatarSetting('emoji', e.target.value);
  });

  document.getElementById('enableNotifications').addEventListener('change', (e) => {
    saveNotificationSettings(e.target.checked);
  });

  document.getElementById('exportData').addEventListener('click', exportData);
  document.getElementById('importData').addEventListener('click', importData);
  document.getElementById('clearData').addEventListener('click', clearAllData);
}

// Tab switching
function switchTab(tabName) {
  // Remove active from all buttons and add Bootstrap's active class
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Hide all tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
    content.style.display = 'none';
  });

  // Show selected tab
  const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
  const selectedContent = document.getElementById(tabName);
  
  if (selectedButton) selectedButton.classList.add('active');
  if (selectedContent) {
    selectedContent.classList.add('active');
    selectedContent.style.display = 'block';
  }
}

// Streak management (Snapchat-style)
async function updateStreak() {
  const data = await chrome.storage.local.get([
    STORAGE_KEYS.STREAK,
    STORAGE_KEYS.LAST_VISIT,
    STORAGE_KEYS.STREAK_HISTORY,
    STORAGE_KEYS.TODOS
  ]);

  const today = new Date().toDateString();
  const lastVisit = data[STORAGE_KEYS.LAST_VISIT];
  let streak = data[STORAGE_KEYS.STREAK] || 0;
  let streakHistory = data[STORAGE_KEYS.STREAK_HISTORY] || [];
  const todos = data[STORAGE_KEYS.TODOS] || [];

  const todayTodos = todos.filter(todo =>
    new Date(todo.createdAt).toDateString() === today && todo.completed
  );

  const hasActivityToday = todayTodos.length > 0;

  if (lastVisit !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastVisit === yesterday.toDateString() && hasActivityToday) {
      streak++;
      streakHistory.push({ date: today, streak });
    } else if (!lastVisit || lastVisit !== yesterday.toDateString()) {
      if (hasActivityToday) {
        streak = 1;
        streakHistory = [{ date: today, streak: 1 }];
      } else {
        streak = 0;
      }
    }

    await chrome.storage.local.set({
      [STORAGE_KEYS.STREAK]: streak,
      [STORAGE_KEYS.LAST_VISIT]: today,
      [STORAGE_KEYS.STREAK_HISTORY]: streakHistory.slice(-30)
    });
  }

  const streakDisplay = streak > 0 ? `${streak}` : '0';
  document.getElementById('streakCount').textContent = streakDisplay;

  const streakCounter = document.querySelector('.streak-counter');
  if (streak >= 7) {
    streakCounter.style.animation = 'pulse 2s infinite';
  }
}

// Todo list functionality
async function loadTodos() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TODOS);
  const todos = data[STORAGE_KEYS.TODOS] || [];

  const regularList = document.getElementById('todoList');
  const completedList = document.getElementById('completedList');

  regularList.innerHTML = '';
  completedList.innerHTML = '';

  const activeTodos = todos.filter(todo => !todo.completed && !todo.isDaily);
  const completedTodos = todos.filter(todo => todo.completed && !todo.isDaily);

  activeTodos.forEach((todo, index) => {
    const originalIndex = todos.indexOf(todo);
    const todoItem = createTodoElement(todo, originalIndex);
    regularList.appendChild(todoItem);
  });

  completedTodos.forEach((todo, index) => {
    const originalIndex = todos.indexOf(todo);
    const todoItem = createTodoElement(todo, originalIndex, true);
    completedList.appendChild(todoItem);
  });

  document.getElementById('regularCount').textContent = activeTodos.length;
  document.getElementById('completedCount').textContent = completedTodos.length;

  updateTodoStats(todos);
  updateProgressBar(todos);
}

async function loadDailyTasks() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.TODOS, STORAGE_KEYS.DAILY_TASKS]);
  const todos = data[STORAGE_KEYS.TODOS] || [];
  const dailyTaskTemplates = data[STORAGE_KEYS.DAILY_TASKS] || [];

  const today = new Date().toDateString();
  const dailyTodos = todos.filter(todo => todo.isDaily);

  const needsReset = dailyTodos.length === 0 ||
    (dailyTodos[0] && new Date(dailyTodos[0].createdAt).toDateString() !== today);

  if (needsReset && dailyTaskTemplates.length > 0) {
    const filteredTodos = todos.filter(todo => !todo.isDaily);

    dailyTaskTemplates.forEach(template => {
      filteredTodos.push({
        text: template.text,
        priority: template.priority || 'medium',
        completed: false,
        isDaily: true,
        createdAt: new Date().toISOString()
      });
    });

    await chrome.storage.local.set({ [STORAGE_KEYS.TODOS]: filteredTodos });
  }

  const dailyList = document.getElementById('dailyTasksList');
  dailyList.innerHTML = '';

  const currentDailyTodos = todos.filter(todo => todo.isDaily);
  currentDailyTodos.forEach((todo, index) => {
    const originalIndex = todos.indexOf(todo);
    const todoItem = createTodoElement(todo, originalIndex);
    dailyList.appendChild(todoItem);
  });

  document.getElementById('dailyCount').textContent = currentDailyTodos.filter(t => !t.completed).length;
}

function createTodoElement(todo, index, isCompleted = false) {
  const div = document.createElement('div');
  div.className = `todo-item d-flex align-items-center gap-2 ${todo.completed ? 'completed' : ''} priority-${todo.priority || 'medium'}`;

  const badgeHtml = todo.isDaily ? '<span class="badge bg-info text-dark">DAILY</span>' : '';
  const completeBtn = todo.completed 
    ? '<button class="btn btn-sm btn-outline-secondary" data-index="' + index + '" data-action="uncomplete">Undo</button>'
    : '<button class="btn btn-sm btn-success" data-index="' + index + '" data-action="complete">Complete</button>';

  div.innerHTML = `
    <span class="todo-text flex-grow-1">${escapeHtml(todo.text)}</span>
    ${badgeHtml}
    ${completeBtn}
    <button class="btn btn-sm btn-danger" data-index="${index}" data-action="delete">Delete</button>
  `;

  const completeButton = div.querySelector('[data-action="complete"], [data-action="uncomplete"]');
  if (completeButton) {
    completeButton.addEventListener('click', (e) => {
      toggleTodo(parseInt(e.target.dataset.index));
    });
  }

  const deleteButton = div.querySelector('[data-action="delete"]');
  deleteButton.addEventListener('click', (e) => {
    deleteTodo(parseInt(e.target.dataset.index));
  });

  return div;
}

async function addTodo() {
  const input = document.getElementById('todoInput');
  const text = input.value.trim();
  const priority = document.getElementById('taskPriority').value;
  const isDaily = document.getElementById('isDailyTask').checked;

  if (!text) return;

  const data = await chrome.storage.local.get([STORAGE_KEYS.TODOS, STORAGE_KEYS.DAILY_TASKS]);
  const todos = data[STORAGE_KEYS.TODOS] || [];
  const dailyTaskTemplates = data[STORAGE_KEYS.DAILY_TASKS] || [];

  const newTodo = {
    text,
    priority,
    completed: false,
    isDaily,
    createdAt: new Date().toISOString()
  };

  todos.push(newTodo);

  if (isDaily) {
    dailyTaskTemplates.push({ text, priority });
    await chrome.storage.local.set({ [STORAGE_KEYS.DAILY_TASKS]: dailyTaskTemplates });
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.TODOS]: todos });
  input.value = '';
  document.getElementById('isDailyTask').checked = false;

  await loadTodos();
  await loadDailyTasks();
  updateMood();
  updateStreak();
}

async function toggleTodo(index) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TODOS);
  const todos = data[STORAGE_KEYS.TODOS] || [];

  if (todos[index]) {
    todos[index].completed = !todos[index].completed;

    if (todos[index].completed) {
      await sendNotification('Task Completed! 🎉', `Great job completing: ${todos[index].text}`);
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.TODOS]: todos });
    await loadTodos();
    await loadDailyTasks();
    updateMood();
    updateStreak();
  }
}

async function deleteTodo(index) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TODOS);
  const todos = data[STORAGE_KEYS.TODOS] || [];

  if (todos[index] && todos[index].isDaily) {
    const dailyData = await chrome.storage.local.get(STORAGE_KEYS.DAILY_TASKS);
    const dailyTemplates = dailyData[STORAGE_KEYS.DAILY_TASKS] || [];
    const filteredTemplates = dailyTemplates.filter(t => t.text !== todos[index].text);
    await chrome.storage.local.set({ [STORAGE_KEYS.DAILY_TASKS]: filteredTemplates });
  }

  todos.splice(index, 1);
  await chrome.storage.local.set({ [STORAGE_KEYS.TODOS]: todos });
  await loadTodos();
  await loadDailyTasks();
  updateMood();
}

function updateProgressBar(todos) {
  const allTodos = todos.filter(todo => !todo.completed);
  const completedTodos = todos.filter(todo => todo.completed);
  const total = todos.length;

  if (total === 0) {
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressText').textContent = '0%';
    return;
  }

  const percentage = Math.round((completedTodos.length / total) * 100);
  document.getElementById('progressBar').style.width = percentage + '%';
  document.getElementById('progressText').textContent = percentage + '%';
}

function updateTodoStats(todos) {
  const today = new Date().toDateString();
  const todayTodos = todos.filter(todo =>
    new Date(todo.createdAt).toDateString() === today
  );

  const completed = todayTodos.filter(todo => todo.completed).length;
  const total = todayTodos.length;

  document.getElementById('todayCompleted').textContent = completed;
  document.getElementById('todayTotal').textContent = total;
}

// Section collapse/expand
async function toggleSection(sectionName) {
  const header = document.querySelector(`[data-section="${sectionName}"]`);
  const section = header.closest('.task-section');
  section.classList.toggle('collapsed');

  const data = await chrome.storage.local.get(STORAGE_KEYS.SECTION_COLLAPSED);
  const collapsed = data[STORAGE_KEYS.SECTION_COLLAPSED] || {};
  collapsed[sectionName] = section.classList.contains('collapsed');
  await chrome.storage.local.set({ [STORAGE_KEYS.SECTION_COLLAPSED]: collapsed });
}

async function loadSectionStates() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SECTION_COLLAPSED);
  const collapsed = data[STORAGE_KEYS.SECTION_COLLAPSED] || {};

  Object.keys(collapsed).forEach(sectionName => {
    if (collapsed[sectionName]) {
      const header = document.querySelector(`[data-section="${sectionName}"]`);
      if (header) {
        const section = header.closest('.task-section');
        section.classList.add('collapsed');
      }
    }
  });
}

// Timer functionality with persistence
let timerInterval = null;
let timeRemaining = 25 * 60;
let isTimerRunning = false;
let currentMode = 'pomodoro';
let timerEndTime = null;

const TIMER_MODES = {
  pomodoro: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60
};

async function setTimerMode(mode, minutes) {
  // Reset timer when switching modes
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  isTimerRunning = false;
  timerEndTime = null;
  currentMode = mode;
  timeRemaining = minutes * 60;
  
  updateTimerDisplay();

  // Update button states
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.mode === mode) {
      btn.classList.add('active');
    }
  });

  await saveTimerState();
}

async function startTimer() {
  if (isTimerRunning) return;

  isTimerRunning = true;
  timerEndTime = Date.now() + (timeRemaining * 1000);

  chrome.runtime.sendMessage({
    type: 'START_TIMER',
    endTime: timerEndTime,
    mode: currentMode
  });

  await saveTimerState();
  runTimerUI();
}

function runTimerUI() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (timerEndTime) {
      timeRemaining = Math.max(0, Math.floor((timerEndTime - Date.now()) / 1000));
      updateTimerDisplay();

      if (timeRemaining <= 0) {
        timerComplete();
      }
    }
  }, 100);
}

async function pauseTimer() {
  isTimerRunning = false;
  timerEndTime = null;

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  chrome.runtime.sendMessage({ type: 'PAUSE_TIMER' });
  await saveTimerState();
}

async function resetTimer() {
  pauseTimer();
  timeRemaining = TIMER_MODES[currentMode] || 25 * 60;
  updateTimerDisplay();
  await saveTimerState();
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  document.getElementById('timerDisplay').textContent =
    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function timerComplete() {
  pauseTimer();

  const data = await chrome.storage.local.get(STORAGE_KEYS.VOICE_PACK);
  const voicePack = data[STORAGE_KEYS.VOICE_PACK] || 'beep';

  await sendNotification('Timer Complete! ⏰', `Your ${currentMode} session is done!`);
  chrome.runtime.sendMessage({ type: 'PLAY_ALARM', voicePack });

  resetTimer();
}

async function saveTimerState() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.TIMER_STATE]: {
      timeRemaining,
      isRunning: isTimerRunning,
      endTime: timerEndTime,
      mode: currentMode
    }
  });
}

async function loadTimerState() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.TIMER_STATE, STORAGE_KEYS.TIMER_MODE]);
  const state = data[STORAGE_KEYS.TIMER_STATE];

  if (state) {
    currentMode = state.mode || 'pomodoro';

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === currentMode);
    });

    if (state.isRunning && state.endTime) {
      timerEndTime = state.endTime;
      const remaining = Math.floor((timerEndTime - Date.now()) / 1000);

      if (remaining > 0) {
        timeRemaining = remaining;
        isTimerRunning = true;
        runTimerUI();
      } else {
        resetTimer();
      }
    } else {
      timeRemaining = state.timeRemaining || TIMER_MODES[currentMode];
    }

    updateTimerDisplay();
  }
}

// Listen for timer updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TIMER_COMPLETE') {
    timerComplete();
  }
});

async function saveVoicePack(voicePack) {
  await chrome.storage.local.set({ [STORAGE_KEYS.VOICE_PACK]: voicePack });
}

// Brain Break functionality
let brainBreakInterval = null;

async function startBrainBreak(minutes) {
  const endTime = Date.now() + (minutes * 60 * 1000);

  chrome.runtime.sendMessage({
    type: 'START_BRAIN_BREAK',
    endTime: endTime
  });

  await chrome.storage.local.set({
    [STORAGE_KEYS.BRAIN_BREAK]: {
      active: true,
      endTime: endTime
    }
  });

  updateBrainBreakUI();
  runBrainBreakTimer();

  await sendNotification('Brain Break Started! 🧠', `Take a ${minutes} minute break. Blocked sites are now accessible.`);
}

function runBrainBreakTimer() {
  if (brainBreakInterval) clearInterval(brainBreakInterval);

  brainBreakInterval = setInterval(async () => {
    await checkBrainBreak();
  }, 1000);
}

async function checkBrainBreak() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.BRAIN_BREAK);
  const brainBreak = data[STORAGE_KEYS.BRAIN_BREAK];
  const endBreakBtn = document.getElementById('endBrainBreak');

  if (brainBreak && brainBreak.active) {
    const remaining = Math.max(0, Math.floor((brainBreak.endTime - Date.now()) / 1000));

    if (remaining > 0) {
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      document.getElementById('brainBreakStatus').textContent =
        `Break active: ${minutes}:${String(seconds).padStart(2, '0')} remaining`;
      document.getElementById('brainBreakStatus').className = 'brain-break-status active';
      if (endBreakBtn) endBreakBtn.style.display = 'block';
    } else {
      await endBrainBreak();
    }
  } else {
    document.getElementById('brainBreakStatus').textContent = '';
    document.getElementById('brainBreakStatus').className = 'brain-break-status';
    if (endBreakBtn) endBreakBtn.style.display = 'none';
  }
}

async function endBrainBreak() {
  if (brainBreakInterval) {
    clearInterval(brainBreakInterval);
    brainBreakInterval = null;
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.BRAIN_BREAK]: {
      active: false,
      endTime: null
    }
  });

  chrome.runtime.sendMessage({ type: 'END_BRAIN_BREAK' });

  await sendNotification('Brain Break Complete! 🎯', 'Time to get back to work. Blocked sites are active again.');

  updateBrainBreakUI();
}

function updateBrainBreakUI() {
  checkBrainBreak();
}

// Website blocker functionality
async function loadBlockedSites() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.BLOCKED_SITES);
  const blockedSites = data[STORAGE_KEYS.BLOCKED_SITES] || [];

  const list = document.getElementById('blockedSitesList');
  list.innerHTML = '';

  blockedSites.forEach((site, index) => {
    const item = createBlockedSiteElement(site, index);
    list.appendChild(item);
  });
}

function createBlockedSiteElement(site, index) {
  const div = document.createElement('div');
  div.className = 'd-flex align-items-center justify-content-between p-2 mb-2 bg-light rounded border';

  div.innerHTML = `
    <div class="d-flex align-items-center gap-2">
      <span class="badge bg-danger">🚫</span>
      <span class="fw-medium">${escapeHtml(site)}</span>
    </div>
    <button class="btn btn-sm btn-success" data-index="${index}">Unblock</button>
  `;

  div.querySelector('button').addEventListener('click', (e) => {
    unblockSite(parseInt(e.target.dataset.index));
  });

  return div;
}

async function addBlockedSite() {
  const input = document.getElementById('blockedSiteInput');
  let site = input.value.trim();

  if (!site) return;

  site = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

  const data = await chrome.storage.local.get(STORAGE_KEYS.BLOCKED_SITES);
  const blockedSites = data[STORAGE_KEYS.BLOCKED_SITES] || [];

  if (!blockedSites.includes(site)) {
    blockedSites.push(site);
    await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: blockedSites });

    chrome.runtime.sendMessage({ type: 'UPDATE_BLOCKED_SITES', sites: blockedSites });

    input.value = '';
    await loadBlockedSites();
  }
}

async function unblockSite(index) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.BLOCKED_SITES);
  const blockedSites = data[STORAGE_KEYS.BLOCKED_SITES] || [];

  blockedSites.splice(index, 1);
  await chrome.storage.local.set({ [STORAGE_KEYS.BLOCKED_SITES]: blockedSites });

  chrome.runtime.sendMessage({ type: 'UPDATE_BLOCKED_SITES', sites: blockedSites });

  await loadBlockedSites();
}

async function loadUsageStats() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.SITE_USAGE);
  const siteUsage = data[STORAGE_KEYS.SITE_USAGE] || {};

  const today = new Date().toDateString();
  const todayUsage = siteUsage[today] || {};

  const usageList = document.getElementById('usageStats');
  usageList.innerHTML = '';

  const sites = Object.entries(todayUsage).sort((a, b) => b[1] - a[1]);

  if (sites.length === 0) {
    usageList.innerHTML = '<div class="text-center text-muted py-3"><em>No usage data yet today</em></div>';
    return;
  }

  const maxSeconds = Math.max(...sites.map(s => s[1]));

  sites.slice(0, 10).forEach(([site, seconds]) => {
    const minutes = Math.floor(seconds / 60);
    const percentage = maxSeconds > 0 ? (seconds / maxSeconds) * 100 : 0;
    
    const item = document.createElement('div');
    item.className = 'mb-3';
    item.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-1">
        <span class="fw-medium small">${escapeHtml(site)}</span>
        <span class="badge bg-secondary">${minutes}m ${seconds % 60}s</span>
      </div>
      <div class="progress" style="height: 8px;">
        <div class="progress-bar bg-warning" role="progressbar" style="width: ${percentage}%"></div>
      </div>
    `;
    usageList.appendChild(item);
  });
}

// Avatar and mood functionality
async function loadAvatarSettings() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.AVATAR_SETTINGS);
  const settings = data[STORAGE_KEYS.AVATAR_SETTINGS] || {
    color: '#4CAF50',
    style: 'circle',
    emoji: '😊'
  };

  const avatar = document.getElementById('avatar');
  avatar.style.background = settings.color;
  avatar.className = `avatar ${settings.style}`;
  avatar.textContent = settings.emoji;

  document.getElementById('avatarColor').value = settings.color;
  document.getElementById('avatarStyle').value = settings.style;
  document.getElementById('avatarEmoji').value = settings.emoji;

  const notifData = await chrome.storage.local.get(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
  const notificationsEnabled = notifData[STORAGE_KEYS.NOTIFICATIONS_ENABLED] !== false;
  document.getElementById('enableNotifications').checked = notificationsEnabled;

  const voiceData = await chrome.storage.local.get(STORAGE_KEYS.VOICE_PACK);
  const voicePack = voiceData[STORAGE_KEYS.VOICE_PACK] || 'beep';
  document.getElementById('voicePack').value = voicePack;
}

async function updateAvatarSetting(key, value) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.AVATAR_SETTINGS);
  const settings = data[STORAGE_KEYS.AVATAR_SETTINGS] || {};

  settings[key] = value;
  await chrome.storage.local.set({ [STORAGE_KEYS.AVATAR_SETTINGS]: settings });
  await loadAvatarSettings();
}

async function updateMood() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TODOS);
  const todos = data[STORAGE_KEYS.TODOS] || [];

  const today = new Date().toDateString();
  const todayTodos = todos.filter(todo =>
    new Date(todo.createdAt).toDateString() === today
  );

  const totalTasks = todayTodos.length;
  const completedTasks = todayTodos.filter(todo => todo.completed).length;
  const incompleteTasks = totalTasks - completedTasks;

  let mood = '😊';

  if (totalTasks === 0) {
    mood = '😴';
  } else if (incompleteTasks === 0) {
    mood = '🤩';
  } else {
    const completionRate = completedTasks / totalTasks;

    if (completionRate >= 0.8) {
      mood = '😃';
    } else if (completionRate >= 0.6) {
      mood = '😊';
    } else if (completionRate >= 0.4) {
      mood = '😐';
    } else if (completionRate >= 0.2) {
      mood = '😕';
    } else if (incompleteTasks > 5) {
      mood = '😰';
    } else {
      mood = '😔';
    }
  }

  document.getElementById('moodMeter').textContent = mood;

  const avatarData = await chrome.storage.local.get(STORAGE_KEYS.AVATAR_SETTINGS);
  const settings = avatarData[STORAGE_KEYS.AVATAR_SETTINGS];

  if (!settings || !settings.customEmoji) {
    document.getElementById('avatar').textContent = mood;
  }
}

// Notification functionality
async function sendNotification(title, message) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.NOTIFICATIONS_ENABLED);
  const notificationsEnabled = data[STORAGE_KEYS.NOTIFICATIONS_ENABLED] !== false;

  if (notificationsEnabled) {
    chrome.runtime.sendMessage({
      type: 'SHOW_NOTIFICATION',
      title,
      message
    });
  }
}

async function saveNotificationSettings(enabled) {
  await chrome.storage.local.set({ [STORAGE_KEYS.NOTIFICATIONS_ENABLED]: enabled });
}

// Data management
async function exportData() {
  const data = await chrome.storage.local.get(null);
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `productivity-pal-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

async function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  input.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        await chrome.storage.local.set(data);
        alert('Data imported successfully!');
        await initializeExtension();
      } catch (error) {
        alert('Error importing data. Please check the file format.');
      }
    };
    reader.readAsText(file);
  });

  input.click();
}

async function clearAllData() {
  if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    await chrome.storage.local.clear();
    alert('All data cleared!');
    await initializeExtension();
  }
}

// Utility functions
function updateUI() {
  updateTimerDisplay();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}