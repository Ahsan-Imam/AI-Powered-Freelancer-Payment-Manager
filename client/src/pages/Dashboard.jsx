import React, { useState, useEffect } from 'react';
import api from '../utils/api';

/* ─── helpers ─── */
const formatCurrency = (amount) => {
  if (typeof amount === 'object' && amount !== null) {
    amount = amount.total || amount.amount || 0;
  }
  const num = typeof amount === 'number' ? amount : Number(amount || 0);
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

const statusBadge = (status) => {
  const map = {
    completed: 'bg-green-100 text-green-800',
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    overdue: 'bg-red-100 text-red-800',
    failed: 'bg-red-100 text-red-800',
    sent: 'bg-blue-100 text-blue-800',
    draft: 'bg-gray-100 text-gray-800',
  };
  const cls = map[(status || '').toLowerCase()] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {status || 'pending'}
    </span>
  );
};

/* ─── skeleton components ─── */
const SkeletonCard = () => (
  <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="space-y-3 flex-1">
        <div className="h-3 bg-gray-200 rounded w-24" />
        <div className="h-8 bg-gray-200 rounded w-32" />
      </div>
      <div className="h-12 w-12 bg-gray-200 rounded-lg" />
    </div>
  </div>
);

const SkeletonRow = () => (
  <tr className="animate-pulse">
    {[...Array(4)].map((_, i) => (
      <td key={i} className="px-6 py-4">
        <div className="h-4 bg-gray-200 rounded w-full" />
      </td>
    ))}
  </tr>
);

const SkeletonChart = () => (
  <div className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
    <div className="h-5 bg-gray-200 rounded w-48 mb-6" />
    <div className="flex items-end gap-2 h-48">
      {[40, 65, 45, 80, 55, 70, 90, 60, 75, 50, 85, 95].map((h, i) => (
        <div key={i} className="flex-1 bg-gray-200 rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
);

/* ─── stat card ─── */
const StatCard = ({ icon, label, value, sub, color, iconBg }) => (
  <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>
          {typeof value === 'object' && value !== null ? JSON.stringify(value) : value}
        </p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
      <div className={`p-3 rounded-lg ${iconBg}`}>
        {icon}
      </div>
    </div>
  </div>
);

/* ─── bar chart ─── */
const BarChart = ({ data = [] }) => {
  if (!Array.isArray(data) || !data.length) return null;
  const normalizedData = data.map((d) => ({
    month: d.month || '—',
    amount: Number(d.amount ?? d.total ?? 0),
  }));
  const maxVal = Math.max(...normalizedData.map((d) => d.amount), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-6">Monthly Earnings</h3>
      <div className="flex items-end gap-2 h-56">
        {normalizedData.map((item, i) => {
          const pct = (item.amount / maxVal) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-gray-500 font-medium">
                {formatCurrency(item.amount)}
              </span>
              <div
                className="w-full bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t-md transition-all duration-500 hover:from-indigo-500 hover:to-purple-400 cursor-pointer min-h-[4px]"
                style={{ height: `${Math.max(pct, 4)}%` }}
                title={`${item.month}: ${formatCurrency(item.amount)}`}
              />
              <span className="text-xs text-gray-400 mt-1">{item.month}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── main dashboard ─── */
const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await api.get('/dashboard/stats');
        setStats(data);
      } catch (err) {
        console.error('Failed to load dashboard stats:', err);
        setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  /* ── loading skeleton ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="h-8 bg-gray-200 rounded w-48 mb-8 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
          <SkeletonChart />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-48 mb-4" />
                <div className="space-y-3">
                  {[...Array(5)].map((__, j) => <SkeletonRow key={j} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── error state ── */
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Unable to load dashboard</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const {
    totalEarnings = 0,
    pendingPayments,
    completedTransactions = 0,
    overdueInvoices,
    monthlyEarnings = [],
    recentTransactions = [],
    recentInvoices = [],
  } = stats || {};

  // Extract totals and counts safely from primitives or objects
  const pendingTotal = typeof pendingPayments === 'object' && pendingPayments !== null
    ? pendingPayments.total
    : pendingPayments;
  const pendingCount = typeof pendingPayments === 'object' && pendingPayments !== null
    ? pendingPayments.count
    : null;

  const overdueTotal = typeof overdueInvoices === 'object' && overdueInvoices !== null
    ? overdueInvoices.total
    : overdueInvoices;
  const overdueCount = typeof overdueInvoices === 'object' && overdueInvoices !== null
    ? overdueInvoices.count
    : null;

  const completedCount = typeof completedTransactions === 'object' && completedTransactions !== null
    ? completedTransactions.count || 0
    : completedTransactions;

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back! Here's your financial overview.</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            label="Total Earnings"
            value={formatCurrency(totalEarnings)}
            color="text-green-700"
            iconBg="bg-green-100"
            icon={
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Pending Payments"
            value={formatCurrency(pendingTotal)}
            sub={pendingCount ? `${pendingCount} invoice${pendingCount !== 1 ? 's' : ''}` : undefined}
            color="text-yellow-700"
            iconBg="bg-yellow-100"
            icon={
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Completed Transactions"
            value={completedCount}
            sub="all time"
            color="text-blue-700"
            iconBg="bg-blue-100"
            icon={
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="Overdue Invoices"
            value={formatCurrency(overdueTotal)}
            sub={overdueCount ? `${overdueCount} overdue` : undefined}
            color="text-red-700"
            iconBg="bg-red-100"
            icon={
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            }
          />
        </div>

        {/* Bar Chart */}
        <div className="mb-8">
          <BarChart data={monthlyEarnings} />
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">Recent Transactions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentTransactions && recentTransactions.length > 0 ? (
                    recentTransactions.slice(0, 5).map((txn, i) => (
                      <tr key={txn.id || txn._id || i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-800 font-medium">
                          {txn.description || txn.client_name || txn.clientName || '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-800 font-semibold">
                          {formatCurrency(txn.amount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {formatDate(txn.transaction_date || txn.date || txn.created_at || txn.createdAt)}
                        </td>
                        <td className="px-6 py-4">{statusBadge(txn.status)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                        No recent transactions
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Invoices */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-800">Recent Invoices</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentInvoices && recentInvoices.length > 0 ? (
                    recentInvoices.slice(0, 5).map((inv, i) => (
                      <tr key={inv.id || inv._id || i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-indigo-600 font-medium">
                          {inv.invoice_number || inv.invoiceNumber || `INV-${String(i + 1).padStart(3, '0')}`}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {inv.client_name || inv.clientName || inv.client?.name || '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-800 font-semibold">
                          {formatCurrency(inv.total_amount || inv.amount || inv.total || 0)}
                        </td>
                        <td className="px-6 py-4">{statusBadge(inv.status)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">
                        No recent invoices
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
