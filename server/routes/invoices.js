const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function generateInvoiceNumber() {
  const prefix = 'INV';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// Get all invoices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT i.*, c.name as client_name, c.email as client_email, p.name as project_name
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      WHERE i.user_id = ?
    `;
    const params = [req.user.id];

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    query += ' ORDER BY i.created_at DESC';
    const [invoices] = await pool.query(query, params);

    // Auto-update overdue invoices
    const now = new Date();
    for (const inv of invoices) {
      if (inv.status === 'sent' && new Date(inv.due_date) < now) {
        await pool.query('UPDATE invoices SET status = ? WHERE id = ?', ['overdue', inv.id]);
        inv.status = 'overdue';
      }
    }

    res.json(invoices);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// Get single invoice
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const [invoices] = await pool.query(
      `SELECT i.*, c.name as client_name, c.email as client_email, c.company as client_company,
        c.address as client_address, c.phone as client_phone,
        p.name as project_name,
        u.name as freelancer_name, u.email as freelancer_email, u.business_name, u.address as freelancer_address, u.phone as freelancer_phone
      FROM invoices i
      JOIN clients c ON i.client_id = c.id
      LEFT JOIN projects p ON i.project_id = p.id
      JOIN users u ON i.user_id = u.id
      WHERE i.id = ? AND i.user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoices[0]);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// Create invoice
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { client_id, project_id, milestone_id, description, items, subtotal, tax_rate, tax_amount, total_amount, due_date, issued_date, notes } = req.body;

    if (!client_id || !total_amount || !due_date) {
      return res.status(400).json({ error: 'Client, total amount, and due date are required' });
    }

    const invoice_number = generateInvoiceNumber();

    const [result] = await pool.query(
      `INSERT INTO invoices (user_id, client_id, project_id, milestone_id, invoice_number, description, items, subtotal, tax_rate, tax_amount, total_amount, due_date, issued_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, client_id, project_id || null, milestone_id || null,
        invoice_number, description || null, JSON.stringify(items || []),
        subtotal || total_amount, tax_rate || 0, tax_amount || 0, total_amount,
        due_date, issued_date || new Date().toISOString().split('T')[0], notes || null
      ]
    );

    const [newInvoice] = await pool.query(
      `SELECT i.*, c.name as client_name FROM invoices i JOIN clients c ON i.client_id = c.id WHERE i.id = ?`,
      [result.insertId]
    );
    res.status(201).json(newInvoice[0]);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Update invoice
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { description, items, subtotal, tax_rate, tax_amount, total_amount, due_date, status, notes } = req.body;
    const [result] = await pool.query(
      `UPDATE invoices SET description = ?, items = ?, subtotal = ?, tax_rate = ?, tax_amount = ?, total_amount = ?, due_date = ?, status = ?, notes = ? WHERE id = ? AND user_id = ?`,
      [description, JSON.stringify(items || []), subtotal, tax_rate, tax_amount, total_amount, due_date, status, notes, req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const [updated] = await pool.query(
      `SELECT i.*, c.name as client_name FROM invoices i JOIN clients c ON i.client_id = c.id WHERE i.id = ?`,
      [req.params.id]
    );
    res.json(updated[0]);
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// Send invoice (change status to sent)
router.post('/:id/send', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE invoices SET status = ? WHERE id = ? AND user_id = ? AND status = ?',
      ['sent', req.params.id, req.user.id, 'draft']
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Invoice not found or already sent' });
    }

    res.json({ message: 'Invoice sent successfully' });
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

// Delete invoice
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM invoices WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

module.exports = router;

