import React, { useState } from 'react';
import api from '../utils/api';

const renderFormattedText = (text) => {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null;

  const flushList = () => {
    if (listItems.length > 0) {
      if (listType === 'ul') {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 mb-3 text-gray-700">
            {listItems.map((item, i) => (
              <li key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: item }} />
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`list-${elements.length}`} className="list-decimal list-inside space-y-1 mb-3 text-gray-700">
            {listItems.map((item, i) => (
              <li key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: item }} />
            ))}
          </ol>
        );
      }
      listItems = [];
      listType = null;
    }
  };

  const applyInline = (str) => {
    return str.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // H2 heading
    if (/^##\s/.test(trimmed)) {
      flushList();
      const heading = applyInline(trimmed.replace(/^##\s+/, ''));
      elements.push(
        <h2
          key={`h2-${idx}`}
          className="text-lg font-bold text-gray-900 mt-5 mb-2 pb-1 border-b border-gray-200"
          dangerouslySetInnerHTML={{ __html: heading }}
        />
      );
      return;
    }

    // H3 heading
    if (/^###\s/.test(trimmed)) {
      flushList();
      const heading = applyInline(trimmed.replace(/^###\s+/, ''));
      elements.push(
        <h3
          key={`h3-${idx}`}
          className="text-md font-semibold text-gray-800 mt-4 mb-1"
          dangerouslySetInnerHTML={{ __html: heading }}
        />
      );
      return;
    }

    // H1 heading
    if (/^#\s/.test(trimmed)) {
      flushList();
      const heading = applyInline(trimmed.replace(/^#\s+/, ''));
      elements.push(
        <h1
          key={`h1-${idx}`}
          className="text-xl font-bold text-gray-900 mt-5 mb-3"
          dangerouslySetInnerHTML={{ __html: heading }}
        />
      );
      return;
    }

    // Unordered list
    if (/^\s*[-•*]\s/.test(trimmed)) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(applyInline(trimmed.replace(/^\s*[-•*]\s+/, '')));
      return;
    }

    // Ordered list
    if (/^\s*\d+\.\s/.test(trimmed)) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(applyInline(trimmed.replace(/^\s*\d+\.\s+/, '')));
      return;
    }

    flushList();

    // Empty line
    if (trimmed === '') {
      elements.push(<div key={`br-${idx}`} className="h-2" />);
      return;
    }

    // Regular paragraph
    elements.push(
      <p
        key={`p-${idx}`}
        className="text-sm text-gray-700 leading-relaxed mb-2"
        dangerouslySetInnerHTML={{ __html: applyInline(trimmed) }}
      />
    );
  });

  flushList();
  return elements;
};

export default function Insights() {
  const [insights, setInsights] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/ai/insights');
      setInsights(res.data.insights || res.data.response || '');
      setGenerated(true);
    } catch (err) {
      setError('Failed to generate insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl px-6 py-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold">AI Income Insights</h1>
              <p className="text-white/70 text-sm">Intelligent analysis of your income patterns & trends</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {generated && (
              <button
                onClick={generateInsights}
                disabled={loading}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-medium px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center space-x-2 disabled:opacity-50 border border-white/30"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                <span>Refresh</span>
              </button>
            )}
            <button
              onClick={generateInsights}
              disabled={loading}
              className={`font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 flex items-center space-x-2 disabled:opacity-50 ${
                generated
                  ? 'bg-white text-teal-700 hover:bg-white/90 shadow-md'
                  : 'bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white border border-white/30'
              }`}
            >
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
                  </svg>
                  <span>Generate Insights</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="animate-pulse space-y-6">
            {/* Skeleton header */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-200 rounded-lg" />
              <div className="h-5 w-48 bg-gray-200 rounded" />
            </div>
            {/* Skeleton content blocks */}
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-full" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
              <div className="h-4 bg-gray-100 rounded w-4/6" />
            </div>
            <div className="pt-2 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-40" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
            </div>
            <div className="pt-2 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-56" />
              <div className="grid grid-cols-3 gap-4">
                <div className="h-20 bg-gray-100 rounded-xl" />
                <div className="h-20 bg-gray-100 rounded-xl" />
                <div className="h-20 bg-gray-100 rounded-xl" />
              </div>
            </div>
            <div className="pt-2 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-44" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
              <div className="h-4 bg-gray-200 rounded w-4/5" />
              <div className="h-4 bg-gray-100 rounded w-3/4" />
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !generated && (
        <div className="text-center py-20">
          <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Ready to Analyze Your Income</h3>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Get AI-powered insights into your earning patterns, client analysis, and actionable recommendations to grow your freelance business.
          </p>
          <button
            onClick={generateInsights}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg inline-flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" />
            </svg>
            <span>Generate Insights</span>
          </button>
        </div>
      )}

      {/* Insights Content */}
      {!loading && generated && insights && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Content Header */}
          <div className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 px-6 py-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-sm font-medium text-gray-600">AI-Generated Analysis</p>
              <span className="text-xs text-gray-400 ml-auto">
                Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Insights Body */}
          <div className="px-6 py-6">
            {renderFormattedText(insights)}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 border-t border-gray-100 px-6 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Powered by AI • Based on your invoice & payment data
            </p>
            <button
              onClick={generateInsights}
              disabled={loading}
              className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center space-x-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              <span>Regenerate</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
