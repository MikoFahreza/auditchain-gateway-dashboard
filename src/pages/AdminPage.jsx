import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import Icon from '../components/common/Icon';
import AppearanceMenu from '../components/common/AppearanceMenu';
import DBEngineBadge from '../components/common/DBEngineBadge';
import ClientDetailDrawer from '../components/admin/ClientDetailDrawer';
import { parseJwt, formatTimestamp } from '../utils/formatters';

const ADMIN_TABS = ['overview', 'clients', 'users', 'profile'];
const LEGACY_CLIENT_TABS = ['client-users', 'kafka'];

const isSameJSON = (a, b) => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

const getLatestUserActivity = (users = []) => {
  const latest = users.reduce((currentLatest, user) => {
    const rawValue = user.last_seen_at || user.lastSeenAt || user.updated_at || user.updatedAt || user.created_at || user.createdAt;
    if (!rawValue) return currentLatest;

    const time = new Date(rawValue).getTime();
    if (Number.isNaN(time)) return currentLatest;

    if (!currentLatest || time > currentLatest.time) {
      return { rawValue, time };
    }

    return currentLatest;
  }, null);

  return latest?.rawValue || '';
};

function AdminPage({ onLogout, themePreference = 'system', resolvedTheme = 'light', onThemeChange }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = LEGACY_CLIENT_TABS.includes(tabParam)
    ? 'clients'
    : ADMIN_TABS.includes(tabParam) ? tabParam : 'overview';
  const [clients, setClients] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [kafkaConfigs, setKafkaConfigs] = useState([]);
  const [summary, setSummary] = useState({
    total_clients: 0,
    active_clients: 0,
    inactive_clients: 0,
    pending_clients: 0,
    configured_clients: 0,
    total_users: 0,
    total_streams: 0,
    active_streams: 0
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('auditchain_admin_sidebar_collapsed') === 'true');
  const [sidebarHoverOpen, setSidebarHoverOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('token') || sessionStorage.getItem('token') || '');
  const isMountedRef = useRef(true);

  // Modal states
  const [showClientModal, setShowClientModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [setupCmdCopied, setSetupCmdCopied] = useState(false);

  // Installer Script Helpers
  const getApiBaseUrl = useCallback(() => {
    const baseURL = api.defaults.baseURL || 'http://localhost:8080/api';
    return baseURL.replace(/\/$/, '');
  }, []);

  const getGatewayBaseUrl = useCallback(() => {
    return getApiBaseUrl().replace(/\/api\/?$/, '');
  }, [getApiBaseUrl]);

  const getInstallerScriptUrl = useCallback(() => {
    return `${getApiBaseUrl()}/install.sh`;
  }, [getApiBaseUrl]);

  const buildInstallCommand = useCallback((apiKey) => {
    const key = apiKey?.trim() || '<YOUR_CLIENT_API_KEY>';
    return `curl -fsSL ${getInstallerScriptUrl()} | sudo bash -s -- ${getGatewayBaseUrl()} ${key}`;
  }, [getGatewayBaseUrl, getInstallerScriptUrl]);

  const handleCopySetupCmd = useCallback((cmdText) => {
    const fallbackCopy = () => {
      const el = document.createElement('textarea');
      el.value = cmdText;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setSetupCmdCopied(true);
      setTimeout(() => setSetupCmdCopied(false), 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cmdText).then(() => {
        setSetupCmdCopied(true);
        setTimeout(() => setSetupCmdCopied(false), 2000);
      }).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }, []);

  // Agent Lapis 3 Modal states
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [selectedAgentClient, setSelectedAgentClient] = useState(null);
  const [agentConfig, setAgentConfig] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentActionLoading, setAgentActionLoading] = useState(false);
  const [agentActionError, setAgentActionError] = useState('');
  const [agentActionSuccess, setAgentActionSuccess] = useState('');
  const [agentPingLoading, setAgentPingLoading] = useState(false);
  const [agentPingResult, setAgentPingResult] = useState(null);
  const [agentAdvancedOpen, setAgentAdvancedOpen] = useState(false);
  const [agentForm, setAgentForm] = useState({
    agent_url: '',
    verify_token: '',
    timeout_seconds: 5,
  });

  // CDC client users state
  const [cdcClientUsers, setCdcClientUsers] = useState([]);
  const [cdcActionError, setCdcActionError] = useState('');
  const [selectedRegistryClient, setSelectedRegistryClient] = useState(null);
  const [selectedClientDetail, setSelectedClientDetail] = useState(null);
  const [clientDetailLoading, setClientDetailLoading] = useState(false);
  const [clientDetailError, setClientDetailError] = useState('');
  const [clientDrawerTab, setClientDrawerTab] = useState('overview');
  const [clientDrawerClosing, setClientDrawerClosing] = useState(false);
  const clientDrawerCloseTimerRef = useRef(null);
  const clientDrawerTriggerRef = useRef(null);
  const clientDetailRequestRef = useRef(0);

  // Manage client users state
  const [manageUsersClient, setManageUsersClient] = useState(null);
  const [clientUsers, setClientUsers] = useState([]);
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserConfirmPassword, setNewUserConfirmPassword] = useState('');
  const [userActionLoading, setUserActionLoading] = useState(false);
  const [userActionError, setUserActionError] = useState('');
  const [globalUserActionError, setGlobalUserActionError] = useState('');
  const [newGlobalUser, setNewGlobalUser] = useState({
    full_name: '',
    username: '',
    password: '',
    confirm_password: ''
  });
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

  // Client form state
  const [clientForm, setClientForm] = useState({
    company_name: '', subscription_tier: 'basic', rate_limit_per_sec: 50,
    status: 'active', actor_field: 'actor', fallback_actor_field: '',
  });

  const clientInfo = useMemo(() => parseJwt(authToken), [authToken]);

  const displayName = clientInfo?.full_name || clientInfo?.username || 'Admin';
  const initials = (displayName || 'A')
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleAdminTabChange = useCallback((tab) => {
    setSearchParams(tab === 'overview' ? {} : { tab });
  }, [setSearchParams]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (clientDrawerCloseTimerRef.current) {
        clearTimeout(clientDrawerCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (LEGACY_CLIENT_TABS.includes(tabParam)) {
      setSearchParams({ tab: 'clients' }, { replace: true });
    }
  }, [tabParam, setSearchParams]);

  useEffect(() => {
    localStorage.setItem('auditchain_admin_sidebar_collapsed', sidebarCollapsed ? 'true' : 'false');
  }, [sidebarCollapsed]);

  const clientStats = useMemo(() => {
    const configuredClientIds = new Set(kafkaConfigs.map(config => config.client_id));
    return {
      active: summary.active_clients ?? clients.filter(client => client.status === 'active').length,
      inactive: summary.inactive_clients ?? clients.filter(client => client.status !== 'active' && client.status !== 'pending_setup').length,
      pending: summary.pending_clients ?? clients.filter(client => client.status === 'pending_setup').length,
      configured: summary.configured_clients ?? clients.filter(client => configuredClientIds.has(client.id)).length,
      totalUsers: summary.total_users ?? 0,
      totalStreams: summary.total_streams ?? kafkaConfigs.length,
    };
  }, [clients, kafkaConfigs, summary]);

  const userStats = useMemo(() => {
    return {
      total: allUsers.length,
      admins: allUsers.filter(user => user.role?.toLowerCase() === 'admin').length,
    };
  }, [allUsers]);

  const adminUsers = useMemo(() => (
    allUsers.filter(user => user.role?.toLowerCase() === 'admin')
  ), [allUsers]);

  const cdcUsersByClientId = useMemo(() => {
    const map = new Map();
    cdcClientUsers.forEach(item => {
      if (item?.client_id) map.set(item.client_id, item);
    });
    return map;
  }, [cdcClientUsers]);

  const cdcRegistryStats = useMemo(() => ({
    activeSources: cdcClientUsers.filter(item => (item.users?.length || 0) > 0).length,
  }), [cdcClientUsers]);

  const overviewData = useMemo(() => {
    const configuredClientIds = new Set(kafkaConfigs.map(config => config.client_id));
    const recentClients = [...clients]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 4);

    const clientsWithoutStream = clients.filter(client => !configuredClientIds.has(client.id));
    const inactiveStreams = kafkaConfigs.filter(config => !config.is_active);
    const attentionItems = [
      ...clients.filter(client => client.status === 'pending_setup').slice(0, 3).map(client => ({
        title: client.company_name,
        detail: 'Client is waiting for setup completion',
        tone: 'warning'
      })),
      ...clientsWithoutStream.slice(0, 3).map(client => ({
        title: client.company_name,
        detail: 'No Kafka stream configured yet',
        tone: 'neutral'
      })),
      ...inactiveStreams.slice(0, 3).map(config => ({
        title: config.company_name || config.client_id,
        detail: 'Kafka stream is currently inactive',
        tone: 'danger'
      }))
    ].slice(0, 5);

    const activeRate = summary.total_clients > 0
      ? Math.round(((summary.active_clients ?? clientStats.active) / summary.total_clients) * 100)
      : 0;
    const configuredRate = summary.total_clients > 0
      ? Math.round(((summary.configured_clients ?? clientStats.configured) / summary.total_clients) * 100)
      : 0;

    return {
      recentClients,
      attentionItems,
      activeRate,
      configuredRate,
      clientsWithoutStream: clientsWithoutStream.length,
      inactiveStreams: inactiveStreams.length
    };
  }, [clients, kafkaConfigs, summary, clientStats]);

  const pageMeta = {
    overview: {
      kicker: 'Gateway Command Center',
      title: 'Admin Dashboard',
      subtitle: 'Monitor client onboarding, tenant access, and ingestion readiness across the AuditChain Gateway.'
    },
    clients: {
      kicker: 'Tenant Operations',
      title: 'Client Registry',
      subtitle: 'Register, activate, and manage all client systems connected to the AuditChain Gateway.'
    },
    users: {
      kicker: 'Access Control',
      title: 'Admin User Management',
      subtitle: 'Kelola akun administrator yang memiliki akses untuk mengatur gateway dashboard.'
    },
    profile: {
      kicker: 'Admin Account',
      title: 'Admin Profile',
      subtitle: 'Update your administrator identity and password without leaving the admin workspace.'
    }
  }[activeTab] || {
    kicker: 'Gateway Command Center',
    title: 'Admin Dashboard',
    subtitle: 'Monitor AuditChain Gateway operations.'
  };

  const fetchData = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;

    const [summaryRes, clientsRes, kafkaRes, usersRes, cdcUsersRes] = await Promise.allSettled([
      api.get('/admin/summary'),
      api.get('/admin/clients'),
      api.get('/admin/kafka-configs'),
      api.get('/admin/users'),
      api.get('/admin/client-cdc-users')
    ]);

    const unauthorized = [summaryRes, clientsRes, kafkaRes, usersRes, cdcUsersRes]
      .some(result => result.status === 'rejected' && result.reason?.response?.status === 401);

    if (unauthorized) {
      onLogout();
      return;
    }

    if (!isMountedRef.current) return;

    if (summaryRes.status === 'fulfilled') {
      const nextSummary = summaryRes.value.data || { total_clients: 0, active_streams: 0 };
      setSummary(prev => isSameJSON(prev, nextSummary) ? prev : nextSummary);
    } else {
      console.error("Failed to load admin summary:", summaryRes.reason);
    }

    if (clientsRes.status === 'fulfilled') {
      const nextClients = clientsRes.value.data || [];
      setClients(prev => isSameJSON(prev, nextClients) ? prev : nextClients);
    } else {
      console.error("Failed to load admin clients:", clientsRes.reason);
    }

    if (kafkaRes.status === 'fulfilled') {
      const nextKafkaConfigs = kafkaRes.value.data || [];
      setKafkaConfigs(prev => isSameJSON(prev, nextKafkaConfigs) ? prev : nextKafkaConfigs);
    } else {
      console.error("Failed to load admin Kafka configs:", kafkaRes.reason);
    }

    if (usersRes.status === 'fulfilled') {
      const nextUsers = usersRes.value.data || [];
      setAllUsers(prev => isSameJSON(prev, nextUsers) ? prev : nextUsers);
    } else {
      console.error("Failed to load admin users:", usersRes.reason);
    }

    if (cdcUsersRes.status === 'fulfilled') {
      const nextCdcUsers = cdcUsersRes.value.data || [];
      setCdcClientUsers(prev => isSameJSON(prev, nextCdcUsers) ? prev : nextCdcUsers);
      setCdcActionError('');
    } else {
      console.error("Failed to load CDC client users:", cdcUsersRes.reason);
      setCdcActionError(cdcUsersRes.reason?.response?.data?.error || 'Failed to load client CDC users.');
    }
  }, [onLogout]);

  const fetchClientDetail = useCallback(async (clientId, { silent = false } = {}) => {
    const requestId = ++clientDetailRequestRef.current;
    if (!silent) setClientDetailLoading(true);
    setClientDetailError('');
    try {
      const response = await api.get(`/admin/clients/${clientId}/detail`);
      if (requestId === clientDetailRequestRef.current && isMountedRef.current) {
        setSelectedClientDetail(response.data || {});
      }
      return response.data || {};
    } catch (err) {
      if (requestId === clientDetailRequestRef.current && isMountedRef.current) {
        setClientDetailError(err.response?.data?.error || 'Failed to load the latest client detail.');
      }
      throw err;
    } finally {
      if (!silent && requestId === clientDetailRequestRef.current && isMountedRef.current) {
        setClientDetailLoading(false);
      }
    }
  }, []);

  const handleOpenClientDrawer = useCallback((client) => {
    if (clientDrawerCloseTimerRef.current) {
      clearTimeout(clientDrawerCloseTimerRef.current);
      clientDrawerCloseTimerRef.current = null;
    }
    clientDrawerTriggerRef.current = document.activeElement;
    setSelectedRegistryClient(client);
    setSelectedClientDetail(null);
    setClientDrawerTab('overview');
    setClientDrawerClosing(false);
    fetchClientDetail(client.id).catch(() => {});
  }, [fetchClientDetail]);

  const handleCloseClientDrawer = useCallback(() => {
    if (!selectedRegistryClient || clientDrawerClosing) return;
    setClientDrawerClosing(true);
    clientDetailRequestRef.current += 1;
    clientDrawerCloseTimerRef.current = setTimeout(() => {
      setSelectedRegistryClient(null);
      setSelectedClientDetail(null);
      setClientDetailError('');
      setClientDrawerClosing(false);
      clientDrawerCloseTimerRef.current = null;
      clientDrawerTriggerRef.current?.focus?.();
    }, 260);
  }, [selectedRegistryClient, clientDrawerClosing]);

  const refreshSelectedClient = useCallback(async (clientId) => {
    await Promise.allSettled([
      fetchData(),
      fetchClientDetail(clientId, { silent: true }),
    ]);
  }, [fetchData, fetchClientDetail]);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 5000);
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchData();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData]);

  useEffect(() => {
    if (!selectedRegistryClient) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedRegistryClient]);

  useEffect(() => {
    if (!selectedRegistryClient) return;
    const latestClient = clients.find(client => client.id === selectedRegistryClient.id);
    if (latestClient && !isSameJSON(latestClient, selectedRegistryClient)) {
      setSelectedRegistryClient(latestClient);
    } else if (!latestClient) {
      handleCloseClientDrawer();
    }
  }, [clients, selectedRegistryClient, handleCloseClientDrawer]);

  useEffect(() => {
    const handleLayeredEscape = event => {
      if (event.key !== 'Escape') return;
      if (showAgentModal) {
        setShowAgentModal(false);
      } else if (manageUsersClient) {
        setManageUsersClient(null);
      }
    };
    document.addEventListener('keydown', handleLayeredEscape);
    return () => document.removeEventListener('keydown', handleLayeredEscape);
  }, [showAgentModal, manageUsersClient]);

  useEffect(() => {
    if (activeTab !== 'clients' && selectedRegistryClient) {
      handleCloseClientDrawer();
    }
  }, [activeTab, selectedRegistryClient, handleCloseClientDrawer]);

  useEffect(() => {
    if (activeTab !== 'profile') return;

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
        setProfileError(err.response?.data?.error || 'Failed to load admin profile.');
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, clientInfo?.username, onLogout]);

  const handleProfileSubmit = useCallback(async (e) => {
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
        setAuthToken(res.data.token);
      }

      setProfileForm(form => ({
        ...form,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }));
      setProfileSuccess('Admin profile updated successfully.');
    } catch (err) {
      if (err.response?.status === 401 && !profileForm.new_password) onLogout();
      setProfileError(err.response?.data?.error || 'Failed to update admin profile.');
    } finally {
      setProfileSaving(false);
    }
  }, [profileForm, onLogout]);

  const handleToggleClientStatus = useCallback(async (client) => {
    let actionText = client.status === 'active' ? 'deactivate' : 'activate';
    let confirmMsg = `Are you sure you want to ${actionText} the client "${client.company_name}"?`;
    if (!window.confirm(confirmMsg)) {
      return;
    }
    try {
      await api.patch(`/admin/clients/${client.id}/toggle`);
      await refreshSelectedClient(client.id);
    } catch (err) {
      console.error("Failed to update client status:", err);
      alert(err.response?.data?.error || "Failed to update client status.");
    }
  }, [refreshSelectedClient]);

  const handleDeleteClient = useCallback(async (client) => {
    if (!window.confirm(`Are you sure you want to permanently delete the client "${client.company_name}"? All associated users will also lose access.`)) {
      return;
    }
    try {
      await api.delete(`/admin/clients/${client.id}`);
      handleCloseClientDrawer();
      await fetchData();
    } catch (err) {
      console.error("Failed to delete client:", err);
      alert(err.response?.data?.error || "Failed to delete client.");
    }
  }, [fetchData, handleCloseClientDrawer]);

  const fetchClientUsers = useCallback(async (clientId) => {
    try {
      setUserActionLoading(true);
      setUserActionError('');
      const res = await api.get(`/admin/clients/${clientId}/users`);
      setClientUsers(res.data || []);
    } catch (err) {
      console.error("Failed to load client users:", err);
      setUserActionError(err.response?.data?.error || "Failed to load client users.");
    } finally {
      setUserActionLoading(false);
    }
  }, []);

  const handleManageUsers = useCallback((client) => {
    setManageUsersClient(client);
    setClientUsers([]);
    setNewUserUsername('');
    setNewUserPassword('');
    setNewUserConfirmPassword('');
    setUserActionError('');
    fetchClientUsers(client.id);
  }, [fetchClientUsers]);

  const handleOpenUserModal = useCallback(() => {
    setGlobalUserActionError('');
    setNewGlobalUser({
      full_name: '',
      username: '',
      password: '',
      confirm_password: ''
    });
    setShowUserModal(true);
  }, []);

  const handleCreateGlobalUser = useCallback(async (e) => {
    e.preventDefault();
    setGlobalUserActionError('');

    if (newGlobalUser.password !== newGlobalUser.confirm_password) {
      setGlobalUserActionError('Passwords do not match.');
      return;
    }

    try {
      setUserActionLoading(true);
      await api.post('/admin/users', {
        full_name: newGlobalUser.full_name,
        username: newGlobalUser.username,
        password: newGlobalUser.password
      });
      setShowUserModal(false);
      setNewGlobalUser({
        full_name: '',
        username: '',
        password: '',
        confirm_password: ''
      });
      fetchData();
    } catch (err) {
      const status = err.response?.status;
      const apiMessage = err.response?.data?.error;
      const fallbackMessage = status === 404
        ? 'Admin create endpoint is not active yet. Please restart the backend service.'
        : status
          ? `Failed to create admin account. Backend returned HTTP ${status}.`
          : err.message || 'Failed to create admin account.';
      setGlobalUserActionError(apiMessage || fallbackMessage);
    } finally {
      setUserActionLoading(false);
    }
  }, [newGlobalUser, fetchData]);

  const handleAddClientUser = useCallback(async (e) => {
    e.preventDefault();
    if (!manageUsersClient) return;
    if (newUserPassword !== newUserConfirmPassword) {
      setUserActionError("Passwords do not match.");
      return;
    }
    try {
      setUserActionLoading(true);
      setUserActionError('');
      await api.post(`/admin/clients/${manageUsersClient.id}/users`, {
        username: newUserUsername,
        password: newUserPassword
      });
      setNewUserUsername('');
      setNewUserPassword('');
      setNewUserConfirmPassword('');
      fetchClientUsers(manageUsersClient.id);
      fetchData();
    } catch (err) {
      console.error("Failed to add client user:", err);
      setUserActionError(err.response?.data?.error || "Failed to create user account.");
    } finally {
      setUserActionLoading(false);
    }
  }, [manageUsersClient, newUserUsername, newUserPassword, newUserConfirmPassword, fetchClientUsers, fetchData]);

  const handleDeleteClientUser = useCallback(async (user) => {
    if (!window.confirm(`Are you sure you want to delete the user account "${user.username}"?`)) {
      return;
    }
    try {
      setUserActionLoading(true);
      setUserActionError('');
      setGlobalUserActionError('');
      await api.delete(`/admin/users/${user.id}`);
      if (manageUsersClient) {
        fetchClientUsers(manageUsersClient.id);
      }
      fetchData();
    } catch (err) {
      console.error("Failed to delete client user:", err);
      const errorMessage = err.response?.data?.error || "Failed to delete user account.";
      setUserActionError(errorMessage);
      setGlobalUserActionError(errorMessage);
    } finally {
      setUserActionLoading(false);
    }
  }, [manageUsersClient, fetchClientUsers, fetchData]);

  const handleSubmitClient = useCallback(async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/admin/clients', {
        company_name: clientForm.company_name,
        status: clientForm.status,
        actor_field: clientForm.actor_field,
        fallback_actor_field: clientForm.fallback_actor_field
      });
      setNewApiKey(response.data.api_key);
      setShowClientModal(false);
      setShowApiKeyModal(true);
      setClientForm({
        company_name: '', subscription_tier: 'basic', rate_limit_per_sec: 50,
        status: 'active', actor_field: 'actor', fallback_actor_field: '',
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to register client');
    }
  }, [clientForm, fetchData]);

  const handleCreateKafka = useCallback(async (clientId, form) => {
    try {
      await api.post('/admin/kafka-config', {
        client_id: clientId,
        kafka_brokers: form.kafka_brokers,
        topic_prefix: form.topic_prefix,
        source_system: 'Auto-Sync', // Backend akan override dengan Company Name
        pk_field: form.pk_field,
        actor_field: '', // Tidak dipakai lagi
      });
      await refreshSelectedClient(clientId);
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to save Kafka configuration');
    }
  }, [refreshSelectedClient]);

  const handleToggleKafka = useCallback(async (configId) => {
    try {
      await api.patch(`/admin/kafka-config/${configId}/toggle`);
      if (selectedRegistryClient) {
        await refreshSelectedClient(selectedRegistryClient.id);
      } else {
        await fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update Kafka configuration status');
    }
  }, [fetchData, refreshSelectedClient, selectedRegistryClient]);

  const handleCopyApiKey = useCallback(() => {
    const fallbackCopy = () => {
      const el = document.createElement('textarea');
      el.value = newApiKey;
      el.setAttribute('readonly', '');
      el.style.position = 'absolute';
      el.style.left = '-9999px';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 2000);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(newApiKey).then(() => {
        setApiKeyCopied(true);
        setTimeout(() => setApiKeyCopied(false), 2000);
      }).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  }, [newApiKey]);

  // ======= AGENT LAPIS 3 HANDLERS =======
  const fetchAgentConfig = useCallback(async (clientId) => {
    try {
      setAgentLoading(true);
      setAgentActionError('');
      const res = await api.get(`/admin/clients/${clientId}/agent-config`);
      setAgentConfig(res.data);
      setAgentAdvancedOpen(false);
      setAgentForm({
        agent_url: res.data.agent_url || '',
        verify_token: '',
        timeout_seconds: res.data.timeout_seconds || 5,
      });
    } catch (err) {
      if (err.response?.status === 404) {
        setAgentConfig(null);
        setAgentAdvancedOpen(true);
        setAgentForm({ agent_url: '', verify_token: '', timeout_seconds: 5 });
      } else {
        console.error("Failed to load agent config:", err);
        setAgentActionError(err.response?.data?.error || "Failed to load Agent configuration.");
      }
    } finally {
      setAgentLoading(false);
    }
  }, []);

  const handleOpenAgentModal = useCallback((client) => {
    setSelectedAgentClient(client);
    setShowAgentModal(true);
    setAgentConfig(null);
    setAgentPingResult(null);
    setAgentAdvancedOpen(false);
    setAgentActionError('');
    setAgentActionSuccess('');
    fetchAgentConfig(client.id);
  }, [fetchAgentConfig]);

  const handleSaveAgentConfig = useCallback(async (e) => {
    e.preventDefault();
    if (!selectedAgentClient) return;
    try {
      setAgentActionLoading(true);
      setAgentActionError('');
      setAgentActionSuccess('');
      const res = await api.post(`/admin/clients/${selectedAgentClient.id}/agent-config`, {
        agent_url: agentForm.agent_url,
        verify_token: agentForm.verify_token,
        timeout_seconds: parseInt(agentForm.timeout_seconds, 10) || 5,
      });
      setAgentActionSuccess(res.data.message || "Agent configuration saved successfully!");
      fetchAgentConfig(selectedAgentClient.id);
      refreshSelectedClient(selectedAgentClient.id);
    } catch (err) {
      console.error("Failed to save agent config:", err);
      setAgentActionError(err.response?.data?.error || "Failed to save Agent configuration.");
    } finally {
      setAgentActionLoading(false);
    }
  }, [selectedAgentClient, agentForm, fetchAgentConfig, refreshSelectedClient]);

  const handleDeleteAgentConfig = useCallback(async () => {
    if (!selectedAgentClient) return;
    if (!window.confirm(`Are you sure you want to revoke Agent access for client "${selectedAgentClient.company_name}"?`)) {
      return;
    }
    try {
      setAgentActionLoading(true);
      setAgentActionError('');
      setAgentActionSuccess('');
      const res = await api.delete(`/admin/clients/${selectedAgentClient.id}/agent-config`);
      setAgentActionSuccess(res.data.message || "Agent configuration deleted successfully.");
      setAgentConfig(null);
      setAgentPingResult(null);
      setAgentForm({ agent_url: '', verify_token: '', timeout_seconds: 5 });
      refreshSelectedClient(selectedAgentClient.id);
    } catch (err) {
      console.error("Failed to delete agent config:", err);
      setAgentActionError(err.response?.data?.error || "Failed to delete Agent configuration.");
    } finally {
      setAgentActionLoading(false);
    }
  }, [selectedAgentClient, refreshSelectedClient]);

  const handlePingAgent = useCallback(async () => {
    if (!selectedAgentClient) return;
    try {
      setAgentPingLoading(true);
      setAgentPingResult(null);
      const startTime = performance.now();
      const res = await api.get(`/admin/clients/${selectedAgentClient.id}/agent-ping`);
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      setAgentPingResult({ ...res.data, latency });
    } catch (err) {
      console.error("Failed to ping agent:", err);
      if (err.response?.data) {
        setAgentPingResult({ ...err.response.data, latency: null });
      } else {
        setAgentPingResult({ reachable: false, error: err.message || "Failed to reach Agent server.", latency: null });
      }
    } finally {
      setAgentPingLoading(false);
    }
  }, [selectedAgentClient]);

  const handleDeleteKafkaConfig = useCallback(async (configId, companyName) => {
    if (!window.confirm(`Are you sure you want to delete Kafka configuration for "${companyName || 'client'}"?`)) {
      return;
    }
    try {
      await api.delete(`/admin/kafka-config/${configId}`);
      if (selectedRegistryClient) {
        setSelectedClientDetail(detail => detail ? { ...detail, kafka_config: {} } : detail);
        await fetchData();
      } else {
        await fetchData();
      }
    } catch (err) {
      console.error("Failed to delete Kafka config:", err);
      alert(err.response?.data?.error || "Failed to delete Kafka configuration.");
    }
  }, [fetchData, selectedRegistryClient]);

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
    <div className={`ac-shell ac-shell--admin${sidebarCollapsed ? ' ac-shell--sidebar-collapsed' : ''}${isSidebarPreviewOpen ? ' ac-shell--sidebar-hover-open' : ''}`}>

      {/* ======= TOP NAV ======= */}
      <header className="ac-topnav">
        <div className="ac-topnav__brand">
          <img src="/logo/logo-with-background.png" alt="Auditchain Logo" style={{ height: 38, width: 'auto', display: 'block', flexShrink: 0, borderRadius: 6 }} />
          <div>
            <div className="ac-topnav__brand-name">Auditchain Gateway</div>
            <div className="ac-topnav__brand-sub ac-admin-portal-label">Admin Portal</div>
          </div>
        </div>
        <div className="ac-topnav__right">
          <div className="ac-topnav__client-pill ac-admin-pill">
            <span className="ac-topnav__client-dot ac-admin-dot" />
            <span className="ac-topnav__client-label">SUPER ADMIN</span>
          </div>
          <div className="ac-profile-menu">
            <button
              className="ac-topnav__profile-btn"
              onClick={() => setProfileMenuOpen(open => !open)}
              title="Open admin menu"
            >
              <span className="ac-topnav__avatar ac-topnav__avatar--compact ac-topnav__avatar--admin">{initials}</span>
              <span className="ac-topnav__profile-copy">
                <span className="ac-topnav__user-name">{displayName}</span>
                <span className="ac-topnav__user-role">{clientInfo?.role || 'System Administrator'}</span>
              </span>
              <Icon name="chevronDown" size={14} />
            </button>
            {profileMenuOpen && (
              <div className="ac-profile-menu__panel">
                <button onClick={() => { setProfileMenuOpen(false); handleAdminTabChange('profile'); }}>
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
              <div className="ac-sidebar__section-label">Admin Panel</div>
              <div className="ac-sidebar__section-sub">Client System Management</div>
            </div>
          </div>
        </div>
        <nav className="ac-sidebar__nav">
          <button
            className={`ac-sidebar__nav-item${activeTab === 'overview' ? ' ac-sidebar__nav-item--active' : ''}`}
            onClick={() => { handleAdminTabChange('overview'); setSidebarOpen(false); }}
            title="Admin Dashboard"
          >
            <Icon name="dashboard" size={18} />
            <span className="ac-sidebar__nav-label">Admin Dashboard</span>
          </button>

          <button
            className={`ac-sidebar__nav-item${activeTab === 'clients' ? ' ac-sidebar__nav-item--active' : ''}`}
            onClick={() => { handleAdminTabChange('clients'); setSidebarOpen(false); }}
            title="Client Registry"
          >
            <Icon name="database" size={18} />
            <span className="ac-sidebar__nav-label">Client Registry</span>
          </button>

          <button
            className={`ac-sidebar__nav-item${activeTab === 'users' ? ' ac-sidebar__nav-item--active' : ''}`}
            onClick={() => { handleAdminTabChange('users'); setSidebarOpen(false); }}
            title="User Management"
          >
            <Icon name="user" size={18} />
            <span className="ac-sidebar__nav-label">User Management</span>
          </button>

          <div className="ac-sidebar__divider" />
          <button className="ac-sidebar__nav-item" onClick={() => navigate('/dashboard')} title="Auditor Dashboard">
            <Icon name="dashboard" size={18} />
            <span className="ac-sidebar__nav-label">Auditor View</span>
          </button>
        </nav>
        <div className="ac-sidebar__footer">
          {clientInfo && (
            <div className="ac-sidebar__identity-card">
              <div className="ac-sidebar__identity-user">
                <span className="ac-sidebar__identity-avatar">
                  {initials}
                </span>
                <div className="ac-sidebar__identity-details">
                  <span className="ac-sidebar__identity-name" title={displayName}>{displayName}</span>
                  <span className="ac-sidebar__identity-role">{clientInfo.role?.toLowerCase() === 'admin' ? 'Super Admin' : clientInfo.role}</span>
                </div>
              </div>
              <div className="ac-sidebar__identity-client">
                <Icon name="database" size={14} />
                <span>{clientInfo.client_id ? 'Client Workspace' : 'Admin Dashboard'}</span>
              </div>
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

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 35, background: 'rgba(0,0,0,0.3)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ======= MAIN CONTENT ======= */}
      <main className="ac-main">
        <div className="ac-main__container">

          {/* ===== HERO ADMIN ===== */}
          <section className="ac-hero">
            <div className="ac-hero__pattern" />
            <div className="ac-hero__content">
              <div className="ac-hero__left">
                <span className="ac-page-kicker ac-page-kicker--admin">{pageMeta.kicker}</span>
                <h1 className="ac-hero__title">{pageMeta.title}</h1>
                <p className="ac-hero__subtitle">{pageMeta.subtitle}</p>
              </div>
              <div className="ac-admin-hero-stats">
                <div className="ac-admin-hero-stat">
                  <div className="ac-admin-hero-stat__val">{summary.total_clients}</div>
                  <div className="ac-admin-hero-stat__label">Registered Clients</div>
                </div>
                <div className="ac-admin-hero-stat">
                  <div className="ac-admin-hero-stat__val">{userStats.admins || adminUsers.length || 0}</div>
                  <div className="ac-admin-hero-stat__label">Admin Accounts</div>
                </div>
              </div>
            </div>
          </section>

          {activeTab === 'overview' && (
            <>
              <section className="ac-admin-overview-grid">
                <div className="ac-admin-overview-stat">
                  <span className="ac-admin-overview-stat__icon ac-admin-overview-stat__icon--blue">
                    <Icon name="database" size={20} />
                  </span>
                  <div>
                    <div className="ac-admin-overview-stat__label">Registered Clients</div>
                    <div className="ac-admin-overview-stat__value">{summary.total_clients || clients.length}</div>
                    <div className="ac-admin-overview-stat__sub">Total tenant systems onboarded</div>
                  </div>
                </div>
                <div className="ac-admin-overview-stat">
                  <span className="ac-admin-overview-stat__icon ac-admin-overview-stat__icon--teal">
                    <Icon name="shield" size={20} />
                  </span>
                  <div>
                    <div className="ac-admin-overview-stat__label">Active Clients</div>
                    <div className="ac-admin-overview-stat__value">{clientStats.active}</div>
                    <div className="ac-admin-overview-stat__sub">{overviewData.activeRate}% tenants allowed to operate</div>
                  </div>
                </div>
                <div className="ac-admin-overview-stat">
                  <span className="ac-admin-overview-stat__icon ac-admin-overview-stat__icon--amber">
                    <Icon name="link" size={20} />
                  </span>
                  <div>
                    <div className="ac-admin-overview-stat__label">Ingestion Ready</div>
                    <div className="ac-admin-overview-stat__value">{overviewData.configuredRate}%</div>
                    <div className="ac-admin-overview-stat__sub">{clientStats.configured}/{summary.total_clients || clients.length} clients have Kafka setup</div>
                  </div>
                </div>
                <div className="ac-admin-overview-stat">
                  <span className="ac-admin-overview-stat__icon ac-admin-overview-stat__icon--coral">
                    <Icon name="warn" size={20} />
                  </span>
                  <div>
                    <div className="ac-admin-overview-stat__label">Needs Setup</div>
                    <div className="ac-admin-overview-stat__value">{overviewData.attentionItems.length}</div>
                    <div className="ac-admin-overview-stat__sub">{overviewData.clientsWithoutStream} missing stream, {overviewData.inactiveStreams} inactive</div>
                  </div>
                </div>
              </section>

              <section className="ac-admin-dashboard-layout">
                <div className="ac-admin-command-card">
                  <div className="ac-admin-section-head">
                    <div>
                      <h2>Quick Actions</h2>
                      <p>Common setup actions for onboarding clients and operating gateway access.</p>
                    </div>
                  </div>
                  <div className="ac-admin-quick-grid">
                    <button onClick={() => setShowClientModal(true)}>
                      <Icon name="database" size={19} />
                      <span>
                        <strong>Register Client</strong>
                        <small>Create tenant and API key</small>
                      </span>
                    </button>
                    <button onClick={() => handleAdminTabChange('clients')}>
                      <Icon name="link" size={19} />
                      <span>
                        <strong>Configure Stream</strong>
                        <small>Select a client in Registry</small>
                      </span>
                    </button>
                    <button onClick={() => handleAdminTabChange('users')}>
                      <Icon name="user" size={19} />
                      <span>
                        <strong>Manage Admins</strong>
                        <small>Create administrator accounts</small>
                      </span>
                    </button>
                    <button onClick={() => handleAdminTabChange('clients')}>
                      <Icon name="warn" size={19} />
                      <span>
                        <strong>Review Setup</strong>
                        <small>Find clients missing ingestion</small>
                      </span>
                    </button>
                  </div>
                </div>

                <div className="ac-admin-command-card">
                  <div className="ac-admin-section-head">
                    <div>
                      <h2>Operational Attention</h2>
                      <p>Clients that still need setup before audit logs can flow reliably.</p>
                    </div>
                    <span className="ac-admin-attention-count">{overviewData.attentionItems.length}</span>
                  </div>
                  <div className="ac-admin-attention-list">
                    {overviewData.attentionItems.length === 0 ? (
                      <div className="ac-admin-empty-state">
                        <Icon name="checkmark" size={18} />
                        All tenants look ready.
                      </div>
                    ) : (
                      overviewData.attentionItems.map((item, index) => (
                        <div className={`ac-admin-attention-item ac-admin-attention-item--${item.tone}`} key={`${item.title}-${index}`}>
                          <div>
                            <strong>{item.title}</strong>
                            <span>{item.detail}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>

              <section className="ac-admin-dashboard-layout ac-admin-dashboard-layout--wide-left">
                <div className="ac-admin-command-card">
                  <div className="ac-admin-section-head">
                    <div>
                      <h2>Recent Clients</h2>
                      <p>Latest tenants added to the gateway.</p>
                    </div>
                    <button className="ac-admin-link-btn" onClick={() => handleAdminTabChange('clients')}>View Registry</button>
                  </div>
                  <div className="ac-admin-recent-list">
                    {overviewData.recentClients.length === 0 ? (
                      <div className="ac-admin-empty-state">No clients registered yet.</div>
                    ) : (
                      overviewData.recentClients.map(client => (
                        <button className="ac-admin-recent-client" key={client.id} onClick={() => handleAdminTabChange('clients')}>
                          <span className="ac-admin-client-cell__avatar">{client.company_name?.charAt(0)?.toUpperCase() || 'C'}</span>
                          <span>
                            <strong>{client.company_name}</strong>
                            <small>{client.id}</small>
                          </span>
                          <span className={`ac-dot-status${client.status === 'active' ? ' ac-dot-status--active' : client.status === 'pending_setup' ? ' ac-dot-status--pending' : ' ac-dot-status--inactive'}`}>
                            {client.status || 'inactive'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="ac-admin-command-card">
                  <div className="ac-admin-section-head">
                    <div>
                      <h2>Stream Health</h2>
                      <p>Kafka ingestion coverage across registered clients.</p>
                    </div>
                  </div>
                  <div className="ac-admin-health-stack">
                    <div>
                      <span>Clients with stream</span>
                      <strong>{clientStats.configured}/{summary.total_clients || clients.length}</strong>
                    </div>
                    <div>
                      <span>Active streams</span>
                      <strong>{summary.active_streams || 0}/{summary.total_streams || kafkaConfigs.length}</strong>
                    </div>
                    <div>
                      <span>Missing stream</span>
                      <strong>{overviewData.clientsWithoutStream}</strong>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ===== TAB: DAFTAR KLIEN ===== */}
          {activeTab === 'clients' && (
            <>
              {cdcActionError && <div className="ac-admin-inline-alert"><Icon name="warn" size={15} />{cdcActionError}</div>}
              <section className="ac-card ac-admin-registry-card" style={{ animation: 'fadeIn 0.3s ease' }}>
                <div className="ac-card__header ac-admin-registry-header">
                  <div className="ac-admin-registry-header__copy">
                    <div className="ac-card__title">Client Registry</div>
                    <div className="ac-admin-card-sub">Client access, CDC identity, and Kafka readiness in one workspace</div>
                  </div>
                  <div className="ac-admin-registry-header__meta">
                    <span className="ac-admin-mini-stat"><strong>{clientStats.active}</strong>Active</span>
                    <span className="ac-admin-mini-stat ac-admin-mini-stat--soft"><strong>{clientStats.configured}</strong>Kafka</span>
                    <span className="ac-admin-mini-stat ac-admin-mini-stat--soft"><strong>{cdcRegistryStats.activeSources}</strong>With CDC Users</span>
                    {clientStats.pending > 0 && <span className="ac-admin-mini-stat ac-admin-mini-stat--warning"><strong>{clientStats.pending}</strong>Pending</span>}
                  </div>
                  <button className="ac-btn-primary ac-admin-register-btn" onClick={() => setShowClientModal(true)}><Icon name="database" size={15} />Register Client</button>
                </div>
                <div className="ac-table-wrap">
                  <table className="ac-table ac-admin-client-table ac-admin-client-table--unified">
                    <thead><tr><th>Client</th><th>Client Status</th><th>Database</th><th>CDC Users</th><th>Kafka</th><th>Registration Date</th><th>Detail</th></tr></thead>
                    <tbody>
                      {clients.length === 0 && <tr><td colSpan={7} className="ac-admin-table-empty">No registered clients found.</td></tr>}
                      {clients.map(client => {
                        const matchingKafka = kafkaConfigs.find(config => config.client_id === client.id);
                        const detectedUsers = cdcUsersByClientId.get(client.id)?.users || [];
                        const latestSeen = getLatestUserActivity(detectedUsers);
                        const dbEngine = client.db_engine || matchingKafka?.db_engine || '';
                        return (
                          <tr key={client.id} className="ac-admin-client-row" tabIndex={0} onClick={() => handleOpenClientDrawer(client)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); handleOpenClientDrawer(client); } }} aria-label={`Open details for ${client.company_name}`}>
                            <td><div className="ac-admin-client-cell"><div className="ac-admin-client-cell__avatar">{client.company_name?.charAt(0)?.toUpperCase() || 'C'}</div><div className="ac-admin-client-cell__content"><div className="ac-admin-client-cell__name">{client.company_name}</div><div className="ac-admin-client-cell__id">{client.id}</div></div></div></td>
                            <td><span className={`ac-dot-status${client.status === 'active' ? ' ac-dot-status--active' : client.status === 'pending_setup' ? ' ac-dot-status--pending' : ' ac-dot-status--inactive'}`}>{client.status === 'active' ? 'Active' : client.status === 'pending_setup' ? 'Pending Setup' : 'Inactive'}</span></td>
                            <td><div className="ac-admin-registry-stack"><DBEngineBadge engine={dbEngine} />{client.db_name && <small>{client.db_name}</small>}</div></td>
                            <td><div className="ac-admin-registry-stack"><span className={`ac-cdc-count-badge${detectedUsers.length ? ' ac-cdc-count-badge--active' : ''}`}>{detectedUsers.length}</span><small>{latestSeen ? formatTimestamp(latestSeen) : 'No activity yet'}</small></div></td>
                            <td><span className={`ac-client-readiness-badge${matchingKafka ? matchingKafka.is_active ? ' ac-client-readiness-badge--active' : ' ac-client-readiness-badge--inactive' : ''}`}>{matchingKafka ? matchingKafka.is_active ? 'Active' : 'Inactive' : 'Not configured'}</span></td>
                            <td className="ac-table__time">{formatTimestamp(client.created_at)}</td>
                            <td><button type="button" className="ac-admin-detail-button" onClick={event => { event.stopPropagation(); handleOpenClientDrawer(client); }}><span>Detail</span><Icon name="chevronRight" size={15} /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}


          {activeTab === 'users' && (
            <section className="ac-card ac-admin-registry-card" style={{ animation: 'fadeIn 0.3s ease' }}>
              <div className="ac-card__header ac-admin-registry-header">
                <div className="ac-admin-registry-header__copy">
                  <div className="ac-card__title">Admin User Management</div>
                  <div className="ac-admin-card-sub">Kelola akun admin yang bisa mengatur client, Kafka stream, dan akses dashboard.</div>
                </div>
                <div className="ac-admin-registry-header__meta">
                  <span className="ac-admin-mini-stat">
                    <strong>{userStats.admins}</strong>
                    Admins
                  </span>
                </div>
                <button className="ac-btn-primary ac-admin-register-btn" onClick={handleOpenUserModal}>
                  <Icon name="user" size={15} />
                  Add Admin
                </button>
              </div>

              {globalUserActionError && (
                <div className="ac-admin-inline-alert">
                  <Icon name="warn" size={15} />
                  {globalUserActionError}
                </div>
              )}

              <div className="ac-admin-user-guidance">
                <div>
                  <strong>Khusus akun admin</strong>
                  <span>Halaman ini hanya menampilkan dan membuat akun administrator.</span>
                </div>
                <div>
                  <strong>Akun auditor</strong>
                  <span>Akun auditor dibuat dari menu Client Registry pada client masing-masing.</span>
                </div>
              </div>

              <div className="ac-table-wrap">
                <table className="ac-table ac-admin-user-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Workspace</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminUsers.length === 0 && (
                      <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-outline)', padding: '32px 0' }}>No admin accounts registered yet.</td></tr>
                    )}
                    {adminUsers.map(user => {
                      const userDisplayName = user.full_name || user.username || 'User';
                      const userInitials = userDisplayName
                        .split(' ')
                        .map(part => part.charAt(0))
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      const isCurrentUser = user.id === clientInfo?.user_id;

                      return (
                        <tr key={user.id}>
                          <td>
                            <div className="ac-admin-user-cell">
                              <span className="ac-admin-user-avatar ac-admin-user-avatar--admin">
                                {userInitials}
                              </span>
                              <span className="ac-admin-user-cell__copy">
                                <strong>{userDisplayName}</strong>
                                <small>{user.username}</small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="ac-admin-role-badge ac-admin-role-badge--admin">
                              <Icon name="shield" size={13} />
                              Admin
                            </span>
                          </td>
                          <td>
                            <div className="ac-admin-workspace-cell">
                              <strong>{user.company_name || 'Tidak terhubung ke klien'}</strong>
                              <small>{user.client_id || 'Admin dashboard'}</small>
                            </div>
                          </td>
                          <td className="ac-table__time">{formatTimestamp(user.created_at)}</td>
                          <td className="ac-admin-actions-cell">
                            <button
                              className="ac-admin-action-btn ac-admin-action-btn--danger"
                              onClick={() => handleDeleteClientUser(user)}
                              disabled={userActionLoading || isCurrentUser}
                              title={isCurrentUser ? 'Current admin account cannot delete itself' : 'Delete user account'}
                            >
                              <Icon name="x" size={14} />
                              <span>{isCurrentUser ? 'Current User' : 'Delete'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {activeTab === 'profile' && (
            <section className="ac-admin-profile-layout">
              <form className="ac-profile-card ac-profile-form" onSubmit={handleProfileSubmit}>
                <div className="ac-profile-card__header">
                  <div>
                    <h2>Admin Profile</h2>
                    <p>Manage your administrator identity and login credentials.</p>
                  </div>
                  <span className="ac-profile-card__icon ac-profile-card__icon--teal">
                    <Icon name="shield" size={18} />
                  </span>
                </div>

                {profileLoading ? (
                  <div className="ac-profile-loading">
                    <Icon name="spinner" size={18} />
                    Loading admin profile...
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
                        placeholder="Admin display name"
                      />
                    </label>

                    <label className="ac-form-field">
                      <span className="ac-form-label">Username</span>
                      <input
                        className="ac-form-input ac-form-input--lg"
                        value={profileForm.username}
                        onChange={e => setProfileForm(form => ({ ...form, username: e.target.value }))}
                        placeholder="Admin username"
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
                      <button type="button" className="ac-btn-ghost-action" onClick={() => handleAdminTabChange('overview')}>
                        Back to Overview
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
                    <h2>Admin Scope</h2>
                    <p>Current privileges in this gateway session.</p>
                  </div>
                  <span className="ac-profile-card__icon">
                    <Icon name="user" size={18} />
                  </span>
                </div>
                <div className="ac-profile-summary__row">
                  <span>Role</span>
                  <strong>{clientInfo?.role || 'Admin'}</strong>
                </div>
                <div className="ac-profile-summary__row">
                  <span>Managed Clients</span>
                  <strong>{summary.total_clients || clients.length}</strong>
                </div>
                <div className="ac-profile-summary__row">
                  <span>Admin Accounts</span>
                  <strong>{userStats.admins || adminUsers.length || 0}</strong>
                </div>
              </aside>
            </section>
          )}

        </div>
      </main>

      {/* ===== MODAL: DAFTARKAN KLIEN BARU ===== */}
      {showClientModal && (
        <div className="ac-modal-overlay" onClick={() => setShowClientModal(false)}>
          <div className="ac-modal ac-modal--client-register" onClick={e => e.stopPropagation()}>
            <div className="ac-modal__header">
              <div className="ac-modal-title-lockup">
                <span className="ac-modal__title-icon">
                  <Icon name="building" size={18} />
                </span>
                <div>
                  <div className="ac-modal__title">Register New Client</div>
                  <div className="ac-modal__subtitle">Fill in the details for the new client company to establish connection</div>
                </div>
              </div>
              <button className="ac-modal__close" onClick={() => setShowClientModal(false)} aria-label="Close client registration">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="ac-modal__body">
              <form className="ac-register-form" onSubmit={handleSubmitClient}>
                <section className="ac-form-section">
                  <div className="ac-form-section__head">
                    <div className="ac-form-section__icon">
                      <Icon name="database" size={17} />
                    </div>
                    <div>
                      <div className="ac-form-section__title">Client Identity</div>
                      <div className="ac-form-section__subtitle">Basic tenant data used across the admin and auditor dashboards.</div>
                    </div>
                  </div>
                  <div className="ac-form-grid ac-form-grid--register">
                    <div className="ac-form-field ac-form-field--wide">
                      <label className="ac-form-label">Company Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
                      <input className="ac-form-input ac-form-input--lg" required placeholder="e.g. Acme Corporation"
                        value={clientForm.company_name}
                        onChange={e => setClientForm(f => ({ ...f, company_name: e.target.value }))} />
                    </div>
                    <div className="ac-form-field">
                      <label className="ac-form-label">Status</label>
                      <select className="ac-form-input ac-form-input--lg" value={clientForm.status}
                        onChange={e => setClientForm(f => ({ ...f, status: e.target.value }))}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className="ac-form-section">
                  <div className="ac-form-section__head">
                    <div className="ac-form-section__icon ac-form-section__icon--teal">
                      <Icon name="link" size={17} />
                    </div>
                    <div>
                      <div className="ac-form-section__title">Audit Field Mapping</div>
                      <div className="ac-form-section__subtitle">Map the primary source field used to identify the actor in audit logs.</div>
                    </div>
                  </div>
                  <div className="ac-form-grid ac-form-grid--register">
                    <div className="ac-form-field ac-form-field--wide">
                      <label className="ac-form-label">Actor Field</label>
                      <input className="ac-form-input ac-form-input--lg" placeholder="actor"
                        value={clientForm.actor_field}
                        onChange={e => setClientForm(f => ({ ...f, actor_field: e.target.value }))} />
                    </div>
                    <div className="ac-form-field">
                      <label className="ac-form-label">Fallback Actor Field</label>
                      <input className="ac-form-input ac-form-input--lg" placeholder="Optional, e.g. db_user"
                        value={clientForm.fallback_actor_field}
                        onChange={e => setClientForm(f => ({ ...f, fallback_actor_field: e.target.value }))} />
                    </div>
                  </div>
                </section>

                <div className="ac-register-form__note">
                  <Icon name="lock" size={15} />
                  API key will be generated after registration and displayed once.
                </div>

                <div className="ac-form-actions ac-register-form__actions">
                  <button type="button" className="ac-btn-ghost-action" onClick={() => setShowClientModal(false)}>Cancel</button>
                  <button type="submit" className="ac-btn-primary">
                    <Icon name="checkmark" size={15} />
                    Register Client
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ======= MODAL: API KEY & 1-COMMAND INSTALLER ======= */}
      {showApiKeyModal && (
        <div className="ac-modal-overlay">
          <div className="ac-modal" style={{ maxWidth: '680px', width: '92%' }} onClick={e => e.stopPropagation()}>
            <div className="ac-modal__header">
              <div className="ac-modal-title-lockup">
                <span className="ac-modal__title-icon ac-modal__title-icon--success">
                  <Icon name="checkCircle" size={18} />
                </span>
                <div>
                  <div className="ac-modal__title">Client Successfully Registered!</div>
                  <div className="ac-modal__subtitle">Copy and run the 1-command installer script on the client server</div>
                </div>
              </div>
            </div>
            <div className="ac-modal__body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>

              {/* 1-Command Installer Script Box (PRIMARY) */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Icon name="rocket" size={15} />
                  1-Command Automated Agent & CDC Installer
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-outline)', marginBottom: '12px' }}>
                  Copy and run this command on the Client's Linux VPS/Server terminal as Root/Sudo:
                </div>

                <div className="ac-terminal-box">
                  <div className="ac-terminal-box__header">
                    <div className="ac-terminal-box__title">
                      <Icon name="terminal" size={14} />
                      <span>BASH ONE-LINER (AUTO-CONFIGURED)</span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#8b949e', fontFamily: 'var(--font-mono)' }}>Ready to paste</span>
                  </div>
                  <div className="ac-terminal-box__code" style={{ fontSize: '12px', lineHeight: 1.5, wordBreak: 'break-all' }}>
                    {buildInstallCommand(newApiKey)}
                  </div>
                  <div className="ac-terminal-box__actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      type="button"
                      className={`ac-btn-primary ${setupCmdCopied ? 'ac-btn-primary--success' : ''}`}
                      style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700 }}
                      onClick={() => handleCopySetupCmd(buildInstallCommand(newApiKey))}
                    >
                      <Icon name={setupCmdCopied ? 'checkCircle' : 'copy'} size={14} />
                      {setupCmdCopied ? 'Command Copied!' : 'Copy Setup Command'}
                    </button>
                  </div>
                </div>

                {/* Compact API Key reference for record */}
                <div style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-surface-variant, rgba(0,0,0,0.03))',
                  borderRadius: '8px',
                  border: '1px solid var(--color-outline-variant, #e0e0e0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-outline)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Generated API Key Reference
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {newApiKey}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ac-btn-ghost-action"
                    style={{ padding: '4px 8px', fontSize: '11px', flexShrink: 0 }}
                    onClick={handleCopyApiKey}
                    title="Copy Raw API Key"
                  >
                    <Icon name={apiKeyCopied ? 'checkCircle' : 'copy'} size={13} />
                    {apiKeyCopied ? 'Copied' : 'Copy Key'}
                  </button>
                </div>

              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  className="ac-btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    setShowApiKeyModal(false);
                    setNewApiKey('');
                  }}
                >
                  <Icon name="checkmark" size={15} />
                  I Have Copied - Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: CREATE GLOBAL USER ===== */}
      {showUserModal && (
        <div className="ac-modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="ac-modal ac-modal--user-register" onClick={e => e.stopPropagation()}>
            <div className="ac-modal__header">
              <div className="ac-modal-title-lockup">
                <span className="ac-modal__title-icon ac-modal__title-icon--amber">
                  <Icon name="shield" size={18} />
                </span>
                <div>
                  <div className="ac-modal__title">Create Admin Account</div>
                  <div className="ac-modal__subtitle">Buat akun administrator untuk mengelola dashboard gateway</div>
                </div>
              </div>
              <button className="ac-modal__close" onClick={() => setShowUserModal(false)} aria-label="Close admin account form">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="ac-modal__body">
              <form className="ac-register-form" onSubmit={handleCreateGlobalUser}>
                {globalUserActionError && (
                  <div className="ac-admin-inline-alert ac-admin-inline-alert--inside">
                    <Icon name="warn" size={15} />
                    {globalUserActionError}
                  </div>
                )}

                <section className="ac-form-section">
                  <div className="ac-form-section__head">
                    <div className="ac-form-section__icon">
                      <Icon name="user" size={17} />
                    </div>
                    <div>
                      <div className="ac-form-section__title">Account Identity</div>
                      <div className="ac-form-section__subtitle">Credentials used by this user to access the gateway portal.</div>
                    </div>
                  </div>
                  <div className="ac-form-grid ac-form-grid--register">
                    <div className="ac-form-field">
                      <label className="ac-form-label">Full Name</label>
                      <input
                        className="ac-form-input ac-form-input--lg"
                        placeholder="e.g. Audit Manager"
                        value={newGlobalUser.full_name}
                        onChange={e => setNewGlobalUser(f => ({ ...f, full_name: e.target.value }))}
                        disabled={userActionLoading}
                      />
                    </div>
                    <div className="ac-form-field">
                      <label className="ac-form-label">Username <span style={{ color: 'var(--color-error)' }}>*</span></label>
                      <input
                        className="ac-form-input ac-form-input--lg"
                        required
                        minLength={4}
                        placeholder="e.g. admin_ops"
                        value={newGlobalUser.username}
                        onChange={e => setNewGlobalUser(f => ({ ...f, username: e.target.value }))}
                        disabled={userActionLoading}
                      />
                    </div>
                    <div className="ac-form-field">
                      <label className="ac-form-label">Password <span style={{ color: 'var(--color-error)' }}>*</span></label>
                      <input
                        className="ac-form-input ac-form-input--lg"
                        type="password"
                        required
                        minLength={6}
                        placeholder="Minimum 6 characters"
                        value={newGlobalUser.password}
                        onChange={e => setNewGlobalUser(f => ({ ...f, password: e.target.value }))}
                        disabled={userActionLoading}
                      />
                    </div>
                    <div className="ac-form-field">
                      <label className="ac-form-label">Confirm Password <span style={{ color: 'var(--color-error)' }}>*</span></label>
                      <input
                        className="ac-form-input ac-form-input--lg"
                        type="password"
                        required
                        minLength={6}
                        placeholder="Repeat password"
                        value={newGlobalUser.confirm_password}
                        onChange={e => setNewGlobalUser(f => ({ ...f, confirm_password: e.target.value }))}
                        disabled={userActionLoading}
                      />
                    </div>
                  </div>
                </section>

                <section className="ac-form-section">
                  <div className="ac-form-section__head">
                    <div className="ac-form-section__icon ac-form-section__icon--teal">
                      <Icon name="shield" size={17} />
                    </div>
                    <div>
                      <div className="ac-form-section__title">Access</div>
                      <div className="ac-form-section__subtitle">Akun ini hanya dibuat sebagai administrator dashboard.</div>
                    </div>
                  </div>
                  <div className="ac-admin-role-preview">
                    <span className="ac-admin-role-badge ac-admin-role-badge--admin">
                      <Icon name="shield" size={13} />
                      Admin
                    </span>
                    <div>
                      <strong>Administrator</strong>
                      <small>Dapat mengelola client, Kafka stream, dan akun admin.</small>
                    </div>
                  </div>
                  <div className="ac-register-form__note">
                    <Icon name="lock" size={15} />
                    Admin role grants gateway-wide access. Keep this limited to trusted gateway operators.
                  </div>
                </section>

                <div className="ac-form-actions ac-register-form__actions">
                  <button type="button" className="ac-btn-ghost-action" onClick={() => setShowUserModal(false)}>Cancel</button>
                  <button type="submit" className="ac-btn-primary" disabled={userActionLoading}>
                    <Icon name={userActionLoading ? 'spinner' : 'checkmark'} size={15} />
                    {userActionLoading ? 'Saving...' : 'Create Admin'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: KELOLA USER KLIEN ===== */}
      {manageUsersClient && (
        <div className="ac-modal-overlay ac-modal-overlay--above-drawer" onClick={() => setManageUsersClient(null)}>
          <div className="ac-modal" style={{ maxWidth: '800px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="ac-modal__header">
              <div className="ac-modal-title-lockup">
                <span className="ac-modal__title-icon ac-modal__title-icon--teal">
                  <Icon name="users" size={18} />
                </span>
                <div>
                  <div className="ac-modal__title">Manage Users: {manageUsersClient.company_name}</div>
                  <div className="ac-modal__subtitle">Add or remove auditor accounts for this client to access the gateway dashboard</div>
                </div>
              </div>
              <button className="ac-modal__close" onClick={() => setManageUsersClient(null)} aria-label="Close user management">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="ac-modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '20px 24px' }}>
              {/* Form Add User */}
              <div style={{ borderRight: '1px solid var(--color-outline-variant)', paddingRight: '24px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '16px' }}>Create New User Account</div>

                {userActionError && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(186, 26, 26, 0.1)',
                    color: 'var(--color-error)',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Icon name="warn" size={14} />
                    {userActionError}
                  </div>
                )}

                <form onSubmit={handleAddClientUser}>
                  <div className="ac-form-field" style={{ marginBottom: '12px' }}>
                    <label className="ac-form-label">Username <span style={{ color: 'var(--color-error)' }}>*</span></label>
                    <input
                      className="ac-form-input"
                      required
                      minLength={4}
                      placeholder="e.g. auditor_senior"
                      value={newUserUsername}
                      onChange={e => setNewUserUsername(e.target.value)}
                      disabled={userActionLoading}
                    />
                  </div>
                  <div className="ac-form-field" style={{ marginBottom: '12px' }}>
                    <label className="ac-form-label">Password <span style={{ color: 'var(--color-error)' }}>*</span></label>
                    <input
                      className="ac-form-input"
                      type="password"
                      required
                      minLength={6}
                      placeholder="******"
                      value={newUserPassword}
                      onChange={e => setNewUserPassword(e.target.value)}
                      disabled={userActionLoading}
                    />
                  </div>
                  <div className="ac-form-field" style={{ marginBottom: '20px' }}>
                    <label className="ac-form-label">Confirm Password <span style={{ color: 'var(--color-error)' }}>*</span></label>
                    <input
                      className="ac-form-input"
                      type="password"
                      required
                      minLength={6}
                      placeholder="******"
                      value={newUserConfirmPassword}
                      onChange={e => setNewUserConfirmPassword(e.target.value)}
                      disabled={userActionLoading}
                    />
                  </div>
                  <button
                    type="submit"
                    className="ac-btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    disabled={userActionLoading}
                  >
                    {userActionLoading ? 'Saving...' : 'Add Account'}
                  </button>
                </form>
              </div>

              {/* List Users */}
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '16px' }}>Registered Accounts</div>
                {userActionLoading && clientUsers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-outline)' }}>Loading user accounts...</div>
                ) : (
                  <div className="ac-table-wrap" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <table className="ac-table">
                      <thead>
                        <tr>
                          <th>Username</th>
                          <th>Role</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientUsers.length === 0 && (
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-outline)', padding: '24px 0', fontSize: '12px' }}>
                              No user accounts registered.
                            </td>
                          </tr>
                        )}
                        {clientUsers.map(user => (
                          <tr key={user.id}>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: '13px' }}>{user.username}</div>
                              <div style={{ fontSize: '10px', color: 'var(--color-outline)' }}>ID: {user.id.substring(0, 8)}...</div>
                            </td>
                            <td>
                              <span className="ac-status ac-status--pending" style={{ fontSize: '10px', padding: '2px 6px' }}>{user.role}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="ac-btn-primary ac-btn-primary--danger"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                onClick={() => handleDeleteClientUser(user)}
                                disabled={userActionLoading}
                              >
                                ❌ Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== DRAWER: CLIENT REGISTRY DETAIL ===== */}
      {selectedRegistryClient && (
        <ClientDetailDrawer
          client={selectedRegistryClient}
          detail={selectedClientDetail}
          cdcUsers={cdcUsersByClientId.get(selectedRegistryClient.id)?.users || []}
          kafkaConfig={kafkaConfigs.find(config => config.client_id === selectedRegistryClient.id)}
          activeTab={clientDrawerTab}
          onTabChange={setClientDrawerTab}
          loading={clientDetailLoading}
          error={clientDetailError}
          closing={clientDrawerClosing}
          onClose={handleCloseClientDrawer}
          onToggleClient={handleToggleClientStatus}
          onConfigureAgent={handleOpenAgentModal}
          onManageUsers={handleManageUsers}
          onDeleteClient={handleDeleteClient}
          onCreateKafka={form => handleCreateKafka(selectedRegistryClient.id, form)}
          onToggleKafka={handleToggleKafka}
          onDeleteKafka={handleDeleteKafkaConfig}
          escapeDisabled={showAgentModal || Boolean(manageUsersClient)}
        />
      )}


      {/* ===== MODAL: KONFIGURASI AGENT LAPIS 3 ===== */}
      {showAgentModal && selectedAgentClient && (
        <div className="ac-modal-overlay ac-modal-overlay--above-drawer" onClick={() => setShowAgentModal(false)}>
          <div className="ac-modal" style={{ maxWidth: '650px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="ac-modal__header">
              <div className="ac-modal-title-lockup">
                <span className="ac-modal__title-icon ac-modal__title-icon--teal">
                  <Icon name="bot" size={18} />
                </span>
                <div>
                  <div className="ac-modal__title">Agent Lapis 3: {selectedAgentClient.company_name}</div>
                  <div className="ac-modal__subtitle">Configure organization's local Agent for Gateway verification & integration</div>
                </div>
              </div>
              <button className="ac-modal__close" onClick={() => setShowAgentModal(false)} aria-label="Close agent configuration">
                <Icon name="x" size={18} />
              </button>
            </div>

            <div className="ac-modal__body" style={{ padding: '20px 24px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm, 8px)',
                backgroundColor: agentConfig ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)',
                border: agentConfig ? '1px solid rgba(76, 175, 80, 0.3)' : '1px solid rgba(255, 152, 0, 0.3)',
                marginBottom: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name={agentConfig ? 'checkCircle' : 'warn'} size={15} />
                    {agentConfig ? 'Agent Registered & Active' : 'No Registered Agent'}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: 2 }}>
                    {agentConfig ? `URL: ${agentConfig.agent_url} | Timeout: ${agentConfig.timeout_seconds}s` : 'Register local Agent URL below.'}
                  </div>
                </div>

                {agentConfig && (
                  <button
                    type="button"
                    className="ac-btn-primary"
                    style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={handlePingAgent}
                    disabled={agentPingLoading}
                  >
                    <Icon name={agentPingLoading ? 'spinner' : 'wifi'} size={14} />
                    {agentPingLoading ? 'Testing Connection...' : 'Test Connection'}
                  </button>
                )}
              </div>

              {agentPingResult && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm, 8px)',
                  marginBottom: '16px',
                  backgroundColor: agentPingResult.reachable ? 'rgba(46, 125, 50, 0.15)' : 'rgba(211, 47, 47, 0.15)',
                  border: agentPingResult.reachable ? '1px solid #2e7d32' : '1px solid #d32f2f',
                  color: agentPingResult.reachable ? '#1b5e20' : '#c62828',
                  fontSize: '12px'
                }}>
                  <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name={agentPingResult.reachable ? 'checkCircle' : 'xCircle'} size={15} />
                    {agentPingResult.reachable ? 'Agent Connected Successfully!' : 'Connection Failed / Unreachable'}
                  </div>
                  <div><strong>Target URL:</strong> {agentPingResult.agent_url}</div>
                  {agentPingResult.http_status && <div><strong>HTTP Status:</strong> {agentPingResult.http_status}</div>}
                  {agentPingResult.latency !== null && agentPingResult.latency !== undefined && (
                    <div><strong>Latency (RTT):</strong> {agentPingResult.latency} ms</div>
                  )}
                  {agentPingResult.error && <div><strong>Error Details:</strong> {agentPingResult.error}</div>}
                </div>
              )}

              {agentActionError && (
                <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: 'rgba(186,26,26,0.1)', color: 'var(--color-error)', fontSize: '12px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="warn" size={14} />
                  {agentActionError}
                </div>
              )}
              {agentActionSuccess && (
                <div style={{ padding: '10px 14px', borderRadius: '6px', backgroundColor: 'rgba(76,175,80,0.1)', color: '#2e7d32', fontSize: '12px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="checkCircle" size={14} />
                  {agentActionSuccess}
                </div>
              )}

              {agentLoading ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-outline)' }}>Loading Agent configuration...</div>
              ) : (
                <>
                  <div className="ac-agent-advanced-toggle">
                    <div>
                      <strong>{agentConfig ? 'Agent config is already stored.' : 'Agent config is required before connection testing.'}</strong>
                      <span>{agentConfig ? 'Open advanced settings only when you need to change URL, token, timeout, or revoke the agent.' : 'Register the agent URL and verify token once, then use Test Connection for routine checks.'}</span>
                    </div>
                    <button type="button" className="ac-btn-ghost-action" onClick={() => setAgentAdvancedOpen(open => !open)}>
                      {agentAdvancedOpen ? 'Hide Advanced Config' : (agentConfig ? 'Advanced Config' : 'Register Agent')}
                    </button>
                  </div>

                  {agentAdvancedOpen && (
                    <form onSubmit={handleSaveAgentConfig}>
                      <div className="ac-form-grid">
                        <div className="ac-form-field" style={{ gridColumn: '1 / -1' }}>
                          <label className="ac-form-label">Agent Server URL <span style={{ color: 'var(--color-error)' }}>*</span></label>
                          <input
                            className="ac-form-input"
                            required
                            placeholder="http://192.168.11.50:9090"
                            value={agentForm.agent_url}
                            onChange={e => setAgentForm(f => ({ ...f, agent_url: e.target.value }))}
                            disabled={agentActionLoading}
                          />
                          <div style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: 4 }}>
                            HTTP/HTTPS endpoint for the client organization's local Layer-3 Agent.
                          </div>
                        </div>

                        <div className="ac-form-field">
                          <label className="ac-form-label">Secret Verify Token <span style={{ color: 'var(--color-error)' }}>*</span></label>
                          <input
                            className="ac-form-input"
                            type="password"
                            required
                            placeholder="Secret verification token"
                            value={agentForm.verify_token}
                            onChange={e => setAgentForm(f => ({ ...f, verify_token: e.target.value }))}
                            disabled={agentActionLoading}
                          />
                          <div style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: 4 }}>
                            Required when saving because the backend does not return the stored token.
                          </div>
                        </div>

                        <div className="ac-form-field">
                          <label className="ac-form-label">Timeout (Seconds)</label>
                          <input
                            className="ac-form-input"
                            type="number"
                            min={1}
                            max={30}
                            placeholder="5"
                            value={agentForm.timeout_seconds}
                            onChange={e => setAgentForm(f => ({ ...f, timeout_seconds: e.target.value }))}
                            disabled={agentActionLoading}
                          />
                        </div>
                      </div>

                      <div className="ac-form-actions" style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          {agentConfig && (
                            <button
                              type="button"
                              className="ac-btn-primary ac-btn-primary--danger"
                              style={{ padding: '8px 14px', fontSize: '12px' }}
                              onClick={handleDeleteAgentConfig}
                              disabled={agentActionLoading}
                            >
                              🗑️ Revoke Agent
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button type="button" className="ac-btn-ghost-action" onClick={() => setShowAgentModal(false)}>Cancel</button>
                          <button type="submit" className="ac-btn-primary" disabled={agentActionLoading}>
                            {agentActionLoading ? 'Saving...' : (agentConfig ? 'Update Agent Config' : 'Register Agent')}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export { AdminPage };
export default AdminPage;
