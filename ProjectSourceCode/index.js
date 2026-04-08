require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const path = require('path');


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

// Routes
const auth = require('./routes/auth');
auth.init(pool);
app.use('/api/auth', auth.router);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;
