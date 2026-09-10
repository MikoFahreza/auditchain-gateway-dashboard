import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import api from '../api';
import AdminPage from './AdminPage';

jest.mock('../api', () => ({
  __esModule: true,
  default: {
    defaults: { baseURL: 'http://localhost:8080/api' },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockImplementation(url => {
    if (url === '/admin/summary') return Promise.resolve({ data: { total_clients: 0 } });
    return Promise.resolve({ data: [] });
  });
});

test('redirects legacy Kafka URL to the unified Client Registry', async () => {
  render(
    <MemoryRouter initialEntries={['/admin?tab=kafka']}>
      <Routes>
        <Route path="/admin" element={<><AdminPage onLogout={jest.fn()} /><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>
  );

  await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?tab=clients'));
  expect(screen.getByRole('heading', { name: 'Client Registry' })).toBeInTheDocument();
  expect(screen.queryByText('Client Users CDC')).not.toBeInTheDocument();
  expect(screen.queryByText('Kafka Configuration')).not.toBeInTheDocument();
});
