import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClientDetailDrawer from './ClientDetailDrawer';

const client = {
  id: 'client-1',
  company_name: 'PT Example',
  status: 'active',
  actor_field: 'actor_name',
  fallback_actor_field: 'username',
  created_at: '2026-09-09T01:00:00Z',
};

const detail = {
  client,
  agent_config: {
    db_engine: 'postgres',
    db_name: 'audit_db',
    db_tables: 'public.users,public.orders',
    user_table_name: 'public.users',
    user_column_name: 'username',
    connector_status: 'running',
    hostname: 'client-host',
    tailscale_ip: '100.64.0.10',
  },
};

const cdcUsers = [{
  username: 'alice',
  email: 'alice@example.com',
  full_name: 'Alice Auditor',
  source_table: 'public.users',
  last_seen_at: '2026-09-09T02:00:00Z',
}];

const defaultProps = {
  client,
  detail,
  cdcUsers,
  loading: false,
  error: '',
  closing: false,
  onClose: jest.fn(),
  onToggleClient: jest.fn(),
  onConfigureAgent: jest.fn(),
  onManageUsers: jest.fn(),
  onDeleteClient: jest.fn(),
  onCreateKafka: jest.fn().mockResolvedValue(undefined),
  onToggleKafka: jest.fn(),
  onDeleteKafka: jest.fn(),
};

function StatefulDrawer(props) {
  const [tab, setTab] = useState('overview');
  return <ClientDetailDrawer {...defaultProps} {...props} activeTab={tab} onTabChange={setTab} />;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('switches between overview and client-specific CDC information', () => {
  render(<StatefulDrawer />);

  expect(screen.getByText('Field Mapping')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /CDC Users/ }));

  expect(screen.getByText('Alice Auditor')).toBeInTheDocument();
  expect(screen.getAllByText('public.users').length).toBeGreaterThan(0);
  expect(screen.getByText('public.orders')).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText('Search table name...'), { target: { value: 'orders' } });
  expect(screen.queryByText('public.users', { selector: '.ac-watched-table-row code' })).not.toBeInTheDocument();
  expect(screen.getByText('public.orders')).toBeInTheDocument();
});

test('submits a new Kafka configuration without a client selector', async () => {
  const onCreateKafka = jest.fn().mockResolvedValue(undefined);
  render(<StatefulDrawer cdcUsers={[]} onCreateKafka={onCreateKafka} />);

  fireEvent.click(screen.getByRole('tab', { name: 'Kafka' }));
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText('192.168.1.1:9092'), { target: { value: '10.0.0.5:9092' } });
  fireEvent.change(screen.getByPlaceholderText('cdc_simrs'), { target: { value: 'audit_events' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Configuration' }));

  await waitFor(() => expect(onCreateKafka).toHaveBeenCalledWith({
    kafka_brokers: '10.0.0.5:9092',
    topic_prefix: 'audit_events',
    pk_field: 'ID',
  }));
});

test('shows and controls the existing Kafka configuration', () => {
  const onToggleKafka = jest.fn();
  const onDeleteKafka = jest.fn();
  const kafkaConfig = {
    id: 'kafka-1',
    client_id: client.id,
    kafka_brokers: 'broker:9092',
    topic_prefix: 'audit',
    source_system: 'PT Example',
    pk_field: 'id',
    is_active: true,
  };

  render(<StatefulDrawer kafkaConfig={kafkaConfig} onToggleKafka={onToggleKafka} onDeleteKafka={onDeleteKafka} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Kafka' }));
  expect(screen.getByText('broker:9092')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Deactivate Stream' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete Configuration' }));

  expect(onToggleKafka).toHaveBeenCalledWith('kafka-1');
  expect(onDeleteKafka).toHaveBeenCalledWith('kafka-1', 'PT Example');
});
