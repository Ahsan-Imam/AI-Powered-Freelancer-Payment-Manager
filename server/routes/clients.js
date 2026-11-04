const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all clients
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [clients] = await pool.query(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM projects WHERE client_id = c.id) as project_count,
        (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE client_id = c.id AND status = 'paid') as total_paid,
        (SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE client_id = c.id AND status IN ('sent','overdue')) as total_pending
      FROM clients c WHERE c.user_id = ? ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get single client
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [clients] = await pool.query(
      'SELECT * FROM clients WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (clients.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json(clients[0]);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// Create client
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, email, company, phone, address, notes } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const [result] = await pool.query(
      'INSERT INTO clients (user_id, name, email, company, phone, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name, email, company || null, phone || null, address || null, notes || null]
    );

    const [newClient] = await pool.query('SELECT * FROM clients WHERE id = ?', [result.insertId]);
    res.status(201).json(newClient[0]);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// Update client
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, email, company, phone, address, notes } = req.body;
    const [result] = await pool.query(
      'UPDATE clients SET name = ?, email = ?, company = ?, phone = ?, address = ?, notes = ? WHERE id = ? AND user_id = ?',
      [name, email, company || null, phone || null, address || null, notes || null, req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const [updated] = await pool.query('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// Delete client
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM clients WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

module.exports = router;

