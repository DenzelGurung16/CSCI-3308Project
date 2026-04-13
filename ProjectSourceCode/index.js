require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./src/resources/db.js');

if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB,
  port: process.env.POSTGRES_PORT || 5432,
});

app.use(express.json());

// Session middleware BEFORE routes
app.use(session({
  store: new pgSession({
    conObject: {
      host: process.env.POSTGRES_HOST || 'db',
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    },
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 86400,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

// Auth BEFORE routes that use authenticateToken
const auth = require('./routes/auth');
auth.init(pool);
app.use('/api/auth', auth.router);
const { authenticateToken } = auth;

const worksites = require('./routes/worksites');
worksites.init(pool);
app.use('/api/worksites', worksites.router);

// Static files
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));

app.get('/api/config', (req, res) => {
  res.json({ googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || '' });
});

// Welcome route
app.get('/welcome', (req, res) => {
  req.session.visits = (req.session.visits || 0) + 1;
  res.status(200).json({ status: 'success', message: 'Welcome!', visits: req.session.visits });
});

// Get tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await db.any(`
      SELECT t.*, w.name AS worksite_name, w.lat AS worksite_lat, w.lng AS worksite_lng
      FROM tasks t
      LEFT JOIN worksites w ON w.id = t.worksite_id
    `);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create task
app.post('/api/tasks', authenticateToken, async (req, res) => {
  let created_by = null;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') && authHeader.slice(7);
  if (token) {
    try { 
      created_by = jwt.verify(token, process.env.JWT_SECRET).id; 
    } catch(err) {
      console.error('Token verification failed:', err.message);
    }
  }

  const { title, description, status, due_date, priority, worksite_id } = req.body;
  
  // Validate required fields
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  // FIXED: Use parameterized queries ($1, $2, etc.) instead of ${variables}
  const query = `
    INSERT INTO tasks (title, description, status, due_date, created_by, priority, worksite_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, created_at;
  `;
  
  try {
    const result = await db.one(query, [
      title,
      description || null,
      status || 'backlog',
      due_date || null,
      created_by,
      priority || 'medium',
      worksite_id || null
    ]);
    res.status(201).json(result);
  } catch (err) {
    console.error('Task creation error:', err);
    res.status(500).json({ error: 'Failed to create task', details: err.message });
  }
});

// Update task
app.patch('/api/tasks/:id', authenticateToken, async (req, res) => {
  const { title, description, status, due_date, assignee, priority, worksite_id } = req.body;
  const taskId = parseInt(req.params.id);
  
  // Build dynamic update query based on provided fields
  const updates = [];
  const values = [];
  let valueCounter = 1;
  
  if (title !== undefined) {
    updates.push(`title = $${valueCounter++}`);
    values.push(title);
  }
  if (description !== undefined) {
    updates.push(`description = $${valueCounter++}`);
    values.push(description);
  }
  if (status !== undefined) {
    updates.push(`status = $${valueCounter++}`);
    values.push(status);
  }
  if (due_date !== undefined) {
    updates.push(`due_date = $${valueCounter++}`);
    values.push(due_date);
  }
  if (assignee !== undefined) {
    updates.push(`assignee = $${valueCounter++}`);
    values.push(assignee);
  }
  if (priority !== undefined) {
    updates.push(`priority = $${valueCounter++}`);
    values.push(priority);
  }
  if (worksite_id !== undefined) {
    updates.push(`worksite_id = $${valueCounter++}`);
    values.push(worksite_id);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }
  
  values.push(taskId);
  const query = `
    UPDATE tasks
    SET ${updates.join(', ')}
    WHERE id = $${valueCounter}
    RETURNING *
  `;
  
  try {
    const result = await db.oneOrNone(query, values);
    if (!result) return res.status(404).json({ error: 'Task not found' });
    res.status(200).json({ success: true, task: result });
  } catch (err) {
    console.error('Task update error:', err);
    res.status(500).json({ error: 'Failed to update task', details: err.message });
  }
});

// Delete task
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.result('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;
