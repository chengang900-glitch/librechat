import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DataCenter from './DataCenter';

const mockAuth = {
  user: { id: 'user-a' },
  token: 'test-only-token',
  isAuthenticated: true,
  logout: jest.fn(),
};
const mockPortal = {
  enabled: true,
  navigation: {
    dataCenter: { url: `${window.location.origin}/metabase/`, label: 'Data workspace' },
  },
};
jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({ isLoading: false, data: { portal: mockPortal } }),
}));
jest.mock('~/hooks/AuthContext', () => ({ useAuthContext: () => mockAuth }));
jest.mock('~/hooks/useLocalize', () => ({ __esModule: true, default: () => (key: string) => key }));
jest.mock('@librechat/client', () => ({
  Button: ({ children, variant: _variant, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

const response = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
const identity = { issuer: 'https://identity.example/realms/test', subject: 'subject-a' };
const setFetch = (implementation: (...args: Parameters<typeof fetch>) => Promise<Response>) => {
  const mock = jest.fn(implementation);
  Object.defineProperty(global, 'fetch', { configurable: true, writable: true, value: mock });
  return mock;
};
const mount = () =>
  render(
    <MemoryRouter>
      <DataCenter />
    </MemoryRouter>,
  );

describe('Personal Metabase workspace', () => {
  beforeEach(() => {
    mockAuth.user = { id: 'user-a' };
    mockAuth.isAuthenticated = true;
    mockAuth.logout.mockClear();
    mockPortal.navigation.dataCenter.url = `${window.location.origin}/metabase/`;
    setFetch(async () => response(identity));
  });

  it('mounts only after both authenticated identities match, without forwarding LibreChat tokens to Metabase', async () => {
    mount();
    expect(screen.queryByTitle('Data workspace')).not.toBeInTheDocument();
    const frame = await screen.findByTitle('Data workspace');
    expect(frame).toHaveAttribute('src', mockPortal.navigation.dataCenter.url);
    expect(
      screen.queryByRole('button', { name: 'com_ui_portal_data_signout' }),
    ).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/portal/data-identity',
      expect.objectContaining({ headers: { Authorization: 'Bearer test-only-token' } }),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      `${window.location.origin}/metabase/auth/keycloak/status`,
      expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }),
    );
    const mbOptions = (global.fetch as unknown as jest.Mock).mock.calls.find(([url]) =>
      url.includes('/metabase/'),
    )[1];
    expect(mbOptions.headers).toBeUndefined();
  });

  it('offers the login link when the Metabase session is missing', async () => {
    setFetch(async (url) => response(identity, String(url).includes('/metabase/') ? 401 : 200));
    mount();
    expect(await screen.findByRole('link')).toHaveAttribute('target', '_top');
    expect(screen.queryByTitle('Data workspace')).not.toBeInTheDocument();
  });

  it('offers retry when the Metabase session check fails', async () => {
    setFetch(async (url) => response(identity, String(url).includes('/metabase/') ? 403 : 200));
    mount();
    expect(
      await screen.findByRole('button', { name: 'com_ui_portal_data_retry' }),
    ).toBeInTheDocument();
    expect(screen.queryByTitle('Data workspace')).not.toBeInTheDocument();
  });

  it('refuses a stale session belonging to another subject even when the issuer matches', async () => {
    setFetch(async (url) =>
      response(
        String(url).includes('/metabase/') ? { ...identity, subject: 'subject-b' } : identity,
      ),
    );
    mount();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByTitle('Data workspace')).not.toBeInTheDocument();
  });

  it('removes the frame immediately on an account change and rejects a stale async response', async () => {
    const view = mount();
    await screen.findByTitle('Data workspace');
    setFetch(() => new Promise<Response>(() => {}));
    mockAuth.user = { id: 'user-b' };
    view.rerender(
      <MemoryRouter>
        <DataCenter />
      </MemoryRouter>,
    );
    expect(screen.queryByTitle('Data workspace')).not.toBeInTheDocument();
  });

  it.each([
    'https://other.example/metabase/',
    `${window.location.origin.replace(/^https?/, window.location.protocol === 'http:' ? 'https' : 'http')}/metabase/`,
    `${window.location.origin.replace(/^https?/, 'ftp')}/metabase/`,
    `${window.location.origin.replace('://', '://user:pass@')}/metabase/`,
    `${window.location.origin}/metabase/#fragment`,
    `${window.location.origin}/other/`,
    `${window.location.origin}/metabase/?token=bad`,
  ])('rejects a non-contract workspace URL (%s)', (url) => {
    mockPortal.navigation.dataCenter.url = url;
    mount();
    expect(screen.queryByTitle('Data workspace')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('offers retry after network failure without mounting an unauthenticated frame', async () => {
    setFetch(async () => {
      throw new Error('offline');
    });
    mount();
    await screen.findByRole('button', { name: 'com_ui_portal_data_retry' });
    expect(screen.queryByTitle('Data workspace')).not.toBeInTheDocument();
    setFetch(async () => response(identity));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_portal_data_retry' }));
    await screen.findByTitle('Data workspace');
  });
});
