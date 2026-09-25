import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { portalPresetIcons } from 'librechat-data-provider';
import type {
  CreatePortalAppInput,
  CreatePortalGroupInput,
  TPortalAdminApp,
  TPortalAdminGroup,
} from 'librechat-data-provider';
import {
  useGetStartupConfig,
  usePortalAdminCatalog,
  usePortalAdminMutations,
} from '~/data-provider';
import PortalSidebar from '../components/Sidebar';
import useLocalize from '~/hooks/useLocalize';

const emptyGroup: CreatePortalGroupInput = {
  name: '',
  iconRef: 'app',
  sortOrder: 0,
  enabled: true,
};
const emptyApp: CreatePortalAppInput = {
  groupId: '',
  name: '',
  description: '',
  url: '',
  iconType: 'preset',
  iconRef: 'app',
  sortOrder: 0,
  enabled: true,
};

type Props = {
  section: 'groups' | 'apps';
};

export default function PortalAdmin({ section }: Props) {
  const localize = useLocalize();
  const configQuery = useGetStartupConfig();
  const config = configQuery.data;
  const catalog = usePortalAdminCatalog(config?.portal?.canManage === true);
  const mutations = usePortalAdminMutations();
  const [group, setGroup] = useState(emptyGroup);
  const [groupId, setGroupId] = useState<string>();
  const [app, setApp] = useState<CreatePortalAppInput>(emptyApp);
  const [appId, setAppId] = useState<string>();
  const [iconFile, setIconFile] = useState<File>();
  const [error, setError] = useState('');

  if (configQuery.isLoading) return null;
  if (!config?.portal?.enabled) return <Navigate to="/c/new" replace />;
  if (!config.portal.canManage) return <Navigate to="/portal/apps" replace />;

  const resetGroup = () => {
    setGroup(emptyGroup);
    setGroupId(undefined);
  };
  const resetApp = () => {
    setApp(emptyApp);
    setAppId(undefined);
    setIconFile(undefined);
  };
  const handleError = (value: unknown) =>
    setError(value instanceof Error ? value.message : String(value));

  const submitGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      if (groupId) {
        await mutations.updateGroup.mutateAsync({ id: groupId, input: group });
      } else {
        await mutations.createGroup.mutateAsync(group);
      }
      resetGroup();
    } catch (value) {
      handleError(value);
    }
  };

  const submitApp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      let payload: CreatePortalAppInput | FormData = app;
      if (iconFile) {
        const form = new FormData();
        form.append('payload', JSON.stringify(app));
        form.append('icon', iconFile);
        payload = form;
      }
      if (appId) {
        await mutations.updateApp.mutateAsync({ id: appId, input: payload });
      } else {
        await mutations.createApp.mutateAsync(payload);
      }
      resetApp();
    } catch (value) {
      handleError(value);
    }
  };

  const editGroup = (value: TPortalAdminGroup) => {
    setGroup({
      name: value.name,
      iconRef: value.iconRef,
      sortOrder: value.sortOrder,
      enabled: value.enabled,
    });
    setGroupId(value.id);
  };
  const editApp = (value: TPortalAdminApp) => {
    setApp({
      groupId: value.groupId,
      name: value.name,
      description: value.description,
      url: value.url,
      iconType: value.iconType,
      iconRef: value.iconRef,
      sortOrder: value.sortOrder,
      enabled: value.enabled,
    });
    setAppId(value.id);
    setIconFile(undefined);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-primary md:flex-row">
      <PortalSidebar
        groups={(catalog.data?.groups ?? []).filter((value) => value.enabled)}
        selected={section === 'groups' ? 'manage-groups' : 'manage-apps'}
        canManage
      />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-text-primary">
              {localize(
                section === 'groups' ? 'com_portal_group_management' : 'com_portal_app_management',
              )}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">{localize('com_portal_app_center')}</p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          {catalog.isError && (
            <div className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {localize('com_portal_load_failed')}
            </div>
          )}

          {section === 'groups' && (
            <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <form
                onSubmit={submitGroup}
                className="rounded-2xl border border-border-light p-5 dark:border-border-medium"
              >
                <h2 className="mb-4 text-lg font-semibold text-text-primary">
                  {localize('com_portal_groups')}
                </h2>
                <label className="mb-3 block text-sm text-text-secondary">
                  {localize('com_ui_name')}
                  <input
                    required
                    maxLength={40}
                    value={group.name}
                    onChange={(event) => setGroup({ ...group, name: event.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-border-medium bg-surface-primary px-3 text-text-primary"
                  />
                </label>
                <label className="mb-3 block text-sm text-text-secondary">
                  {localize('com_portal_icon')}
                  <select
                    value={group.iconRef}
                    onChange={(event) =>
                      setGroup({
                        ...group,
                        iconRef: event.target.value as (typeof portalPresetIcons)[number],
                      })
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-border-medium bg-surface-primary px-3 text-text-primary"
                  >
                    {portalPresetIcons.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mb-3 block text-sm text-text-secondary">
                  {localize('com_portal_sort_order')}
                  <input
                    type="number"
                    min={0}
                    max={999999}
                    value={group.sortOrder}
                    onChange={(event) =>
                      setGroup({ ...group, sortOrder: Number(event.target.value) })
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-border-medium bg-surface-primary px-3 text-text-primary"
                  />
                </label>
                <label className="mb-4 flex items-center gap-2 text-sm text-text-primary">
                  <input
                    type="checkbox"
                    checked={group.enabled}
                    onChange={(event) => setGroup({ ...group, enabled: event.target.checked })}
                  />
                  {localize('com_portal_enabled')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    {groupId ? localize('com_ui_save') : localize('com_ui_add')}
                  </button>
                  {groupId && (
                    <button
                      type="button"
                      onClick={resetGroup}
                      className="rounded-lg border px-4 py-2 text-sm"
                    >
                      {localize('com_ui_cancel')}
                    </button>
                  )}
                </div>
              </form>

              <div className="rounded-2xl border border-border-light p-5 dark:border-border-medium">
                <div className="space-y-2">
                  {(catalog.data?.groups ?? []).map((value) => (
                    <div
                      key={value.id}
                      className="flex items-center justify-between rounded-xl bg-surface-secondary px-4 py-3"
                    >
                      <div>
                        <div className="font-medium text-text-primary">{value.name}</div>
                        <div className="text-xs text-text-secondary">
                          {value.sortOrder} · {value.enabled ? 'ON' : 'OFF'}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => editGroup(value)}
                          className="rounded-lg p-2 hover:bg-surface-tertiary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(localize('com_portal_delete_group_confirm'))) {
                              mutations.deleteGroup.mutate(value.id, { onError: handleError });
                            }
                          }}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {section === 'apps' && (
            <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
              <form
                onSubmit={submitApp}
                className="rounded-2xl border border-border-light p-5 dark:border-border-medium"
              >
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text-primary">
                  <Plus className="h-5 w-5" /> {localize('com_portal_app_center')}
                </h2>
                <label className="mb-3 block text-sm text-text-secondary">
                  {localize('com_portal_group')}
                  <select
                    required
                    value={app.groupId}
                    onChange={(event) => setApp({ ...app, groupId: event.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-border-medium bg-surface-primary px-3 text-text-primary"
                  >
                    <option value="">—</option>
                    {(catalog.data?.groups ?? []).map((value) => (
                      <option key={value.id} value={value.id}>
                        {value.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mb-3 block text-sm text-text-secondary">
                  {localize('com_ui_name')}
                  <input
                    required
                    maxLength={60}
                    value={app.name}
                    onChange={(event) => setApp({ ...app, name: event.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-border-medium bg-surface-primary px-3 text-text-primary"
                  />
                </label>
                <label className="mb-3 block text-sm text-text-secondary">
                  {localize('com_ui_description')}
                  <textarea
                    maxLength={200}
                    value={app.description}
                    onChange={(event) => setApp({ ...app, description: event.target.value })}
                    className="mt-1 min-h-20 w-full rounded-lg border border-border-medium bg-surface-primary p-3 text-text-primary"
                  />
                </label>
                <label className="mb-3 block text-sm text-text-secondary">
                  {localize('com_portal_url')}
                  <input
                    required
                    type="url"
                    maxLength={2048}
                    value={app.url}
                    onChange={(event) => setApp({ ...app, url: event.target.value })}
                    className="mt-1 h-10 w-full rounded-lg border border-border-medium bg-surface-primary px-3 text-text-primary"
                  />
                </label>
                <label className="mb-3 block text-sm text-text-secondary">
                  {localize('com_portal_icon')}
                  <select
                    value={app.iconRef}
                    onChange={(event) => {
                      setApp({ ...app, iconType: 'preset', iconRef: event.target.value });
                      setIconFile(undefined);
                    }}
                    className="mt-1 h-10 w-full rounded-lg border border-border-medium bg-surface-primary px-3 text-text-primary"
                  >
                    {portalPresetIcons.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setIconFile(event.target.files?.[0])}
                    className="mt-2 block w-full text-xs text-text-secondary"
                  />
                </label>
                <label className="mb-3 block text-sm text-text-secondary">
                  {localize('com_portal_sort_order')}
                  <input
                    type="number"
                    min={0}
                    max={999999}
                    value={app.sortOrder}
                    onChange={(event) => setApp({ ...app, sortOrder: Number(event.target.value) })}
                    className="mt-1 h-10 w-full rounded-lg border border-border-medium bg-surface-primary px-3 text-text-primary"
                  />
                </label>
                <label className="mb-4 flex items-center gap-2 text-sm text-text-primary">
                  <input
                    type="checkbox"
                    checked={app.enabled}
                    onChange={(event) => setApp({ ...app, enabled: event.target.checked })}
                  />
                  {localize('com_portal_enabled')}
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    {appId ? localize('com_ui_save') : localize('com_ui_add')}
                  </button>
                  {appId && (
                    <button
                      type="button"
                      onClick={resetApp}
                      className="rounded-lg border px-4 py-2 text-sm"
                    >
                      {localize('com_ui_cancel')}
                    </button>
                  )}
                </div>
              </form>

              <div className="rounded-2xl border border-border-light p-5 dark:border-border-medium">
                <div className="space-y-2">
                  {(catalog.data?.apps ?? []).map((value) => (
                    <div
                      key={value.id}
                      className="flex items-center justify-between rounded-xl bg-surface-secondary px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-text-primary">{value.name}</div>
                        <div className="truncate text-xs text-text-secondary">{value.url}</div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => editApp(value)}
                          className="rounded-lg p-2 hover:bg-surface-tertiary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(localize('com_portal_delete_app_confirm')))
                              mutations.deleteApp.mutate(value.id, { onError: handleError });
                          }}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
