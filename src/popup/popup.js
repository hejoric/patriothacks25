// Storage keys
const STORAGE_KEYS = {
  TODOS: 'todos',
  STREAK: 'streak',
  BLOCKED_SITES: 'blockedSites',
  TIMER_STATE: 'timerState',
  AVATAR_SETTINGS: 'avatarSettings'
};

// Initialize the extension when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  await loadTodos();
  setupEventListeners();
});

// Attach event listeners to all interactive elements
function setupEventListeners() {

  document.getElementById('addTodo')?.addEventListener('click', addTodo);
  document.getElementById('todoInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTodo();
  });


  document.getElementById('startTimer')?.addEventListener('click', startTimer);
  document.getElementById('pauseTimer')?.addEventListener('click', pauseTimer);
  document.getElementById('resetTimer')?.addEventListener('click', resetTimer);

  document.querySelectorAll('.tab-button')?.forEach(button => {
    button.addEventListener('click', (e) => {
      const tabName = e.target.dataset.tab;
      switchTab(tabName);
    });
  });


  document.getElementById('saveSettings')?.addEventListener('click', saveSettings);


  document.getElementById('addBlockedSite')?.addEventListener('click', addBlockedSite);
  document.getElementById('blockedSiteInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addBlockedSite();
  });
}

// Load and display todos from storage
async function loadTodos() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TODOS);
  const todos = data[STORAGE_KEYS.TODOS] || [];

  const list = document.getElementById('todoList');
  if (!list) return;

  list.innerHTML = '';

  todos.forEach((todo, index) => {
    const todoItem = createTodoElement(todo, index);
    list.appendChild(todoItem);
  });
}

// Create a DOM element for a single todo item with event handlers
function createTodoElement(todo, index) {
  const div = document.createElement('div');
  div.className = `todo-item ${todo.completed ? 'completed' : ''}`;

  div.innerHTML = `
    <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} data-index="${index}">
    <span class="todo-text">${escapeHtml(todo.text)}</span>
    <button class="todo-delete" data-index="${index}">×</button>
  `;

  div.querySelector('.todo-checkbox').addEventListener('change', (e) => {
    toggleTodo(parseInt(e.target.dataset.index));
  });

  div.querySelector('.todo-delete').addEventListener('click', (e) => {
    deleteTodo(parseInt(e.target.dataset.index));
  });

  return div;
}

// Add a new todo item to storage and refresh the list
async function addTodo() {
  const input = document.getElementById('todoInput');
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  const data = await chrome.storage.local.get(STORAGE_KEYS.TODOS);
  const todos = data[STORAGE_KEYS.TODOS] || [];

  const newTodo = {
    text,
    completed: false,
    createdAt: new Date().toISOString()
  };

  todos.push(newTodo);
  await chrome.storage.local.set({ [STORAGE_KEYS.TODOS]: todos });

  input.value = '';
  await loadTodos();
}

// Toggle the completed state of a todo item
async function toggleTodo(index) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TODOS);
  const todos = data[STORAGE_KEYS.TODOS] || [];

  if (todos[index]) {
    todos[index].completed = !todos[index].completed;
    await chrome.storage.local.set({ [STORAGE_KEYS.TODOS]: todos });
    await loadTodos();
  }
}

// Remove a todo item from storage
async function deleteTodo(index) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TODOS);
  const todos = data[STORAGE_KEYS.TODOS] || [];

  todos.splice(index, 1);
  await chrome.storage.local.set({ [STORAGE_KEYS.TODOS]: todos });
  await loadTodos();
}

// Timer state variables
let timerInterval = null;
let timeRemaining = 25 * 60;
let isTimerRunning = false;

// Start the countdown timer with 1-second intervals
function startTimer() {
  if (isTimerRunning) return;

  isTimerRunning = true;

  timerInterval = setInterval(() => {
    if (timeRemaining > 0) {
      timeRemaining--;
      updateTimerDisplay();
      saveTimerState();
    } else {
      pauseTimer();
      showNotification('Timer Complete!', 'Your session is finished.');
    }
  }, 1000);

  updateTimerDisplay();
  saveTimerState();
}

// Pause the timer and clear the interval
function pauseTimer() {
  isTimerRunning = false;

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  saveTimerState();
}

// Reset timer to default 25 minutes
function resetTimer() {
  pauseTimer();
  timeRemaining = 25 * 60;
  updateTimerDisplay();
  saveTimerState();
}

// Update the timer display in MM:SS format
function updateTimerDisplay() {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const display = document.getElementById('timerDisplay');
  if (display) {
    display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}

// Persist timer state to chrome storage
async function saveTimerState() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.TIMER_STATE]: {
      timeRemaining,
      isRunning: isTimerRunning
    }
  });
}

// Streak tracking
async function updateStreak() {
  // TODO: Implement streak tracking
  // - Get last visit date from storage
  // - Compare with today's date
  // - Increment streak if consecutive days
  // - Reset streak if gap > 1 day
  // - Update UI with current streak
  console.log('Update streak');
}

// TODO: Website blocker
// - Allow users to add/remove blocked sites
// - Block sites during work sessions
// - Add "brain break" mode to temporarily unblock

// TODO: Usage statistics
// - Track time spent on different websites
// - Display daily/weekly stats
// - Show productivity insights

// TODO: Avatar and mood system
// - Customizable avatar (color, style, emoji)
// - Mood changes based on productivity
// - Settings for personalization

// TODO: Notifications
// - Task completion notifications
// - Timer complete notifications
// - Configurable notification settings

// TODO: Data management
// - Export data to JSON file
// - Import data from backup
// - Clear all data option

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Display a browser notification or fallback to alert
function showNotification(title, message) {
  // Check if notifications are supported
  if ('Notification' in window) {
    // Request permission if needed
    if (Notification.permission === 'granted') {
      new Notification(title, { body: message });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body: message });
        }
      });
    }
  }
  // Fallback to alert if notifications not supported
  else {
    alert(`${title}\n${message}`);
  }
}