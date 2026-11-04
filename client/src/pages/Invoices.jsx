import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const STATUS_TABS = ['All', 'Draft', 'Sent', 'Paid', 'Overdue'];

const statusBadge = (status) => {
  const map = {
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-500',
  };
  const cls = map[status] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
};

const emptyLineItem = () => ({ description: '', quantity: 1, rate: 0, amount: 0 });

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    client_id: '',
    description: '',
    line_items: [emptyLineItem()],
    tax_rate: 0,
    due_date: '',
    notes: '',
  });

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/invoices');
      setInvoices(Array.isArray(data) ? data : data.invoices || []);
    } catch (err) {
      console.error('Failed to fetch invoices', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const { data } = await api.get('/clients');
      setClients(Array.isArray(data) ? data : data.clients || []);
    } catch (err) {
      console.error('Failed to fetch clients', err);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchClients();
  }, [fetchInvoices, fetchClients]);

  /* ---- helpers ---- */
  const subtotal = form.line_items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const taxAmount = subtotal * (Number(form.tax_rate) / 100);
  const totalAmount = subtotal + taxAmount;

  const updateLineItem = (idx, field, value) => {
    setForm((prev) => {
      const items = [...prev.line_items];
      items[idx] = { ...items[idx], [field]: value };
      if (field === 'quantity' || field === 'rate') {
        items[idx].amount = Number(items[idx].quantity) * Number(items[idx].rate);
      }
      return { ...prev, line_items: items };
    });
  };

  const addLineItem = () =>
    setForm((prev) => ({ ...prev, line_items: [...prev.line_items, emptyLineItem()] }));

  const removeLineItem = (idx) =>
    setForm((prev) => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== idx),
    }));

  const resetForm = () =>
    setForm({
      client_id: '',
      description: '',
      line_items: [emptyLineItem()],
      tax_rate: 0,
      due_date: '',
      notes: '',
    });

  /* ---- actions ---- */
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post('/invoices', {
        client_id: form.client_id,
        description: form.description,
        items: form.line_items,
        subtotal,
        tax_rate: Number(form.tax_rate),
        tax_amount: taxAmount,
        total_amount: totalAmount,
        due_date: form.due_date,
        notes: form.notes,
      });
      setShowModal(false);
      resetForm();
      fetchInvoices();
    } catch (err) {
      console.error('Failed to create invoice', err);
      alert('Failed to create invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSend = async (id) => {
    if (!window.confirm('Send this invoice to the client?')) return;
    try {
      await api.post(`/invoices/${id}/send`);
      fetchInvoices();
    } catch (err) {
      console.error('Failed to send invoice', err);
      alert('Failed to send invoice');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      fetchInvoices();
    } catch (err) {
      console.error('Failed to delete invoice', err);
      alert('Failed to delete invoice');
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    try {
      setAiLoading(true);
      const { data } = await api.post('/ai/generate-invoice', { description: aiPrompt });
      const inv = data.invoice || data;
      setForm((prev) => ({
        ...prev,
        client_id: inv.client_id || prev.client_id,
        description: inv.description || prev.description,
        line_items:
          inv.items && inv.items.length
            ? inv.items.map((i) => ({
                description: i.description || '',
                quantity: i.quantity || 1,
                rate: i.rate || 0,
                amount: (i.quantity || 1) * (i.rate || 0),
              }))
            : prev.line_items,
        tax_rate: inv.tax_rate ?? prev.tax_rate,
        due_date: inv.due_date || prev.due_date,
        notes: inv.notes || prev.notes,
      }));
      setShowAIModal(false);
      setAiPrompt('');
      setShowModal(true);
    } catch (err) {
      console.error('AI generation failed', err);
      alert('AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  /* ---- filtered list ---- */
  const filtered =
    activeTab === 'All'
      ? invoices
      : invoices.filter((inv) => inv.status?.toLowerCase() === activeTab.toLowerCase());

  /* ---- render ---- */
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <div className="mt-3 sm:mt-0 flex gap-3">
          <button
            onClick={() => setShowAIModal(true)}
            className="inline-flex items-center px-4 py-2 border border-purple-300 rounded-lg text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI Generate Invoice
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition"
          >
            + New Invoice
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap pb-3 px-1 border-b-2 text-sm font-medium transition ${
                activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
              {tab !== 'All' && (
                <span className="ml-2 text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                  {invoices.filter((i) => i.status?.toLowerCase() === tab.toLowerCase()).length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading invoices…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new invoice.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Invoice #', 'Client', 'Description', 'Amount', 'Status', 'Due Date', 'Actions'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                    <a href={`/invoices/${inv.id}`}>{inv.invoice_number}</a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{inv.client_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{inv.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ${Number(inv.total_amount || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{statusBadge(inv.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    {(inv.status === 'draft') && (
                      <button
                        onClick={() => handleSend(inv.id)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Send
                      </button>
                    )}
                    <a href={`/invoices/${inv.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
                      View
                    </a>
                    <button
                      onClick={() => handleDelete(inv.id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---- AI Prompt Modal ---- */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-black bg-opacity-40 transition-opacity" onClick={() => setShowAIModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6 z-10">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Generate Invoice</h2>
              <p className="text-sm text-gray-500 mb-3">
                Describe the work you did and we'll generate an invoice for you.
              </p>
              <textarea
                rows={4}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Built a React landing page with responsive design, 3 sections, contact form integration — 12 hours at $85/hr"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <div className="mt-4 flex justify-end gap-3">
                <button
                  onClick={() => setShowAIModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAIGenerate}
                  disabled={aiLoading || !aiPrompt.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {aiLoading ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Create Invoice Modal ---- */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            <div className="fixed inset-0 bg-black bg-opacity-40 transition-opacity" onClick={() => setShowModal(false)} />
            <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 z-10 max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Create New Invoice</h2>
              <form onSubmit={handleCreate} className="space-y-5">
                {/* Client */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                  <select
                    required
                    value={form.client_id}
                    onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select a client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.company ? `(${c.company})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Invoice description"
                  />
                </div>

                {/* Line Items */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Line Items</label>
                  <div className="space-y-2">
                    {form.line_items.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          min="0"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(idx, 'quantity', e.target.value)}
                          className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <input
                          type="number"
                          placeholder="Rate"
                          min="0"
                          step="any"
                          value={item.rate}
                          onChange={(e) => updateLineItem(idx, 'rate', e.target.value)}
                          className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <span className="w-24 py-2 text-sm text-right font-medium text-gray-700">
                          ${Number(item.amount || 0).toFixed(2)}
                        </span>
                        {form.line_items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(idx)}
                            className="text-red-500 hover:text-red-700 p-2"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    + Add Line Item
                  </button>
                </div>

                {/* Totals */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-gray-600">Tax Rate (%)</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.tax_rate}
                      onChange={(e) => setForm((p) => ({ ...p, tax_rate: e.target.value }))}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax Amount</span>
                    <span className="font-medium">${taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2">
                    <span>Total</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Due date & notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Payment terms, thank you note, etc."
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submitting ? 'Creating…' : 'Create Invoice'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
