import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Icon from '../components/common/Icon';
import AppearanceMenu from '../components/common/AppearanceMenu';
import AuditDashboardOverview from '../components/dashboard/AuditDashboardOverview';
import AuditLogsView from '../components/dashboard/AuditLogsView';
import WebUsersView from '../components/dashboard/WebUsersView';
import ReportsView from '../components/dashboard/ReportsView';
import ResourceDetailModal from '../components/dashboard/ResourceDetailModal';
import { parseJwt, mapRangeItemToVerifyStatus } from '../utils/formatters';

const areStatsEqual = (a = {}, b = {}) => (
  (a.total_logs || 0) === (b.total_logs || 0) &&
  (a.pending_logs || 0) === (b.pending_logs || 0) &&
  (a.anchored_logs || 0) === (b.anchored_logs || 0)
);

const getLogTimestampMs = (timestamp) => {
  if (!timestamp) return 0;
  let tsStr = String(timestamp);
  if (tsStr.includes(' ') && !tsStr.includes('T')) {
    tsStr = tsStr.replace(' ', 'T');
  }
  return new Date(tsStr).getTime() || 0;
};

const getVerificationBucket = (log, verifyStatuses = {}) => {
  const status = String(
    verifyStatuses[log?.log_id]?.status ||
    log?.verify_status ||
    log?.verification_status ||
    log?.integrity_status ||
    ''
  ).toLowerCase();

  if (status === 'success' || status === 'valid') return 'VALID';
  if (status === 'pending' || status === 'loading') return 'PENDING';
  if (status === 'failed' || status === 'failed_local' || status === 'failed_onchain' || status === 'tampered' || status === 'error' || status === 'unreachable') {
    return 'INVALID';
  }
  return 'UNKNOWN';
};

const buildRangeInspectionLog = (item, fallbackLog) => {
  const log = item?.log || item?.audit_log || fallbackLog || {};

  return {
    ...log,
    log_id: item?.log_id || log.log_id,
    actor: log.actor ?? item?.actor,
    action: log.action ?? item?.action,
    resource: log.resource ?? item?.resource,
    source_table: log.source_table ?? item?.source_table,
    timestamp: log.timestamp ?? item?.timestamp,
    source_system: log.source_system ?? item?.source_system,
    metadata: log.metadata ?? item?.metadata,
    hash_value: log.hash_value ?? item?.hash_value,
    verify_status: item?.verify_status || log.verify_status || log.verification_status,
    verification_status: item?.verify_status || log.verification_status || log.verify_status,
    verification_message: item?.message || log.verification_message,
  };
};

const fetchAllLogsForRange = async ({ fromISO, toISO, selectedClient }) => {
  const pageSize = 200;
  const baseParams = {
    page_size: pageSize,
    sort_order: 'asc',
    from: fromISO,
    to: toISO,
  };

  if (selectedClient) {
    baseParams.client_id = selectedClient;
  }

  const firstRes = await api.get('/dashboard/logs', {
    params: { ...baseParams, page: 1 },
  });

  const firstData = Array.isArray(firstRes.data) ? firstRes.data : (firstRes.data?.data || []);
  const totalPages = Array.isArray(firstRes.data)
    ? 1
    : (firstRes.data?.pagination?.total_pages || 1);

  if (totalPages <= 1) return firstData;

  const restResponses = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => (
      api.get('/dashboard/logs', {
        params: { ...baseParams, page: index + 2 },
      })
    ))
  );

  return restResponses.reduce((allLogs, response) => {
    const pageData = Array.isArray(response.data) ? response.data : (response.data?.data || []);
    return allLogs.concat(pageData);
  }, firstData);
};

function DashboardPage({ onLogout, onProfileUpdated, view = 'dashboard', themePreference = 'system', resolvedTheme = 'light', onThemeChange }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total_logs: 0, pending_logs: 0, anchored_logs: 0 });
  const [recentLogs, setRecentLogs] = useState([]);
  const [verifyStatuses, setVerifyStatuses] = useState({});
  const [selectedVerifyResult, setSelectedVerifyResult] = useState(null);
  const [totalLogsCount, setTotalLogsCount] = useState(0);

  const [selectedLog, setSelectedLog] = useState(null);

  // State Plan V12: Table Filter, Sort Order, & Table Names
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterTable, setFilterTable] = useState('');
  const [tableNames, setTableNames] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterVerification, setFilterVerification] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('auditchain_sidebar_collapsed') === 'true');
  const [sidebarHoverOpen, setSidebarHoverOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [tempDateFrom, setTempDateFrom] = useState('');
  const [tempDateTo, setTempDateTo] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [rangeVerifyResult, setRangeVerifyResult] = useState(null);
  const [isVerifyRangeLoading, setIsVerifyRangeLoading] = useState(false);
  const logsRequestSeq = useRef(0);

  // Decode JWT info for Workspace Context Indicator
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const clientInfo = useMemo(() => parseJwt(token), [token]);

  const displayName = clientInfo?.full_name || clientInfo?.username || 'Auditor';
  const initials = (displayName || 'A')
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    localStorage.setItem('auditchain_sidebar_collapsed', sidebarCollapsed ? 'true' : 'false');
  }, [sidebarCollapsed]);

  const [selectedClient, setSelectedClient] = useState(clientInfo?.client_id || '');
  const [adminClients, setAdminClients] = useState([]);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    username: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Fetch client list for admin dropdown
  useEffect(() => {
    if (clientInfo?.role?.toLowerCase() === 'admin') {
      api.get('/admin/clients')
        .then(res => {
          setAdminClients(res.data || []);
        })
        .catch(err => {
          console.error("Failed to load admin clients list:", err);
        });
    }
  }, [clientInfo]);

  // Update selectedClient if clientInfo changes
  useEffect(() => {
    if (clientInfo?.client_id) {
      setSelectedClient(clientInfo.client_id);
    }
  }, [clientInfo]);

  useEffect(() => {
    if (view !== 'profile') return;

    let cancelled = false;
    setProfileLoading(true);
    setProfileError('');

    api.get('/auth/me')
      .then(res => {
        if (cancelled) return;
        setProfileForm(form => ({
          ...form,
          full_name: res.data?.full_name || '',
          username: res.data?.username || clientInfo?.username || '',
          current_password: '',
          new_password: '',
          confirm_password: ''
        }));
      })
      .catch(err => {
        if (cancelled) return;
        if (err.response?.status === 401) onLogout();
        setProfileError(err.response?.data?.error || 'Failed to load profile data.');
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [view, clientInfo?.username, onLogout]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (profileForm.new_password && profileForm.new_password !== profileForm.confirm_password) {
      setProfileError('Password baru dan konfirmasi password belum sama.');
      return;
    }

    try {
      setProfileSaving(true);
      const tokenStorage = localStorage.getItem('token') ? localStorage : sessionStorage;
      const res = await api.put('/auth/me', {
        full_name: profileForm.full_name,
        username: profileForm.username,
        current_password: profileForm.current_password,
        new_password: profileForm.new_password
      });

      if (res.data?.token) {
        tokenStorage.setItem('token', res.data.token);
        if (onProfileUpdated) onProfileUpdated();
      }

      setProfileForm(form => ({
        ...form,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }));
      setProfileSuccess('Profile updated successfully.');
    } catch (err) {
      if (err.response?.status === 401 && !profileForm.new_password) onLogout();
      setProfileError(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const [isLogsLoading, setIsLogsLoading] = useState(false);

  // Fetch transaction logs on demand. The table uses server pagination so it
  // loads the newest 10 rows by default and only fetches again after user input.
  const fetchTransactionLogs = useCallback(async ({
    page = 1,
    pageSize = 10,
    fromDate = '',
    toDate = '',
    activeSort = 'desc',
    activeTable = ''
  } = {}) => {
    const requestId = logsRequestSeq.current + 1;
    logsRequestSeq.current = requestId;
    setIsLogsLoading(true);
    try {
      const params = {
        page,
        page_size: pageSize,
        sort_order: activeSort,
      };
      if (activeTable) {
        params.source_table = activeTable;
      }
      if (selectedClient) {
        params.client_id = selectedClient;
      }
      if (fromDate && toDate) {
        const fromObj = new Date(fromDate);
        const toObj = new Date(toDate);
        // Include the last selected second on the To field.
        toObj.setSeconds(59, 999);
        params.from = fromObj.toISOString();
        params.to = toObj.toISOString();
      }

      const logsRes = await api.get('/dashboard/logs', { params });
      if (requestId !== logsRequestSeq.current) return;

      let logsArray = [];
      let serverTotal = 0;

      if (Array.isArray(logsRes.data)) {
        logsArray = logsRes.data;
        serverTotal = logsRes.data.length;
      } else if (logsRes.data?.data) {
        logsArray = logsRes.data.data;
        serverTotal = logsRes.data.pagination?.total_items ?? logsRes.data.data.length;
      }

      setRecentLogs(logsArray);
      setTotalLogsCount(serverTotal);
    } catch (err) {
      if (requestId !== logsRequestSeq.current) return;
      console.error("Failed to load transaction logs:", err);
      if (err.response?.status === 401) onLogout();
    } finally {
      if (requestId === logsRequestSeq.current) {
        setIsLogsLoading(false);
      }
    }
  }, [selectedClient, onLogout]);

  useEffect(() => {
    if (view !== 'dashboard' && view !== 'audit-logs') return;
    if (view === 'audit-logs' && rangeVerifyResult?.results?.length) return;

    fetchTransactionLogs({
      page: view === 'dashboard' ? 1 : currentPage,
      pageSize: view === 'dashboard' ? 200 : rowsPerPage,
      fromDate: filterDateFrom,
      toDate: filterDateTo,
      activeSort: sortOrder,
      activeTable: filterTable
    });
  }, [view, fetchTransactionLogs, currentPage, rowsPerPage, filterDateFrom, filterDateTo, sortOrder, filterTable, rangeVerifyResult]);

  // Fetch summary stats only. The transaction table is loaded on demand.
  useEffect(() => {
    let cancelled = false;

    const fetchSummaryStats = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;

      try {
        const params = selectedClient ? { client_id: selectedClient } : {};
        const statsRes = await api.get('/dashboard/stats', { params });
        if (cancelled) return;

        setStats(prev => areStatsEqual(prev, statsRes.data) ? prev : statsRes.data);

      } catch (err) {
        if (err.response?.status === 401) onLogout();
      }
    };

    fetchSummaryStats();
    const id = setInterval(fetchSummaryStats, 5000);
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchSummaryStats();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onLogout, selectedClient]);

  // Fetch daftar nama tabel (Sekali saat mount / client berubah — bukan polling)
  useEffect(() => {
    const fetchTableNames = async () => {
      try {
        const params = selectedClient ? { client_id: selectedClient } : {};
        const res = await api.get('/dashboard/inventory', { params });
        const tables = (res.data || []).map(t => t.table_name).filter(Boolean).sort();
        setTableNames(tables);
      } catch (err) {
        console.error("Failed to load table names:", err);
      }
    };
    fetchTableNames();
  }, [selectedClient]);



  const handleSortOrderChange = (newSort) => {
    setSortOrder(newSort);
    setCurrentPage(1);
  };

  const handleFilterTableChange = (newTable) => {
    setFilterTable(newTable);
    setCurrentPage(1);
  };

  const handleFilterActionChange = (newAction) => {
    setFilterAction(newAction);
    setCurrentPage(1);
  };

  const handleFilterVerificationChange = (newVerification) => {
    setFilterVerification(newVerification);
    setCurrentPage(1);
  };

  // Auto-trigger logs fetch ketika kedua tanggal (From & To) dipilih.
  useEffect(() => {
    if (tempDateFrom && tempDateTo) {
      setFilterDateFrom(tempDateFrom);
      setFilterDateTo(tempDateTo);
      setCurrentPage(1);
    }
  }, [tempDateFrom, tempDateTo]);

  const handleApplyLogsRange = useCallback((fromDate, toDate) => {
    const fromVal = fromDate || tempDateFrom;
    const toVal = toDate || tempDateTo;
    if (!fromVal || !toVal) return;
    setRangeVerifyResult(null);
    setFilterDateFrom(fromVal);
    setFilterDateTo(toVal);
    setCurrentPage(1);
  }, [tempDateFrom, tempDateTo]);

  // Clear Range handler
  const handleClearRange = useCallback(() => {
    setTempDateFrom('');
    setTempDateTo('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setRangeVerifyResult(null);
    setFilterVerification('ALL');
    setSortOrder('desc');
    setCurrentPage(1);
  }, []);

  // Verifikasi satu log SECARA ON-DEMAND
  const handleVerifyLog = useCallback((logId) => {
    setVerifyStatuses(prev => ({
      ...prev,
      [logId]: { status: 'loading' }
    }));

    const params = selectedClient ? { client_id: selectedClient } : {};

    api.get(`/dashboard/verify/${logId}`, { params })
      .then(res => {
        setVerifyStatuses(prev => ({ ...prev, [logId]: res.data }));
        setSelectedVerifyResult(res.data);
      })
      .catch(err => {
        const data = err.response?.data || { status: 'failed', message: 'Failed to contact verification server.' };
        setVerifyStatuses(prev => ({ ...prev, [logId]: data }));
        setSelectedVerifyResult(data);
      });
  }, [selectedClient]);

  // Verify range using backend API — Integrated into Main Table (Opsi A)
  const handleVerifyRange = useCallback(async () => {
    if (!filterDateFrom || !filterDateTo) return;
    setIsVerifyRangeLoading(true);
    try {
      const fromISO = new Date(filterDateFrom).toISOString();
      const toISO = new Date(filterDateTo).toISOString();

      const params = {
        from: fromISO,
        to: toISO
      };
      if (selectedClient) {
        params.client_id = selectedClient;
      }

      const res = await api.get('/dashboard/verify-range', { params });
      const results = res.data.results || [];
      let rangeLogs = [];

      try {
        rangeLogs = await fetchAllLogsForRange({ fromISO, toISO, selectedClient });
      } catch (logsErr) {
        console.error("Failed to hydrate range inspection logs:", logsErr);
      }

      const rangeLogsById = new Map(rangeLogs.map(log => [log.log_id, log]));
      const hydratedResults = results.map(item => ({
        ...item,
        log: item.log || item.audit_log || rangeLogsById.get(item.log_id) || null,
      }));

      setVerifyStatuses(prev => {
        const next = { ...prev };
        hydratedResults.forEach(item => {
          next[item.log_id] = mapRangeItemToVerifyStatus(item);
        });
        return next;
      });

      setRangeVerifyResult({
        range: { from: filterDateFrom, to: filterDateTo },
        summary: res.data.summary || {
          total: hydratedResults.length,
          valid: hydratedResults.filter(r => r.verify_status === 'success' || r.verify_status === 'valid').length,
          invalid: hydratedResults.filter(r => ['tampered', 'failed_local', 'failed_onchain', 'failed', 'error', 'unreachable'].includes(r.verify_status)).length,
          pending: hydratedResults.filter(r => r.verify_status === 'pending').length
        },
        results: hydratedResults
      });
      setCurrentPage(1);
    } catch (err) {
      console.error("Failed to verify range:", err);
      setRangeVerifyResult({
        range: { from: filterDateFrom, to: filterDateTo },
        summary: { total: 0, valid: 0, invalid: 0, pending: 0 },
        results: [],
        status: 'failed_local',
        message: err.response?.data?.error || 'Connection error while verifying log range.'
      });
    } finally {
      setIsVerifyRangeLoading(false);
    }
  }, [filterDateFrom, filterDateTo, selectedClient]);



  // Filter & pagination
  const rangeInspectionLogs = useMemo(() => {
    if (!rangeVerifyResult?.results?.length) return [];

    const recentById = new Map(recentLogs.map(log => [log.log_id, log]));
    return rangeVerifyResult.results
      .map(item => buildRangeInspectionLog(item, recentById.get(item?.log_id)))
      .filter(log => log?.log_id);
  }, [rangeVerifyResult, recentLogs]);

  const isRangeInspectionMode = rangeInspectionLogs.length > 0;

  const filteredLogs = useMemo(() => {
    const normalizedSearch = deferredSearchQuery.trim().toLowerCase();
    const activeFrom = filterDateFrom || tempDateFrom;
    const activeTo = filterDateTo || tempDateTo;
    const fromTime = activeFrom ? new Date(activeFrom).getTime() : NaN;
    let toTime = NaN;

    if (activeTo) {
      const toObj = new Date(activeTo);
      toObj.setSeconds(59, 999);
      toTime = toObj.getTime();
    }

    const sourceLogs = isRangeInspectionMode ? rangeInspectionLogs : recentLogs;
    const list = sourceLogs.filter(log => {
      const matchSearch = !normalizedSearch || [
        log?.source_table || log?.resource || '',
        log?.actor || '',
        log?.source_system || '',
        typeof log?.metadata === 'string' ? log.metadata : JSON.stringify(log?.metadata || ''),
        log?.hash_value || ''
      ].some(value => String(value).toLowerCase().includes(normalizedSearch));

      const matchAction = filterAction === 'ALL' || log?.action === filterAction;

      let matchDate = true;
      if (log?.timestamp) {
        const logTime = getLogTimestampMs(log.timestamp);

        if (!isNaN(logTime)) {
          if (!isNaN(fromTime) && logTime < fromTime) matchDate = false;
          if (!isNaN(toTime) && logTime > toTime) matchDate = false;
        }
      } else if (!isRangeInspectionMode && (filterDateFrom || filterDateTo || tempDateFrom || tempDateTo)) {
        matchDate = false;
      }

      // Verification status filter (Dropdown: ALL | VALID | INVALID)
      let matchVerification = true;
      if (filterVerification !== 'ALL') {
        matchVerification = getVerificationBucket(log, verifyStatuses) === filterVerification;
      }

      return matchSearch && matchAction && matchDate && matchVerification;
    });

    // Urutkan data secara aman berdasarkan sortOrder:
    // 'desc' (Newest First) -> Dari TO ke FROM (timestamp terbaru ke terlama)
    // 'asc'  (Oldest First) -> Dari FROM ke TO (timestamp terlama ke terbaru)
    return list.sort((a, b) => {
      const timeA = getLogTimestampMs(a?.timestamp);
      const timeB = getLogTimestampMs(b?.timestamp);

      if (sortOrder === 'asc') {
        return timeA - timeB;
      }
      return timeB - timeA;
    });
  }, [recentLogs, rangeInspectionLogs, isRangeInspectionMode, deferredSearchQuery, filterAction, filterDateFrom, filterDateTo, tempDateFrom, tempDateTo, filterVerification, verifyStatuses, sortOrder]);
  const totalPages = isRangeInspectionMode
    ? (Math.ceil(filteredLogs.length / rowsPerPage) || 1)
    : (Math.ceil(totalLogsCount / rowsPerPage) || 1);
  const paginatedLogs = isRangeInspectionMode
    ? filteredLogs.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
    : filteredLogs;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const hasLocalFilter = searchQuery || filterAction !== 'ALL' || filterVerification !== 'ALL';
  const displayTotal = isRangeInspectionMode ? filteredLogs.length : (hasLocalFilter ? filteredLogs.length : totalLogsCount);
  const workspaceName = clientInfo?.company_name || adminClients.find(c => c.id === clientInfo?.client_id)?.company_name || 'Client Workspace';
  const latestActivity = recentLogs[0];
  const profileStats = [
    { label: 'Total Logs', value: stats.total_logs || 0, icon: 'database', tone: 'blue' },
    { label: 'Anchored', value: stats.anchored_logs || 0, icon: 'checkCircle', tone: 'teal' },
    { label: 'Pending', value: stats.pending_logs || 0, icon: 'clock', tone: 'amber' },
  ];
  const accessItems = [
    { label: 'Dashboard', description: 'Ringkasan integritas data dan status gateway', icon: 'dashboard' },
    { label: 'Audit Logs', description: 'Investigasi transaksi, hash, dan hasil verifikasi', icon: 'history' },
    { label: 'Web Users', description: 'Melihat akun aplikasi yang tercatat di workspace', icon: 'users' },
  ];

  // Status badge for transaction table
  const renderStatusBadge = useCallback((log) => {
    if (!log || !log.log_id || !log.hash_value) {
      return (
        <span className="ac-status ac-status--invalid">
          <Icon name="xCircle" size={12} />
          INVALID
        </span>
      );
    }
    const v = verifyStatuses[log.log_id];

    if (!v) {
      return (
        <button
          className="ac-btn-ghost"
          style={{ padding: '4px 10px', fontSize: '11px' }}
          onClick={(e) => { e.stopPropagation(); handleVerifyLog(log.log_id); }}
        >
          <Icon name="search" size={12} />
          Verify
        </button>
      );
    }

    if (v.status === 'loading')
      return (
        <span className="ac-status ac-status--checking">
          <Icon name="spinner" size={12} />
          Memeriksa...
        </span>
      );
    if (v.status === 'success' || v.status === 'valid')
      return (
        <span className="ac-status ac-status--valid" onClick={() => setSelectedVerifyResult(v)}>
          <Icon name="checkCircle" size={12} />
          VALID
        </span>
      );
    if (v.status === 'pending')
      return (
        <span className="ac-status ac-status--pending" onClick={() => setSelectedVerifyResult(v)}>
          <Icon name="clock" size={12} />
          PENDING
        </span>
      );
    return (
      <span className="ac-status ac-status--invalid" onClick={() => setSelectedVerifyResult(v)}>
        <Icon name="xCircle" size={12} />
        INVALID
      </span>
    );
  }, [handleVerifyLog, verifyStatuses]);


  // Pagination page numbers
  const renderPageNumbers = useCallback(() => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  const isMobileSidebar = typeof window !== 'undefined' && window.innerWidth <= 768;
  const isSidebarPreviewOpen = !isMobileSidebar && sidebarCollapsed && sidebarHoverOpen;

  const handleSidebarModeToggle = useCallback(() => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(o => !o);
      return;
    }

    setSidebarHoverOpen(false);
    setSidebarCollapsed(collapsed => !collapsed);
  }, []);

  return (
    <div className={`ac-shell ac-shell--user${sidebarCollapsed ? ' ac-shell--sidebar-collapsed' : ''}${isSidebarPreviewOpen ? ' ac-shell--sidebar-hover-open' : ''}`}>
      {/* ======= TOP NAV ======= */}
      <header className="ac-topnav">
        <div className="ac-topnav__brand">
          <img src="/logo/logo-with-background.png" alt="Auditchain Logo" style={{ height: 38, width: 'auto', display: 'block', flexShrink: 0, borderRadius: 6 }} />
          <div>
            <div className="ac-topnav__brand-name">Auditchain Gateway</div>
            <div className="ac-topnav__brand-sub">Gateway Portal</div>
          </div>
        </div>
        <div className="ac-topnav__right">
          {clientInfo && clientInfo.role?.toLowerCase() === 'admin' ? (
            <select
              value={selectedClient}
              onChange={e => {
                setSelectedClient(e.target.value);
                setCurrentPage(1);
              }}
              className="ac-topnav__client-select"
              style={{
                background: 'rgba(3,40,93,0.05)',
                border: '1px solid rgba(3,40,93,0.1)',
                color: '#03285D',
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                fontWeight: '700',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value={clientInfo.client_id}>
                {clientInfo.client_id} (Admin Default)
              </option>
              {adminClients.length === 0 ? (
                <>
                  <option value="ed067ad4-e549-4baa-9c9d-3d27ff24194d">
                    SIMRS Dummy 2 (ed067ad4-e549-4baa-9c9d-3d27ff24194d)
                  </option>
                  <option value="7f2bc265-d419-48fe-9892-d6ef198751e1">
                    Satu Peta Debezium (7f2bc265-d419-48fe-9892-d6ef198751e1)
                  </option>
                </>
              ) : (
                adminClients.map(client => {
                  if (client.id === clientInfo.client_id) return null;
                  return (
                    <option key={client.id} value={client.id}>
                      {client.company_name || 'Klien'} ({client.id})
                    </option>
                  );
                })
              )}
            </select>
          ) : null}
          {clientInfo && (
            <div className="ac-profile-menu">
              <button
                className={`ac-topnav__profile-btn${view === 'profile' ? ' ac-topnav__profile-btn--active' : ''}`}
                onClick={() => setProfileMenuOpen(open => !open)}
                title="Open user menu"
              >
                <span className="ac-topnav__avatar ac-topnav__avatar--compact">{initials}</span>
                <span className="ac-topnav__profile-copy">
                  <span className="ac-topnav__user-name">{displayName}</span>
                  <span className="ac-topnav__user-role">{clientInfo.role || 'Auditor'}</span>
                </span>
                <Icon name="chevronDown" size={14} />
              </button>
              {profileMenuOpen && (
                <div className="ac-profile-menu__panel">
                  <button onClick={() => { setProfileMenuOpen(false); navigate('/profile'); }}>
                    <Icon name="user" size={15} />
                    Profile
                  </button>
                  <AppearanceMenu
                    themePreference={themePreference}
                    resolvedTheme={resolvedTheme}
                    onThemeChange={onThemeChange}
                  />
                  <button onClick={onLogout} className="ac-profile-menu__danger">
                    <Icon name="logout" size={15} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ======= SIDEBAR ======= */}
      <aside
        className={`ac-sidebar${sidebarOpen ? ' ac-sidebar--open' : ''}${isSidebarPreviewOpen ? ' ac-sidebar--hover-open' : ''}`}
        onMouseEnter={() => {
          if (window.innerWidth > 768 && sidebarCollapsed) setSidebarHoverOpen(true);
        }}
        onMouseLeave={() => {
          if (window.innerWidth > 768 && sidebarCollapsed) setSidebarHoverOpen(false);
        }}
      >
        <div className="ac-sidebar__header">
          <div className="ac-sidebar__header-main">
            <img className="ac-sidebar__compact-logo" src="/logo/Mask group.png" alt="AG" />
            <div className="ac-sidebar__header-copy">
              <div className="ac-sidebar__section-label">Gateway Portal</div>
              <div className="ac-sidebar__section-sub">Secure Data Integrity</div>
            </div>
          </div>
        </div>
        <nav className="ac-sidebar__nav">
          <button
            className={`ac-sidebar__nav-item${view === 'dashboard' ? ' ac-sidebar__nav-item--active' : ''}`}
            onClick={() => { navigate('/dashboard'); setSidebarOpen(false); }}
            title="Dashboard"
          >
            <Icon name="dashboard" size={18} />
            <span className="ac-sidebar__nav-label">Dashboard</span>
          </button>

          <button
            className={`ac-sidebar__nav-item${view === 'audit-logs' ? ' ac-sidebar__nav-item--active' : ''}`}
            onClick={() => { navigate('/audit-logs'); setSidebarOpen(false); }}
            title="Audit Logs"
          >
            <Icon name="history" size={18} />
            <span className="ac-sidebar__nav-label">Audit Logs</span>
          </button>

          <button
            className={`ac-sidebar__nav-item${view === 'web-users' ? ' ac-sidebar__nav-item--active' : ''}`}
            onClick={() => { navigate('/web-users'); setSidebarOpen(false); }}
            title="Web Users"
          >
            <Icon name="user" size={18} />
            <span className="ac-sidebar__nav-label">Web Users</span>
          </button>

          <button
            className={`ac-sidebar__nav-item${view === 'reports' ? ' ac-sidebar__nav-item--active' : ''}`}
            onClick={() => { navigate('/reports'); setSidebarOpen(false); }}
            title="Reports"
          >
            <Icon name="fileText" size={18} />
            <span className="ac-sidebar__nav-label">Reports</span>
          </button>

          {clientInfo && clientInfo.role?.toLowerCase() === 'admin' && (
            <button
              className="ac-sidebar__nav-item"
              onClick={() => navigate('/admin')}
              style={{ marginTop: 4 }}
              title="Admin Panel"
            >
              <Icon name="shield" size={18} />
              <span className="ac-sidebar__nav-label">Admin Panel</span>
            </button>
          )}
        </nav>
        <div className="ac-sidebar__footer">
          {clientInfo && (
            <div className="ac-sidebar__identity-card">
              <div className="ac-sidebar__identity-user">
                <span className="ac-sidebar__identity-avatar">
                  {initials}
                </span>
                <div className="ac-sidebar__identity-details">
                  <span className="ac-sidebar__identity-name" title={displayName}>
                    {displayName}
                  </span>
                  <span className="ac-sidebar__identity-role">
                    {clientInfo.role}
                  </span>
                </div>
              </div>
              {clientInfo.role?.toLowerCase() === 'admin' && (
                <div className="ac-sidebar__identity-client">
                  <Icon name="database" size={14} />
                  <span className="ac-sidebar__identity-workspace">
                    <strong>{adminClients.find(c => c.id === clientInfo.client_id)?.company_name || clientInfo.company_name || 'Client Workspace'}</strong>
                    <small title={clientInfo.client_id}>{clientInfo.client_id}</small>
                  </span>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            className={`ac-sidebar__mode-toggle${!sidebarCollapsed ? ' ac-sidebar__mode-toggle--pinned' : ''}`}
            onClick={handleSidebarModeToggle}
            title={sidebarCollapsed ? 'Pin sidebar open' : 'Use auto-collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Pin sidebar open' : 'Use auto-collapse sidebar'}
          >
            <Icon name="sidebarPanel" size={17} />
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 35, background: 'rgba(0,0,0,0.3)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ======= MAIN CONTENT ======= */}
      <main className="ac-main">
        <div className="ac-main__container">



          {view === 'profile' ? (
            <section className="ac-profile-page">
              <div className="ac-profile-hero">
                <div className="ac-profile-hero__identity">
                  <span className="ac-profile-hero__avatar">{initials}</span>
                  <div>
                    <span className="ac-page-kicker">Account Center</span>
                    <h1>{displayName}</h1>
                    <p>Kelola identitas, keamanan, dan akses workspace Auditchain Gateway.</p>
                  </div>
                </div>
                <div className="ac-profile-hero__meta">
                  <span className="ac-status ac-status--valid">
                    <Icon name="checkCircle" size={13} />
                    Active Session
                  </span>
                  <span>{workspaceName}</span>
                </div>
              </div>

              <div className="ac-profile-stat-grid">
                {profileStats.map(item => (
                  <div className={`ac-profile-stat ac-profile-stat--${item.tone}`} key={item.label}>
                    <span className="ac-profile-stat__icon">
                      <Icon name={item.icon} size={18} />
                    </span>
                    <div>
                      <strong>{item.value.toLocaleString('id-ID')}</strong>
                      <span>{item.label}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ac-profile-layout">
                <form className="ac-profile-card ac-profile-form" onSubmit={handleProfileSubmit}>
                  <div className="ac-profile-card__header">
                    <div>
                      <h2>Profile Details</h2>
                      <p>Update display name, username, and password.</p>
                    </div>
                    <span className="ac-profile-card__icon">
                      <Icon name="user" size={18} />
                    </span>
                  </div>

                  {profileLoading ? (
                    <div className="ac-profile-loading">
                      <Icon name="spinner" size={18} />
                      Loading profile...
                    </div>
                  ) : (
                    <>
                      {profileError && <div className="ac-profile-alert ac-profile-alert--error">{profileError}</div>}
                      {profileSuccess && <div className="ac-profile-alert ac-profile-alert--success">{profileSuccess}</div>}

                      <label className="ac-form-field">
                        <span className="ac-form-label">Full Name</span>
                        <input
                          className="ac-form-input ac-form-input--lg"
                          value={profileForm.full_name}
                          onChange={e => setProfileForm(form => ({ ...form, full_name: e.target.value }))}
                          placeholder="Your display name"
                        />
                      </label>

                      <label className="ac-form-field">
                        <span className="ac-form-label">Username</span>
                        <input
                          className="ac-form-input ac-form-input--lg"
                          value={profileForm.username}
                          onChange={e => setProfileForm(form => ({ ...form, username: e.target.value }))}
                          placeholder="Username"
                          required
                          minLength={4}
                        />
                      </label>

                      <div className="ac-profile-password-grid">
                        <label className="ac-form-field">
                          <span className="ac-form-label">Current Password</span>
                          <input
                            className="ac-form-input ac-form-input--lg"
                            type="password"
                            value={profileForm.current_password}
                            onChange={e => setProfileForm(form => ({ ...form, current_password: e.target.value }))}
                            placeholder="Required for password change"
                          />
                        </label>

                        <label className="ac-form-field">
                          <span className="ac-form-label">New Password</span>
                          <input
                            className="ac-form-input ac-form-input--lg"
                            type="password"
                            value={profileForm.new_password}
                            onChange={e => setProfileForm(form => ({ ...form, new_password: e.target.value }))}
                            placeholder="Minimum 6 characters"
                          />
                        </label>
                      </div>

                      <label className="ac-form-field">
                        <span className="ac-form-label">Confirm New Password</span>
                        <input
                          className="ac-form-input ac-form-input--lg"
                          type="password"
                          value={profileForm.confirm_password}
                          onChange={e => setProfileForm(form => ({ ...form, confirm_password: e.target.value }))}
                          placeholder="Repeat new password"
                        />
                      </label>

                      <div className="ac-profile-actions">
                        <button type="button" className="ac-btn-ghost-action" onClick={() => navigate('/dashboard')}>
                          Back to Dashboard
                        </button>
                        <button type="submit" className="ac-btn-primary" disabled={profileSaving}>
                          <Icon name={profileSaving ? 'spinner' : 'checkmark'} size={15} />
                          {profileSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </>
                  )}
                </form>

                <aside className="ac-profile-card ac-profile-summary">
                  <div className="ac-profile-card__header">
                    <div>
                      <h2>Workspace</h2>
                      <p>Identitas sesi yang terhubung dengan akun ini.</p>
                    </div>
                    <span className="ac-profile-card__icon ac-profile-card__icon--teal">
                      <Icon name="shield" size={18} />
                    </span>
                  </div>
                  <div className="ac-profile-summary__row">
                    <span>Role</span>
                    <strong>{clientInfo?.role || 'Auditor'}</strong>
                  </div>
                  <div className="ac-profile-summary__row">
                    <span>Client ID</span>
                    <code>{clientInfo?.client_id || '-'}</code>
                  </div>
                  <div className="ac-profile-summary__row">
                    <span>Company</span>
                    <strong>{workspaceName}</strong>
                  </div>
                  <div className="ac-profile-summary__row">
                    <span>Username</span>
                    <strong>{profileForm.username || clientInfo?.username || '-'}</strong>
                  </div>
                  <div className="ac-profile-summary__row">
                    <span>Security</span>
                    <strong>Password protected</strong>
                  </div>
                </aside>
              </div>

              <div className="ac-profile-secondary-grid">
                <div className="ac-profile-card ac-profile-access-card">
                  <div className="ac-profile-card__header">
                    <div>
                      <h2>Akses Portal</h2>
                      <p>Menu yang tersedia untuk role kamu.</p>
                    </div>
                    <span className="ac-profile-card__icon">
                      <Icon name="key" size={18} />
                    </span>
                  </div>
                  <div className="ac-profile-access-list">
                    {accessItems.map(item => (
                      <div className="ac-profile-access-item" key={item.label}>
                        <span>
                          <Icon name={item.icon} size={16} />
                        </span>
                        <div>
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ac-profile-card ac-profile-settings-card">
                  <div className="ac-profile-card__header">
                    <div>
                      <h2>Preferensi</h2>
                      <p>Pengaturan ringan untuk pengalaman kerja harian.</p>
                    </div>
                    <span className="ac-profile-card__icon ac-profile-card__icon--teal">
                      <Icon name="settings" size={18} />
                    </span>
                  </div>
                  <label className="ac-profile-toggle-row">
                    <input type="checkbox" defaultChecked />
                    <span>
                      <strong>Email Alerts</strong>
                      <small>Notifikasi saat ada audit log yang perlu ditinjau.</small>
                    </span>
                  </label>
                  <label className="ac-profile-toggle-row">
                    <input type="checkbox" defaultChecked={resolvedTheme === 'dark'} readOnly />
                    <span>
                      <strong>Appearance</strong>
                      <small>{themePreference === 'system' ? 'Following system theme' : `${resolvedTheme} mode`}</small>
                    </span>
                  </label>
                </div>

                <div className="ac-profile-card ac-profile-activity-card">
                  <div className="ac-profile-card__header">
                    <div>
                      <h2>Aktivitas Terakhir</h2>
                      <p>Audit event terbaru dari workspace aktif.</p>
                    </div>
                    <span className="ac-profile-card__icon">
                      <Icon name="activity" size={18} />
                    </span>
                  </div>
                  {latestActivity ? (
                    <div className="ac-profile-activity">
                      <strong>{latestActivity.action || 'Audit event'}</strong>
                      <span>{latestActivity.resource || latestActivity.source_table || 'Gateway resource'}</span>
                      <code>{latestActivity.timestamp || 'Timestamp unavailable'}</code>
                    </div>
                  ) : (
                    <div className="ac-profile-activity ac-profile-activity--empty">
                      Belum ada aktivitas terbaru yang bisa ditampilkan.
                    </div>
                  )}
                </div>
              </div>
            </section>
          ) : view === 'web-users' ? (
            <WebUsersView onLogout={onLogout} />
          ) : view === 'reports' ? (
            <ReportsView />
          ) : view === 'audit-logs' ? (
            <AuditLogsView
              paginatedLogs={paginatedLogs}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filterAction={filterAction}
              setFilterAction={handleFilterActionChange}
              filterVerification={filterVerification}
              setFilterVerification={handleFilterVerificationChange}
              sortOrder={sortOrder}
              setSortOrder={handleSortOrderChange}
              filterTable={filterTable}
              setFilterTable={handleFilterTableChange}
              tableNames={tableNames}
              rowsPerPage={rowsPerPage}
              setRowsPerPage={setRowsPerPage}
              tempDateFrom={tempDateFrom}
              setTempDateFrom={setTempDateFrom}
              tempDateTo={tempDateTo}
              setTempDateTo={setTempDateTo}
              filterDateFrom={filterDateFrom}
              filterDateTo={filterDateTo}
              setFilterDateFrom={setFilterDateFrom}
              setFilterDateTo={setFilterDateTo}
              handleApplyLogsRange={handleApplyLogsRange}
              handleClearRange={handleClearRange}
              isLogsLoading={isLogsLoading}
              handleVerifyRange={handleVerifyRange}
              rangeVerifyResult={rangeVerifyResult}
              setRangeVerifyResult={setRangeVerifyResult}
              isVerifyRangeLoading={isVerifyRangeLoading}
              selectedVerifyResult={selectedVerifyResult}
              setSelectedVerifyResult={setSelectedVerifyResult}
              onSelectResource={setSelectedLog}
              renderStatusBadge={renderStatusBadge}
              displayTotal={displayTotal}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalPages={totalPages}
              renderPageNumbers={renderPageNumbers}
              stats={stats}
            />
          ) : (
          <>
            {/* Hero Section */}
            <section className="ac-hero">
              <div className="ac-hero__pattern" />
              <div className="ac-hero__content">
                <div className="ac-hero__left">
                  <h1 className="ac-hero__title">
                    🛡️ Auditchain Gateway Dashboard
                  </h1>
                  <p className="ac-hero__subtitle">
                    Monitor audit logs and verify blockchain transactions in real-time.
                    Ensure the highest data integrity across the database infrastructure network.
                  </p>
                </div>
              </div>
            </section>

            <AuditDashboardOverview
              stats={stats}
              selectedClient={selectedClient}
              onOpenAuditLogs={() => navigate('/audit-logs')}
            />

          </>
          )}

        </div>
      </main>

      {/* MODAL LEVEL 2: Resource Log History */}
      {selectedLog && (
        <ResourceDetailModal
          log={selectedLog}
          selectedClient={selectedClient}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}

export { DashboardPage };
export default DashboardPage;

