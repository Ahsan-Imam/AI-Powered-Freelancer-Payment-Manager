const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get milestones for a project
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const [milestones] = await pool.query(
      'SELECT * FROM milestones WHERE project_id = ? AND user_id = ? ORDER BY due_date ASC',
      [req.params.projectId, req.user.id]
    );
    res.json(milestones);
  } catch (error) {
    console.error('Get milestones error:', error);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
});

// Create milestone
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { project_id, title, description, amount, due_date } = req.body;

    if (!project_id || !title || !amount) {
      return res.status(400).json({ error: 'Project, title, and amount are required' });
    }

    // Verify project belongs to user
    const [projects] = await pool.query(
      'SELECT id FROM projects WHERE id = ? AND user_id = ?',
      [project_id, req.user.id]
    );
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [result] = await pool.query(
      'INSERT INTO milestones (project_id, user_id, title, description, amount, due_date) VALUES (?, ?, ?, ?, ?, ?)',
      [project_id, req.user.id, title, description || null, amount, due_date || null]
    );

    const [newMilestone] = await pool.query('SELECT * FROM milestones WHERE id = ?', [result.insertId]);
    res.status(201).json(newMilestone[0]);
  } catch (error) {
    console.error('Create milestone error:', error);
    res.status(500).json({ error: 'Failed to create milestone' });
  }
});

// Update milestone
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, amount, due_date, status, payment_status } = req.body;
    const [result] = await pool.query(
      'UPDATE milestones SET title = ?, description = ?, amount = ?, due_date = ?, status = ?, payment_status = ? WHERE id = ? AND user_id = ?',
      [title, description, amount, due_date, status, payment_status, req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const [updated] = await pool.query('SELECT * FROM milestones WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update milestone error:', error);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
});

// Delete milestone
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM milestones WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }
    res.json({ message: 'Milestone deleted successfully' });
  } catch (error) {
    console.error('Delete milestone error:', error);
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
});

module.exports = router;

