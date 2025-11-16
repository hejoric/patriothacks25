// Storage keys
const STORAGE_KEYS = {
  TODOS: 'todos'
  // TODO: Add more storage keys as needed
  // - STREAK: for tracking daily streaks
  // - BLOCKED_SITES: for website blocker
  // - TIMER_STATE: for timer persistence
  // - AVATAR_SETTINGS: for user customization
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  await loadTodos();
  setupEventListeners();
});

// Setup basic event listeners
function setupEventListeners() {
  // Todo list
  document.getElementById('addTodo')?.addEventListener('click', addTodo);
  document.getElementById('todoInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTodo();
  });

  // TODO: Add more event listeners
  // - Timer controls (start, pause, reset)
  // - Tab navigation
  // - Settings
  // - Website blocker
}

// Todo list functionality
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

async function toggleTodo(index) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TODOS);
  const todos = data[STORAGE_KEYS.TODOS] || [];

  if (todos[index]) {
    todos[index].completed = !todos[index].completed;
    await chrome.storage.local.set({ [STORAGE_KEYS.TODOS]: todos });
    await loadTodos();
  }
}

async function deleteTodo(index) {
  const data = await chrome.storage.local.get(STORAGE_KEYS.TODOS);
  const todos = data[STORAGE_KEYS.TODOS] || [];

  todos.splice(index, 1);
  await chrome.storage.local.set({ [STORAGE_KEYS.TODOS]: todos });
  await loadTodos();
}

// TODO: Timer functionality
// - Add pomodoro timer with start/pause/reset
// - Store timer state in chrome.storage
// - Show notifications when timer completes
// - Support different timer modes (work, short break, long break)

// TODO: Streak tracking
// - Track daily completion streaks (like Snapchat)
// - Store last visit date
// - Calculate and display current streak
// - Add visual indicators for milestones

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