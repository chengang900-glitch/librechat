import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { dataService } from 'librechat-data-provider';
import { Navigate, useSearchParams } from 'react-router-dom';
import { usePortalCatalog, usePortalFavoriteMutation } from '~/data-provider';
import { useGetStartupConfig } from '~/data-provider';
import PortalSidebar from '../components/Sidebar';
import useLocalize from '~/hooks/useLocalize';
import PortalCard from '../components/Card';

export default function PortalApps() {
  const localize = useLocalize();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [openError, setOpenError] = useState(false);
  const [favoriteError, setFavoriteError] = useState(false);
  const configQuery = useGetStartupConfig();
  const config = configQuery.data;
  const catalog = usePortalCatalog(config?.portal?.enabled === true);
  const favoriteMutation = usePortalFavoriteMutation();
  const requestedSection = searchParams.get('section') ?? 'favorites';
  const selected =
    requestedSection === 'favorites' ||
    requestedSection === 'all' ||
    (catalog.data?.groups ?? []).some((group) => group.id === requestedSection)
      ? requestedSection
      : 'favorites';

  const favoriteIds = useMemo(
    () => new Set(catalog.data?.favoriteAppIds ?? []),
    [catalog.data?.favoriteAppIds],
  );
  const apps = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    return (catalog.data?.apps ?? []).filter((app) => {
      const inSection =
        selected === 'all' ||
        (selected === 'favorites' ? favoriteIds.has(app.id) : app.groupId === selected);
      return inSection && (!normalized || app.name.toLocaleLowerCase().includes(normalized));
    });
  }, [catalog.data?.apps, favoriteIds, search, selected]);
  const sectionLabel = useMemo(() => {
    if (selected === 'favorites') return localize('com_portal_my_favorites');
    if (selected === 'all') return localize('com_portal_all_apps');
    return catalog.data?.groups.find((group) => group.id === selected)?.name ?? '';
  }, [catalog.data?.groups, localize, selected]);

  const openApp = async (appId: string) => {
    setOpenError(false);
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      const { url } = await dataService.launchPortalApp(appId);
      if (popup) {
        popup.location.replace(url);
      } else {
        const fallback = window.open(url, '_blank', 'noopener,noreferrer');
        if (!fallback) setOpenError(true);
      }
    } catch {
      popup?.close();
      setOpenError(true);
    }
  };

  if (configQuery.isLoading) return null;
  if (!config?.portal?.enabled) return <Navigate to="/c/new" replace />;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-primary md:flex-row">
      <PortalSidebar
        groups={catalog.data?.groups ?? []}
        selected={selected}
        canManage={config.portal.canManage}
      />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-text-primary">
                {localize('com_portal_app_center')}
              </h1>
              <p className="mt-1 text-sm text-text-secondary">{sectionLabel}</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
              <label className="relative block min-w-0 flex-1 sm:flex-none">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={localize('com_portal_search_placeholder')}
                  className="h-10 w-full rounded-xl border border-border-medium bg-surface-primary pl-9 pr-3 text-sm text-text-primary outline-none focus:border-blue-500 sm:w-64"
                />
              </label>
            </div>
          </div>

          {openError && (
            <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {localize('com_portal_app_open_failed')}
            </div>
          )}
          {favoriteError && (
            <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {localize('com_portal_favorite_failed')}
            </div>
          )}

          {catalog.isLoading && <div className="py-16 text-center text-text-secondary">…</div>}
          {catalog.isError && (
            <div className="rounded-2xl border border-border-medium p-8 text-center">
              <p className="text-text-secondary">{localize('com_portal_load_failed')}</p>
              <button
                type="button"
                onClick={() => catalog.refetch()}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                {localize('com_ui_retry')}
              </button>
            </div>
          )}
          {!catalog.isLoading && !catalog.isError && apps.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border-medium p-12 text-center">
              <p className="text-text-secondary">
                {selected === 'favorites' && !search
                  ? localize('com_portal_no_favorites')
                  : localize('com_portal_app_empty')}
              </p>
              {selected === 'favorites' && (
                <button
                  type="button"
                  onClick={() => setSearchParams({ section: 'all' })}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  {localize('com_portal_browse_all')}
                </button>
              )}
            </div>
          )}
          {apps.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {apps.map((app) => (
                <PortalCard
                  key={app.id}
                  app={app}
                  favorite={favoriteIds.has(app.id)}
                  onFavorite={(favorite) => {
                    setFavoriteError(false);
                    favoriteMutation.mutate(
                      { appId: app.id, favorite },
                      { onError: () => setFavoriteError(true) },
                    );
                  }}
                  onOpen={() => openApp(app.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
