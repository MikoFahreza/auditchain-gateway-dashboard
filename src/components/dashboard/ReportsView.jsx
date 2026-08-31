import React, { useState, useMemo } from 'react';
import api from '../../api';
import Icon from '../common/Icon';

const today = () => new Date().toISOString().split('T')[0];
const subDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

const getFirstOfMonth = (offset = 0) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().split('T')[0];
};

const getLastOfMonth = (offset = 0) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset + 1);
  d.setDate(0);
  return d.toISOString().split('T')[0];
};

const REPORT_TYPES = [
  {
    id: 'full',
    label: 'Full Audit Report',
    description: 'Summary statistics plus the audit log detail table.',
    icon: 'shield',
    defaultFormat: 'pdf',
  },
  {
    id: 'export',
    label: 'Data Export',
    description: 'Raw audit log rows for spreadsheet processing.',
    icon: 'database',
    defaultFormat: 'csv',
  },
];

const FORMAT_OPTIONS = [
  {
    id: 'csv',
    label: 'CSV',
    description: 'Spreadsheet-friendly, up to 10,000 rows.',
    icon: 'list',
  },
  {
    id: 'pdf',
    label: 'PDF',
    description: 'Printable summary plus up to 500 recent logs.',
    icon: 'fileText',
  },
];

const QUICK_RANGES = [
  { id: 'last-7', label: 'Last 7 Days', from: () => subDays(7), to: today },
  { id: 'last-30', label: 'Last 30 Days', from: () => subDays(30), to: today },
  { id: 'this-month', label: 'This Month', from: () => getFirstOfMonth(0), to: () => getLastOfMonth(0) },
  { id: 'last-month', label: 'Last Month', from: () => getFirstOfMonth(-1), to: () => getLastOfMonth(-1) },
];

const formatDateLabel = (value) => {
  if (!value) return '-';
  const time = new Date(value).getTime();
  if (isNaN(time)) return value;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(time));
};

const formatGeneratedAt = (value) => (
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
);

function ReportsView({ selectedClient }) {
  const [reportType, setReportType] = useState('full');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [activeQuickRange, setActiveQuickRange] = useState('');
  const [format, setFormat] = useState('pdf');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentDownloads, setRecentDownloads] = useState([]);

  const dateError = useMemo(() => {
    if (!periodFrom || !periodTo) return '';
    if (new Date(periodFrom) > new Date(periodTo)) {
      return 'Date From must be earlier than or equal to Date To.';
    }
    return '';
  }, [periodFrom, periodTo]);

  const handleReportTypeChange = (typeId) => {
    setReportType(typeId);
    const type = REPORT_TYPES.find(t => t.id === typeId);
    if (type) setFormat(type.defaultFormat);
  };

  const handleQuickRange = (range) => {
    setPeriodFrom(range.from());
    setPeriodTo(range.to());
    setActiveQuickRange(range.id);
    setError('');
  };

  const handleDateChange = (setter) => (e) => {
    setter(e.target.value);
    setActiveQuickRange('');
    setError('');
  };

  const handleGenerate = async () => {
    if (!periodFrom || !periodTo) {
      setError('Please select both From and To dates.');
      return;
    }
    if (dateError) {
      setError(dateError);
      return;
    }

    setError('');
    setSuccess('');
    setIsGenerating(true);

    try {
      const fromObj = new Date(periodFrom);
      const toObj = new Date(periodTo);
      toObj.setSeconds(59, 999); // Include the whole day

      const requestConfig = {
        responseType: 'blob',
        params: {},
      };
      if (selectedClient) {
        requestConfig.params.client_id = selectedClient;
      }

      const response = await api.post('/dashboard/reports/generate', {
        period_from: fromObj.toISOString(),
        period_to: toObj.toISOString(),
        format,
        sections: ['summary', 'logs']
      }, requestConfig);

      const blob = new Blob([response.data], {
        type: format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auditchain-report-${periodFrom}-to-${periodTo}.${format}`;
      link.click();
      URL.revokeObjectURL(url);

      const type = REPORT_TYPES.find(t => t.id === reportType);
      setRecentDownloads(prev => ([
        {
          id: `${Date.now()}`,
          typeLabel: type ? type.label : 'Report',
          format: format.toUpperCase(),
          from: periodFrom,
          to: periodTo,
          generatedAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 10)));
      setSuccess(`Report downloaded: ${formatDateLabel(periodFrom)} to ${formatDateLabel(periodTo)} (${format.toUpperCase()}).`);
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
            <span className="ac-page-kicker">Reports &amp; Compliance</span>
            <h1 className="ac-hero__title">Audit Reports</h1>
            <p className="ac-hero__subtitle">
              Generate audit reports for your workspace.
            </p>
          </div>
        </div>
      </section>

      <div className="ac-report">
        <div className="ac-report__grid">
          {/* Step 1: Report type */}
          <section className="ac-card ac-report-step">
            <div className="ac-card__header">
              <div className="ac-card__header-left">
                <span className="ac-card__icon ac-card__icon--soft"><Icon name="fileText" size={16} /></span>
                <div>
                  <h2 className="ac-card__title">1. Report Type</h2>
                  <p className="ac-card__subtitle">Choose what the report should contain.</p>
                </div>
              </div>
            </div>
            <div className="ac-report-step__body">
              {REPORT_TYPES.map(type => (
                <button
                  key={type.id}
                  type="button"
                  className={`ac-report-option${reportType === type.id ? ' ac-report-option--active' : ''}`}
                  onClick={() => handleReportTypeChange(type.id)}
                >
                  <span className="ac-report-option__icon">
                    <Icon name={type.icon} size={18} />
                  </span>
                  <span className="ac-report-option__copy">
                    <strong>{type.label}</strong>
                    <small>{type.description}</small>
                  </span>
                  <span className="ac-report-option__check">
                    <Icon name="checkCircle" size={16} />
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Step 2: Format */}
          <section className="ac-card ac-report-step">
            <div className="ac-card__header">
              <div className="ac-card__header-left">
                <span className="ac-card__icon ac-card__icon--soft"><Icon name="download" size={16} /></span>
                <div>
                  <h2 className="ac-card__title">2. Output Format</h2>
                  <p className="ac-card__subtitle">How you want to receive the file.</p>
                </div>
              </div>
            </div>
            <div className="ac-report-step__body">
              {FORMAT_OPTIONS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={`ac-report-option${format === option.id ? ' ac-report-option--active' : ''}`}
                  onClick={() => setFormat(option.id)}
                >
                  <span className="ac-report-option__icon">
                    <Icon name={option.icon} size={18} />
                  </span>
                  <span className="ac-report-option__copy">
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                  <span className="ac-report-option__check">
                    <Icon name="checkCircle" size={16} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Step 3: Period */}
        <section className="ac-card">
          <div className="ac-card__header">
            <div className="ac-card__header-left">
              <span className="ac-card__icon ac-card__icon--soft"><Icon name="calendar" size={16} /></span>
              <div>
                <h2 className="ac-card__title">3. Reporting Period</h2>
                <p className="ac-card__subtitle">Pick a quick range or set custom dates.</p>
              </div>
            </div>
            <div className="ac-report-chips">
              {QUICK_RANGES.map(range => (
                <button
                  key={range.id}
                  type="button"
                  className={`ac-btn-ghost ac-report-chip${activeQuickRange === range.id ? ' ac-report-chip--active' : ''}`}
                  onClick={() => handleQuickRange(range)}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ac-report-step__body">
            <div className="ac-report-dates">
              <label className="ac-form-field">
                <span className="ac-form-label">Date From</span>
                <input
                  type="date"
                  className="ac-form-input ac-form-input--lg"
                  value={periodFrom}
                  max={periodTo || undefined}
                  onChange={handleDateChange(setPeriodFrom)}
                />
              </label>
              <label className="ac-form-field">
                <span className="ac-form-label">Date To</span>
                <input
                  type="date"
                  className="ac-form-input ac-form-input--lg"
                  value={periodTo}
                  min={periodFrom || undefined}
                  onChange={handleDateChange(setPeriodTo)}
                />
              </label>
            </div>

            {(error || dateError) && (
              <div className="ac-report-alert ac-report-alert--error">
                <Icon name="xCircle" size={15} />
                {error || dateError}
              </div>
            )}
            {success && (
              <div className="ac-report-alert ac-report-alert--success">
                <Icon name="checkCircle" size={15} />
                {success}
              </div>
            )}

            <div className="ac-report-footer">
              <div className="ac-report-preview">
                <Icon name="eye" size={15} />
                <span>
                  <strong>{REPORT_TYPES.find(t => t.id === reportType)?.label || 'Report'}</strong>
                  {' \u2022 '}
                  {format.toUpperCase()}
                  {' \u2022 '}
                  {periodFrom || periodTo
                    ? `${formatDateLabel(periodFrom)} \u2013 ${formatDateLabel(periodTo)}`
                    : 'No period selected'}
                </span>
              </div>
              <button
                type="button"
                className="ac-btn-primary ac-report-footer__action"
                onClick={handleGenerate}
                disabled={isGenerating || !periodFrom || !periodTo || !!dateError}
              >
                <Icon
                  name={isGenerating ? 'spinner' : 'download'}
                  size={15}
                  style={isGenerating ? { animation: 'spin 1s linear infinite' } : undefined}
                />
                {isGenerating ? 'Generating...' : 'Generate & Download'}
              </button>
            </div>
          </div>
        </section>

        {/* Recent downloads */}
        <section className="ac-card">
          <div className="ac-card__header">
            <div className="ac-card__header-left">
              <span className="ac-card__icon ac-card__icon--soft"><Icon name="history" size={16} /></span>
              <div>
                <h2 className="ac-card__title">Recent Downloads</h2>
                <p className="ac-card__subtitle">Reports generated in this session.</p>
              </div>
            </div>
          </div>
          {recentDownloads.length === 0 ? (
            <div className="ac-report-table ac-report-table--empty">
              <Icon name="inbox" size={22} />
              <p>No reports generated yet. Your session downloads will appear here.</p>
            </div>
          ) : (
            <div className="ac-report-table">
              <table>
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Format</th>
                    <th>Period</th>
                    <th>Generated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDownloads.map(item => (
                    <tr key={item.id}>
                      <td><strong>{item.typeLabel}</strong></td>
                      <td><span className={`ac-report-badge ac-report-badge--${item.format.toLowerCase()}`}>{item.format}</span></td>
                      <td>{formatDateLabel(item.from)} &ndash; {formatDateLabel(item.to)}</td>
                      <td>{formatGeneratedAt(item.generatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

const MemoizedReportsView = React.memo(ReportsView);

export { ReportsView };
export default MemoizedReportsView;
