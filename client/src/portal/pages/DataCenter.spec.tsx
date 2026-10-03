import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

  it.each([401, 403])('refuses a missing/invalid Metabase session (%s)', async (status) => {
    setFetch(async (url) => response(identity, String(url).includes('/metabase/') ? status : 200));
    mount();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByTitle('Data workspace')).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('target', '_top');
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

  it('removes the frame and clears Metabase before invoking LibreChat logout', async () => {
    mount();
    await screen.findByTitle('Data workspace');
    let finish: (value: Response) => void = () => {};
    setFetch(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_portal_data_signout' }));
    expect(screen.queryByTitle('Data workspace')).not.toBeInTheDocument();
    expect(mockAuth.logout).not.toHaveBeenCalled();
    await act(async () => finish(response({}, 503)));
    expect(mockAuth.logout).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `${window.location.origin}/metabase/auth/keycloak/logout`,
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
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
