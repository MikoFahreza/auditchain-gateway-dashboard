import React from 'react';
import { createPortal } from 'react-dom';
import Icon from '../common/Icon';
import ActionBadge from '../common/ActionBadge';
import VerificationModal from './VerificationModal';
import { formatTimestamp, renderMetadataCell } from '../../utils/formatters';
import api from '../../api';

const QUICK_RANGES = [
  { key: '1h', label: 'Last 1 hour', amount: 1, unit: 'hour' },
  { key: '12h', label: 'Last 12 hours', amount: 12, unit: 'hour' },
  { key: '24h', label: 'Last 24 hours', amount: 24, unit: 'hour' },
  { key: '72h', label: 'Last 72 hours', amount: 72, unit: 'hour' },
  { key: '7d', label: 'Last 7 days', amount: 7, unit: 'day' }
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const padDatePart = (value) => String(value).padStart(2, '0');

const toDateInputValue = (date) => {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';

  return [
    d.getFullYear(),
    padDatePart(d.getMonth() + 1),
    padDatePart(d.getDate())
  ].join('-') + `T${padDatePart(d.getHours())}:${padDatePart(d.getMinutes())}`;
};

const fromDateInputValue = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildQuickRange = (range) => {
  const end = new Date();
  const start = new Date(end);

  if (range.unit === 'day') {
    start.setDate(start.getDate() - range.amount);
  } else {
    start.setHours(start.getHours() - range.amount);
  }

  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end)
  };
};

const getCalendarDays = (visibleMonth) => {
  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
};

const isSameDay = (a, b) => (
  !!a && !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()
);

const isBetweenDays = (date, start, end) => {
  if (!date || !start || !end) return false;
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return d > s && d < e;
};

const getRangeLabel = (from, to) => {
  if (!from || !to) return 'Date Range';

  const fromDate = fromDateInputValue(from);
  const toDate = fromDateInputValue(to);
  if (!fromDate || !toDate) return 'Date Range';

  const duration = toDate.getTime() - fromDate.getTime();
  const tolerance = 60 * 1000;
  const matched = QUICK_RANGES.find(range => {
    const expected = range.unit === 'day'
      ? range.amount * 24 * 60 * 60 * 1000
      : range.amount * 60 * 60 * 1000;
    return Math.abs(duration - expected) <= tolerance;
  });

  if (matched) return matched.label;

  return `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`;
};

const parseCustomRange = (value) => {
  const text = value.trim().toLowerCase();
  const match = text.match(/^(\d+)\s*(m|min|minute|minutes|h|hr|hour|hours|d|day|days)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!amount || amount < 1) return null;

  const end = new Date();
  const start = new Date(end);
  const unit = match[2];

  if (unit.startsWith('m')) {
    start.setMinutes(start.getMinutes() - amount);
  } else if (unit.startsWith('h')) {
    start.setHours(start.getHours() - amount);
  } else {
    start.setDate(start.getDate() - amount);
  }

  return {
    from: toDateInputValue(start),
    to: toDateInputValue(end)
  };
};

function FilterDropdown({ value, options, onChange, disabled = false, className = '', ariaLabel }) {
  const [open, setOpen] = React.useState(false);
  const dropdownRef = React.useRef(null);
  const selectedOption = options.find(option => option.value === value) || options[0];

  React.useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className={`ac-filter-dropdown ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className={`ac-filter-dropdown__trigger${open ? ' ac-filter-dropdown__trigger--open' : ''}`}
        disabled={disabled}
        onClick={() => setOpen(value => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span>{selectedOption.label}</span>
        <Icon name="chevronDown" size={15} />
      </button>

      {open && (
        <div className="ac-filter-dropdown__menu" role="listbox">
          {options.map(option => (
            <button
              type="button"
              key={option.value}
              className={`ac-filter-dropdown__option${option.value === value ? ' ac-filter-dropdown__option--active' : ''}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              role="option"
              aria-selected={option.value === value}
            >
              <span>{option.label}</span>
              {option.value === value && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditLogTable({
  paginatedLogs = [],
  searchQuery = '',
  setSearchQuery,
  filterAction = 'ALL',
  setFilterAction,
  filterVerification = 'ALL',
  setFilterVerification,
  sortOrder = 'desc',
  setSortOrder,
  filterTable = '',
  setFilterTable,
  tableNames = [],
  rowsPerPage = 10,
  setRowsPerPage,
  tempDateFrom = '',
  setTempDateFrom,
  tempDateTo = '',
  setTempDateTo,
  filterDateFrom = '',
  filterDateTo = '',
  setFilterDateFrom,
  setFilterDateTo,
  handleApplyLogsRange,
  handleClearRange,
  isLogsLoading = false,
  handleVerifyRange,
  rangeVerifyResult = null,
  setRangeVerifyResult,
  isVerifyRangeLoading = false,
  selectedVerifyResult = null,
  setSelectedVerifyResult,
  onSelectResource,
  renderStatusBadge,
  displayTotal = 0,
  currentPage = 1,
  setCurrentPage,
  totalPages = 1,
  renderPageNumbers
}) {
  const [copyState, setCopyState] = React.useState('');
  const [isTablePickerOpen, setIsTablePickerOpen] = React.useState(false);
  const [isRangePickerOpen, setIsRangePickerOpen] = React.useState(false);
  const [tableSearch, setTableSearch] = React.useState('');
  const [customRangeText, setCustomRangeText] = React.useState('');
  const [draftFrom, setDraftFrom] = React.useState(tempDateFrom || filterDateFrom || '');
  const [draftTo, setDraftTo] = React.useState(tempDateTo || filterDateTo || '');
  const [draftPreset, setDraftPreset] = React.useState('');
  const [rangePickerPosition, setRangePickerPosition] = React.useState(null);
  const [visibleMonth, setVisibleMonth] = React.useState(() => {
    const activeDate = fromDateInputValue(tempDateFrom || filterDateFrom);
    return activeDate || new Date();
  });
  const tablePickerRef = React.useRef(null);
  const rangePickerRef = React.useRef(null);
  const rangeTriggerRef = React.useRef(null);
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExportRange = async () => {
    if (!filterDateFrom || !filterDateTo) return;
    setIsExporting(true);
    try {
      const fromObj = new Date(filterDateFrom);
      const toObj = new Date(filterDateTo);
      toObj.setSeconds(59, 999);
      
      const response = await api.post('/dashboard/reports/generate', {
        period_from: fromObj.toISOString(),
        period_to: toObj.toISOString(),
        format: 'csv',
        sections: ['summary', 'logs']
      }, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auditchain-report-${filterDateFrom}-to-${filterDateTo}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export report:", err);
      alert("Failed to export report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredTableNames = React.useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    if (!query) return tableNames;
    return tableNames.filter(name => name.toLowerCase().includes(query));
  }, [tableNames, tableSearch]);

  React.useEffect(() => {
    const handleOutsideClick = (event) => {
      if (tablePickerRef.current && !tablePickerRef.current.contains(event.target)) {
        setIsTablePickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  React.useEffect(() => {
    const handleOutsideClick = (event) => {
      const clickedTrigger = rangeTriggerRef.current && rangeTriggerRef.current.contains(event.target);
      const clickedPanel = rangePickerRef.current && rangePickerRef.current.contains(event.target);
      if (!clickedTrigger && !clickedPanel) {
        setIsRangePickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  React.useEffect(() => {
    if (!isRangePickerOpen) return undefined;

    const updatePosition = () => {
      const trigger = rangeTriggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 16;
      const triggerGap = 10;
      const panelWidth = Math.min(620, window.innerWidth - (viewportPadding * 2));
      const left = Math.max(
        viewportPadding,
        Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - viewportPadding)
      );
      const preferredTop = rect.bottom + triggerGap;
      const availableBelow = window.innerHeight - preferredTop - viewportPadding;
      const maxHeight = Math.max(
        260,
        Math.min(560, window.innerHeight - (viewportPadding * 2), availableBelow)
      );
      const top = Math.max(
        viewportPadding,
        Math.min(preferredTop, window.innerHeight - maxHeight - viewportPadding)
      );

      setRangePickerPosition({
        top,
        left,
        width: panelWidth,
        maxHeight
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isRangePickerOpen]);

  React.useEffect(() => {
    if (!isRangePickerOpen) return;

    const nextFrom = tempDateFrom || filterDateFrom || '';
    const nextTo = tempDateTo || filterDateTo || '';
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
    setDraftPreset('');
    setCustomRangeText('');

    const activeDate = fromDateInputValue(nextFrom);
    setVisibleMonth(activeDate || new Date());
  }, [isRangePickerOpen, tempDateFrom, tempDateTo, filterDateFrom, filterDateTo]);

  const handleTableSelect = (nextTable) => {
    if (setFilterTable) setFilterTable(nextTable);
    if (setCurrentPage) setCurrentPage(1);
    setIsTablePickerOpen(false);
    setTableSearch('');
  };

  const handleCopyResults = async () => {
    if (!rangeVerifyResult || !rangeVerifyResult.results) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(rangeVerifyResult.results, null, 2));
      setCopyState('Copied!');
      setTimeout(() => setCopyState(''), 2000);
    } catch {
      setCopyState('Failed');
      setTimeout(() => setCopyState(''), 2000);
    }
  };

  const handleQuickRangeSelect = (range) => {
    const nextRange = buildQuickRange(range);
    setDraftFrom(nextRange.from);
    setDraftTo(nextRange.to);
    setDraftPreset(range.key);
    setVisibleMonth(fromDateInputValue(nextRange.from) || new Date());
  };

  const handleCustomRangeSubmit = (event) => {
    if (event.key !== 'Enter') return;
    const parsed = parseCustomRange(customRangeText);
    if (!parsed) return;

    setDraftFrom(parsed.from);
    setDraftTo(parsed.to);
    setDraftPreset('custom');
    setVisibleMonth(fromDateInputValue(parsed.from) || new Date());
  };

  const handleCalendarDayClick = (date) => {
    const selectedStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0);
    const selectedEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59);
    const currentFromDate = fromDateInputValue(draftFrom);
    const currentToDate = fromDateInputValue(draftTo);

    setDraftPreset('custom');

    if (!currentFromDate || currentToDate) {
      setDraftFrom(toDateInputValue(selectedStart));
      setDraftTo('');
      return;
    }

    if (selectedStart.getTime() < currentFromDate.getTime()) {
      setDraftFrom(toDateInputValue(selectedStart));
      setDraftTo('');
      return;
    }

    setDraftTo(toDateInputValue(selectedEnd));
  };

  const handleApplyRange = () => {
    if (!draftFrom || !draftTo) return;

    setTempDateFrom(draftFrom);
    setTempDateTo(draftTo);
    if (handleApplyLogsRange) {
      handleApplyLogsRange(draftFrom, draftTo);
    }
    setIsRangePickerOpen(false);
  };

  const handleClearDateRange = () => {
    setDraftFrom('');
    setDraftTo('');
    setDraftPreset('');
    setCustomRangeText('');
    if (handleClearRange) {
      handleClearRange();
    } else {
      setTempDateFrom('');
      setTempDateTo('');
      setFilterDateFrom('');
      setFilterDateTo('');
      setCurrentPage(1);
    }
    setIsRangePickerOpen(false);
  };

  const shiftVisibleMonth = (amount) => {
    setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const calendarDays = React.useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const draftFromDate = fromDateInputValue(draftFrom);
  const draftToDate = fromDateInputValue(draftTo);
  const appliedRangeLabel = getRangeLabel(filterDateFrom, filterDateTo);
  const hasAppliedRange = Boolean(filterDateFrom && filterDateTo);
  const actionOptions = React.useMemo(() => ([
    { value: 'ALL', label: 'All Actions' },
    { value: 'INSERT', label: 'INSERT' },
    { value: 'UPDATE', label: 'UPDATE' },
    { value: 'DELETE', label: 'DELETE' }
  ]), []);
  const statusOptions = React.useMemo(() => ([
    { value: 'ALL', label: 'All Status' },
    { value: 'VALID', label: 'VALID' },
    { value: 'INVALID', label: 'INVALID' }
  ]), []);
  const rowsOptions = React.useMemo(() => ([5, 10, 20, 50].map(count => ({
    value: count,
    label: `${count} Rows`
  }))), []);

  const rangePickerPopover = isRangePickerOpen && rangePickerPosition ? createPortal(
    <div
      className="ac-range-picker__popover ac-range-picker__popover--portal"
      role="dialog"
      aria-label="Date range picker"
      ref={rangePickerRef}
      style={{
        top: rangePickerPosition.top,
        left: rangePickerPosition.left,
        width: rangePickerPosition.width,
        '--range-picker-max-height': `${rangePickerPosition.maxHeight}px`
      }}
    >
      <input
        className="ac-range-picker__custom"
        value={customRangeText}
        onChange={event => setCustomRangeText(event.target.value)}
        onKeyDown={handleCustomRangeSubmit}
        placeholder="Custom range: 3h, 12 hours, 7 days..."
      />

      <div className="ac-range-picker__body">
        <div className="ac-range-picker__calendar">
          <div className="ac-range-picker__monthbar">
            <strong>{MONTH_NAMES[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}</strong>
            <span>
              <button type="button" onClick={() => shiftVisibleMonth(-1)} aria-label="Previous month">
                <Icon name="chevronLeft" size={14} />
              </button>
              <button type="button" onClick={() => shiftVisibleMonth(1)} aria-label="Next month">
                <Icon name="chevronRight" size={14} />
              </button>
            </span>
          </div>

          <div className="ac-range-picker__weekdays">
            {DAY_NAMES.map(day => <span key={day}>{day}</span>)}
          </div>

          <div className="ac-range-picker__days">
            {calendarDays.map(date => {
              const outsideMonth = date.getMonth() !== visibleMonth.getMonth();
              const isStart = isSameDay(date, draftFromDate);
              const isEnd = isSameDay(date, draftToDate);
              const inRange = isBetweenDays(date, draftFromDate, draftToDate);

              return (
                <button
                  type="button"
                  key={date.toISOString()}
                  className={[
                    'ac-range-picker__day',
                    outsideMonth ? 'ac-range-picker__day--muted' : '',
                    inRange ? 'ac-range-picker__day--range' : '',
                    isStart || isEnd ? 'ac-range-picker__day--selected' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleCalendarDayClick(date)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ac-range-picker__presets">
          {QUICK_RANGES.map(range => (
            <button
              type="button"
              key={range.key}
              className={draftPreset === range.key ? 'ac-range-picker__preset--active' : ''}
              onClick={() => handleQuickRangeSelect(range)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ac-range-picker__fields">
        <label>
          <span>Start</span>
          <input
            type="datetime-local"
            value={draftFrom}
            onChange={event => {
              setDraftFrom(event.target.value);
              setDraftPreset('custom');
            }}
          />
        </label>
        <label>
          <span>End</span>
          <input
            type="datetime-local"
            value={draftTo}
            onChange={event => {
              setDraftTo(event.target.value);
              setDraftPreset('custom');
            }}
          />
        </label>
      </div>

      <div className="ac-range-picker__footer">
        <button type="button" className="ac-btn-ghost-action" onClick={handleClearDateRange}>
          Clear
        </button>
        <button
          type="button"
          className="ac-btn-primary"
          onClick={handleApplyRange}
          disabled={!draftFrom || !draftTo}
        >
          Apply
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <section className={`ac-card ac-audit-card${isRangePickerOpen ? ' ac-audit-card--range-open' : ''}`}>
      <div className="ac-card__header ac-audit-card-header">
        <div className="ac-audit-card-header__top">
          <div className="ac-card__header-left">
            <span className="ac-card__icon ac-card__icon--soft">
              <Icon name="history" size={18} />
            </span>
            <span className="ac-card__title">Audit Logs</span>
          </div>

          <div className="ac-toolbar">
            <div className="ac-search">
              <span className="ac-search__icon">
                <Icon name="search" size={15} />
              </span>
              <input
                type="text"
                className="ac-search__input"
                placeholder="Search Actor, Resource, Hash..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="ac-combobox" ref={tablePickerRef}>
              <button
                type="button"
                className={`ac-combobox__trigger${isTablePickerOpen ? ' ac-combobox__trigger--open' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={isTablePickerOpen}
                onClick={() => setIsTablePickerOpen(open => !open)}
                title={filterTable || 'All Tables'}
              >
                <Icon name="database" size={15} />
                <span className="ac-combobox__value">{filterTable || 'All Tables'}</span>
                <Icon name="chevronDown" size={15} />
              </button>

              {isTablePickerOpen && (
                <div className="ac-combobox__menu" role="listbox">
                  <div className="ac-combobox__search">
                    <Icon name="search" size={14} />
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={e => setTableSearch(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') setIsTablePickerOpen(false);
                      }}
                      placeholder="Filter tables..."
                      autoFocus
                    />
                  </div>
                  <div className="ac-combobox__list">
                    <button
                      type="button"
                      className={`ac-combobox__option${!filterTable ? ' ac-combobox__option--active' : ''}`}
                      onClick={() => handleTableSelect('')}
                      role="option"
                      aria-selected={!filterTable}
                    >
                      <span className="ac-combobox__option-main">All Tables</span>
                      <span className="ac-combobox__option-meta">{tableNames.length} detected</span>
                    </button>
                    {filteredTableNames.length > 0 ? (
                      filteredTableNames.map(name => (
                        <button
                          type="button"
                          key={name}
                          className={`ac-combobox__option${filterTable === name ? ' ac-combobox__option--active' : ''}`}
                          onClick={() => handleTableSelect(name)}
                          role="option"
                          aria-selected={filterTable === name}
                          title={name}
                        >
                          <span className="ac-combobox__option-main">{name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="ac-combobox__empty">No table found</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <FilterDropdown
              value={filterAction}
              options={actionOptions}
              onChange={setFilterAction}
              ariaLabel="Filter by action"
            />

            <FilterDropdown
              value={filterVerification}
              options={statusOptions}
              onChange={setFilterVerification}
              ariaLabel="Filter by verification status"
            />

            <button
              type="button"
              className={`ac-btn-ghost ac-sort-toggle${sortOrder === 'desc' ? ' ac-btn-ghost--active' : ''}`}
              disabled={isLogsLoading}
              onClick={() => {
                if (isLogsLoading) return;
                if (setSortOrder) setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
              }}
              title={
                sortOrder === 'desc'
                  ? 'Sort logs by newest first'
                  : 'Sort logs by oldest first'
              }
            >
              <Icon name={sortOrder === 'desc' ? 'arrowDown' : 'arrowUp'} size={14} />
              {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
            </button>

            <FilterDropdown
              value={rowsPerPage}
              options={rowsOptions}
              disabled={isLogsLoading}
              onChange={nextValue => {
                setRowsPerPage(Number(nextValue));
                setCurrentPage(1);
              }}
              className="ac-filter-dropdown--rows"
              ariaLabel="Rows per page"
            />
          </div>
        </div>

        <div className="ac-range-toolbar">
          <div className="ac-range-toolbar__left">
            {isLogsLoading && (
              <span className="ac-date-panel__loading">
                <Icon name="spinner" size={14} />
                Loading logs...
              </span>
            )}
            {hasAppliedRange && (
              <button className="ac-btn-ghost-action ac-date-action-btn" onClick={handleClearDateRange}>
                <Icon name="x" size={14} />
                Clear Range
              </button>
            )}
            {filterDateFrom && filterDateTo && (
              <button
                className="ac-btn-primary ac-date-action-btn ac-date-action-btn--primary"
                disabled={isVerifyRangeLoading}
                onClick={handleVerifyRange}
              >
                <Icon name={isVerifyRangeLoading ? 'spinner' : 'zap'} size={14} className={isVerifyRangeLoading ? 'ac-spin' : ''} />
                {isVerifyRangeLoading ? 'Verifying...' : 'Verify Range'}
              </button>
            )}
            {filterDateFrom && filterDateTo && (
              <button
                className="ac-btn-ghost-action ac-date-action-btn"
                disabled={isExporting}
                onClick={handleExportRange}
              >
                <Icon name={isExporting ? 'spinner' : 'download'} size={14} className={isExporting ? 'ac-spin' : ''} />
                {isExporting ? 'Exporting...' : 'Export CSV'}
              </button>
            )}
            {rangeVerifyResult && (
              <button
                type="button"
                className="ac-btn-ghost-action ac-date-action-btn"
                onClick={handleCopyResults}
              >
                <Icon name="copy" size={14} />
                Copy Results {copyState && `(${copyState})`}
              </button>
            )}
          </div>

          <div className="ac-range-picker">
            <button
              type="button"
              ref={rangeTriggerRef}
              className={`ac-range-picker__trigger${hasAppliedRange ? ' ac-range-picker__trigger--active' : ''}`}
              onClick={() => setIsRangePickerOpen(open => !open)}
              aria-haspopup="dialog"
              aria-expanded={isRangePickerOpen}
            >
              <Icon name="calendar" size={14} />
              {appliedRangeLabel}
            </button>
          </div>
        </div>

        {/* Inline Verification Animation — Single Log Verification */}
        {selectedVerifyResult && !selectedVerifyResult.range && (
          <div style={{ marginTop: '12px' }}>
            <VerificationModal
              result={selectedVerifyResult}
              onClose={() => setSelectedVerifyResult && setSelectedVerifyResult(null)}
            />
          </div>
        )}

        {rangeVerifyResult && rangeVerifyResult.summary && (
          <div className="ac-range-summary">
            <div className="ac-range-summary__header">
              <div className="ac-range-summary__title">
                <span className="ac-card__icon ac-card__icon--soft">
                  <Icon name="chart" size={17} />
                </span>
                <div>
                  <div className="ac-range-summary__heading">
                    Range Verification Inspection Summary
                  </div>
                  <div className="ac-range-summary__sub">
                    Checked logs from {formatTimestamp(rangeVerifyResult.range.from)} to {formatTimestamp(rangeVerifyResult.range.to)}
                  </div>
                </div>
              </div>
              <button
                className="ac-btn-ghost-action ac-range-summary__close"
                onClick={() => setRangeVerifyResult && setRangeVerifyResult(null)}
                title="Dismiss Inspection Banner"
              >
                <Icon name="x" size={13} />
                Close Inspection
              </button>
            </div>

            <div className="ac-range-summary__stats">
              <div className="ac-range-summary__stat">
                <div className="ac-range-summary__value ac-range-summary__value--total">{rangeVerifyResult.summary.total}</div>
                <div className="ac-range-summary__label ac-range-summary__label--total">Total Checked</div>
              </div>
              <div className="ac-range-summary__stat">
                <div className="ac-range-summary__value ac-range-summary__value--valid">{rangeVerifyResult.summary.valid}</div>
                <div className="ac-range-summary__label ac-range-summary__label--valid">Valid</div>
              </div>
              <div className="ac-range-summary__stat">
                <div className="ac-range-summary__value ac-range-summary__value--invalid">{rangeVerifyResult.summary.invalid}</div>
                <div className="ac-range-summary__label ac-range-summary__label--invalid">Invalid</div>
              </div>
              <div className="ac-range-summary__stat">
                <div className="ac-range-summary__value ac-range-summary__value--pending">{rangeVerifyResult.summary.pending}</div>
                <div className="ac-range-summary__label ac-range-summary__label--pending">Pending</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {rangePickerPopover}

      <div className={`ac-table-wrap${isLogsLoading ? ' ac-table-wrap--loading' : ''}`}>
        {isLogsLoading && paginatedLogs.length > 0 && (
          <div className="ac-table-loading" role="status" aria-live="polite">
            <Icon name="spinner" size={18} />
            Loading transaction logs...
          </div>
        )}
        <table className="ac-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Metadata</th>
              <th>Source System</th>
              <th>Verification</th>
            </tr>
          </thead>
          <tbody>
            {isLogsLoading && paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="ac-empty ac-empty--loading">
                    <div className="ac-empty__icon">
                      <Icon name="spinner" size={30} />
                    </div>
                    <span style={{ fontWeight: '600', color: 'var(--color-on-surface)' }}>
                      Loading latest transaction logs...
                    </span>
                  </div>
                </td>
              </tr>
            ) : paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="ac-empty">
                    <div className="ac-empty__icon">
                      <Icon name="calendar" size={30} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontWeight: '600', color: 'var(--color-on-surface)' }}>
                        No transactions match the selected filter.
                      </span>
                      {!filterDateFrom || !filterDateTo ? (
                        <span style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                          The dashboard loads the latest logs on demand.
                        </span>
                      ) : null}
                    </div>
                  </div>
                </td>
              </tr>
            ) : paginatedLogs.map(log => {
              return (
                <tr key={log.log_id} onClick={() => onSelectResource(log)}>
                  <td className="ac-table__time">{formatTimestamp(log.timestamp)}</td>
                  <td className="ac-table__actor">{log.actor}</td>
                  <td><ActionBadge action={log.action} /></td>
                  <td className="ac-table__mono">{log.source_table || log.resource || '-'}</td>
                  <td onClick={e => e.stopPropagation()}>{renderMetadataCell(log.metadata)}</td>
                  <td className="ac-table__source-system">{log.source_system || '-'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {renderStatusBadge(log)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ac-pagination">
        <span className="ac-pagination__info">
          Showing {paginatedLogs.length} of {displayTotal} results
        </span>
        <div className="ac-pagination__controls">
          <button
            className="ac-pagination__btn"
            disabled={isLogsLoading || currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            Prev
          </button>
          {renderPageNumbers().map((p, i) =>
            p === '...'
              ? <span key={`dots-${i}`} className="ac-pagination__dots">...</span>
              : <button
                key={p}
                className={`ac-pagination__page${currentPage === p ? ' ac-pagination__page--active' : ''}`}
                disabled={isLogsLoading}
                onClick={() => setCurrentPage(p)}
              >{p}</button>
          )}
          <button
            className={`ac-pagination__btn${isLogsLoading ? ' ac-pagination__btn--loading' : ''}`}
            disabled={isLogsLoading || currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            {isLogsLoading ? (
              <>
                <Icon name="spinner" size={13} />
                Loading
              </>
            ) : (
              'Next'
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

const MemoizedAuditLogTable = React.memo(AuditLogTable);

export { AuditLogTable };
export default MemoizedAuditLogTable;
