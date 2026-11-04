import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

const statusStyles = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  on_hold: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
};

const paymentStyles = {
  paid: 'bg-green-100 text-green-800',
  unpaid: 'bg-gray-100 text-gray-600',
  partial: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-orange-100 text-orange-800',
};

const statusLabel = (s) =>
  (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const fmt = (v) =>
  Number(v || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const emptyMilestone = {
  title: '',
  amount: '',
  due_date: '',
  status: 'pending',
  payment_status: 'unpaid',
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyMilestone);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/projects/${id}`);
      setProject(data);
    } catch {
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleAddMilestone = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await api.post('/milestones', {
        project_id: parseInt(id, 10),
        title: form.title,
        amount: parseFloat(form.amount) || 0,
        due_date: form.due_date || null,
        status: form.status,
        payment_status: form.payment_status,
      });
      setForm(emptyMilestone);
      setShowForm(false);
      fetchProject();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to add milestone');
    } finally {
      setSaving(false);
    }
  };

  const updateMilestoneStatus = async (milestoneId, newStatus) => {
    try {
      await api.put(`/milestones/${milestoneId}`, { status: newStatus });
      fetchProject();
    } catch {
      setError('Failed to update milestone');
    }
  };

  const updateMilestonePayment = async (milestoneId, newPayment) => {
    try {
      await api.put(`/milestones/${milestoneId}`, { payment_status: newPayment });
      fetchProject();
    } catch {
      setError('Failed to update payment status');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={() => navigate('/projects')}
          className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          ← Back to Projects
        </button>
      </div>
    );
  }

  if (!project) return null;

  const milestones = project.milestones || [];
  const paidCount = milestones.filter((m) => m.payment_status === 'paid').length;
  const paidPct = milestones.length > 0 ? Math.round((paidCount / milestones.length) * 100) : 0;
  const paidAmount = milestones
    .filter((m) => m.payment_status === 'paid')
    .reduce((sum, m) => sum + Number(m.amount || 0), 0);

  return (
    <div className="space-y-8">
      {/* Back button */}
      <button
        onClick={() => navigate('/projects')}
        className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-indigo-600 transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to Projects
      </button>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Project info card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                  statusStyles[project.status] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {statusLabel(project.status)}
              </span>
            </div>
            {project.client_name && (
              <p className="mt-1 text-sm text-gray-500">Client: {project.client_name}</p>
            )}
            {project.description && (
              <p className="mt-3 text-sm text-gray-600 max-w-2xl">{project.description}</p>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-gray-500 font-medium">Total Amount</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{fmt(project.total_amount)}</p>
          </div>
          <div className="rounded-lg bg-green-50 p-4">
            <p className="text-xs text-green-600 font-medium">Paid</p>
            <p className="text-lg font-bold text-green-700 mt-1">{fmt(paidAmount)}</p>
          </div>
          <div className="rounded-lg bg-indigo-50 p-4">
            <p className="text-xs text-indigo-600 font-medium">Start Date</p>
            <p className="text-sm font-semibold text-indigo-700 mt-1">{fmtDate(project.start_date)}</p>
          </div>
          <div className="rounded-lg bg-indigo-50 p-4">
            <p className="text-xs text-indigo-600 font-medium">End Date</p>
            <p className="text-sm font-semibold text-indigo-700 mt-1">{fmtDate(project.end_date)}</p>
          </div>
        </div>
      </div>

      {/* Milestones section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Milestones</h2>
            <p className="text-sm text-gray-500 mt-1">
              {paidCount} of {milestones.length} paid
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Milestone
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Payment Progress</span>
            <span className="font-medium">{paidPct}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-500"
              style={{ width: `${paidPct}%` }}
            />
          </div>
        </div>

        {/* Add milestone form */}
        {showForm && (
          <form
            onSubmit={handleAddMilestone}
            className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50/50 p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold text-gray-900">New Milestone</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  name="due_date"
                  type="date"
                  value={form.due_date}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                <select
                  name="payment_status"
                  value={form.payment_status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(emptyMilestone);
                  setFormError('');
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {saving ? 'Adding…' : 'Add Milestone'}
              </button>
            </div>
          </form>
        )}

        {/* Milestones list */}
        {milestones.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 py-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-600 font-medium">No milestones yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition"
            >
              + Add the first milestone
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {milestones.map((m) => (
              <div
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-900 truncate">{m.title}</h4>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        statusStyles[m.status] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {statusLabel(m.status)}
                    </span>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                        paymentStyles[m.payment_status] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {statusLabel(m.payment_status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="font-medium text-gray-900">{fmt(m.amount)}</span>
                    {m.due_date && <span>Due: {fmtDate(m.due_date)}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={m.status}
                    onChange={(e) => updateMilestoneStatus(m.id, e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <select
                    value={m.payment_status}
                    onChange={(e) => updateMilestonePayment(m.id, e.target.value)}
                    className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
