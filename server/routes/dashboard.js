const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Dashboard stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Total earnings
    const [earnings] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND status = 'completed'`,
      [userId]
    );

    // Pending payments
    const [pending] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM invoices WHERE user_id = ? AND status IN ('sent', 'draft')`,
      [userId]
    );

    // Completed transactions
    const [completed] = await pool.query(
      `SELECT COUNT(*) as count FROM transactions WHERE user_id = ? AND status = 'completed'`,
      [userId]
    );

    // Overdue invoices
    const [overdue] = await pool.query(
      `SELECT COALESCE(SUM(total_amount), 0) as total, COUNT(*) as count FROM invoices WHERE user_id = ? AND (status = 'overdue' OR (status = 'sent' AND due_date < CURDATE()))`,
      [userId]
    );

    // Monthly earnings (last 12 months)
    const [monthlyEarnings] = await pool.query(
      `SELECT 
        DATE_FORMAT(transaction_date, '%Y-%m') as month,
        SUM(amount) as total
      FROM transactions 
      WHERE user_id = ? AND status = 'completed' AND transaction_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      GROUP BY DATE_FORMAT(transaction_date, '%Y-%m')
      ORDER BY month ASC`,
      [userId]
    );

    // Recent transactions
    const [recentTransactions] = await pool.query(
      `SELECT t.*, c.name as client_name, i.invoice_number 
       FROM transactions t
       LEFT JOIN clients c ON t.client_id = c.id
       LEFT JOIN invoices i ON t.invoice_id = i.id
       WHERE t.user_id = ? 
       ORDER BY t.transaction_date DESC LIMIT 5`,
      [userId]
    );

    // Recent invoices
    const [recentInvoices] = await pool.query(
      `SELECT i.*, c.name as client_name 
       FROM invoices i 
       JOIN clients c ON i.client_id = c.id
       WHERE i.user_id = ? 
       ORDER BY i.created_at DESC LIMIT 5`,
      [userId]
    );

    // Client count
    const [clientCount] = await pool.query(
      'SELECT COUNT(*) as count FROM clients WHERE user_id = ?',
      [userId]
    );

    // Active projects
    const [activeProjects] = await pool.query(
      `SELECT COUNT(*) as count FROM projects WHERE user_id = ? AND status = 'active'`,
      [userId]
    );

    // This month's earnings
    const [thisMonth] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND status = 'completed' AND MONTH(transaction_date) = MONTH(CURDATE()) AND YEAR(transaction_date) = YEAR(CURDATE())`,
      [userId]
    );

    res.json({
      totalEarnings: earnings[0].total,
      pendingPayments: { total: pending[0].total, count: pending[0].count },
      completedTransactions: completed[0].count,
      overdueInvoices: { total: overdue[0].total, count: overdue[0].count },
      monthlyEarnings,
      recentTransactions,
      recentInvoices,
      clientCount: clientCount[0].count,
      activeProjects: activeProjects[0].count,
      thisMonthEarnings: thisMonth[0].total
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

module.exports = router;

