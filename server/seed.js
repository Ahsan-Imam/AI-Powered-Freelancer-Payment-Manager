const bcrypt = require('bcryptjs');
const { pool, initializeDatabase } = require('./config/database');
require('dotenv').config();

async function seed() {
  try {
    await initializeDatabase();
    console.log('🌱 Seeding database...');

    // Create demo user
    const hashedPassword = await bcrypt.hash('demo123', 10);
    const [userResult] = await pool.query(
      `INSERT INTO users (name, email, password, business_name, phone, address) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      ['Alex Johnson', 'alex@freelancer.com', hashedPassword, 'Alex Design Studio', '+1-555-0101', '123 Creative Ave, New York, NY 10001']
    );
    const userId = userResult.insertId || 1;

    // Get the actual user id
    const [users] = await pool.query('SELECT id FROM users WHERE email = ?', ['alex@freelancer.com']);
    const actualUserId = users[0].id;

    // Create clients
    const clientsData = [
      ['TechCorp Inc', 'billing@techcorp.com', 'TechCorp Inc', '+1-555-0201', '456 Tech Blvd, San Francisco, CA', 'Long-term client, monthly retainer'],
      ['StartupXYZ', 'payments@startupxyz.io', 'StartupXYZ', '+1-555-0202', '789 Innovation Dr, Austin, TX', 'Fast-growing startup, new client'],
      ['Design Agency Pro', 'finance@designpro.com', 'Design Agency Pro', '+1-555-0203', '321 Design St, Chicago, IL', 'Sub-contracting work'],
      ['Global Media Ltd', 'ap@globalmedia.com', 'Global Media Ltd', '+1-555-0204', '654 Media Lane, Los Angeles, CA', 'Quarterly projects'],
      ['E-Commerce Plus', 'pay@ecomplus.com', 'E-Commerce Plus', '+1-555-0205', '987 Commerce Way, Seattle, WA', 'Ongoing e-commerce development']
    ];

    const clientIds = [];
    for (const c of clientsData) {
      const [result] = await pool.query(
        'INSERT INTO clients (user_id, name, email, company, phone, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [actualUserId, ...c]
      );
      clientIds.push(result.insertId);
    }

    // Create projects
    const projectsData = [
      [clientIds[0], 'Website Redesign', 'Complete redesign of corporate website', 15000, 'active', '2026-09-01', '2026-12-31'],
      [clientIds[1], 'Mobile App MVP', 'Build MVP for iOS and Android', 25000, 'active', '2026-10-01', '2027-02-28'],
      [clientIds[2], 'Brand Identity Package', 'Logo, brand guidelines, and collateral', 5000, 'completed', '2026-07-01', '2026-09-30'],
      [clientIds[3], 'Marketing Campaign Design', 'Q4 marketing campaign visuals', 8000, 'active', '2026-10-15', '2026-12-15'],
      [clientIds[4], 'E-Commerce Platform', 'Custom Shopify theme and integrations', 12000, 'active', '2026-08-01', '2026-11-30']
    ];

    const projectIds = [];
    for (const p of projectsData) {
      const [result] = await pool.query(
        'INSERT INTO projects (user_id, client_id, name, description, total_amount, status, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [actualUserId, ...p]
      );
      projectIds.push(result.insertId);
    }

    // Create milestones
    const milestonesData = [
      [projectIds[0], 'Wireframes & Design', 'Create wireframes and design mockups', 5000, '2026-10-01', 'completed', 'paid'],
      [projectIds[0], 'Frontend Development', 'Build responsive frontend', 5000, '2026-11-15', 'in_progress', 'unpaid'],
      [projectIds[0], 'Backend & Launch', 'Backend integration and deployment', 5000, '2026-12-31', 'pending', 'unpaid'],
      [projectIds[1], 'UI/UX Design', 'App design and prototyping', 8000, '2026-11-01', 'completed', 'paid'],
      [projectIds[1], 'iOS Development', 'Build iOS app', 8500, '2026-12-15', 'in_progress', 'unpaid'],
      [projectIds[1], 'Android Development', 'Build Android app', 8500, '2027-02-28', 'pending', 'unpaid'],
      [projectIds[4], 'Theme Design', 'Custom Shopify theme design', 4000, '2026-09-15', 'completed', 'paid'],
      [projectIds[4], 'Integration', 'Third-party integrations', 4000, '2026-10-31', 'completed', 'paid'],
      [projectIds[4], 'Testing & Launch', 'QA testing and launch', 4000, '2026-11-30', 'in_progress', 'unpaid']
    ];

    const milestoneIds = [];
    for (const m of milestonesData) {
      const [result] = await pool.query(
        'INSERT INTO milestones (project_id, user_id, title, description, amount, due_date, status, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [m[0], actualUserId, m[1], m[2], m[3], m[4], m[5], m[6]]
      );
      milestoneIds.push(result.insertId);
    }

    // Create invoices
    const invoicesData = [
      [clientIds[0], projectIds[0], milestoneIds[0], 'INV-DEMO-001', 'Website Redesign - Wireframes & Design',
        JSON.stringify([{description: 'Wireframes', quantity: 1, rate: 2000, amount: 2000}, {description: 'UI Design', quantity: 1, rate: 3000, amount: 3000}]),
        5000, 0, 0, 5000, 'paid', '2026-10-15', '2026-09-25', 'Thank you for your business!'],
      [clientIds[0], projectIds[0], milestoneIds[1], 'INV-DEMO-002', 'Website Redesign - Frontend Development',
        JSON.stringify([{description: 'Frontend Development', quantity: 1, rate: 5000, amount: 5000}]),
        5000, 0, 0, 5000, 'sent', '2026-11-20', '2026-11-01', 'Due upon completion of milestone'],
      [clientIds[1], projectIds[1], milestoneIds[3], 'INV-DEMO-003', 'Mobile App MVP - UI/UX Design',
        JSON.stringify([{description: 'UI/UX Design & Prototyping', quantity: 1, rate: 8000, amount: 8000}]),
        8000, 0, 0, 8000, 'paid', '2026-11-10', '2026-10-20', null],
      [clientIds[2], projectIds[2], null, 'INV-DEMO-004', 'Brand Identity Package - Complete',
        JSON.stringify([{description: 'Logo Design', quantity: 1, rate: 2000, amount: 2000}, {description: 'Brand Guidelines', quantity: 1, rate: 2000, amount: 2000}, {description: 'Collateral Design', quantity: 1, rate: 1000, amount: 1000}]),
        5000, 0, 0, 5000, 'paid', '2026-09-30', '2026-09-15', null],
      [clientIds[3], projectIds[3], null, 'INV-DEMO-005', 'Marketing Campaign - Phase 1',
        JSON.stringify([{description: 'Campaign Visual Design', quantity: 1, rate: 4000, amount: 4000}]),
        4000, 0, 0, 4000, 'overdue', '2026-10-20', '2026-10-10', 'Payment due upon delivery'],
      [clientIds[4], projectIds[4], milestoneIds[6], 'INV-DEMO-006', 'E-Commerce - Theme Design',
        JSON.stringify([{description: 'Custom Shopify Theme', quantity: 1, rate: 4000, amount: 4000}]),
        4000, 0, 0, 4000, 'paid', '2026-09-30', '2026-09-15', null],
      [clientIds[4], projectIds[4], milestoneIds[7], 'INV-DEMO-007', 'E-Commerce - Integrations',
        JSON.stringify([{description: 'Third-party Integrations', quantity: 1, rate: 4000, amount: 4000}]),
        4000, 0, 0, 4000, 'paid', '2026-11-05', '2026-10-25', null],
      [clientIds[1], projectIds[1], milestoneIds[4], 'INV-DEMO-008', 'Mobile App - iOS Development',
        JSON.stringify([{description: 'iOS App Development', quantity: 1, rate: 8500, amount: 8500}]),
        8500, 0, 0, 8500, 'sent', '2026-12-20', '2026-11-01', 'Due upon milestone completion'],
      [clientIds[3], projectIds[3], null, 'INV-DEMO-009', 'Marketing Campaign - Phase 2',
        JSON.stringify([{description: 'Social Media Assets', quantity: 1, rate: 2000, amount: 2000}, {description: 'Email Templates', quantity: 1, rate: 2000, amount: 2000}]),
        4000, 0, 0, 4000, 'draft', '2026-12-01', '2026-11-04', null]
    ];

    const invoiceIds = [];
    for (const inv of invoicesData) {
      const [result] = await pool.query(
        `INSERT INTO invoices (user_id, client_id, project_id, milestone_id, invoice_number, description, items, subtotal, tax_rate, tax_amount, total_amount, status, due_date, issued_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [actualUserId, ...inv]
      );
      invoiceIds.push(result.insertId);
    }

    // Create transactions for paid invoices
    const paidInvoices = invoicesData
      .map((inv, idx) => ({ ...inv, id: invoiceIds[idx], clientId: inv[0] }))
      .filter(inv => inv[10] === 'paid'); // status index

    const transactionDates = ['2026-10-05', '2026-10-25', '2026-09-28', '2026-09-20', '2026-10-30'];
    let txIdx = 0;
    for (const inv of paidInvoices) {
      await pool.query(
        `INSERT INTO transactions (user_id, invoice_id, client_id, paypal_order_id, paypal_capture_id, amount, currency, status, description, transaction_date)
         VALUES (?, ?, ?, ?, ?, ?, 'USD', 'completed', ?, ?)`,
        [actualUserId, inv.id, inv.clientId, `DEMO-ORDER-${txIdx + 1}`, `DEMO-CAPTURE-${txIdx + 1}`,
         inv[9], `Payment for ${inv[4]}`, transactionDates[txIdx] || '2026-10-15']
      );
      txIdx++;
    }

    console.log('✅ Database seeded successfully!');
    console.log('\n📧 Demo Login:');
    console.log('   Email: alex@freelancer.com');
    console.log('   Password: demo123');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();

