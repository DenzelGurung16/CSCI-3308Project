require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB,
  port: process.env.POSTGRES_PORT || 5432,
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Routes
const auth = require('./routes/auth');
auth.init(pool);
app.use('/api/auth', auth.router);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = app;
