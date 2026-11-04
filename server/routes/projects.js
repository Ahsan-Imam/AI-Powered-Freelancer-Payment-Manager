const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all projects
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [projects] = await pool.query(
      `SELECT p.*, c.name as client_name, c.email as client_email,
        (SELECT COUNT(*) FROM milestones WHERE project_id = p.id) as milestone_count,
        (SELECT COUNT(*) FROM milestones WHERE project_id = p.id AND status = 'paid') as milestones_paid
      FROM projects p 
      JOIN clients c ON p.client_id = c.id 
      WHERE p.user_id = ? 
      ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get single project with milestones
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [projects] = await pool.query(
      `SELECT p.*, c.name as client_name, c.email as client_email
      FROM projects p 
      JOIN clients c ON p.client_id = c.id 
      WHERE p.id = ? AND p.user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [milestones] = await pool.query(
      'SELECT * FROM milestones WHERE project_id = ? ORDER BY due_date ASC',
      [req.params.id]
    );

    res.json({ ...projects[0], milestones });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { client_id, name, description, total_amount, start_date, end_date } = req.body;

    if (!client_id || !name || !total_amount) {
      return res.status(400).json({ error: 'Client, name, and total amount are required' });
    }

    const [result] = await pool.query(
      'INSERT INTO projects (user_id, client_id, name, description, total_amount, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, client_id, name, description || null, total_amount, start_date || null, end_date || null]
    );

    const [newProject] = await pool.query(
      `SELECT p.*, c.name as client_name FROM projects p JOIN clients c ON p.client_id = c.id WHERE p.id = ?`,
      [result.insertId]
    );
    res.status(201).json(newProject[0]);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, total_amount, status, start_date, end_date } = req.body;
    const [result] = await pool.query(
      'UPDATE projects SET name = ?, description = ?, total_amount = ?, status = ?, start_date = ?, end_date = ? WHERE id = ? AND user_id = ?',
      [name, description, total_amount, status, start_date, end_date, req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [updated] = await pool.query(
      `SELECT p.*, c.name as client_name FROM projects p JOIN clients c ON p.client_id = c.id WHERE p.id = ?`,
      [req.params.id]
    );
    res.json(updated[0]);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;

