require('dotenv').config();
const pgp = require('pg-promise')();

const dbConfig = {
  host: process.env.POSTGRES_HOST || 'db',
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
};

const db = pgp(dbConfig);
module.exports = db;
