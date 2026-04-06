/* =========================================================
   APEX OS - CORE APPLICATION LOGIC
   ========================================================= */

// --- 1. DATA LAYER (localStorage) ---
const DB_PREFIX = 'apex_';

const DB = {
  get: (key, defaultVal) => {
    const data = localStorage.getItem(DB_PREFIX + key);
    return data ? JSON.parse(data) : defaultVal;
  },
  set: (key, val) => {
    localStorage.setItem(DB_PREFIX + key, JSON.stringify(val));
    updateGlobalState();
  },
  push: (key, item) => {
    const arr = DB.get(key, []);
    arr.push({...item, id: Date.now().toString(), createdAt: new Date().toISOString()});
    DB.set(key, arr);
  },
  update: (key, id, updates) => {
    const arr = DB.get(key, []);
    const idx = arr.findIndex(item => item.id === id);
    if (idx > -1) {
      arr[idx] = { ...arr[idx], ...updates, updatedAt: new Date().toISOString() };
      DB.set(key, arr);
    }
  },
  remove: (key, id) => {
    const arr = DB.get(key, []);
    DB.set(key, arr.filter(item => item.id !== id));
  }
};

// Default setup
function initDB() {
  if (!localStorage.getItem(DB_PREFIX + 'init')) {
    DB.set('settings', { name: 'User', currency: '₹', theme: 'dark', neon: false });
    DB.set('tasks', []);
    DB.set('habits', []);
    DB.set('habitLogs', {}); // { date_habitId: status }
    DB.set('diary', []);
    DB.set('finance', []);
    DB.set('goals', []);
    DB.set('notes', []);
    DB.set('xp', 0);
    DB.set('level', 1);
    DB.set('moodLogs', {}); // { date: {mood, note, factors} }
    DB.set('water', {}); // { date: count }
    DB.set('sleep', {}); // { date: hours }
    DB.set('pomodoro', { sessions: 0, minutes: 0 });
    localStorage.setItem(DB_PREFIX + 'init', 'true');
  }
}

// Global data update hook
function updateGlobalState() {
  renderSidebarStats();
  if (currentPage === 'dashboard') renderDashboard();
  if (currentPage === 'tasks') renderTasks();
  if (currentPage === 'habits') renderHabits();
  if (currentPage === 'finance') renderFinance();
  if (currentPage === 'diary') renderDiary();
  if (currentPage === 'goals') renderGoals();
  if (currentPage === 'notes') renderNotes();
  if (currentPage === 'mood') renderMood();
}

// --- 2. THEME & UI ---
function applyTheme() {
  const settings = DB.get('settings', { theme: 'dark', neon: false });
  document.documentElement.setAttribute('data-theme', settings.theme);
  document.documentElement.setAttribute('data-neon', settings.neon);
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const s = DB.get('settings');
  s.theme = s.theme === 'dark' ? 'light' : 'dark';
  DB.set('settings', s);
  applyTheme();
});

document.getElementById('neon-toggle').addEventListener('click', () => {
  const s = DB.get('settings');
  s.neon = !s.neon;
  DB.set('settings', s);
  applyTheme();
});

// Modals
window.openModal = function(id) {
  document.getElementById(id).classList.add('open');
};

window.closeModal = function(id) {
  document.getElementById(id).classList.remove('open');
  // Auto-clear inputs
  const inputs = document.getElementById(id).querySelectorAll('input, textarea');
  inputs.forEach(i => { if(i.type !== 'color' && i.type !== 'date') i.value = '' });
};

// Toasts
window.showToast = function(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '✅';
  if(type === 'error') icon = '❌';
  if(type === 'info') icon = 'ℹ️';
  if(type === 'warning') icon = '⚠️';

  toast.innerHTML = `<div class="toast-icon">${icon}</div><div class="toast-text">${msg}</div>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};

// Clock
setInterval(() => {
  const now = new Date();
  document.getElementById('clock').innerText = now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}, 1000);

// Navigation
let currentPage = 'dashboard';
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', (e) => {
    if (el.id === 'settings-btn') {
      loadSettings();
      openModal('settings-modal');
      return;
    }
    const page = el.getAttribute('data-page');
    if(page) window.navigate(page);
  });
});

window.navigate = function(page) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if(navItem) navItem.classList.add('active');

  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  
  currentPage = page;
  document.getElementById('topbar-title').innerText = page.charAt(0).toUpperCase() + page.slice(1);
  updateGlobalState();
};

function renderSidebarStats() {
  const xp = DB.get('xp', 0);
  const lvl = Math.floor(xp / 500) + 1;
  const progress = (xp % 500) / 500 * 100;
  
  document.getElementById('xp-label-text').innerText = `XP · ${xp%500}/500`;
  document.getElementById('xp-level-text').innerText = `LVL ${lvl}`;
  document.getElementById('xp-fill').style.width = `${progress}%`;

  const today = getTodayStr();
  const tasks = DB.get('tasks', []).filter(t => t.due === today && t.status !== 'done').length;
  const taskBadge = document.getElementById('task-badge');
  if(tasks > 0) { taskBadge.style.display = 'block'; taskBadge.innerText = tasks; } 
  else { taskBadge.style.display = 'none'; }
}

function addXP(amount) {
  const xp = DB.get('xp', 0);
  DB.set('xp', xp + amount);
  showToast(`+${amount} XP Earned!`, 'success');
}

// Utilities
function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// --- 3. DASHBOARD ---
function renderDashboard() {
  const s = DB.get('settings');
  document.getElementById('greeting-name').innerText = s.name || 'User';
  
  const hour = new Date().getHours();
  let greeting = 'morning';
  if (hour >= 12 && hour < 17) greeting = 'afternoon';
  else if (hour >= 17) greeting = 'evening';
  document.getElementById('greeting-time').innerText = greeting;

  document.getElementById('dashboard-date').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Stats
  const today = getTodayStr();
  const tasks = DB.get('tasks', []);
  const todayTasks = tasks.filter(t => t.due === today);
  const doneTasks = todayTasks.filter(t => t.status === 'done').length;
  
  document.getElementById('dash-tasks-done').innerText = `${doneTasks} of ${todayTasks.length} tasks`;
  
  let pct = todayTasks.length ? Math.round((doneTasks / todayTasks.length) * 100) : 0;
  document.getElementById('dash-pct').innerText = pct + '%';
  document.getElementById('dash-ring').style.strokeDashoffset = 175.9 - (175.9 * pct / 100);

  document.getElementById('dash-total-xp').innerText = DB.get('xp', 0);
  document.getElementById('dash-level-badge').innerText = `Level ${Math.floor(DB.get('xp',0)/500)+1}`;

  // Mini lists
  const taskList = document.getElementById('dash-tasks-list');
  taskList.innerHTML = todayTasks.slice(0, 4).map(t => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-dim)">
      <input type="checkbox" ${t.status==='done'?'checked':''} onchange="toggleTask('${t.id}')">
      <span style="font-size:13.5px; ${t.status==='done'?'text-decoration:line-through;color:var(--text-muted)':''}">${t.title}</span>
    </div>
  `).join('') || '<div style="color:var(--text-muted);font-size:13px;padding:10px 0">No tasks due today. Enjoy your day!</div>';

  const habits = DB.get('habits', []);
  const habitLogs = DB.get('habitLogs', {});
  const hList = document.getElementById('dash-habits-list');
  hList.innerHTML = habits.slice(0, 4).map(h => {
    const isDone = habitLogs[`${today}_${h.id}`] === true;
    return `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-dim)">
      <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${h.color};background:${isDone?h.color:'transparent'};cursor:pointer" onclick="toggleHabit('${h.id}')"></div>
      <span style="font-size:13.5px;">${h.name}</span>
    </div>`;
  }).join('') || '<div style="color:var(--text-muted);font-size:13px;padding:10px 0">No habits tracked yet.</div>';

  renderInsights();
}

function renderInsights() {
  const html = `
    <div class="insight-item">
      <div class="insight-icon">💡</div>
      <div class="insight-text">You are most productive between <strong>10:00 AM and 12:00 PM</strong> based on task completion trends.</div>
    </div>
    <div class="insight-item">
      <div class="insight-icon">💧</div>
      <div class="insight-text">Drink more water! You've missed your hydration goal for 3 consecutive days.</div>
    </div>
  `;
  document.getElementById('insights-container').innerHTML = html;
}

// --- 4. TASKS ---
window.saveTask = function() {
  const title = document.getElementById('task-title').value;
  if(!title) return showToast('Title is required', 'error');

  const task = {
    title,
    desc: document.getElementById('task-desc').value,
    due: document.getElementById('task-due').value,
    priority: document.getElementById('task-priority').value,
    category: document.getElementById('task-category').value,
    status: document.getElementById('task-status').value
  };

  const id = document.getElementById('task-edit-id').value;
  if(id) DB.update('tasks', id, task);
  else DB.push('tasks', task);

  closeModal('task-modal');
  showToast('Task saved');
  if(task.status==='done' && !id) addXP(10);
};

window.toggleTask = function(id) {
  const tasks = DB.get('tasks', []);
  const task = tasks.find(t => t.id === id);
  if(task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    DB.update('tasks', id, { status: newStatus });
    if(newStatus === 'done') addXP(10);
  }
};

window.switchTaskView = function(view, btn) {
  document.querySelectorAll('#page-tasks .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  ['today', 'upcoming', 'all', 'kanban'].forEach(v => {
    document.getElementById(`task-view-${v}`).classList.add('hidden');
  });
  document.getElementById(`task-view-${view}`).classList.remove('hidden');
  renderTasks();
};

function renderTasks() {
  const tasks = DB.get('tasks', []);
  const today = getTodayStr();
  const query = document.getElementById('task-search')?.value.toLowerCase() || '';

  const filtered = tasks.filter(t => t.title.toLowerCase().includes(query));

  // Today
  document.getElementById('tasks-today-list').innerHTML = filtered.filter(t => t.due === today).map(taskHTML).join('') || '<div class="text-muted">No tasks due today.</div>';

  // All
  document.getElementById('tasks-all-list').innerHTML = filtered.map(taskHTML).join('');

  // Kanban
  if(!document.getElementById('task-view-kanban').classList.contains('hidden')) {
    renderKanban(filtered);
  }
}

function taskHTML(t) {
  const pColor = t.priority === 'high' ? 'var(--accent-rose)' : t.priority === 'medium' ? 'var(--accent-amber)' : 'var(--accent-emerald)';
  return `
    <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-deep);border:1px solid var(--border-dim);border-radius:var(--radius-md);margin-bottom:8px">
      <input type="checkbox" ${t.status==='done'?'checked':''} onchange="toggleTask('${t.id}')">
      <div style="flex:1">
        <div style="font-size:14px;font-weight:500;${t.status==='done'?'text-decoration:line-through;color:var(--text-muted)':''}">${t.title}</div>
        <div style="font-size:11px;color:var(--text-muted);display:flex;gap:10px;margin-top:4px">
          <span>📅 ${t.due || 'No date'}</span>
          <span style="color:${pColor}">● ${t.priority}</span>
        </div>
      </div>
      <button class="btn btn-ghost btn-xs" onclick="deleteTask('${t.id}')">🗑</button>
    </div>
  `;
}

window.deleteTask = function(id) {
  if(confirm('Delete task?')) {
    DB.remove('tasks', id);
    showToast('Task deleted', 'info');
  }
};

function renderKanban(tasks) {
  const board = document.getElementById('kanban-board');
  const cols = [
    { id: 'todo', title: 'To Do' },
    { id: 'inprogress', title: 'In Progress' },
    { id: 'done', title: 'Done' }
  ];

  board.innerHTML = cols.map(c => {
    const colTasks = tasks.filter(t => t.status === c.id);
    return `
      <div class="kanban-col" data-status="${c.id}" ondragover="event.preventDefault()" ondrop="dropKanban(event, '${c.id}')">
        <div class="kanban-col-header">
          <div class="kanban-col-title">${c.title}</div>
          <div class="kanban-count">${colTasks.length}</div>
        </div>
        <div>
          ${colTasks.map(t => `
            <div class="kanban-card" draggable="true" ondragstart="dragKanban(event, '${t.id}')">
              <div style="font-size:13px;font-weight:500;margin-bottom:6px">${t.title}</div>
              <div style="font-size:11px;color:var(--text-muted)">📅 ${t.due || 'No date'}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

window.dragKanban = function(e, id) { e.dataTransfer.setData('text/plain', id); };
window.dropKanban = function(e, status) {
  const id = e.dataTransfer.getData('text/plain');
  if(id) {
    const task = DB.get('tasks').find(t=>t.id===id);
    if(task && task.status !== status) {
      DB.update('tasks', id, { status });
      if(status==='done') addXP(10);
    }
  }
};

// --- 5. HABITS ---
window.saveHabit = function() {
  const name = document.getElementById('habit-name').value;
  if(!name) return showToast('Name required', 'error');

  DB.push('habits', {
    name,
    category: document.getElementById('habit-category').value,
    color: document.getElementById('habit-color').value,
    freq: document.getElementById('habit-freq').value
  });
  closeModal('habit-modal');
  showToast('Habit tracked!');
}

function renderHabits() {
  const habits = DB.get('habits', []);
  const logs = DB.get('habitLogs', {});
  const today = getTodayStr();

  document.getElementById('habit-today-date').innerText = new Date().toLocaleDateString();

  const hList = document.getElementById('habits-today');
  hList.innerHTML = habits.map(h => {
    const isDone = logs[`${today}_${h.id}`] === true;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-deep);border:1px solid var(--border-dim);border-radius:var(--radius-md);margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:24px;height:24px;border-radius:6px;border:2px solid ${h.color};background:${isDone?h.color:'transparent'};cursor:pointer;transition:all 0.2s" onclick="toggleHabit('${h.id}')"></div>
          <div>
            <div style="font-size:14px;font-weight:500">${h.name}</div>
            <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">${h.freq.toUpperCase()}</div>
          </div>
        </div>
        <div class="streak-badge">🔥 ???</div>
      </div>
    `;
  }).join('') || '<div class="text-muted">No habits defined. Create one!</div>';

  renderHeatmap();
}

window.toggleHabit = function(id) {
  const today = getTodayStr();
  const logs = DB.get('habitLogs', {});
  const key = `${today}_${id}`;
  if(logs[key]) {
    delete logs[key];
  } else {
    logs[key] = true;
    addXP(5);
  }
  DB.set('habitLogs', logs);
}

function renderHeatmap() {
  const map = document.getElementById('habit-heatmap');
  let html = '';
  // Generate 365 days mostly empty for visual
  for(let i=0; i<364; i++) {
    const level = Math.random() > 0.7 ? Math.floor(Math.random() * 4) + 1 : 0;
    html += `<div class="heatmap-cell" ${level ? `data-level="${level}"` : ''} title="Activity level: ${level}"></div>`;
  }
  map.innerHTML = html;
}

// --- 6. DIARY ---
window.saveDiaryEntry = function() {
  const content = document.getElementById('diary-content').value;
  if(!content) return showToast('Content required', 'error');

  DB.push('diary', {
    title: document.getElementById('diary-title').value || getTodayStr(),
    content,
    mood: window.selectedDiaryMood || 4,
    tags: document.getElementById('diary-tags').value
  });
  closeModal('diary-modal');
  showToast('Entry saved!');
  addXP(15);
}

let diaryMoodIcons = ['😢','😕','😐','🙂','😊','😄','🤩'];
window.selectDiaryMood = function(lvl) {
  window.selectedDiaryMood = lvl;
  document.querySelectorAll('#diary-mood-selector .mood-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector(`#diary-mood-selector .mood-btn[data-mood="${lvl}"]`).classList.add('selected');
}

function renderDiary() {
  const diary = DB.get('diary', []).reverse();
  document.getElementById('diary-entries-list').innerHTML = diary.map(d => `
    <div class="diary-entry" onclick="viewDiary('${d.id}')">
      <div class="diary-meta">
        <div class="diary-mood">${diaryMoodIcons[d.mood-1] || '🙂'}</div>
        <div class="diary-date">${new Date(d.createdAt).toLocaleDateString()}</div>
        <div style="font-weight:600;font-size:14px;margin-left:8px">${d.title}</div>
      </div>
      <div class="diary-preview diary-preview-clamp">${d.content}</div>
    </div>
  `).join('') || '<div class="text-muted">No entries yet.</div>';
}

// --- 7. FINANCE ---
window.setFinType = function(type) {
  document.getElementById('fin-type').value = type;
  document.getElementById('fin-income-btn').style.background = type==='income' ? 'rgba(16,185,129,0.1)' : 'transparent';
  document.getElementById('fin-income-btn').style.color = type==='income' ? 'var(--accent-emerald)' : 'var(--text-secondary)';
  document.getElementById('fin-expense-btn').style.background = type==='expense' ? 'rgba(244,63,94,0.1)' : 'transparent';
  document.getElementById('fin-expense-btn').style.color = type==='expense' ? 'var(--accent-rose)' : 'var(--text-secondary)';
}

window.saveTransaction = function() {
  const amount = parseFloat(document.getElementById('fin-amount').value);
  const desc = document.getElementById('fin-desc').value;
  if(!amount || !desc) return showToast('Amount and description required', 'error');

  DB.push('finance', {
    type: document.getElementById('fin-type').value,
    amount,
    date: document.getElementById('fin-date').value || getTodayStr(),
    desc,
    category: document.getElementById('fin-category').value
  });
  closeModal('finance-modal');
  showToast('Transaction saved');
}

function renderFinance() {
  const sym = DB.get('settings').currency || '₹';
  const txns = DB.get('finance', []).sort((a,b) => new Date(b.date) - new Date(a.date));
  
  let inc = 0, exp = 0;
  txns.forEach(t => { if(t.type==='income') inc+=t.amount; else exp+=t.amount; });

  document.getElementById('fin-income').innerText = `${sym}${inc.toFixed(2)}`;
  document.getElementById('fin-expense').innerText = `${sym}${exp.toFixed(2)}`;
  
  const bal = inc - exp;
  const balEl = document.getElementById('fin-balance');
  balEl.innerText = `${sym}${bal.toFixed(2)}`;
  balEl.style.color = bal >= 0 ? 'var(--text-primary)' : 'var(--accent-rose)';

  document.getElementById('finance-txn-list').innerHTML = txns.slice(0, 10).map(t => `
    <div class="transaction-item">
      <div class="txn-icon" style="background:${t.type==='income'?'rgba(16,185,129,0.1)':'rgba(244,63,94,0.1)'};color:${t.type==='income'?'var(--accent-emerald)':'var(--accent-rose)'}">
        ${t.type==='income'?'↓':'↑'}
      </div>
      <div class="txn-info">
        <div class="txn-name">${t.desc}</div>
        <div class="txn-date">${t.date} · ${t.category}</div>
      </div>
      <div class="txn-amount ${t.type}">${t.type==='income'?'+':'-'}${sym}${t.amount.toFixed(2)}</div>
    </div>
  `).join('') || '<div class="text-muted">No transactions recorded.</div>';
}

// --- 8. GOALS ---
window.saveGoal = function() {
  const title = document.getElementById('goal-title').value;
  if(!title) return showToast('Title required', 'error');

  DB.push('goals', {
    title,
    desc: document.getElementById('goal-desc').value,
    target: parseFloat(document.getElementById('goal-target').value) || 100,
    current: parseFloat(document.getElementById('goal-current').value) || 0,
    category: document.getElementById('goal-category').value,
    deadline: document.getElementById('goal-deadline').value
  });
  closeModal('goal-modal');
  showToast('Goal established!');
}

function renderGoals() {
  const goals = DB.get('goals', []);
  document.getElementById('goals-list').innerHTML = goals.map(g => {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100)) || 0;
    return `
      <div class="goal-card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-weight:600;font-size:15px;margin-bottom:4px">${g.title}</div>
            <div style="font-size:11px;color:var(--text-muted)">🎯 Deadline: ${g.deadline || 'Someday'}</div>
          </div>
          <div style="font-family:var(--font-mono);font-size:14px;font-weight:600;color:var(--accent-primary)">${pct}%</div>
        </div>
        <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${pct}%"></div></div>
        <div style="margin-top:8px;font-size:11px;color:var(--text-secondary);text-align:right">${g.current} / ${g.target}</div>
      </div>
    `;
  }).join('') || '<div class="text-muted" style="grid-column:1/-1">Set goals to track your long-term vision.</div>';
}

// --- 9. NOTES ---
window.saveNote = function() {
  const title = document.getElementById('note-title').value || 'Untitled';
  const content = document.getElementById('note-content').value;
  if(!content) return;

  DB.push('notes', {
    title, content,
    color: document.getElementById('note-color').value,
    tags: document.getElementById('note-tags').value,
    pinned: document.getElementById('note-pinned').checked
  });
  closeModal('note-modal');
  showToast('Note captured!');
}

function renderNotes() {
  const notes = DB.get('notes', []);
  const query = document.getElementById('note-search')?.value.toLowerCase() || '';
  
  const filtered = notes.filter(n => (n.title+n.content).toLowerCase().includes(query)).sort((a,b) => b.pinned - a.pinned);

  document.getElementById('notes-grid').innerHTML = filtered.map(n => {
    let accent = 'var(--border-dim)';
    if(n.color==='primary') accent = 'var(--accent-primary)';
    if(n.color==='cyan') accent = 'var(--accent-cyan)';
    if(n.color==='amber') accent = 'var(--accent-amber)';
    if(n.color==='rose') accent = 'var(--accent-rose)';

    return `
      <div class="note-card ${n.pinned?'pinned':''}" style="border-top: 3px solid ${accent}">
        ${n.pinned ? '<div class="note-pin">📌</div>' : ''}
        <div style="font-weight:600;font-size:14px;margin-bottom:8px">${n.title}</div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.5;white-space:pre-wrap;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;overflow:hidden">${n.content}</div>
        <div style="font-size:10px;font-family:var(--font-mono);color:var(--text-muted)">${new Date(n.createdAt).toLocaleDateString()}</div>
      </div>
    `;
  }).join('') || '<div class="text-muted" style="grid-column:1/-1">No notes found.</div>';
}

// --- 10. MOOD & WELLNESS ---
function renderMood() {
  document.getElementById('water-cups').innerHTML = Array(8).fill(0).map((_,i) => `
    <div class="water-cup" onclick="addWater()"></div>
  `).join('');
  
  const today = getTodayStr();
  const waters = DB.get('water', {});
  const count = waters[today] || 0;
  document.getElementById('water-count').innerText = count;
  const cups = document.querySelectorAll('.water-cup');
  for(let i=0; i<8; i++) {
    if(i < count) cups[i].classList.add('filled');
    else cups[i].classList.remove('filled');
  }

  const sL = DB.get('sleep', {});
  if(sL[today]) {
    document.getElementById('sleep-hours').value = sL[today];
    updateSleep(sL[today]);
  }
}

window.addWater = function() {
  const today = getTodayStr();
  const waters = DB.get('water', {});
  waters[today] = (waters[today] || 0) + 1;
  DB.set('water', waters);
  if(waters[today]===8) addXP(20);
}

window.updateSleep = function(val) {
  document.getElementById('sleep-display').innerText = `${parseFloat(val).toFixed(1)}h`;
  let q = 'Good';
  if(val < 6) q = 'Deprived (Needs Improvement)';
  if(val > 9) q = 'Oversleeping?';
  document.getElementById('sleep-quality').innerText = q;

  const today = getTodayStr();
  const sleep = DB.get('sleep', {});
  sleep[today] = val;
  DB.set('sleep', sleep);
}

window.setTodayMood = function(lvl) {
  window.todayMoodVal = lvl;
  document.querySelectorAll('#mood-today-selector .mood-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector(`#mood-today-selector .mood-btn[data-mood="${lvl}"]`).classList.add('selected');
}

window.toggleFactor = function(el, factor) {
  el.classList.toggle('active-factor');
  if(el.classList.contains('active-factor')) el.style.opacity = '1';
  else el.style.opacity = '0.5';
}

window.saveTodayMood = function() {
  if(!window.todayMoodVal) return showToast('Please select a mood', 'error');
  
  const factors = Array.from(document.querySelectorAll('.active-factor')).map(el => el.innerText);
  const moods = DB.get('moodLogs', {});
  moods[getTodayStr()] = {
    mood: window.todayMoodVal,
    note: document.getElementById('mood-note').value,
    factors
  };
  DB.set('moodLogs', moods);
  showToast('Mood logged successfully!');
  addXP(10);
}

// --- 11. POMODORO / FOCUS ---
let pomoTimer;
let pomoTimeLeft = 25 * 60;
let pomoRunning = false;
let pomoMode = 25;

window.setPomoMode = function(work, rest, btn) {
  document.querySelectorAll('#page-focus .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  pomoMode = work;
  pomoTimeLeft = work * 60;
  updatePomoDisplay();
}

function updatePomoDisplay() {
  const m = Math.floor(pomoTimeLeft / 60).toString().padStart(2, '0');
  const s = (pomoTimeLeft % 60).toString().padStart(2, '0');
  document.getElementById('pomodoro-display').innerText = `${m}:${s}`;
  
  const pct = 100 - ((pomoTimeLeft / (pomoMode * 60)) * 100);
  document.getElementById('pomodoro-ring').style.setProperty('--pct', `${pct}%`);
}

window.togglePomodoro = function() {
  const btn = document.getElementById('pomo-start');
  if(pomoRunning) {
    clearInterval(pomoTimer);
    pomoRunning = false;
    btn.innerText = '▶ Resume';
  } else {
    pomoRunning = true;
    btn.innerHTML = '⏸ Pause';
    pomoTimer = setInterval(() => {
      pomoTimeLeft--;
      updatePomoDisplay();
      if(pomoTimeLeft <= 0) {
        clearInterval(pomoTimer);
        pomoRunning = false;
        showToast('Focus session complete!', 'success');
        addXP(50);
        const pState = DB.get('pomodoro', {sessions:0, minutes:0});
        pState.sessions++;
        pState.minutes += pomoMode;
        DB.set('pomodoro', pState);
        document.getElementById('pomo-sessions').innerText = pState.sessions;
        resetPomodoro();
      }
    }, 1000);
  }
}

window.resetPomodoro = function() {
  clearInterval(pomoTimer);
  pomoRunning = false;
  pomoTimeLeft = pomoMode * 60;
  document.getElementById('pomo-start').innerText = '▶ Start';
  updatePomoDisplay();
}

window.toggleAmbient = function(type, btn) {
  btn.classList.toggle('playing');
  // Sounds would play via Audio() API here
}

// --- 12. SETTINGS ---
function loadSettings() {
  const s = DB.get('settings', { name: 'User', currency: '₹', theme: 'dark', neon: false });
  document.getElementById('settings-name').value = s.name;
  document.getElementById('settings-currency').value = s.currency;
}

window.saveSettings = function() {
  const s = DB.get('settings');
  s.name = document.getElementById('settings-name').value;
  s.currency = document.getElementById('settings-currency').value;
  DB.set('settings', s);
  closeModal('settings-modal');
  showToast('Settings saved');
}

window.exportData = function() {
  const data = JSON.stringify(localStorage);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `apex_os_backup_${getTodayStr()}.json`;
  a.click();
}

window.clearAllData = function() {
  if(confirm('WARNING: This will delete ALL your data. Are you sure?')) {
    Object.keys(localStorage).forEach(k => {
      if(k.startsWith(DB_PREFIX)) localStorage.removeItem(k);
    });
    location.reload();
  }
}

// --- INITIALIZATION ---
window.onload = () => {
  // Render auth 3D background
  initAuth3D();
  
  // Check if unauthenticated UI config says otherwise
  // For prototype, just show auth screen directly.
};

window.unlockApex = function() {
  const pass = document.getElementById('auth-password').value;
  if(pass === '1234' || pass.length > 0) { // simple prototype auth
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').style.display = 'flex';
    
    initDB();
    applyTheme();
    updateGlobalState();
    setTimeout(() => showToast(`Welcome back, ${DB.get('settings').name}!`, 'info'), 500);
  } else {
    showToast('Enter any passcode for prototype access.', 'warning');
  }
};

// Simple Three.js Auth Background Simulation
function initAuth3D() {
  if (typeof THREE === 'undefined') return;
  
  const canvas = document.getElementById('auth-bg-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.z = 30;

  const geometry = new THREE.IcosahedronGeometry(15, 1);
  const material = new THREE.MeshBasicMaterial({ 
    color: 0x6366f1, 
    wireframe: true,
    transparent: true,
    opacity: 0.15
  });
  
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  const particlesGeometry = new THREE.BufferGeometry();
  const particlesCount = 700;
  const posArray = new Float32Array(particlesCount * 3);
  
  for(let i = 0; i < particlesCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 100;
  }
  
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const pMaterial = new THREE.PointsMaterial({
    size: 0.1,
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.4
  });
  
  const particlesMesh = new THREE.Points(particlesGeometry, pMaterial);
  scene.add(particlesMesh);

  let mouseX = 0;
  let mouseY = 0;
  
  document.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) - 0.5;
    mouseY = (e.clientY / window.innerHeight) - 0.5;
  });

  function animate() {
    requestAnimationFrame(animate);
    sphere.rotation.x += 0.001;
    sphere.rotation.y += 0.002;
    
    particlesMesh.rotation.y = mouseX * 0.5;
    particlesMesh.rotation.x = mouseY * 0.5;
    
    renderer.render(scene, camera);
  }
  
  animate();
  
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
