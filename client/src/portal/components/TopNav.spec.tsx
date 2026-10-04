import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TPortalStartupConfig } from 'librechat-data-provider';
import PortalTopNav from './TopNav';

const mockLogout = jest.fn();

jest.mock('~/hooks/AuthContext', () => ({
  useAuthContext: () => ({ logout: mockLogout }),
}));

jest.mock('~/components/Nav/AccountSettings', () => ({
  __esModule: true,
  default: ({
    placement,
    onPortalLogout,
  }: {
    placement?: string;
    onPortalLogout?: () => Promise<void>;
  }) => (
    <div data-testid="top-account-settings" data-placement={placement}>
      {onPortalLogout && (
        <button data-testid="portal-logout" onClick={() => void onPortalLogout()} />
      )}
    </div>
  ),
}));

const config: TPortalStartupConfig = {
  enabled: true,
  brandName: '企业AI中台',
  canManage: false,
  navigation: {
    assistant: { label: 'AI工作台', path: '/c/new' },
    dataCenter: {
      label: '数据中心',
      url: 'https://data.example.com',
      mode: 'new_tab',
    },
    documentCenter: {
      label: '知识中心',
      url: 'https://files.example.com',
      mode: 'new_tab',
    },
    appCenter: { label: '应用中心', path: '/portal/apps' },
  },
};

describe('PortalTopNav', () => {
  beforeEach(() => {
    mockLogout.mockClear();
  });

  it('centers four icon menus and places the account menu on the right', async () => {
    render(
      <MemoryRouter initialEntries={['/c/new']}>
        <PortalTopNav config={config} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('banner')).toHaveClass('grid');
    expect(screen.getByText('企业AI中台')).toBeInTheDocument();
    expect(screen.getByTestId('portal-brand-logo')).toHaveAttribute(
      'src',
      '/assets/portal/uhoo-logo.png',
    );
    expect(screen.getByTestId('portal-brand-logo')).toHaveClass('h-5');
    expect(screen.getByText('企业AI中台')).toHaveClass(
      'hidden',
      'sm:inline',
      'text-lg',
      'leading-none',
    );
    expect(screen.getByText('AI工作台')).toBeInTheDocument();
    expect(screen.getByText('数据中心')).toBeInTheDocument();
    expect(screen.getByText('知识中心')).toBeInTheDocument();
    expect(screen.getByText('应用中心')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /数据中心/ })).toHaveAttribute('href', '/portal/data');
    expect(screen.getByRole('link', { name: /知识中心/ })).toHaveAttribute(
      'href',
      '/portal/knowledge',
    );
    expect(screen.getByRole('link', { name: 'AI工作台' })).toHaveAttribute(
      'aria-label',
      'AI工作台',
    );
    expect(screen.getByRole('link', { name: '应用中心' })).toHaveAttribute(
      'aria-label',
      '应用中心',
    );
    expect(screen.getByTestId('portal-primary-nav').querySelectorAll('svg')).toHaveLength(4);
    expect(await screen.findByTestId('top-account-settings')).toHaveAttribute(
      'data-placement',
      'topbar',
    );
  });

  it.each([200, 503])(
    'passes a same-origin portal logout handler to the account menu (%s)',
    async (status) => {
      const fetchMock = jest.fn(async () => ({ ok: status === 200, status }) as Response);
      Object.defineProperty(global, 'fetch', {
        configurable: true,
        writable: true,
        value: fetchMock,
      });
      const portalConfig = {
        ...config,
        navigation: {
          ...config.navigation,
          dataCenter: {
            ...config.navigation.dataCenter,
            url: `${window.location.origin}/metabase/`,
          },
        },
      };

      render(
        <MemoryRouter initialEntries={['/portal/data']}>
          <PortalTopNav config={portalConfig} />
        </MemoryRouter>,
      );

      fireEvent.click(await screen.findByTestId('portal-logout'));
      await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
      expect(fetchMock).toHaveBeenCalledWith(
        `${window.location.origin}/metabase/auth/keycloak/logout`,
        expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
      );
    },
  );
});
