require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const path = require('path');
const db = require('./src/resources/db.js');


if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');

const app = express();
const port = process.env.PORT || 3000;

// Single DB connection pool using POSTGRES_* vars
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST || 'db',
  database: process.env.POSTGRES_DB,
  port: process.env.POSTGRES_PORT || 5432,
});

app.use(express.json());

// Static files 
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.use('/pages', express.static(path.join(__dirname, 'pages')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));

// Session persistence
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

// Welcome route
app.get('/welcome', (req, res) => {
  req.session.visits = (req.session.visits || 0) + 1;
  res.status(200).json({ status: 'success', message: 'Welcome!', visits: req.session.visits });
});

//pull tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await db.any('SELECT * FROM tasks;');
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//push tasks
app.post('/api/tasks', async (req, res) => {
  const query = `
    INSERT INTO tasks (title, description, status, due_date, created_by, priority)
    VALUES ($\{title\}, $\{description\}, $\{status\}, $\{due_date\}, $\{created_by\}, $\{priority\})
    RETURNING id, created_at;
  `;
    try {
      const result = await db.one(query, {
        title: req.body.title,
        description: req.body.description,
        status: req.body.status || 'backlog',
        due_date: req.body.due_date || null,
        created_by: 1, //TODO: change to the session user id when implemented
        priority: req.body.priority || 'medium'});
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to create task" });
  }
});

// Update task
app.put('/api/tasks/:id', async (req, res) => {
  const query = `
    UPDATE tasks
    SET title       = \${title},
        description = \${description},
        status      = \${status},
        due_date    = \${due_date},
        priority    = \${priority},
        assignee    = \${assignee}
    WHERE id = \${id}
    RETURNING *;
  `;
  try {
    const result = await db.one(query, {
      id:          parseInt(req.params.id, 10),
      title:       req.body.title,
      description: req.body.description  || null,
      status:      req.body.status       || 'backlog',
      due_date:    req.body.due_date     || null,
      priority:    req.body.priority     || 'medium',
      assignee:    req.body.assignee     || null,
    });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});
 
// Delete task
app.delete('/api/tasks/:id', async (req, res) => {
  const query = `DELETE FROM tasks WHERE id = \${id} RETURNING id;`;
  try {
    const result = await db.one(query, { id: parseInt(req.params.id, 10) });
    res.status(200).json({ deleted: result.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Routes
const auth = require('./routes/auth');
auth.init(pool);
app.use('/api/auth', auth.router);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});



module.exports = app;
