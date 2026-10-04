import { lazy, Suspense, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { Skeleton } from '@librechat/client';
import { BarChart3, BookOpen, Brain, LayoutGrid } from 'lucide-react';
import type { TPortalStartupConfig } from 'librechat-data-provider';
import { getDataCenterWorkspace } from '../workspace';
import { useAuthContext } from '~/hooks/AuthContext';

const AccountSettings = lazy(() => import('~/components/Nav/AccountSettings'));

export default function PortalTopNav({ config }: { config: TPortalStartupConfig }) {
  const { logout } = useAuthContext();
  const workspace = getDataCenterWorkspace(config.navigation.dataCenter.url)?.href;
  const portalLogout = useCallback(async () => {
    if (!workspace) return;
    const result = await fetch(`${workspace}auth/keycloak/logout`, {
      method: 'POST',
      credentials: 'same-origin',
    });
    if (!result.ok && result.status !== 503) throw new Error('logout failed');
    logout();
  }, [workspace, logout]);

  const internalClass = ({ isActive }: { isActive: boolean }) =>
    `flex h-14 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition sm:px-5 ${
      isActive
        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-text-secondary hover:text-text-primary'
    }`;

  return (
    <header className="grid h-14 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center border-b border-border-light bg-surface-primary px-3 dark:border-border-medium sm:px-4">
      <div className="flex min-w-0 items-center gap-2 justify-self-start pr-2 sm:pr-4">
        <img
          data-testid="portal-brand-logo"
          src="/assets/portal/uhoo-logo.png"
          alt=""
          className="h-5 w-auto shrink-0 object-contain"
        />
        <span className="hidden truncate text-lg font-semibold leading-none text-text-primary sm:inline">
          {config.brandName}
        </span>
      </div>
      <nav
        data-testid="portal-primary-nav"
        className="flex min-w-0 items-center justify-center overflow-x-auto"
        aria-label={config.brandName}
      >
        <NavLink
          to={config.navigation.assistant.path}
          className={internalClass}
          aria-label={config.navigation.assistant.label}
        >
          <Brain className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="hidden sm:inline">{config.navigation.assistant.label}</span>
        </NavLink>
        <NavLink
          to="/portal/data"
          className={internalClass}
          aria-label={config.navigation.dataCenter.label}
        >
          <BarChart3 className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="hidden sm:inline">{config.navigation.dataCenter.label}</span>
        </NavLink>
        <NavLink
          to="/portal/knowledge"
          className={internalClass}
          aria-label={config.navigation.documentCenter.label}
        >
          <BookOpen className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="hidden sm:inline">{config.navigation.documentCenter.label}</span>
        </NavLink>
        <NavLink
          to={config.navigation.appCenter.path}
          className={internalClass}
          aria-label={config.navigation.appCenter.label}
        >
          <LayoutGrid className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="hidden sm:inline">{config.navigation.appCenter.label}</span>
        </NavLink>
      </nav>
      <div className="justify-self-end pl-2 sm:pl-4">
        <Suspense fallback={<Skeleton className="h-9 w-9 rounded-lg" />}>
          <AccountSettings
            collapsed
            placement="topbar"
            onPortalLogout={workspace ? portalLogout : undefined}
          />
        </Suspense>
      </div>
    </header>
  );
}
