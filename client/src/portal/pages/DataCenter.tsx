import { useEffect, useState } from 'react';
import { Button } from '@librechat/client';
import { Navigate } from 'react-router-dom';
import type { TPortalDataCenterEmbed } from 'librechat-data-provider';
import { useGetStartupConfig } from '~/data-provider';
import { getDataCenterWorkspace } from '../workspace';
import { useAuthContext } from '~/hooks/AuthContext';
import useLocalize from '~/hooks/useLocalize';

type View = { owner: string; state: 'loading' | 'auth' | 'ready' | 'error' };

export default function DataCenter() {
  const configQuery = useGetStartupConfig();
  const { user, token, isAuthenticated } = useAuthContext();
  const localize = useLocalize();
  const [view, setView] = useState<View>({ owner: '', state: 'loading' });
  const [retry, setRetry] = useState(0);
  const portal = configQuery.data?.portal;
  const owner = user?.id ?? '';
  const workspace = getDataCenterWorkspace(portal?.navigation.dataCenter.url)?.href;
  const workspaceEmbed = buildDataCenterEmbedUrl(workspace, portal?.navigation.dataCenter.embed);

  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    let alive = true;
    const check = async () => {
      if (!workspace || !owner || !token || !isAuthenticated || running) return;
      running = true;
      try {
        const [portalIdentity, metabaseIdentity] = await Promise.all([
          fetch('/api/portal/data-identity', {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }),
          fetch(`${workspace}auth/keycloak/status`, {
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal,
          }),
        ]);
        if (!alive) return;
        if (!portalIdentity.ok) {
          setView({ owner, state: 'error' });
          return;
        }
        if (metabaseIdentity.status === 401) {
          setView({ owner, state: 'auth' });
          return;
        }
        if (!metabaseIdentity.ok) throw new Error('workspace unavailable');
        const [p, m] = await Promise.all([portalIdentity.json(), metabaseIdentity.json()]);
        if (!alive) return;
        const matches =
          typeof p.issuer === 'string' &&
          typeof p.subject === 'string' &&
          p.issuer.length > 0 &&
          p.subject.length > 0 &&
          p.issuer === m.issuer &&
          p.subject === m.subject;
        setView({ owner, state: matches ? 'ready' : 'auth' });
      } catch {
        if (alive) setView({ owner, state: 'error' });
      } finally {
        running = false;
      }
    };
    setView({ owner, state: 'loading' });
    void check();
    const timer = window.setInterval(check, 30000);
    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [workspace, owner, token, isAuthenticated, retry]);

  if (configQuery.isLoading) return null;
  if (!portal?.enabled) return <Navigate to="/c/new" replace />;
  if (!workspace)
    return (
      <p role="status" className="p-6 text-text-secondary">
        {localize('com_ui_portal_data_secure')}
      </p>
    );
  const state = view.owner === owner && isAuthenticated ? view.state : 'loading';

  return (
    <main className="flex h-full min-h-0 flex-col bg-surface-primary">
      {state === 'ready' ? (
        <iframe
          key={owner}
          title={portal.navigation.dataCenter.label}
          src={workspaceEmbed}
          className="h-full min-h-0 w-full flex-1 border-0"
          referrerPolicy="same-origin"
        />
      ) : (
        <div
          role="status"
          className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-text-secondary"
        >
          <p>
            {localize(
              {
                loading: 'com_ui_loading',
                auth: 'com_ui_portal_data_auth',
                error: 'com_ui_portal_data_unavailable',
                ready: 'com_ui_loading',
              }[state] as
                | 'com_ui_loading'
                | 'com_ui_portal_data_auth'
                | 'com_ui_portal_data_unavailable',
            )}
          </p>
          {state === 'auth' && (
            <a
              href={`${workspace}auth/keycloak/login`}
              target="_top"
              className="text-sm text-text-primary underline"
            >
              {localize('com_ui_portal_data_auth')}
            </a>
          )}
          {state === 'error' && (
            <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
              {localize('com_ui_portal_data_retry')}
            </Button>
          )}
        </div>
      )}
    </main>
  );
}

function buildDataCenterEmbedUrl(
  workspace: string | undefined,
  embed: TPortalDataCenterEmbed | undefined,
) {
  if (!workspace) return undefined;
  const url = new URL(workspace);
  if (embed?.search) url.searchParams.set('search', 'true');
  if (embed?.newButton) url.searchParams.set('new_button', 'true');
  if (embed?.appSwitcher) url.searchParams.set('app_switcher', 'true');
  return url.toString();
}
