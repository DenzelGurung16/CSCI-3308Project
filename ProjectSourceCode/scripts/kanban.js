let tasks = [];

// ─── Map instances ────────────────────────────────────────────────────────────

const addMap = TaskMap.create({
  mapElId: 'taskMap', searchContainerId: 'mapSearchContainer',
  pinBtnId: 'togglePinModeBtn', clearBtnId: 'clearLocationBtn',
  labelId: 'selectedLocationLabel', hintId: 'mapHint',
});

const editMap = TaskMap.create({
  mapElId: 'editTaskMap', searchContainerId: 'editMapSearchContainer',
  pinBtnId: 'editTogglePinModeBtn', clearBtnId: 'editClearLocationBtn',
  labelId: 'editSelectedLocationLabel', hintId: 'editMapHint',
});

// ─── Utilities ────────────────────────────────────────────────────────────────

function showError(message) {
  document.getElementById('toastMessage').textContent = message;
  bootstrap.Toast.getOrCreateInstance(document.getElementById('errorToast')).show();
}

function formatDate(isoDate) {
  if (!isoDate) return 'No due date';
  const date = new Date(isoDate);
  return isNaN(date) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// Returns headers with Content-Type and Authorization token if one is stored
function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Redirects to login on 401
function handleUnauthorized(response) {
  if (response.status === 401) {
    window.location.href = '/pages/login.html';
    throw new Error('Authentication required');
  }
}

// ─── API layer ────────────────────────────────────────────────────────────────
// These functions are the only place fetch() is called for tasks.
// Each one handles auth headers, checks for errors, re-fetches, and re-renders.
// Event handlers below just call these — they never call fetch() directly.

async function fetchTasks() {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/tasks', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  handleUnauthorized(response);
  const dbTasks = await response.json();
  tasks.length = 0;
  tasks.push(...dbTasks);
  return tasks;
}

async function createTask(taskData) {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(taskData),
  });
  handleUnauthorized(response);
  if (!response.ok) throw new Error('Error saving task to the server');
  // Read the response body FIRST before re-fetching, otherwise the stream is consumed
  const result = await response.json();
  await fetchTasks();
  renderTasksByStatus(tasks);
  return result;
}

async function updateTask(taskId, taskData) {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(taskData),
  });
  handleUnauthorized(response);
  if (!response.ok) throw new Error('Error updating task on the server');
  const result = await response.json();
  await fetchTasks();
  renderTasksByStatus(tasks);
  return result;
}

async function deleteTask(taskId) {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  handleUnauthorized(response);
  if (!response.ok) throw new Error('Error deleting task from the server');
  await fetchTasks();
  renderTasksByStatus(tasks);
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function createTaskCard(task, num) {
  const template = document.getElementById('taskCardTemplate');
  const taskCard = template.content.firstElementChild.cloneNode(true);

  const statusColors = {
    'backlog':     'var(--bs-secondary)',
    'in-progress': 'var(--bs-primary)',
    'review':      'var(--bs-warning)',
    'done':        'var(--bs-success)',
  };
  taskCard.style.borderLeftColor = statusColors[task.status] || 'var(--bs-primary)';

  taskCard.querySelector('.task-title').textContent       = task.title;
  taskCard.querySelector('.task-description').textContent = task.description || '';
  taskCard.querySelector('p.task-meta').textContent       = `#${num} • Due ${formatDate(task.due_date)}`;
  taskCard.querySelector('.task-assignee').textContent    = task.assignee || '';
  taskCard.querySelector('.task-priority').textContent    = task.priority;
  taskCard.querySelector('.btn-edit-task').addEventListener('click', () => openEditModal(task.id));

  const locEl = taskCard.querySelector('.task-location');
  if (task.worksite_name) {
    locEl.textContent = task.worksite_name;
    locEl.classList.remove('d-none');
  }

  return taskCard;
}

function renderTasksByStatus(taskList) {
  const taskLists  = document.querySelectorAll('[data-status]');
  const sorted     = [...taskList].sort((a, b) => a.id - b.id);
  const displayNum = new Map(sorted.map((t, i) => [t.id, i + 1]));

  taskLists.forEach((columnBody) => {
    const status        = columnBody.dataset.status;
    const tasksInColumn = taskList.filter((t) => t.status === status);

    columnBody.innerHTML = '';

    if (tasksInColumn.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.className   = 'text-secondary small mb-0';
      emptyState.textContent = 'No tasks yet.';
      columnBody.appendChild(emptyState);
    } else {
      tasksInColumn.forEach((task) => columnBody.appendChild(createTaskCard(task, displayNum.get(task.id))));
    }

    const countBadge = document.querySelector(`[data-count-for="${status}"]`);
    if (countBadge) countBadge.textContent = tasksInColumn.length;
  });
}

// ─── Edit modal state ─────────────────────────────────────────────────────────

let _editTaskWorksite = null;

function openEditModal(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('editTaskId').value          = task.id;
  document.getElementById('editTaskTitle').value       = task.title;
  document.getElementById('editTaskDescription').value = task.description || '';
  document.getElementById('editTaskAssignee').value    = task.assignee || '';
  document.getElementById('editTaskDueDate').value     = task.due_date ? task.due_date.split('T')[0] : '';
  document.getElementById('editTaskPriority').value    = task.priority;
  document.getElementById('editTaskStatus').value      = task.status;

  _editTaskWorksite = (task.worksite_lat && task.worksite_lng)
    ? { lat: parseFloat(task.worksite_lat), lng: parseFloat(task.worksite_lng), name: task.worksite_name }
    : null;

  document.getElementById('editTaskForm').classList.remove('was-validated');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('editTaskModal')).show();
}

// ─── Event handlers ───────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  tasks = await fetchTasks();
  renderTasksByStatus(tasks);

  const addTaskModalEl  = document.getElementById('addTaskModal');
  const editTaskModalEl = document.getElementById('editTaskModal');

  // Map lifecycle
  addTaskModalEl.addEventListener('shown.bs.modal',  () => addMap.init());
  addTaskModalEl.addEventListener('hidden.bs.modal', () => addMap.reset());

  editTaskModalEl.addEventListener('shown.bs.modal', async () => {
    await editMap.init();
    if (_editTaskWorksite) {
      editMap.setLocation(_editTaskWorksite.lat, _editTaskWorksite.lng, _editTaskWorksite.name);
      _editTaskWorksite = null;
    }
  });
  editTaskModalEl.addEventListener('hidden.bs.modal', () => {
    editMap.reset();
    document.getElementById('editTaskForm').classList.remove('was-validated');
    ['editTaskTitle', 'editTaskPriority', 'editTaskStatus'].forEach(id => {
      document.getElementById(id).classList.remove('is-invalid');
    });
  });

  // ── Add task ──────────────────────────────────────────────────────────────
  document.getElementById('saveTaskBtn').addEventListener('click', async () => {
    const form       = document.getElementById('addTaskForm');
    const titleEl    = document.getElementById('taskTitle');
    const priorityEl = document.getElementById('taskPriority');
    const statusEl   = document.getElementById('taskStatus');
    const descEl     = document.getElementById('taskDescription');
    const assigneeEl = document.getElementById('taskAssignee');
    const dueDateEl  = document.getElementById('taskDueDate');

    let valid = true;
    [titleEl, priorityEl, statusEl].forEach((el) => {
      if (!el.value.trim()) { el.classList.add('is-invalid');    valid = false; }
      else                  { el.classList.remove('is-invalid'); }
    });
    if (!valid) return;

    let worksite_id = null;
    const loc = addMap.getSelection();
    if (loc) {
      const wsRes = await fetch('/api/worksites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: loc.name, address: loc.address, lat: loc.lat, lng: loc.lng }),
      });
      if (wsRes.ok) worksite_id = (await wsRes.json()).id;
    }

    try {
      await createTask({
        title:       titleEl.value.trim(),
        description: descEl.value.trim(),
        priority:    priorityEl.value,
        status:      statusEl.value,
        due_date:    dueDateEl.value || null,
        assignee:    assigneeEl.value.trim(),
        worksite_id,
      });
      // createTask() already re-fetches and re-renders
      form.reset();
      [titleEl, priorityEl, statusEl].forEach((el) => el.classList.remove('is-invalid'));
      bootstrap.Modal.getInstance(addTaskModalEl).hide();
    } catch (err) {
      showError('Failed to save task. Please try again.');
    }
  });

  // ── Update task ───────────────────────────────────────────────────────────
  document.getElementById('updateTaskBtn').addEventListener('click', async () => {
    const form       = document.getElementById('editTaskForm');
    const titleEl    = document.getElementById('editTaskTitle');
    const priorityEl = document.getElementById('editTaskPriority');
    const statusEl   = document.getElementById('editTaskStatus');

    let valid = true;
    [titleEl, priorityEl, statusEl].forEach((el) => {
      if (!el.value.trim()) { el.classList.add('is-invalid');    valid = false; }
      else                  { el.classList.remove('is-invalid'); }
    });
    if (!valid) { form.classList.add('was-validated'); return; }

    const id   = parseInt(document.getElementById('editTaskId').value, 10);
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    let worksite_id = null;
    const loc = editMap.getSelection();
    if (loc) {
      const unchanged = task.worksite_id &&
        Math.abs(parseFloat(task.worksite_lat) - loc.lat) < 0.00001 &&
        Math.abs(parseFloat(task.worksite_lng) - loc.lng) < 0.00001;
      if (unchanged) {
        worksite_id = task.worksite_id;
      } else {
        const wsRes = await fetch('/api/worksites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: loc.name, address: loc.address, lat: loc.lat, lng: loc.lng }),
        });
        if (wsRes.ok) worksite_id = (await wsRes.json()).id;
      }
    }

    try {
      // Calls updateTask() — no inline fetch here
      await updateTask(id, {
        title:       titleEl.value.trim(),
        description: document.getElementById('editTaskDescription').value.trim(),
        assignee:    document.getElementById('editTaskAssignee').value.trim(),
        due_date:    document.getElementById('editTaskDueDate').value || null,
        priority:    priorityEl.value,
        status:      statusEl.value,
        worksite_id,
      });
      // updateTask() already re-fetches and re-renders
      bootstrap.Modal.getInstance(editTaskModalEl).hide();
    } catch {
      showError('Failed to update task. Please try again.');
    }
  });

  // ── Delete task ───────────────────────────────────────────────────────────
  document.getElementById('deleteTaskBtn').addEventListener('click', async () => {
    const id = parseInt(document.getElementById('editTaskId').value, 10);
    if (!confirm('Delete this task? This cannot be undone.')) return;
    try {
      // Calls deleteTask() — no inline fetch here
      await deleteTask(id);
      // deleteTask() already re-fetches and re-renders
      bootstrap.Modal.getInstance(editTaskModalEl).hide();
    } catch {
      showError('Failed to delete task. Please try again.');
    }
  });
});
