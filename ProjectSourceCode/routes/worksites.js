const express = require('express');
const router = express.Router();

let pool;
function init(pgPool) {
  pool = pgPool;
}

// Get worksites- Workers only see their worksites
//                Admin/Manager see all worksites
router.get('/', async (req, res) => {
  try {
    let result;
      if(req.user &&req.user.role === 'worker'){
      result = await pool.query(
        `Select id, name, address, city, state, is_active
        FROM worksites
        WHERE id = (Select worksite_id FROM users WHERE id = $1)
          AND is_active = TRUE`,
        [req.user.id]
      );
    }else{
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

// create worksite, returns id (Only for admin/manager)
router.post('/', async (req, res) => {
  if(req.user && req.user.role === 'worker'){
    return res.status(403).json({ error: 'Forbidden' });
  }
  {
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
}});

module.exports = { router, init };
