import React, { useState } from 'react';
import api from '../../api';
import Icon from '../common/Icon';

const today = () => new Date().toISOString().split('T')[0];
const subDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

function ReportsView() {
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [format, setFormat] = useState('csv'); // Only CSV for Phase 1
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const QUICK_RANGES = [
    { label: 'Last 7 Days', from: () => subDays(7), to: today },
    { label: 'Last 30 Days', from: () => subDays(30), to: today },
  ];

  const handleQuickRange = (range) => {
    setPeriodFrom(range.from());
    setPeriodTo(range.to());
    setError('');
  };

  const handleGenerate = async () => {
    if (!periodFrom || !periodTo) {
      setError('Please select both from and to dates.');
      return;
    }
    
    setError('');
    setIsGenerating(true);
    
    try {
      const fromObj = new Date(periodFrom);
      const toObj = new Date(periodTo);
      toObj.setSeconds(59, 999); // Include the whole day

      const response = await api.post('/dashboard/reports/generate', {
        period_from: fromObj.toISOString(),
        period_to: toObj.toISOString(),
        format,
        sections: ['summary', 'logs']
      }, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auditchain-report-${periodFrom}-to-${periodTo}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate report:", err);
      if (err.response && err.response.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const errData = JSON.parse(text);
          setError(errData.error || 'Failed to generate report.');
          return;
        } catch (e) {
          // Fallback if parsing fails
        }
      }
      setError('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <section className="ac-hero">
        <div className="ac-hero__pattern" />
        <div className="ac-hero__content">
          <div className="ac-hero__left">
            <span className="ac-page-kicker">Reports & Compliance</span>
            <h1 className="ac-hero__title">Audit Reports</h1>
            <p className="ac-hero__subtitle">
              Generate audit reports for your workspace.
            </p>
          </div>
        </div>
      </section>

      <div className="ac-container" style={{ marginTop: '24px' }}>
        <div className="ac-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '8px' }}>
            Generate New Report
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
            Create an audit report for a specific date range.
          </p>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>Date From</label>
              <input 
                type="date" 
                className="ac-input"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>Date To</label>
              <input 
                type="date" 
                className="ac-input"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Quick Range:</span>
            {QUICK_RANGES.map(range => (
              <button 
                key={range.label}
                className="ac-btn-ghost"
                style={{ padding: '4px 10px', fontSize: '12px' }}
                onClick={() => handleQuickRange(range)}
              >
                {range.label}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>Format</label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-main)' }}>
                <input 
                  type="radio" 
                  name="format" 
                  value="csv" 
                  checked={format === 'csv'} 
                  onChange={(e) => setFormat(e.target.value)} 
                />
                CSV (Spreadsheet)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-main)' }}>
                <input 
                  type="radio" 
                  name="format" 
                  value="pdf" 
                  checked={format === 'pdf'} 
                  onChange={(e) => setFormat(e.target.value)} 
                />
                PDF Document
              </label>
            </div>
          </div>

          {error && (
            <div style={{ color: 'var(--danger-main)', fontSize: '14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="xCircle" size={16} />
              {error}
            </div>
          )}

          <button 
            className="ac-btn ac-btn--primary" 
            onClick={handleGenerate}
            disabled={isGenerating || !periodFrom || !periodTo}
          >
            {isGenerating ? (
              <>
                <Icon name="spinner" size={16} className="ac-spin" />
                Generating...
              </>
            ) : (
              <>
                <Icon name="download" size={16} />
                Generate & Download
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

const MemoizedReportsView = React.memo(ReportsView);

export { ReportsView };
export default MemoizedReportsView;
