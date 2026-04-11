/**
 * INCOMPLETE DISREGARD
 */

const DEMO_TASKS = [
  {
    id: 101,
    title: 'Scope Story 3.1 implementation details',
    description: '',
    status: 'backlog',
    due_date: '2026-04-14',
    assignee: 'Winston',
    priority: 'High',
  },
  {
    id: 102,
    title: 'Build initial board page shell',
    description: '',
    status: 'in-progress',
    due_date: '2026-04-11',
    assignee: 'Josh',
    priority: 'Medium',
  },
  {
    id: 103,
    title: 'Review Bootstrap responsiveness',
    description: '',
    status: 'review',
    due_date: '2026-04-12',
    assignee: 'Ryken',
    priority: 'Low',
  },
  {
    id: 104,
    title: 'Confirm homepage theme parity',
    description: '',
    status: 'done',
    due_date: '2026-04-09',
    assignee: 'Hudson',
    priority: 'Medium',
  },
];

let tasks = [];
let nextId = 200;

/*Pulling tasks from db*/
async function fetchTasks() {
  const response = await fetch('/api/tasks');
  const dbTasks = await response.json();
  tasks.length = 0;
  for (const task of dbTasks) {
    tasks.push(task);
  }
  return tasks;
}

/*TODO: Change tasks sql table or task item to have same fields*/
async function createTask(taskData) {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(taskData),
  });
  if (!response.ok) {
    throw new Error('Error saving task to the server');
  }
  await fetchTasks();
  renderTasksByStatus(tasks);
  return await response.json();
}

async function updateTask(taskId, taskData) {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });
  if (!response.ok) {
    throw new Error('Error updating task on the server');
  }
  await fetchTasks();
  renderTasksByStatus(tasks);
  return await response.json();
}

// Delete task from database
async function deleteTask(taskId) {
  const response = await fetch(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Error deleting task from the server');
  }
  await fetchTasks();
  renderTasksByStatus(tasks);
}
 

function formatDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function createTaskCard(task) {
  const template = document.getElementById('taskCardTemplate');
  const taskCard = template.content.firstElementChild.cloneNode(true);

  const statusColors = {
    'backlog':     'var(--bs-secondary)',
    'in-progress': 'var(--bs-primary)',
    'review':      'var(--bs-warning)',
    'done':        'var(--bs-success)',
  };
  taskCard.style.borderLeftColor = statusColors[task.status] || 'var(--bs-primary)';

  taskCard.querySelector('.task-title').textContent = task.title;
  taskCard.querySelector('.task-description').textContent = task.description || '';
  taskCard.querySelector('p.task-meta').textContent = `#${task.id} • Due ${formatDate(task.due_date)}`;
  taskCard.querySelector('.task-assignee').textContent = task.assignee || '';
  taskCard.querySelector('.task-priority').textContent = task.priority;
  taskCard.querySelector('.btn-edit-task').addEventListener('click', () => openEditModal(task.id));

  return taskCard;
}

function renderTasksByStatus(taskList) {
  const taskLists = document.querySelectorAll('[data-status]');

  taskLists.forEach((columnBody) => {
    const status = columnBody.dataset.status;
    const tasksInColumn = taskList.filter((t) => t.status === status);

    columnBody.innerHTML = '';

    if (tasksInColumn.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.className = 'text-secondary small mb-0';
      emptyState.textContent = 'No tasks yet.';
      columnBody.appendChild(emptyState);
    } else {
      tasksInColumn.forEach((task) => columnBody.appendChild(createTaskCard(task)));
    }

    const countBadge = document.querySelector(`[data-count-for="${status}"]`);
    if (countBadge) countBadge.textContent = tasksInColumn.length;
  });
}

// Show confirmation or error message to the user
function showAlert(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const id = `toast-${Date.now()}`;
  container.insertAdjacentHTML('beforeend', `
    <div id="${id}" class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>`);
  const toastEl = document.getElementById(id);
  new bootstrap.Toast(toastEl, { delay: 3000 }).show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

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
 
  document.getElementById('editTaskForm').classList.remove('was-validated');
  bootstrap.Modal.getOrCreateInstance(document.getElementById('editTaskModal')).show();
}

document.addEventListener('DOMContentLoaded', async () => {
  tasks = await fetchTasks();
  renderTasksByStatus(tasks);

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
      if (!el.value.trim()) {
        el.classList.add('is-invalid');
        valid = false;
      } else {
        el.classList.remove('is-invalid');
      }
    });
    if (!valid) return;

    const newTask = {
      title:       titleEl.value.trim(),
      description: descEl.value.trim(),
      priority:    priorityEl.value,
      status:      statusEl.value,
      due_date:    dueDateEl.value || null,
      assignee:    assigneeEl.value.trim(),
    };

    await createTask(newTask);
    renderTasksByStatus(tasks);

    form.reset();
    [titleEl, priorityEl, statusEl].forEach((el) => el.classList.remove('is-invalid'));
    bootstrap.Modal.getInstance(document.getElementById('addTaskModal')).hide();
  });

document.getElementById('updateTaskBtn').addEventListener('click', async () => {
    const form       = document.getElementById('editTaskForm');
    const titleEl    = document.getElementById('editTaskTitle');
    const priorityEl = document.getElementById('editTaskPriority');
    const statusEl   = document.getElementById('editTaskStatus');
 
    let valid = true;
    [titleEl, priorityEl, statusEl].forEach((el) => {
      if (!el.value.trim()) {
        el.classList.add('is-invalid');
        valid = false;
      } else {
        el.classList.remove('is-invalid');
      }
    });
    if (!valid) { form.classList.add('was-validated'); return; }
 
    const id  = parseInt(document.getElementById('editTaskId').value, 10);
    const updatedData = {
      title:       titleEl.value.trim(),
      description: document.getElementById('editTaskDescription').value.trim(),
      assignee:    document.getElementById('editTaskAssignee').value.trim(),
      due_date:    document.getElementById('editTaskDueDate').value || null,
      priority:    priorityEl.value,
      status:      statusEl.value,
    };
 
 try {
   await updateTask(id, updatedData);
   bootstrap.Modal.getInstance(document.getElementById('editTaskModal')).hide();
   showAlert('Task updated succesfully.', 'success');
 }catch (err) {
   showAlert('Failed to update Task. Please try again.', 'danger');
 }
});
 
  // Delete Task
  document.getElementById('deleteTaskBtn').addEventListener('click', async () => {
    const id = parseInt(document.getElementById('editTaskId').value, 10);
    if (!confirm('Delete this task? This cannot be undone.')) return;
 
    try {
      await deleteTask(id);
      bootstrap.Modal.getInstance(document.getElementById('editTaskModal')).hide();
      showAlert('Task deleted.', 'danger');
    } catch (err) {
      showAlert('Failed to delete task. Please try again.', 'danger');
    }
  });
 
  // Reset validation on edit modal close
  document.getElementById('editTaskModal').addEventListener('hidden.bs.modal', () => {
    document.getElementById('editTaskForm').classList.remove('was-validated');
    ['editTaskTitle', 'editTaskPriority', 'editTaskStatus'].forEach(id => {
      document.getElementById(id).classList.remove('is-invalid');
    });
  });
});
