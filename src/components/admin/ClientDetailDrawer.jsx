import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../common/Icon';
import DBEngineBadge from '../common/DBEngineBadge';
import { formatTimestamp } from '../../utils/formatters';

const splitListValue = (value = '') => String(value || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

const getUserName = (user = {}) => (
  user.full_name || user.fullName || user.username || user.email || 'Unknown user'
);

const getUserSecondary = (user = {}) => (
  user.email || user.username || 'No secondary identity'
);

const EMPTY_KAFKA_FORM = {
  kafka_brokers: '',
  topic_prefix: '',
  pk_field: 'ID',
};

function ClientDetailDrawer({
  client,
  detail,
  cdcUsers = [],
  kafkaConfig,
  activeTab,
  onTabChange,
  loading,
  error,
  closing,
  onClose,
  onToggleClient,
  onConfigureAgent,
  onManageUsers,
  onDeleteClient,
  onCreateKafka,
  onToggleKafka,
  onDeleteKafka,
  escapeDisabled = false,
}) {
  const closeButtonRef = useRef(null);
  const [tableSearch, setTableSearch] = useState('');
  const [kafkaForm, setKafkaForm] = useState(EMPTY_KAFKA_FORM);
  const [kafkaSaving, setKafkaSaving] = useState(false);
  const [kafkaError, setKafkaError] = useState('');

  const agentConfig = detail?.agent_config || {};
  const detailClient = detail?.client || client;
  const detailKafka = detail?.kafka_config?.id ? detail.kafka_config : null;
  const resolvedKafka = kafkaConfig || detailKafka;
  const watchedTables = useMemo(() => splitListValue(agentConfig.db_tables), [agentConfig.db_tables]);
  const filteredTables = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();
    return query ? watchedTables.filter(table => table.toLowerCase().includes(query)) : watchedTables;
  }, [tableSearch, watchedTables]);
  const sourceCounts = useMemo(() => cdcUsers.reduce((result, user) => {
    const source = user.source_table || agentConfig.user_table_name || 'Unknown source';
    result[source] = (result[source] || 0) + 1;
    return result;
  }, {}), [cdcUsers, agentConfig.user_table_name]);

  useEffect(() => {
    setTableSearch('');
    setKafkaForm(EMPTY_KAFKA_FORM);
    setKafkaError('');
    closeButtonRef.current?.focus();
  }, [client.id]);

  useEffect(() => {
    if (escapeDisabled) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [escapeDisabled, onClose]);

  const handleKafkaSubmit = async event => {
    event.preventDefault();
    setKafkaError('');
    setKafkaSaving(true);
    try {
      await onCreateKafka(kafkaForm);
      setKafkaForm(EMPTY_KAFKA_FORM);
    } catch (submitError) {
      setKafkaError(submitError.message || 'Failed to save Kafka configuration.');
    } finally {
      setKafkaSaving(false);
    }
  };

  const databaseEngine = agentConfig.db_engine || detailClient?.db_engine || resolvedKafka?.db_engine || '';
  const connectorStatus = agentConfig.connector_status || 'unknown';
  const statusLabel = detailClient?.status === 'pending_setup'
    ? 'Pending Setup'
    : detailClient?.status === 'active' ? 'Active' : 'Inactive';

  return (
    <div
      className={`ac-drawer-overlay${closing ? ' ac-drawer-overlay--closing' : ''}`}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className={`ac-detail-drawer ac-client-detail-drawer${closing ? ' ac-detail-drawer--closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-detail-title"
      >
        <header className="ac-client-detail-drawer__header">
          <div className="ac-client-detail-drawer__identity">
            <span className="ac-admin-client-cell__avatar">
              {client.company_name?.charAt(0)?.toUpperCase() || 'C'}
            </span>
            <div>
              <h2 id="client-detail-title">{client.company_name}</h2>
              <code>{client.id}</code>
            </div>
          </div>
          <button ref={closeButtonRef} className="ac-modal__close" onClick={onClose} aria-label="Close client detail">
            <Icon name="x" size={18} />
          </button>
          <div className="ac-client-detail-drawer__badges">
            <span className={`ac-dot-status${detailClient?.status === 'active' ? ' ac-dot-status--active' : detailClient?.status === 'pending_setup' ? ' ac-dot-status--pending' : ' ac-dot-status--inactive'}`}>
              {statusLabel}
            </span>
            <DBEngineBadge engine={databaseEngine} />
            <span className="ac-client-detail-drawer__connector">Connector: {connectorStatus}</span>
          </div>
        </header>

        <div className="ac-drawer-tabs" role="tablist" aria-label="Client detail sections">
          {[
            ['overview', 'Overview'],
            ['cdc', `CDC Users (${cdcUsers.length})`],
            ['kafka', 'Kafka'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              className={`ac-drawer-tab${activeTab === value ? ' ac-drawer-tab--active' : ''}`}
              onClick={() => onTabChange(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ac-client-detail-drawer__body">
          {error && (
            <div className="ac-admin-inline-alert">
              <Icon name="warn" size={15} />
              {error}
            </div>
          )}
          {loading && (
            <div className="ac-profile-loading ac-client-detail-drawer__loading">
              <Icon name="spinner" size={18} />
              Loading latest client details...
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="ac-client-detail-section">
              <div className="ac-client-detail-summary-grid">
                <div><span>Registered</span><strong>{formatTimestamp(detailClient?.created_at)}</strong></div>
                <div><span>Database</span><strong>{agentConfig.db_name || 'Waiting for telemetry'}</strong></div>
                <div><span>Hostname</span><strong>{agentConfig.hostname || 'Not reported'}</strong></div>
                <div><span>Tailscale IP</span><strong>{agentConfig.tailscale_ip || 'Not reported'}</strong></div>
              </div>

              <section className="ac-watched-drawer-section">
                <div className="ac-watched-drawer-section__head">
                  <div><h3>Field Mapping</h3><p>Identity fields used while processing client audit records.</p></div>
                </div>
                <div className="ac-client-detail-key-values">
                  <span>Actor field</span><code>{detailClient?.actor_field || 'actor'}</code>
                  <span>Fallback actor</span><code>{detailClient?.fallback_actor_field || 'Not configured'}</code>
                </div>
              </section>

              <section className="ac-watched-drawer-section">
                <div className="ac-watched-drawer-section__head">
                  <div><h3>Agent & Access</h3><p>Operational controls for this client workspace.</p></div>
                </div>
                <div className="ac-client-detail-actions">
                  <button type="button" className="ac-btn-ghost-action" onClick={() => onToggleClient(client)}>
                    <Icon name={detailClient?.status === 'active' ? 'lock' : 'shield'} size={15} />
                    {detailClient?.status === 'active' ? 'Block Client' : 'Activate Client'}
                  </button>
                  <button type="button" className="ac-btn-ghost-action" onClick={() => onConfigureAgent(client)}>
                    <Icon name="bot" size={15} /> Configure Agent
                  </button>
                  <button type="button" className="ac-btn-ghost-action" onClick={() => onManageUsers(client)}>
                    <Icon name="users" size={15} /> Manage Auditor Accounts
                  </button>
                </div>
              </section>

              <section className="ac-client-detail-danger-zone">
                <div><strong>Delete client</strong><span>Permanently remove this client and revoke associated access.</span></div>
                <button type="button" className="ac-btn-primary ac-btn-primary--danger" onClick={() => onDeleteClient(client)}>
                  <Icon name="trash" size={15} /> Delete Client
                </button>
              </section>
            </div>
          )}

          {activeTab === 'cdc' && (
            <div className="ac-client-detail-section">
              <div className="ac-watched-drawer-summary">
                <div><span>Monitored Tables</span><strong>{watchedTables.length}</strong></div>
                <div><span>Detected Users</span><strong>{cdcUsers.length}</strong></div>
                <div><span>Connector</span><strong>{connectorStatus}</strong></div>
              </div>

              <section className="ac-watched-drawer-section">
                <div className="ac-watched-drawer-section__head"><div><h3>User Source</h3><p>{databaseEngine || 'Unknown engine'} · {agentConfig.db_name || 'No database metadata'}</p></div></div>
                <div className="ac-watched-source-card">
                  <span>Table</span><code>{agentConfig.user_table_name || 'Waiting for telemetry'}</code>
                  <span>Column</span><code>{agentConfig.user_column_name || 'Auto-detected'}</code>
                  <span>Sync status</span><code>{agentConfig.user_sync_status || 'Not reported'}</code>
                  <span>Sync detail</span><code>{agentConfig.user_sync_message || 'No sync warning'}</code>
                </div>
              </section>

              <section className="ac-watched-drawer-section">
                <div className="ac-watched-drawer-section__head"><div><h3>Detected Client Users</h3><p>Read-only identities discovered through client-side CDC.</p></div></div>
                {cdcUsers.length ? (
                  <div className="ac-watched-user-list">
                    {cdcUsers.map((user, index) => (
                      <div className="ac-watched-user-row" key={`${client.id}-${user.username || user.email || index}`}>
                        <span className="ac-watched-user-row__avatar">{getUserName(user).charAt(0).toUpperCase()}</span>
                        <div className="ac-watched-user-row__identity"><strong>{getUserName(user)}</strong><small>{getUserSecondary(user)}</small></div>
                        <code>{user.source_table || agentConfig.user_table_name || 'source pending'}</code>
                        <time>{user.last_seen_at ? formatTimestamp(user.last_seen_at) : 'No activity time'}</time>
                      </div>
                    ))}
                  </div>
                ) : <div className="ac-admin-empty-state">No detected users from this client yet.</div>}
              </section>

              <section className="ac-watched-drawer-section">
                <div className="ac-watched-drawer-section__head"><div><h3>All Monitored Tables</h3><p>Tables reported by the client Agent telemetry.</p></div></div>
                <label className="ac-watched-search">
                  <Icon name="search" size={15} />
                  <input value={tableSearch} onChange={event => setTableSearch(event.target.value)} placeholder="Search table name..." />
                </label>
                {filteredTables.length ? (
                  <div className="ac-watched-table-list">
                    {filteredTables.map((table, index) => (
                      <div className={`ac-watched-table-row${table === agentConfig.user_table_name ? ' ac-watched-table-row--source' : ''}`} key={`${client.id}-${table}`}>
                        <span>{index + 1}</span><code>{table}</code>{table === agentConfig.user_table_name && <em>User Source</em>}
                      </div>
                    ))}
                  </div>
                ) : <div className="ac-admin-empty-state">{tableSearch.trim() ? 'No table matched your search.' : 'No monitored table metadata yet.'}</div>}
              </section>

              <section className="ac-watched-drawer-section">
                <div className="ac-watched-drawer-section__head"><div><h3>Detected User Sources</h3><p>CDC users grouped by their originating table.</p></div></div>
                {Object.keys(sourceCounts).length ? (
                  <div className="ac-watched-source-list">
                    {Object.entries(sourceCounts).map(([source, count]) => <div key={source}><code>{source}</code><strong>{count}</strong></div>)}
                  </div>
                ) : <div className="ac-admin-empty-state">No detected user sources yet.</div>}
              </section>
            </div>
          )}

          {activeTab === 'kafka' && (
            <div className="ac-client-detail-section">
              {resolvedKafka ? (
                <>
                  <div className="ac-client-detail-summary-grid">
                    <div><span>Status</span><strong>{resolvedKafka.is_active ? 'Active' : 'Inactive'}</strong></div>
                    <div><span>DB Engine</span><strong>{resolvedKafka.db_engine || databaseEngine || 'Unknown'}</strong></div>
                    <div><span>Created</span><strong>{formatTimestamp(resolvedKafka.created_at)}</strong></div>
                    <div><span>Updated</span><strong>{formatTimestamp(resolvedKafka.updated_at)}</strong></div>
                  </div>
                  <section className="ac-watched-drawer-section">
                    <div className="ac-watched-drawer-section__head"><div><h3>Stream Configuration</h3><p>Kafka ingestion settings assigned to this client.</p></div></div>
                    <div className="ac-client-detail-key-values ac-client-detail-key-values--wide">
                      <span>Broker</span><code>{resolvedKafka.kafka_brokers}</code>
                      <span>Topic prefix</span><code>{resolvedKafka.topic_prefix}</code>
                      <span>Source system</span><code>{resolvedKafka.source_system}</code>
                      <span>PK field</span><code>{resolvedKafka.pk_field || 'ID'}</code>
                    </div>
                  </section>
                  <div className="ac-client-detail-actions">
                    <button type="button" className="ac-btn-ghost-action" onClick={() => onToggleKafka(resolvedKafka.id)}>
                      <Icon name={resolvedKafka.is_active ? 'lock' : 'shield'} size={15} />
                      {resolvedKafka.is_active ? 'Deactivate Stream' : 'Activate Stream'}
                    </button>
                    <button type="button" className="ac-btn-primary ac-btn-primary--danger" onClick={() => onDeleteKafka(resolvedKafka.id, client.company_name)}>
                      <Icon name="trash" size={15} /> Delete Configuration
                    </button>
                  </div>
                </>
              ) : (
                <form className="ac-client-kafka-form" onSubmit={handleKafkaSubmit}>
                  <div className="ac-watched-drawer-section__head"><div><h3>Add Kafka Configuration</h3><p>Create the single stream configuration for {client.company_name}.</p></div></div>
                  {kafkaError && <div className="ac-admin-inline-alert"><Icon name="warn" size={15} />{kafkaError}</div>}
                  <label className="ac-form-field"><span className="ac-form-label">Kafka Brokers *</span><input className="ac-form-input" required placeholder="192.168.1.1:9092" value={kafkaForm.kafka_brokers} onChange={event => setKafkaForm(form => ({ ...form, kafka_brokers: event.target.value }))} /></label>
                  <label className="ac-form-field"><span className="ac-form-label">Topic Prefix *</span><input className="ac-form-input" required placeholder="cdc_simrs" value={kafkaForm.topic_prefix} onChange={event => setKafkaForm(form => ({ ...form, topic_prefix: event.target.value }))} /></label>
                  <label className="ac-form-field"><span className="ac-form-label">PK Field</span><input className="ac-form-input" placeholder="ID" value={kafkaForm.pk_field} onChange={event => setKafkaForm(form => ({ ...form, pk_field: event.target.value }))} /></label>
                  <button className="ac-btn-primary" type="submit" disabled={kafkaSaving}>{kafkaSaving ? 'Saving...' : 'Add Configuration'}</button>
                </form>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default ClientDetailDrawer;
