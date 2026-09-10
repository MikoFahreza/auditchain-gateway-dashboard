import React from 'react';
import api from '../../api';
import Icon from '../common/Icon';
import ActionBadge from '../common/ActionBadge';

const TABS = ['All Users', 'Recently Seen', 'Needs Identity'];
const SORT_OPTIONS = ['Newest First', 'Oldest First', 'Name A-Z'];
const PAGE_SIZE_OPTIONS = [8, 16, 32];

const getInitials = (name = '') => (
  String(name || 'U')
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()
);

const getStatusLabel = (status = '') => {
  const labels = {
    detected: 'Detected',
    recent: 'Recent',
    needs_identity: 'Needs Identity'
  };
  return labels[status] || 'Detected';
};

const getActivityStatusLabel = (status = '') => {
  const labels = {
    success: 'Success',
    pending: 'Pending',
    issue: 'Needs Review',
    inactive: 'No Activity'
  };
  return labels[status] || 'No Activity';
};

const getTimestampMs = (timestamp) => {
  if (!timestamp) return 0;
  let tsStr = String(timestamp);
  if (tsStr.includes(' ') && !tsStr.includes('T')) {
    tsStr = tsStr.replace(' ', 'T');
  }
  return new Date(tsStr).getTime() || 0;
};

const formatDateTime = (timestamp) => {
  const time = getTimestampMs(timestamp);
  if (!time) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(time));
};

const formatAbsoluteDateTime = (timestamp) => {
  const time = getTimestampMs(timestamp);
  if (!time) return 'Not available';

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(new Date(time));
};

const formatRelativeTime = (timestamp) => {
  const time = getTimestampMs(timestamp);
  if (!time) return 'Not refreshed yet';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSeconds < 10) return 'Updated just now';
  if (diffSeconds < 60) return `Updated ${diffSeconds} seconds ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `Updated ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Updated ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `Updated ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

const parseRawData = (rawData) => {
  if (!rawData) return {};
  if (typeof rawData === 'object') return rawData;
  try {
    return JSON.parse(rawData);
  } catch (error) {
    return {};
  }
};

const pickFirst = (...values) => values.find(value => value !== undefined && value !== null && String(value).trim() !== '');

const hasDisplayValue = (value) => value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== '-';

const truncateMiddle = (value = '', maxLength = 26) => {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  const edge = Math.max(6, Math.floor((maxLength - 3) / 2));
  return `${text.slice(0, edge)}...${text.slice(-edge)}`;
};

const isTechnicalIdentifier = (value) => {
  if (!value) return false;
  const str = String(value);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const atUuidRegex = /^@[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const longHashRegex = /^[0-9a-fA-F]{30,}$/;
  return uuidRegex.test(str) || atUuidRegex.test(str) || longHashRegex.test(str);
};

const getEmailLocalPart = (email) => {
  if (!email || email === '-') return null;
  return email.split('@')[0];
};

const getDisplayUsername = ({ rawUsername, email, fullName, fallbackIndex }) => {
  if (rawUsername && !isTechnicalIdentifier(rawUsername)) {
    return rawUsername;
  }
  const emailLocalPart = getEmailLocalPart(email);
  if (emailLocalPart && !isTechnicalIdentifier(emailLocalPart)) {
    return emailLocalPart;
  }
  if (fullName && !isTechnicalIdentifier(fullName)) {
    return fullName;
  }
  return `user-${fallbackIndex}`;
};

const normalizeUser = (user, index) => {
  const raw = parseRawData(user.raw_data || user.rawData || user.metadata);
  const rawUsernameCandidate = pickFirst(user.username, raw.username, raw.user_name, raw.login, raw.userid, raw.user_id);
  const email = pickFirst(user.email, raw.email, raw.mail, raw.email_address, '-');
  const rawFullNameCandidate = pickFirst(user.full_name, user.fullName, user.name, raw.full_name, raw.fullName, raw.name, raw.nama);
  
  const username = getDisplayUsername({
    rawUsername: rawUsernameCandidate,
    email,
    fullName: rawFullNameCandidate,
    fallbackIndex: index + 1
  });
  
  const fullName = rawFullNameCandidate || username;
  const role = pickFirst(user.role, raw.role, raw.roles, raw.user_role, raw.jabatan, 'Client User');
  const sourceTable = pickFirst(user.source_table, user.sourceTable, raw.source_table, raw.table_name, '-');
  const lastSeenAt = pickFirst(user.last_seen_at, user.lastSeenAt, user.updated_at, user.updatedAt, user.created_at, user.createdAt);
  const status = (!fullName || fullName === username || email === '-') ? 'needs_identity' : 'detected';
  const rawEntries = Object.entries(raw)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');
  const rawSummary = rawEntries.slice(0, 3).map(([key, value]) => `${key}: ${value}`).join(', ');

  const technicalUserId = (rawUsernameCandidate && isTechnicalIdentifier(rawUsernameCandidate)) ? rawUsernameCandidate : null;

  return {
    id: pickFirst(user.id, user.user_id, user.userId, `${username}-${index}`),
    username,
    technicalUserId,
    email,
    fullName,
    role,
    sourceTable,
    lastSeenAt,
    status: status === 'detected' && getTimestampMs(lastSeenAt) > Date.now() - (24 * 60 * 60 * 1000) ? 'recent' : status,
    raw,
    rawEntries,
    rawSummary
  };
};

const normalizeAction = (action = '') => {
  const normalized = String(action || '').trim().toUpperCase();
  if (!normalized) return '-';
  if (normalized.includes('LOGIN') || normalized.includes('SIGN_IN')) return 'LOGIN';
  if (normalized.includes('LOGOUT') || normalized.includes('SIGN_OUT')) return 'LOGOUT';
  return normalized;
};

const getActivityStatus = (log) => {
  if (!log) return 'inactive';
  const integrity = String(log.integrity_status || '').toLowerCase();
  const status = String(log.status || '').toLowerCase();

  if (['tampered', 'invalid', 'failed', 'error'].some(value => integrity.includes(value) || status.includes(value))) {
    return 'issue';
  }
  if (['pending', 'received', 'not_checked'].some(value => integrity.includes(value) || status.includes(value))) {
    return 'pending';
  }
  return 'success';
};

const getSessionStatus = (latestActivity) => {
  if (!latestActivity) return 'inactive';
  
  const action = String(latestActivity.action || '').toUpperCase();
  const timeDiff = Date.now() - getTimestampMs(latestActivity.timestamp);
  
  if (action === 'LOGOUT' || action === 'SIGN_OUT') return 'offline';
  
  // If LOGIN or any other activity (INSERT, UPDATE) within the last 30 minutes, consider them Online.
  if (timeDiff < 30 * 60 * 1000) {
    return 'online';
  }
  
  return 'offline';
};

const normalizeLog = (log) => {
  const payload = log.audit_log || log.AuditLog || log;
  const action = normalizeAction(pickFirst(payload.action, log.action));
  const timestamp = pickFirst(payload.timestamp, log.timestamp, payload.db_timestamp, log.db_timestamp);

  return {
    logId: pickFirst(payload.log_id, log.log_id, payload.id, log.id, '-'),
    actor: pickFirst(payload.actor, log.actor, '-'),
    action,
    rawAction: pickFirst(payload.action, log.action, action),
    resource: pickFirst(payload.source_table, log.source_table, payload.resource, log.resource, '-'),
    timestamp,
    status: pickFirst(payload.status, log.status, '-'),
    integrityStatus: pickFirst(log.integrity_status, payload.integrity_status, '-'),
    metadata: pickFirst(payload.metadata, log.metadata, '')
  };
};

const getLogsPayload = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getActorKeys = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text || text === '-') return [];
  const keys = [text];
  if (text.startsWith('@')) keys.push(text.slice(1));
  return keys;
};

const buildActivityMap = (logs) => {
  const map = new Map();
  logs.map(normalizeLog).forEach(log => {
    getActorKeys(log.actor).forEach(key => {
      const existing = map.get(key);
      if (!existing || getTimestampMs(log.timestamp) > getTimestampMs(existing.timestamp)) {
        map.set(key, log);
      }
    });
  });
  return map;
};

const attachLatestActivities = (users, activityMap) => users.map(user => {
  const keys = [
    ...getActorKeys(user.username),
    ...(user.technicalUserId ? getActorKeys(user.technicalUserId) : []),
    ...getActorKeys(user.email),
    ...getActorKeys(user.fullName)
  ];
  const latestActivity = keys.map(key => activityMap.get(key)).find(Boolean) || null;
  const actionTime = latestActivity?.timestamp || user.lastSeenAt;
  const behaviorStatus = getActivityStatus(latestActivity);
  const sessionStatus = getSessionStatus(latestActivity);

  return {
    ...user,
    latestActivity,
    actionTime,
    behaviorStatus,
    sessionStatus
  };
});

const getUsersPayload = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  console.warn('Unexpected /dashboard/my-users response shape:', data);
  return [];
};

const getWebUsersError = (err) => {
  if (!err.response) {
    return {
      title: 'Backend cannot be reached',
      body: 'Check the network connection or API base URL, then try again.'
    };
  }

  const status = err.response.status;
  if (status === 403) {
    return {
      title: 'Access denied',
      body: 'Your account is not allowed to view Web Users for this workspace.'
    };
  }
  if (status === 404) {
    return {
      title: 'Web Users data is not available yet',
      body: 'This client workspace does not have CDC user data ready yet.'
    };
  }
  if (status >= 500) {
    return {
      title: 'Server failed to load Web Users',
      body: 'The Gateway returned an internal error. Retry after the service is stable.'
    };
  }

  return {
    title: 'Failed to load Web Users',
    body: err.response?.data?.error || 'The Gateway could not return client web users.'
  };
};

const escapeCsvCell = (value) => `"${String(value ?? '-').replace(/"/g, '""')}"`;

const getCsvTimestamp = (timestamp) => {
  const time = getTimestampMs(timestamp);
  if (!time) return '-';
  return new Date(time).toISOString();
};

const buildUsersCsv = (list) => {
  const headers = ['action_time', 'username', 'full_name', 'email', 'action_type', 'resource', 'action_result'];
  const rows = list.map(user => [
    getCsvTimestamp(user.actionTime),
    user.username,
    user.fullName,
    user.email,
    user.latestActivity?.action || '-',
    user.latestActivity?.resource || '-',
    getActivityStatusLabel(user.behaviorStatus)
  ]);

  return [headers, ...rows]
    .map(row => row.map(escapeCsvCell).join(','))
    .join('\r\n');
};

const downloadCsv = (csvContent) => {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `auditchain-web-users-${date}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

function WebUsersView({ onLogout }) {
  const [query, setQuery] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('All Users');
  const [sortMode, setSortMode] = React.useState('Newest First');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(8);
  const [users, setUsers] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorState, setErrorState] = React.useState(null);
  const [lastFetchedAt, setLastFetchedAt] = React.useState(null);
  const [selectedUser, setSelectedUser] = React.useState(null);
  const [isDrawerClosing, setIsDrawerClosing] = React.useState(false);
  const [copyNotice, setCopyNotice] = React.useState('');

  const fetchUsers = React.useCallback(async (isSilent = false) => {
    const silent = isSilent === true;
    if (!silent) {
      setIsLoading(true);
      setErrorState(null);
      setCopyNotice('');
    }

    try {
      const [usersRes, logsRes] = await Promise.allSettled([
        api.get('/dashboard/my-users'),
        api.get('/dashboard/logs', { params: { page: 1, page_size: 200, sort_order: 'desc' } })
      ]);

      if (usersRes.status === 'rejected') {
        throw usersRes.reason;
      }

      if (logsRes.status === 'rejected') {
        console.warn('Failed to load latest activity logs for Web Users:', logsRes.reason);
      }

      const payload = getUsersPayload(usersRes.value.data);
      const activityMap = buildActivityMap(logsRes.status === 'fulfilled' ? getLogsPayload(logsRes.value.data) : []);
      setUsers(attachLatestActivities(payload.map(normalizeUser), activityMap));
      setLastFetchedAt(new Date().toISOString());
    } catch (err) {
      console.error('Failed to load client web users:', err);
      if (err.response?.status === 401 && onLogout) {
        onLogout();
        return;
      }
      if (!silent) setErrorState(getWebUsersError(err));
      if (!silent) setUsers([]);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [onLogout]);

  React.useEffect(() => {
    fetchUsers(false);
    const interval = setInterval(() => {
      fetchUsers(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  React.useEffect(() => {
    setPage(1);
  }, [activeTab, query, sortMode, pageSize]);

  React.useEffect(() => {
    if (!copyNotice) return undefined;
    const timer = setTimeout(() => setCopyNotice(''), 1800);
    return () => clearTimeout(timer);
  }, [copyNotice]);

  const filteredUsers = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();
    let list = users.filter(user => {
      const tabMatch = activeTab === 'All Users'
        || (activeTab === 'Recently Seen' && user.status === 'recent')
        || (activeTab === 'Needs Identity' && user.status === 'needs_identity');
      const queryMatch = !normalized || [
        user.fullName,
        user.username,
        user.email,
        user.role,
        user.sourceTable,
        user.latestActivity?.action,
        user.latestActivity?.resource,
        user.rawSummary
      ].some(value => String(value).toLowerCase().includes(normalized));

      return tabMatch && queryMatch;
    });

    if (sortMode === 'Name A-Z') {
      list = [...list].sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)));
    } else if (sortMode === 'Oldest First') {
      list = [...list].sort((a, b) => getTimestampMs(a.actionTime) - getTimestampMs(b.actionTime));
    } else {
      list = [...list].sort((a, b) => getTimestampMs(b.actionTime) - getTimestampMs(a.actionTime));
    }

    return list;
  }, [activeTab, query, sortMode, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(pageStart, pageStart + pageSize);

  React.useEffect(() => {
    if (page !== safePage) {
      setPage(safePage);
    }
  }, [page, safePage]);

  const needsIdentityCount = users.filter(user => user.status === 'needs_identity').length;
  const recentCount = users.filter(user => getTimestampMs(user.actionTime) > Date.now() - (24 * 60 * 60 * 1000)).length;
  const identifiedCount = users.length - needsIdentityCount;
  const identityCoverage = users.length ? Math.round((identifiedCount / users.length) * 100) : 0;
  const sourceCount = new Set(users.map(user => user.sourceTable).filter(source => source && source !== '-')).size;
  const emptyStateTitle = users.length === 0
    ? 'No web users detected yet'
    : 'No users match this filter';
  const emptyStateBody = users.length === 0
    ? 'Web users will appear after the client CDC stream captures records from the configured user table.'
    : 'Try another keyword, tab, or sort option.';

  const copyValue = async (value, label) => {
    if (!value || value === '-') return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopyNotice(`${label} copied`);
    } catch (error) {
      console.error('Failed to copy value:', error);
      setCopyNotice('Copy failed');
    }
  };

  const handleExport = () => {
    downloadCsv(buildUsersCsv(filteredUsers));
    setCopyNotice(`Exported ${filteredUsers.length} user${filteredUsers.length === 1 ? '' : 's'}`);
  };

  const handlePageSizeChange = (event) => {
    setPageSize(Number(event.target.value));
  };

  const openUserDetail = (user) => {
    setIsDrawerClosing(false);
    setSelectedUser(user);
  };

  const closeUserDetail = () => {
    if (!selectedUser || isDrawerClosing) return;
    setIsDrawerClosing(true);
    setTimeout(() => {
      setSelectedUser(null);
      setIsDrawerClosing(false);
    }, 250);
  };

  const selectedHasSource = selectedUser && hasDisplayValue(selectedUser.sourceTable);
  const selectedHasResource = selectedUser && hasDisplayValue(selectedUser.latestActivity?.resource);
  const selectedHasAuditLogId = selectedUser && hasDisplayValue(selectedUser.latestActivity?.logId);
  const selectedHasRawAttributes = selectedUser && selectedUser.rawEntries.length > 0;

  return (
    <>
      <section className="ac-web-users-page-head">
        <div>
          <span className="ac-page-kicker">Client Web Monitoring</span>
          <h1>Web Users</h1>
          <p>Track users detected from the client database and review their identity coverage from CDC events.</p>
        </div>
        <div className="ac-web-users-page-head__actions">
          <button type="button" className="ac-btn-ghost-action" onClick={() => fetchUsers(false)} disabled={isLoading}>
            <Icon name={isLoading ? 'spinner' : 'history'} size={14} />
            Refresh
          </button>
          <button type="button" className="ac-btn-primary" onClick={handleExport} disabled={isLoading || filteredUsers.length === 0}>
            <Icon name="arrowDown" size={14} />
            Export CSV
          </button>
        </div>
      </section>

      <section className="ac-web-users-metrics">
        <div className="ac-stat-card">
          <div className="ac-stat-card__icon ac-stat-card__icon--teal">
            <Icon name="user" size={25} />
          </div>
          <div>
            <div className="ac-stat-card__label">Detected Users</div>
            <div className="ac-stat-card__value">{users.length}</div>
            <div className="ac-stat-card__sub ac-stat-card__sub--teal">From this client workspace</div>
          </div>
          <span className="ac-stat-card__meter ac-stat-card__meter--teal">Users</span>
        </div>
        <div className="ac-stat-card">
          <div className="ac-stat-card__icon ac-stat-card__icon--blue">
            <Icon name="clock" size={25} />
          </div>
          <div>
            <div className="ac-stat-card__label">Seen in 24h</div>
            <div className="ac-stat-card__value">{recentCount}</div>
            <div className="ac-stat-card__sub ac-stat-card__sub--blue">Updated in last 24 hours</div>
          </div>
          <span className="ac-stat-card__meter ac-stat-card__meter--blue">Recent</span>
        </div>
        <div className="ac-stat-card">
          <div className="ac-stat-card__icon ac-stat-card__icon--amber">
            <Icon name="warn" size={25} />
          </div>
          <div>
            <div className="ac-stat-card__label">Needs Identity</div>
            <div className="ac-stat-card__value">{needsIdentityCount}</div>
            <div className="ac-stat-card__sub ac-stat-card__sub--amber">
              {sourceCount > 0 ? `${sourceCount} detected source tables` : `${identityCoverage}% identity coverage`}
            </div>
          </div>
          <span className="ac-stat-card__meter ac-stat-card__meter--amber">Review</span>
        </div>
      </section>

      <section className="ac-card ac-web-users-entity-card">
        <div className="ac-web-users-tabs">
          {TABS.map(tab => (
            <button
              type="button"
              key={tab}
              className={activeTab === tab ? 'ac-web-users-tab--active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="ac-web-users-status-band">
          <div>
            <span>Detected from CDC</span>
            <strong>{users.length} total users</strong>
          </div>
          <div>
            <span>Identity coverage</span>
            <strong>{identityCoverage}%</strong>
          </div>
          <div title={formatAbsoluteDateTime(lastFetchedAt)}>
            <span>Last refresh</span>
            <strong>{formatRelativeTime(lastFetchedAt)}</strong>
          </div>
          {copyNotice && <div className="ac-web-users-toast">{copyNotice}</div>}
        </div>

        <div className="ac-web-users-audit-toolbar">
          <div className="ac-search">
            <span className="ac-search__icon">
              <Icon name="search" size={15} />
            </span>
            <input
              type="text"
              className="ac-search__input"
              placeholder="Search by name, username, email, action, or resource..."
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </div>
          <select
            className="ac-select"
            value={sortMode}
            onChange={event => setSortMode(event.target.value)}
          >
            {SORT_OPTIONS.map(option => <option key={option}>{option}</option>)}
          </select>
        </div>

        {errorState && (
          <div className="ac-web-users-error">
            <div className="ac-empty__icon">
              <Icon name="alert" size={28} />
            </div>
            <div>
              <strong>{errorState.title}</strong>
              <span>{errorState.body}</span>
            </div>
            <button type="button" className="ac-btn-ghost-action" onClick={() => fetchUsers(false)} disabled={isLoading}>
              <Icon name={isLoading ? 'spinner' : 'history'} size={14} />
              Retry
            </button>
          </div>
        )}

        <div className="ac-table-wrap ac-web-users-table-wrap">
          <table className="ac-table ac-web-users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Last Activity</th>
                <th>Action Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5}>
                    <div className="ac-empty ac-empty--loading">
                      <div className="ac-empty__icon">
                        <Icon name="spinner" size={30} />
                      </div>
                      <span style={{ fontWeight: '600', color: 'var(--color-on-surface)' }}>
                        Loading client web users...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : !errorState && paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="ac-empty">
                      <div className="ac-empty__icon">
                        <Icon name="inbox" size={30} />
                      </div>
                      <strong>{emptyStateTitle}</strong>
                      <span>{emptyStateBody}</span>
                    </div>
                  </td>
                </tr>
              ) : !errorState ? paginatedUsers.map(user => (
                <tr
                  key={user.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open details for ${user.fullName}`}
                  onClick={() => openUserDetail(user)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openUserDetail(user);
                    }
                  }}
                >
                  <td data-label="User">
                    <div className="ac-detected-user-cell">
                      <div style={{ position: 'relative', display: 'inline-flex' }}>
                        <span className={`ac-detected-user-avatar ac-detected-user-avatar--${user.status}`}>
                          {getInitials(user.fullName)}
                        </span>
                        {user.sessionStatus === 'online' && (
                          <span style={{ position: 'absolute', bottom: '0', right: '-2px', width: '10px', height: '10px', backgroundColor: '#10b981', border: '2px solid var(--surface-main)', borderRadius: '50%' }} title="Online"></span>
                        )}
                        {user.sessionStatus === 'offline' && (
                          <span style={{ position: 'absolute', bottom: '0', right: '-2px', width: '10px', height: '10px', backgroundColor: '#6b7280', border: '2px solid var(--surface-main)', borderRadius: '50%' }} title="Offline"></span>
                        )}
                      </div>
                      <span className="ac-detected-user-cell__copy">
                        <strong title={user.fullName}>{user.fullName}</strong>
                        <small title={user.rawSummary || user.role}>
                          {user.role}{user.rawSummary ? ` | ${user.rawSummary}` : ''}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td data-label="Email">
                    <div className="ac-web-users-device">
                      <strong title={user.email}>{user.email === '-' ? 'No email' : user.email}</strong>
                      <small>Client identity</small>
                    </div>
                  </td>
                  <td data-label="Last Activity">
                    <div className="ac-web-users-activity-cell">
                      {user.latestActivity ? <ActionBadge action={user.latestActivity.action} /> : <span className="ac-web-users-muted">No activity</span>}
                      <small title={user.latestActivity?.resource || ''}>{user.latestActivity?.resource || 'Waiting for audit log'}</small>
                    </div>
                  </td>
                  <td data-label="Action Time" className="ac-table__time">{formatDateTime(user.actionTime)}</td>
                  <td data-label="Status">
                    <span className={`ac-detected-user-status ac-detected-user-status--${user.behaviorStatus}`}>
                      {getActivityStatusLabel(user.behaviorStatus)}
                    </span>
                  </td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>

        <div className="ac-web-users-pagination">
          <span>
            {filteredUsers.length === 0
              ? `0 of ${users.length} users`
              : `${pageStart + 1}-${Math.min(pageStart + pageSize, filteredUsers.length)} of ${filteredUsers.length} users`}
          </span>
          <div>
            <button
              type="button"
              onClick={() => setPage(current => Math.max(1, current - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
            >
              <Icon name="chevronLeft" size={14} />
            </button>
            <button type="button" className="ac-web-users-pagination__active" aria-current="page">
              {safePage}
            </button>
            <button
              type="button"
              onClick={() => setPage(current => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
              aria-label="Next page"
            >
              <Icon name="chevronRight" size={14} />
            </button>
          </div>
          <select className="ac-select" value={pageSize} onChange={handlePageSizeChange}>
            {PAGE_SIZE_OPTIONS.map(option => (
              <option key={option} value={option}>{option} / page</option>
            ))}
          </select>
        </div>
      </section>

      {selectedUser && (
        <div
          className={`ac-web-users-drawer-overlay${isDrawerClosing ? ' ac-web-users-drawer-overlay--closing' : ''}`}
          onClick={closeUserDetail}
        >
          <aside
            className={`ac-web-users-drawer${isDrawerClosing ? ' ac-web-users-drawer--closing' : ''}`}
            onClick={event => event.stopPropagation()}
          >
            <div className="ac-web-users-drawer__head">
              <div className="ac-detected-user-cell">
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  <span className={`ac-detected-user-avatar ac-detected-user-avatar--${selectedUser.status}`}>
                    {getInitials(selectedUser.fullName)}
                  </span>
                  {selectedUser.sessionStatus === 'online' && (
                    <span style={{ position: 'absolute', bottom: '0', right: '-2px', width: '10px', height: '10px', backgroundColor: '#10b981', border: '2px solid var(--surface-main)', borderRadius: '50%' }} title="Online"></span>
                  )}
                  {selectedUser.sessionStatus === 'offline' && (
                    <span style={{ position: 'absolute', bottom: '0', right: '-2px', width: '10px', height: '10px', backgroundColor: '#6b7280', border: '2px solid var(--surface-main)', borderRadius: '50%' }} title="Offline"></span>
                  )}
                </div>
                <span className="ac-detected-user-cell__copy">
                  <strong>{selectedUser.fullName}</strong>
                  <small>@{truncateMiddle(selectedUser.username, 24)}</small>
                </span>
              </div>
              <button type="button" className="ac-modal__close" onClick={closeUserDetail} aria-label="Close user details">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="ac-web-users-drawer__body">
              <section>
                <div className="ac-web-users-drawer__section-title">Identity</div>
                <dl className="ac-web-users-detail-list">
                  <div>
                    <dt>Full name</dt>
                    <dd>{selectedUser.fullName}</dd>
                  </div>
                  <div>
                    <dt>Username</dt>
                    <dd className="ac-table__mono">{selectedUser.username}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{selectedUser.email === '-' ? 'No email returned' : selectedUser.email}</dd>
                  </div>
                  <div>
                    <dt>Role</dt>
                    <dd>{selectedUser.role}</dd>
                  </div>
                  <div>
                    <dt>Profile synced</dt>
                    <dd>{formatDateTime(selectedUser.lastSeenAt)}</dd>
                  </div>
                  <div>
                    <dt>Session status</dt>
                    <dd>
                      {selectedUser.sessionStatus === 'online' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: '500' }}>
                          <svg width="10" height="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="5" cy="5" r="5" fill="currentColor" />
                          </svg>
                          Online (Active)
                        </span>
                      )}
                      {selectedUser.sessionStatus === 'offline' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontWeight: '500' }}>
                          <svg width="10" height="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="5" cy="5" r="4" fill="transparent" stroke="currentColor" strokeWidth="2" />
                          </svg>
                          Offline
                        </span>
                      )}
                      {selectedUser.sessionStatus === 'inactive' && <span style={{ color: 'var(--text-muted)' }}>No Activity</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>Identity status</dt>
                    <dd>
                      <span className={`ac-detected-user-status ac-detected-user-status--${selectedUser.status}`}>
                        {getStatusLabel(selectedUser.status)}
                      </span>
                    </dd>
                  </div>
                </dl>
              </section>

              <section>
                <div className="ac-web-users-drawer__section-title">Latest Activity</div>
                <dl className="ac-web-users-detail-list">
                  <div>
                    <dt>Action type</dt>
                    <dd>{selectedUser.latestActivity ? <ActionBadge action={selectedUser.latestActivity.action} /> : 'No activity detected'}</dd>
                  </div>
                  <div>
                    <dt>Action time</dt>
                    <dd>{formatDateTime(selectedUser.actionTime)}</dd>
                  </div>
                  <div>
                    <dt>Action result</dt>
                    <dd>
                      <span className={`ac-detected-user-status ac-detected-user-status--${selectedUser.behaviorStatus}`}>
                        {getActivityStatusLabel(selectedUser.behaviorStatus)}
                      </span>
                    </dd>
                  </div>
                  {selectedHasResource && (
                    <div>
                      <dt>Resource</dt>
                      <dd>{selectedUser.latestActivity.resource}</dd>
                    </div>
                  )}
                  {selectedHasAuditLogId && (
                    <div>
                      <dt>Audit log ID</dt>
                      <dd className="ac-table__mono">{selectedUser.latestActivity.logId}</dd>
                    </div>
                  )}
                </dl>
              </section>

              {selectedHasSource && (
                <section>
                  <div className="ac-web-users-drawer__section-title">Source</div>
                  <dl className="ac-web-users-detail-list">
                    <div>
                      <dt>Source table</dt>
                      <dd>{selectedUser.sourceTable}</dd>
                    </div>
                    {selectedUser.technicalUserId && (
                      <div>
                        <dt>Technical user ID</dt>
                        <dd className="ac-table__mono">{selectedUser.technicalUserId}</dd>
                      </div>
                    )}
                  </dl>
                </section>
              )}

              {selectedHasRawAttributes && (
                <section>
                  <div className="ac-web-users-drawer__section-title">Raw Attributes</div>
                  <dl className="ac-web-users-raw-list">
                    {selectedUser.rawEntries.slice(0, 12).map(([key, value]) => (
                      <div key={`${selectedUser.id}-${key}`}>
                        <dt>{key}</dt>
                        <dd>{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}
            </div>

            <div className="ac-web-users-drawer__actions">
              <button type="button" className="ac-btn-ghost-action" onClick={() => copyValue(selectedUser.username, 'Username')}>
                <Icon name="copy" size={14} />
                Copy username
              </button>
              <button
                type="button"
                className="ac-btn-ghost-action"
                onClick={() => copyValue(selectedUser.email, 'Email')}
                disabled={selectedUser.email === '-'}
              >
                <Icon name="copy" size={14} />
                Copy email
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

const MemoizedWebUsersView = React.memo(WebUsersView);

export { WebUsersView };
export default MemoizedWebUsersView;
