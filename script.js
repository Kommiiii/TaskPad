/* ================================================
   TASKPAD — Script
   Architecture: tasks[] is the single source of truth.
   All mutations update tasks[], call commit(), then render().
   ================================================ */

// ── DOM References ──
const taskInput          = document.getElementById('task-input');
const addBtn             = document.getElementById('add-btn');
const todoList           = document.getElementById('todo-list');
const completedList      = document.getElementById('completed-list');
const statusBar          = document.getElementById('status-bar');
const clearBtn           = document.getElementById('clear-btn');
const divider            = document.querySelector('.divider');
const sectionTitle       = document.querySelector('.section-title');
const prevBtn            = document.getElementById('prev-btn');
const nextBtn            = document.getElementById('next-btn');
const paginationControls = document.getElementById('pagination-controls');
const pageIndicator      = document.getElementById('page-indicator');
const themeToggle        = document.getElementById('theme-toggle');
const themeIcon          = document.getElementById('theme-icon');

// ── State ──
let tasks        = [];
let currentPage  = 0;
const TASKS_PER_PAGE = 10;

// ── Utilities ──
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function setStatus(msg) {
    statusBar.textContent = msg;
}

function activeTasks() {
    return tasks.filter(t => !t.completed);
}

function completedTasks() {
    return tasks.filter(t => t.completed);
}

// ── Theme ──
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('taskpad-theme', theme);

    const isDark = theme === 'dark';

    // Inject the new icon HTML directly so Font Awesome renders it fresh
    themeToggle.innerHTML = isDark 
        ? '<i class="fa-solid fa-moon btn-icon" aria-hidden="true"></i>' 
        : '<i class="fa-solid fa-sun btn-icon" aria-hidden="true"></i>';
    
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
}

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
});

applyTheme(localStorage.getItem('taskpad-theme') || 'light');

// ── Persistence ──
function commit() {
    localStorage.setItem('taskpad-tasks', JSON.stringify(tasks));
}

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem('taskpad-tasks')) || [];
        tasks = saved
            .map(t => ({ id: t.id || uid(), text: t.text || '', completed: !!t.completed }))
            .filter(t => t.text.length > 0);
    } catch {
        tasks = [];
    }
}

// ── State Mutations ──
function addTask(text) {
    tasks.push({ id: uid(), text, completed: false });
    currentPage = Math.max(0, Math.ceil(activeTasks().length / TASKS_PER_PAGE) - 1);
    commit();
    render();

    const lastRow = todoList.lastElementChild;
    if (lastRow) fadeIn(lastRow);
    setStatus('Task added.');
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    commit();
    render();
    setStatus('Task deleted.');
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    tasks = tasks.filter(t => t.id !== id);
    
    if (task.completed) {
        tasks.push(task);
    } else {
        const firstCompleted = tasks.findIndex(t => t.completed);
        firstCompleted === -1 ? tasks.push(task) : tasks.splice(firstCompleted, 0, task);
    }

    commit();
    render();
    setStatus(task.completed ? 'Task moved to finished.' : 'Task returned to ongoing.');
}

function clearFinished() {
    tasks = tasks.filter(t => !t.completed);
    commit();
    render();
    setStatus('Finished tasks cleared.');
}

function syncDragOrder() {
    const active    = activeTasks();
    const completed = completedTasks();
    const pageStart = currentPage * TASKS_PER_PAGE;

    const pageIds       = Array.from(todoList.querySelectorAll('li[data-id]')).map(li => li.dataset.id);
    const activeBefore  = active.slice(0, pageStart);
    const activeAfter   = active.slice(pageStart + pageIds.length);
    const reorderedPage = pageIds.map(id => active.find(t => t.id === id)).filter(Boolean);

    tasks = [...activeBefore, ...reorderedPage, ...activeAfter, ...completed];
    commit();
}

// ── Render ──
function render(animate) {
    renderActiveList(animate);
    renderCompletedList();
    renderFinishedSection();
}

function renderActiveList(animate) {
    const active     = activeTasks();
    const total      = active.length;
    const totalPages = Math.max(1, Math.ceil(total / TASKS_PER_PAGE));

    if (currentPage >= totalPages) currentPage = totalPages - 1;

    const start     = currentPage * TASKS_PER_PAGE;
    const pageItems = active.slice(start, start + TASKS_PER_PAGE);

    todoList.style.counterReset = `task-counter ${start}`;
    todoList.innerHTML = '';
    pageItems.forEach(task => todoList.appendChild(buildActiveRow(task)));

    pageIndicator.textContent  = total > 0 ? `Page ${currentPage + 1} of ${totalPages}` : '';
    paginationControls.hidden  = totalPages <= 1;
    prevBtn.disabled           = currentPage === 0;
    nextBtn.disabled           = currentPage >= totalPages - 1;

    if (animate) {
        todoList.classList.remove('page-flip');
        void todoList.offsetWidth; 
        todoList.classList.add('page-flip');
    }
}

function renderCompletedList() {
    completedList.innerHTML = '';
    completedTasks().forEach(task => completedList.appendChild(buildCompletedRow(task)));
}

function renderFinishedSection() {
    const visible = tasks.some(t => t.completed);
    const display = visible ? 'block' : 'none';
    divider.style.display       = display;
    sectionTitle.style.display  = display;
    completedList.style.display = display;
    clearBtn.style.display      = display;
}

// ── DOM Factories ──
function buildActiveRow(task) {
    const li         = document.createElement('li');
    const statusSpan = document.createElement('span');
    const textSpan   = document.createElement('span');

    li.dataset.id = task.id;
    li.classList.add('draggable');
    li.draggable = true;

    statusSpan.className   = 'status-box';
    statusSpan.textContent = '[ ]';
    statusSpan.addEventListener('click', () => toggleTask(task.id));

    textSpan.className   = 'task-text';
    textSpan.textContent = task.text;

    li.append(statusSpan, textSpan, buildDeleteBtn(task));

    li.addEventListener('dragstart', () => li.classList.add('dragging'));
    li.addEventListener('dragend',   () => {
        li.classList.remove('dragging');
        syncDragOrder(); 
    });

    return li;
}

function buildCompletedRow(task) {
    const li         = document.createElement('li');
    const statusSpan = document.createElement('span');
    const textSpan   = document.createElement('span');

    li.classList.add('completed-item');
    li.dataset.id = task.id;

    statusSpan.className   = 'status-box';
    statusSpan.textContent = '[✓]';
    statusSpan.addEventListener('click', () => toggleTask(task.id));

    textSpan.className   = 'task-text';
    textSpan.textContent = task.text;

    li.append(statusSpan, textSpan, buildDeleteBtn(task));
    return li;
}

function buildDeleteBtn(task) {
    const btn = document.createElement('button');
    const icon = document.createElement('i');

    icon.className = 'fa-solid fa-xmark btn-icon';
    icon.setAttribute('aria-hidden', 'true');

    btn.className = 'delete-btn';
    btn.setAttribute('aria-label', `Delete: ${task.text}`);
    btn.appendChild(icon);
    btn.addEventListener('click', () => deleteTask(task.id));

    return btn;
}

// ── Drag-Over Reorder ──
todoList.addEventListener('dragover', e => {
    e.preventDefault();
    const dragging = document.querySelector('.dragging');
    const target   = e.target.closest('li');
    if (!target || target === dragging) return;

    const { top, bottom } = target.getBoundingClientRect();
    const below = (e.clientY - top) / (bottom - top) > 0.5;
    todoList.insertBefore(dragging, below ? target.nextSibling : target);
});

// ── Input Events ──
taskInput.addEventListener('input', () => {
    if (taskInput.value.trim().length > 0) {
        setStatus('Typing a task...');
    } else {
        setStatus('Ready.');
    }
});

taskInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); }
});

addBtn.addEventListener('click', () => {
    const val = taskInput.value.trim();
    if (!val) return;
    taskInput.value = '';
    addTask(val);
});

prevBtn.addEventListener('click', () => {
    if (currentPage > 0) { currentPage--; render(true); }
});

nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(activeTasks().length / TASKS_PER_PAGE);
    if (currentPage < totalPages - 1) { currentPage++; render(true); }
});

clearBtn.addEventListener('click', clearFinished);

// ── Fade-In Animation ──
function fadeIn(el) {
    el.style.opacity = '0';
    let opacity = 0;
    const step = () => {
        opacity = Math.min(opacity + 0.05, 1);
        el.style.opacity = opacity;
        if (opacity < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

// ── Init ──
loadState();
render();