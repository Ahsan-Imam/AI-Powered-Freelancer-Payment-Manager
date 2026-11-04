const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper: get all financial data for the user
async function getUserFinancialData(userId) {
  const [invoices] = await pool.query(
    `SELECT i.*, c.name as client_name FROM invoices i JOIN clients c ON i.client_id = c.id WHERE i.user_id = ?`,
    [userId]
  );

  const [transactions] = await pool.query(
    `SELECT t.*, c.name as client_name, i.invoice_number FROM transactions t
     LEFT JOIN clients c ON t.client_id = c.id LEFT JOIN invoices i ON t.invoice_id = i.id
     WHERE t.user_id = ? ORDER BY t.transaction_date DESC`,
    [userId]
  );

  const [clients] = await pool.query('SELECT * FROM clients WHERE user_id = ?', [userId]);
  const [projects] = await pool.query(
    `SELECT p.*, c.name as client_name FROM projects p JOIN clients c ON p.client_id = c.id WHERE p.user_id = ?`,
    [userId]
  );
  const [milestones] = await pool.query('SELECT * FROM milestones WHERE user_id = ?', [userId]);

  const [totalEarnings] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND status = 'completed'`,
    [userId]
  );

  const [thisMonthEarnings] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND status = 'completed' AND MONTH(transaction_date) = MONTH(CURDATE()) AND YEAR(transaction_date) = YEAR(CURDATE())`,
    [userId]
  );

  const [lastMonthEarnings] = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND status = 'completed' AND MONTH(transaction_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(transaction_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`,
    [userId]
  );

  return {
    invoices,
    transactions,
    clients,
    projects,
    milestones,
    totalEarnings: totalEarnings[0].total,
    thisMonthEarnings: thisMonthEarnings[0].total,
    lastMonthEarnings: lastMonthEarnings[0].total
  };
}

// Build context string for AI
function buildFinancialContext(data) {
  const now = new Date();
  const overdueInvoices = data.invoices.filter(i => 
    (i.status === 'overdue' || (i.status === 'sent' && new Date(i.due_date) < now))
  );
  const pendingInvoices = data.invoices.filter(i => i.status === 'sent' || i.status === 'draft');
  const paidInvoices = data.invoices.filter(i => i.status === 'paid');

  return `
FREELANCER FINANCIAL DATA SUMMARY (as of ${now.toISOString().split('T')[0]}):

EARNINGS:
- Total Lifetime Earnings: $${data.totalEarnings}
- This Month's Earnings: $${data.thisMonthEarnings}
- Last Month's Earnings: $${data.lastMonthEarnings}

CLIENTS (${data.clients.length} total):
${data.clients.map(c => `- ${c.name} (${c.email})${c.company ? ` - ${c.company}` : ''}`).join('\n')}

INVOICES (${data.invoices.length} total):
- Paid: ${paidInvoices.length} invoices
- Pending/Draft: ${pendingInvoices.length} invoices totaling $${pendingInvoices.reduce((sum, i) => sum + Number(i.total_amount), 0)}
- Overdue: ${overdueInvoices.length} invoices totaling $${overdueInvoices.reduce((sum, i) => sum + Number(i.total_amount), 0)}

DETAILED INVOICES:
${data.invoices.map(i => `- ${i.invoice_number}: $${i.total_amount} | Client: ${i.client_name} | Status: ${i.status} | Due: ${i.due_date ? new Date(i.due_date).toISOString().split('T')[0] : 'N/A'}`).join('\n')}

PROJECTS (${data.projects.length} total):
${data.projects.map(p => `- ${p.name}: $${p.total_amount} | Client: ${p.client_name} | Status: ${p.status}`).join('\n')}

MILESTONES:
${data.milestones.map(m => `- ${m.title}: $${m.amount} | Status: ${m.status} | Payment: ${m.payment_status}`).join('\n')}

RECENT TRANSACTIONS (last 10):
${data.transactions.slice(0, 10).map(t => `- $${t.amount} from ${t.client_name || 'Unknown'} | ${t.status} | ${new Date(t.transaction_date).toISOString().split('T')[0]}`).join('\n')}
  `.trim();
}

// AI Chat endpoint
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const financialData = await getUserFinancialData(req.user.id);
    const context = buildFinancialContext(financialData);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key') {
      // Fallback: use rule-based responses if no API key
      const response = generateFallbackResponse(message, financialData);
      return res.json({ response, source: 'local' });
    }

    const systemPrompt = `You are an AI financial assistant for a freelancer. You help them understand their payment data, answer questions about earnings, invoices, clients, and projects. Be concise, helpful, and use specific numbers from the data. Format currency values with $ sign. If asked about something not in the data, say so politely.

Here is the freelancer's current financial data:

${context}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\nUser Question: ${message}` }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
        })
      }
    );

    const geminiData = await geminiResponse.json();
    const aiResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

    res.json({ response: aiResponse, source: 'gemini' });
  } catch (error) {
    console.error('AI Chat error:', error);
    res.status(500).json({ error: 'Failed to process AI request' });
  }
});

// AI Invoice Generator
router.post('/generate-invoice', authenticateToken, async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const [clients] = await pool.query('SELECT id, name, email FROM clients WHERE user_id = ?', [req.user.id]);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key') {
      return res.json({
        suggestion: {
          description: description,
          items: [{ description: description, quantity: 1, rate: 0, amount: 0 }],
          tax_rate: 0,
          notes: 'Generated from description. Please fill in the amounts.',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        clients,
        source: 'local'
      });
    }

    const prompt = `Based on this description of freelance work, generate a structured invoice. Return ONLY valid JSON (no markdown, no code blocks) with these fields:
{
  "description": "brief invoice description",
  "items": [{"description": "item description", "quantity": number, "rate": number, "amount": number}],
  "tax_rate": number (percentage, 0-100),
  "notes": "any relevant notes",
  "suggested_due_days": number (days from now)
}

Work description: "${description}"

Available clients: ${clients.map(c => `${c.name} (${c.email})`).join(', ')}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
        })
      }
    );

    const geminiData = await geminiResponse.json();
    let aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Clean up potential markdown code blocks
    aiText = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let suggestion;
    try {
      suggestion = JSON.parse(aiText);
    } catch {
      suggestion = {
        description: description,
        items: [{ description: description, quantity: 1, rate: 0, amount: 0 }],
        tax_rate: 0,
        notes: 'AI could not parse the description. Please fill in manually.',
        suggested_due_days: 30
      };
    }

    if (suggestion.suggested_due_days) {
      suggestion.due_date = new Date(Date.now() + suggestion.suggested_due_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    res.json({ suggestion, clients, source: 'gemini' });
  } catch (error) {
    console.error('AI Invoice Generator error:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

// AI Income Insights
router.post('/insights', authenticateToken, async (req, res) => {
  try {
    const financialData = await getUserFinancialData(req.user.id);
    const context = buildFinancialContext(financialData);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_gemini_api_key') {
      const insights = generateFallbackInsights(financialData);
      return res.json({ insights, source: 'local' });
    }

    const prompt = `Analyse this freelancer's financial data and provide actionable insights. Include:
1. Monthly income trend analysis
2. Payment pattern observations (which clients pay on time, which are late)
3. Revenue concentration risk (dependency on specific clients)
4. Cash flow observations
5. Actionable recommendations

Be specific with numbers and percentages. Format as a clear, structured report.

${context}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 2048 }
        })
      }
    );

    const geminiData = await geminiResponse.json();
    const insights = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate insights.';

    res.json({ insights, source: 'gemini' });
  } catch (error) {
    console.error('AI Insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

// Smart Reminders - Generate reminder messages for overdue invoices
router.post('/reminders', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const [overdueInvoices] = await pool.query(
      `SELECT i.*, c.name as client_name, c.email as client_email
       FROM invoices i JOIN clients c ON i.client_id = c.id
       WHERE i.user_id = ? AND (i.status = 'overdue' OR (i.status = 'sent' AND i.due_date < ?))`,
      [req.user.id, now]
    );

    if (overdueInvoices.length === 0) {
      return res.json({ reminders: [], message: 'No overdue invoices found!' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const reminders = [];

    for (const invoice of overdueInvoices) {
      const daysOverdue = Math.floor((now - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24));
      let reminderMessage;

      if (!apiKey || apiKey === 'your_gemini_api_key') {
        reminderMessage = `Hi ${invoice.client_name},\n\nThis is a friendly reminder that Invoice ${invoice.invoice_number} for $${invoice.total_amount} was due on ${new Date(invoice.due_date).toLocaleDateString()}. It is now ${daysOverdue} day(s) overdue.\n\nPlease arrange payment at your earliest convenience. If you have already made the payment, please disregard this message.\n\nThank you for your business!\n\nBest regards`;
      } else {
        const prompt = `Write a professional but friendly payment reminder email for:
- Client Name: ${invoice.client_name}
- Invoice Number: ${invoice.invoice_number}
- Amount Due: $${invoice.total_amount}
- Due Date: ${new Date(invoice.due_date).toLocaleDateString()}
- Days Overdue: ${daysOverdue}

The tone should be ${daysOverdue > 30 ? 'firm but professional' : daysOverdue > 14 ? 'polite but clear' : 'friendly and gentle'}. Keep it concise.`;

        try {
          const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
              })
            }
          );

          const geminiData = await geminiResponse.json();
          reminderMessage = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } catch {
          reminderMessage = `Hi ${invoice.client_name},\n\nThis is a reminder about Invoice ${invoice.invoice_number} for $${invoice.total_amount}, which was due on ${new Date(invoice.due_date).toLocaleDateString()} (${daysOverdue} days ago). Please arrange payment at your convenience.\n\nThank you!`;
        }
      }

      // Save reminder
      await pool.query(
        'INSERT INTO reminders (user_id, invoice_id, client_id, message) VALUES (?, ?, ?, ?)',
        [req.user.id, invoice.id, invoice.client_id, reminderMessage]
      );

      // Update invoice status to overdue if needed
      if (invoice.status === 'sent') {
        await pool.query('UPDATE invoices SET status = ? WHERE id = ?', ['overdue', invoice.id]);
      }

      reminders.push({
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_name: invoice.client_name,
        client_email: invoice.client_email,
        amount: invoice.total_amount,
        due_date: invoice.due_date,
        days_overdue: daysOverdue,
        message: reminderMessage
      });
    }

    res.json({ reminders, source: apiKey && apiKey !== 'your_gemini_api_key' ? 'gemini' : 'local' });
  } catch (error) {
    console.error('Smart Reminders error:', error);
    res.status(500).json({ error: 'Failed to generate reminders' });
  }
});

// Fallback response generator
function generateFallbackResponse(message, data) {
  const lowerMessage = message.toLowerCase();
  const now = new Date();

  if (lowerMessage.includes('earn') && (lowerMessage.includes('this month') || lowerMessage.includes('month'))) {
    return `Your earnings this month are **$${data.thisMonthEarnings}**. Last month you earned **$${data.lastMonthEarnings}**.`;
  }

  if (lowerMessage.includes('earn') && lowerMessage.includes('total')) {
    return `Your total lifetime earnings are **$${data.totalEarnings}**.`;
  }

  if (lowerMessage.includes('pending') || lowerMessage.includes('unpaid')) {
    const pending = data.invoices.filter(i => i.status === 'sent' || i.status === 'draft');
    if (pending.length === 0) return 'Great news! You have no pending payments.';
    const total = pending.reduce((sum, i) => sum + Number(i.total_amount), 0);
    const details = pending.map(i => `• **${i.client_name}**: $${i.total_amount} (${i.invoice_number})`).join('\n');
    return `You have **${pending.length} pending payment(s)** totaling **$${total}**:\n\n${details}`;
  }

  if (lowerMessage.includes('overdue')) {
    const overdue = data.invoices.filter(i =>
      i.status === 'overdue' || (i.status === 'sent' && new Date(i.due_date) < now)
    );
    if (overdue.length === 0) return '✅ No overdue invoices! All payments are on track.';
    const total = overdue.reduce((sum, i) => sum + Number(i.total_amount), 0);
    const details = overdue.map(i => {
      const daysOverdue = Math.floor((now - new Date(i.due_date)) / (1000 * 60 * 60 * 24));
      return `• **${i.client_name}**: $${i.total_amount} (${daysOverdue} days overdue)`;
    }).join('\n');
    return `⚠️ You have **${overdue.length} overdue invoice(s)** totaling **$${total}**:\n\n${details}`;
  }

  if (lowerMessage.includes('client')) {
    if (data.clients.length === 0) return 'You have no clients yet. Add your first client to get started!';
    const details = data.clients.map(c => `• **${c.name}** (${c.email})${c.company ? ` - ${c.company}` : ''}`).join('\n');
    return `You have **${data.clients.length} client(s)**:\n\n${details}`;
  }

  if (lowerMessage.includes('project')) {
    if (data.projects.length === 0) return 'You have no projects yet.';
    const details = data.projects.map(p => `• **${p.name}**: $${p.total_amount} | ${p.client_name} | ${p.status}`).join('\n');
    return `You have **${data.projects.length} project(s)**:\n\n${details}`;
  }

  return `Here's a quick summary of your finances:\n\n💰 **Total Earnings**: $${data.totalEarnings}\n📅 **This Month**: $${data.thisMonthEarnings}\n📋 **Invoices**: ${data.invoices.length} total\n👥 **Clients**: ${data.clients.length}\n📁 **Projects**: ${data.projects.length}\n\nTry asking about your pending payments, overdue invoices, monthly earnings, or specific clients!`;
}

// Fallback insights generator
function generateFallbackInsights(data) {
  const lines = [];
  lines.push('## 📊 Financial Insights\n');

  lines.push(`### Earnings Overview`);
  lines.push(`- **Total Earnings**: $${data.totalEarnings}`);
  lines.push(`- **This Month**: $${data.thisMonthEarnings}`);
  lines.push(`- **Last Month**: $${data.lastMonthEarnings}`);

  if (data.lastMonthEarnings > 0) {
    const change = ((data.thisMonthEarnings - data.lastMonthEarnings) / data.lastMonthEarnings * 100).toFixed(1);
    lines.push(`- **Month-over-Month Change**: ${change > 0 ? '+' : ''}${change}%`);
  }

  const now = new Date();
  const overdue = data.invoices.filter(i =>
    i.status === 'overdue' || (i.status === 'sent' && new Date(i.due_date) < now)
  );

  if (overdue.length > 0) {
    lines.push(`\n### ⚠️ Attention Needed`);
    lines.push(`You have **${overdue.length} overdue invoice(s)** totaling **$${overdue.reduce((s, i) => s + Number(i.total_amount), 0)}**.`);
    lines.push('Consider sending payment reminders to these clients.');
  }

  lines.push(`\n### 💡 Recommendations`);
  if (data.clients.length < 3) {
    lines.push('- Consider diversifying your client base to reduce income dependency.');
  }
  if (overdue.length > 0) {
    lines.push('- Send payment reminders for overdue invoices to improve cash flow.');
  }
  lines.push('- Set up milestone-based payments for large projects to ensure steady cash flow.');

  return lines.join('\n');
}

module.exports = router;

