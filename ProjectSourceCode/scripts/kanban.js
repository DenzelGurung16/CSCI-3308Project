/**
 * INCOMPLETE DISREGARD
 */

const DEMO_TASKS = [
  {
    id: 101,
    title: 'Scope Story 3.1 implementation details',
    status: 'backlog',
    dueDate: '2026-04-14',
    assignee: 'Winston',
    priority: 'High',
  },
  {
    id: 102,
    title: 'Build initial board page shell',
    status: 'in-progress',
    dueDate: '2026-04-11',
    assignee: 'Josh',
    priority: 'Medium',
  },
  {
    id: 103,
    title: 'Review Bootstrap responsiveness',
    status: 'review',
    dueDate: '2026-04-12',
    assignee: 'Ryken',
    priority: 'Low',
  },
  {
    id: 104,
    title: 'Confirm homepage theme parity',
    status: 'done',
    dueDate: '2026-04-09',
    assignee: 'Hudson',
    priority: 'Medium',
  },
];

/**
 * TODO: Replace demo loader with real DB-backed task query endpoint.
 */
async function fetchTasks() {
  return DEMO_TASKS;
}

function formatDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function createTaskCard(task) {
  const template = document.getElementById('taskCardTemplate');
  const taskCard = template.content.firstElementChild.cloneNode(true);

  taskCard.querySelector('.task-title').textContent = task.title;
  taskCard.querySelector('.task-meta').textContent = `#${task.id} • Due ${formatDate(task.dueDate)}`;
  taskCard.querySelector('.task-assignee').textContent = task.assignee;
  taskCard.querySelector('.task-priority').textContent = task.priority;

  return taskCard;
}

function renderTasksByStatus(tasks) {
  const taskLists = document.querySelectorAll('[data-status]');

  taskLists.forEach((columnBody) => {
    const status = columnBody.dataset.status;
    const tasksInColumn = tasks.filter((task) => task.status === status);

    columnBody.innerHTML = '';

    if (tasksInColumn.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.className = 'text-secondary small mb-0';
      emptyState.textContent = 'No tasks yet.';
      columnBody.appendChild(emptyState);
    } else {
      tasksInColumn.forEach((task) => {
        columnBody.appendChild(createTaskCard(task));
      });
    }

    const countBadge = document.querySelector(`[data-count-for="${status}"]`);
    if (countBadge) {
      countBadge.textContent = tasksInColumn.length;
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const tasks = await fetchTasks();
  renderTasksByStatus(tasks);
});