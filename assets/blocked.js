// Load and display stats
async function loadStats() {
    const data = await chrome.storage.local.get(['todos', 'streak']);
    const todos = data.todos || [];
    const streak = data.streak || 0;

    const today = new Date().toDateString();
    const todayTodos = todos.filter(todo =>
        new Date(todo.createdAt).toDateString() === today
    );
    const completed = todayTodos.filter(todo => todo.completed).length;

    document.getElementById('tasksCompleted').textContent = completed;
    document.getElementById('streak').textContent = streak;
}

function openExtension() {
    chrome.runtime.sendMessage({ type: 'OPEN_POPUP' });
}

// Add event listeners
document.getElementById('openExtensionBtn').addEventListener('click', openExtension);
document.getElementById('goBackBtn').addEventListener('click', () => history.back());

loadStats();
