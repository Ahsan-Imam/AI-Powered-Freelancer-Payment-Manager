const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { client: paypalClient, paypal } = require('../config/paypal');

const router = express.Router();

// Create PayPal order for an invoice
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const { invoice_id } = req.body;

    if (!invoice_id) {
      return res.status(400).json({ error: 'Invoice ID is required' });
    }

    const [invoices] = await pool.query(
      'SELECT * FROM invoices WHERE id = ? AND user_id = ?',
      [invoice_id, req.user.id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoices[0];

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    const clientBase = (process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const clientOrigin = clientBase.startsWith('http') ? clientBase : `https://${clientBase}`;

    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: invoice.invoice_number,
        description: invoice.description || `Payment for Invoice ${invoice.invoice_number}`,
        amount: {
          currency_code: 'USD',
          value: invoice.total_amount.toString()
        }
      }],
      application_context: {
        brand_name: 'Freelancer Payment Manager',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: new URL('/payment/success', clientOrigin).toString(),
        cancel_url: new URL('/payment/cancel', clientOrigin).toString()
      }
    });

    const order = await paypalClient().execute(request);

    // Record pending transaction
    await pool.query(
      `INSERT INTO transactions (user_id, invoice_id, client_id, paypal_order_id, amount, currency, status, description)
       VALUES (?, ?, ?, ?, ?, 'USD', 'pending', ?)`,
      [req.user.id, invoice.id, invoice.client_id, order.result.id, invoice.total_amount,
       `Payment for Invoice ${invoice.invoice_number}`]
    );

    res.json({
      orderID: order.result.id,
      status: order.result.status,
      links: order.result.links
    });
  } catch (error) {
    console.error('Create PayPal order error:', error);
    res.status(500).json({ error: 'Failed to create PayPal order' });
  }
});

// Capture PayPal payment
router.post('/capture-order', authenticateToken, async (req, res) => {
  try {
    const { orderID } = req.body;

    if (!orderID) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const request = new paypal.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    const capture = await paypalClient().execute(request);

    if (capture.result.status === 'COMPLETED') {
      const captureId = capture.result.purchase_units[0].payments.captures[0].id;

      // Update transaction
      await pool.query(
        'UPDATE transactions SET status = ?, paypal_capture_id = ? WHERE paypal_order_id = ?',
        ['completed', captureId, orderID]
      );

      // Get the transaction to find the invoice
      const [transactions] = await pool.query(
        'SELECT * FROM transactions WHERE paypal_order_id = ?',
        [orderID]
      );

      if (transactions.length > 0) {
        const transaction = transactions[0];

        // Update invoice status to paid
        await pool.query(
          'UPDATE invoices SET status = ? WHERE id = ?',
          ['paid', transaction.invoice_id]
        );

        // If invoice has a milestone, update milestone payment status
        const [invoices] = await pool.query(
          'SELECT milestone_id FROM invoices WHERE id = ?',
          [transaction.invoice_id]
        );
        if (invoices.length > 0 && invoices[0].milestone_id) {
          await pool.query(
            'UPDATE milestones SET payment_status = ?, status = ? WHERE id = ?',
            ['paid', 'paid', invoices[0].milestone_id]
          );
        }
      }

      res.json({
        status: 'COMPLETED',
        captureId,
        details: capture.result
      });
    } else {
      res.status(400).json({
        status: capture.result.status,
        message: 'Payment not completed'
      });
    }
  } catch (error) {
    console.error('Capture payment error:', error);
    res.status(500).json({ error: 'Failed to capture payment' });
  }
});

// Get transaction history
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const [transactions] = await pool.query(
      `SELECT t.*, i.invoice_number, c.name as client_name
       FROM transactions t
       LEFT JOIN invoices i ON t.invoice_id = i.id
       LEFT JOIN clients c ON t.client_id = c.id
       WHERE t.user_id = ?
       ORDER BY t.transaction_date DESC`,
      [req.user.id]
    );
    res.json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Verify PayPal order
router.get('/verify/:orderID', authenticateToken, async (req, res) => {
  try {
    const request = new paypal.orders.OrdersGetRequest(req.params.orderID);
    const order = await paypalClient().execute(request);

    res.json({
      status: order.result.status,
      details: order.result
    });
  } catch (error) {
    console.error('Verify order error:', error);
    res.status(500).json({ error: 'Failed to verify order' });
  }
});

module.exports = router;

