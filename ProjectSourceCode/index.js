require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const path = require('path');
const db = require('./src/resources/db');

const app = express();
const port = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB,
  port: process.env.POSTGRES_PORT || 3000,
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(session({ //session persistence
  store: new pgSession({
    conObject: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    tableName: 'session',
    createTableIfMissing: false
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000*86400, //1 day
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}));

// Routes
const auth = require('./routes/auth');
auth.init(pool);
app.use('/api/auth', auth.router);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;
