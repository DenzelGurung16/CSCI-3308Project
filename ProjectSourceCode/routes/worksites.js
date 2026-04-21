const express = require('express');
const router = express.Router();

let pool, authenticateToken, requireRole;
function init(pgPool, authMiddleware) {
  pool = pgPool;
  authenticateToken = authMiddleware.authenticateToken;
  requireRole = authMiddleware.requireRole;
}

// Get worksites — workers only see their assigned worksite, admins/managers see all
router.get('/', (req, res, next) => authenticateToken(req, res, next), async (req, res) => {
  try {
    let result;
    if (req.user.role === 'worker') {
      result = await pool.query(
        `SELECT id, name, address, city, state, is_active
         FROM worksites
         WHERE id = (SELECT worksite_id FROM users WHERE id = $1)
           AND is_active = TRUE`,
        [req.user.id]
      );
    } else {
      result = await pool.query(
        'SELECT * FROM worksites WHERE is_active = TRUE ORDER BY name'
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error('Get worksites error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create worksite — admins/managers only
router.post('/', (req, res, next) => authenticateToken(req, res, next), (req, res, next) => requireRole('admin', 'manager')(req, res, next), async (req, res) => {
  const { name, address, city, state, lat, lng } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  try {
    const result = await pool.query(
      `INSERT INTO worksites (name, address, city, state, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [name, address || null, city || null, state || null, lat || null, lng || null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Create worksite error:', err);
    res.status(500).json({ error: 'Create worksite error' });
  }
});

module.exports = { router, init };
