import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';

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
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const fetchInvoice = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/invoices/${id}`);
      setInvoice(data.invoice || data);
    } catch (err) {
      console.error('Failed to fetch invoice', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const parseItems = (items) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    try {
      return JSON.parse(items);
    } catch {
      return [];
    }
  };

  const handlePayWithPayPal = async () => {
    try {
      setPaying(true);
      // 1. Create order
      const { data } = await api.post('/payments/create-order', { invoice_id: invoice.id });
      const orderID = data.orderID || data.id;

      // 2. Find approval link & open in new window
      const approveLink = data.links?.find((l) => l.rel === 'approve');
      if (approveLink) {
        const payWindow = window.open(approveLink.href, '_blank', 'width=500,height=700');

        // Poll for window close (user completed or cancelled approval)
        await new Promise((resolve) => {
          const timer = setInterval(() => {
            if (!payWindow || payWindow.closed) {
              clearInterval(timer);
              resolve();
            }
          }, 1000);
        });
      }

      // 3. Capture order
      await api.post('/payments/capture-order', { orderID });

      setPaymentSuccess(true);
      fetchInvoice();
    } catch (err) {
      console.error('Payment failed', err);
      alert('Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500">
        Loading invoice…
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Invoice not found</h2>
        <Link to="/invoices" className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
          ← Back to Invoices
        </Link>
      </div>
    );
  }

  const items = parseItems(invoice.items);
  const isUnpaid = invoice.status !== 'paid' && invoice.status !== 'cancelled';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top bar (hidden on print) */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Link to="/invoices" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          ← Back to Invoices
        </Link>
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Download
          </button>
          {isUnpaid && (
            <button
              onClick={handlePayWithPayPal}
              disabled={paying}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {paying ? (
                'Processing…'
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944 2.56A.859.859 0 015.79 1.84h6.393c2.118 0 3.768.506 4.882 1.466.93.8 1.457 1.952 1.457 3.342 0 .16-.013.326-.026.498-.37 2.88-2.504 4.68-5.68 4.68h-2.29a.86.86 0 00-.846.72l-.873 5.517a.641.641 0 01-.633.546H7.076v2.728z" />
                  </svg>
                  Pay with PayPal
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Payment success banner */}
      {paymentSuccess && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 print:hidden">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-green-800">Payment completed successfully!</p>
          </div>
        </div>
      )}

      {/* Invoice card */}
      <div className="bg-white shadow-lg rounded-xl p-8 sm:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">INVOICE</h1>
            <p className="text-lg text-indigo-600 font-semibold mt-1">{invoice.invoice_number}</p>
          </div>
          <div className="mt-4 sm:mt-0 text-right">
            {statusBadge(invoice.status)}
          </div>
        </div>

        {/* Freelancer + Client info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
          {/* From */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">From</h3>
            <p className="text-sm font-semibold text-gray-900">{invoice.freelancer_name || '—'}</p>
            {invoice.business_name && (
              <p className="text-sm text-gray-700">{invoice.business_name}</p>
            )}
            {invoice.freelancer_address && (
              <p className="text-sm text-gray-500">{invoice.freelancer_address}</p>
            )}
            {invoice.freelancer_email && (
              <p className="text-sm text-gray-500">{invoice.freelancer_email}</p>
            )}
            {invoice.freelancer_phone && (
              <p className="text-sm text-gray-500">{invoice.freelancer_phone}</p>
            )}
          </div>

          {/* To */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Bill To</h3>
            <p className="text-sm font-semibold text-gray-900">{invoice.client_name || '—'}</p>
            {invoice.client_company && (
              <p className="text-sm text-gray-700">{invoice.client_company}</p>
            )}
            {invoice.client_address && (
              <p className="text-sm text-gray-500">{invoice.client_address}</p>
            )}
            {invoice.client_email && (
              <p className="text-sm text-gray-500">{invoice.client_email}</p>
            )}
            {invoice.client_phone && (
              <p className="text-sm text-gray-500">{invoice.client_phone}</p>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 bg-gray-50 rounded-lg p-4">
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Invoice Date</p>
            <p className="text-sm font-medium text-gray-900">
              {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Due Date</p>
            <p className="text-sm font-medium text-gray-900">
              {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium">Status</p>
            <p className="text-sm font-medium text-gray-900 capitalize">{invoice.status}</p>
          </div>
        </div>

        {/* Line Items */}
        <div className="overflow-x-auto mb-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length > 0 ? (
                items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">${Number(item.rate || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                      ${Number(item.amount || (item.quantity || 0) * (item.rate || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                    No line items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-900 font-medium">
                ${Number(invoice.subtotal || 0).toFixed(2)}
              </span>
            </div>
            {(invoice.tax_rate > 0 || invoice.tax_amount > 0) && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  Tax {invoice.tax_rate ? `(${invoice.tax_rate}%)` : ''}
                </span>
                <span className="text-gray-900 font-medium">
                  ${Number(invoice.tax_amount || 0).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
              <span>Total</span>
              <span>${Number(invoice.total_amount || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notes</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .bg-white.shadow-lg, .bg-white.shadow-lg * { visibility: visible; }
          .bg-white.shadow-lg { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
