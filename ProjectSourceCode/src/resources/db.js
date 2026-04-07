require('dotenv').config();
const pgp = require('pg-promise')();

const dbConfig = {
    host: process.env.DB_HOST || 'db',
    port: 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

const db = pgp(dbConfig);
module.exports = db;