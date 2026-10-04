import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { TPortalSettings } from 'librechat-data-provider';
import {
  useGetStartupConfig,
  usePortalAdminCatalog,
  usePortalAdminMutations,
  usePortalAdminSettings,
} from '~/data-provider';
import useLocalize from '~/hooks/useLocalize';
import PortalSidebar from '../components/Sidebar';

type ServiceForm = TPortalSettings['dataCenter'];

const emptyService: ServiceForm = { enabled: true, label: '', url: '' };
const defaultLogoUrl = '/assets/portal/uhoo-logo.png';

export default function PortalSettings() {
  const localize = useLocalize();
  const configQuery = useGetStartupConfig();
  const settingsQuery = usePortalAdminSettings(configQuery.data?.portal?.canManage === true);
  const catalog = usePortalAdminCatalog(configQuery.data?.portal?.canManage === true);
  const mutations = usePortalAdminMutations();
  const [portalLogoUrl, setPortalLogoUrl] = useState('');
  const [loginLogoUrl, setLoginLogoUrl] = useState('');
  const [dataCenter, setDataCenter] = useState<ServiceForm>(emptyService);
  const [knowledgeCenter, setKnowledgeCenter] = useState<ServiceForm>(emptyService);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const settings = settingsQuery.data;
    const portal = configQuery.data?.portal;
    setPortalLogoUrl(settings?.brand.portalLogoUrl ?? defaultLogoUrl);
    setLoginLogoUrl(settings?.brand.loginLogoUrl ?? defaultLogoUrl);
    setDataCenter(
      settings?.dataCenter?.url
        ? settings.dataCenter
        : {
            enabled: true,
            label: portal?.navigation.dataCenter.label ?? '数据中心',
            url: portal?.navigation.dataCenter.url ?? '',
          },
    );
    setKnowledgeCenter(
      settings?.knowledgeCenter?.url
        ? settings.knowledgeCenter
        : {
            enabled: true,
            label: portal?.navigation.documentCenter.label ?? '知识中心',
            url: portal?.navigation.documentCenter.url ?? '',
          },
    );
  }, [settingsQuery.data, configQuery.data]);

  if (configQuery.isLoading || settingsQuery.isLoading) return null;
  if (!configQuery.data?.portal?.enabled) return <Navigate to="/c/new" replace />;
  if (!configQuery.data.portal.canManage) return <Navigate to="/portal/apps" replace />;

  const uploadLogo = async (type: 'portal' | 'login', file?: File) => {
    if (!file) return;
    setError('');
    const form = new FormData();
    form.append('logo', file);
    try {
      const result = await mutations.uploadLogo.mutateAsync({ type, input: form });
      setPortalLogoUrl(result.brand.portalLogoUrl ?? defaultLogoUrl);
      setLoginLogoUrl(result.brand.loginLogoUrl ?? defaultLogoUrl);
      setSaved(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSaved(false);
    try {
      const result = await mutations.updateSettings.mutateAsync({
        brand: {
          portalLogoUrl: portalLogoUrl || undefined,
          loginLogoUrl: loginLogoUrl || undefined,
        },
        dataCenter,
        knowledgeCenter,
      });
      setPortalLogoUrl(result.brand.portalLogoUrl ?? defaultLogoUrl);
      setLoginLogoUrl(result.brand.loginLogoUrl ?? defaultLogoUrl);
      setSaved(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-primary md:flex-row">
      <PortalSidebar
        groups={(catalog.data?.groups ?? []).filter((value) => value.enabled)}
        selected="portal-settings"
        canManage
      />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-6 lg:p-8">
        <form className="mx-auto max-w-4xl space-y-6" onSubmit={save}>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">
              {localize('com_portal_portal_settings')}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {localize('com_portal_settings_description')}
            </p>
          </div>
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          {saved && (
            <div className="rounded-xl bg-green-50 p-3 text-sm text-green-700">
              {localize('com_portal_settings_saved')}
            </div>
          )}
          <section className="rounded-2xl border border-border-light p-5 dark:border-border-medium">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">
              {localize('com_portal_brand_settings')}
            </h2>
            <div className="grid gap-5 md:grid-cols-2">
              <LogoField
                label={localize('com_portal_portal_logo')}
                url={portalLogoUrl}
                onChange={(file) => uploadLogo('portal', file)}
                emptyLabel={localize('com_portal_default_logo')}
              />
              <LogoField
                label={localize('com_portal_login_logo')}
                url={loginLogoUrl}
                onChange={(file) => uploadLogo('login', file)}
                emptyLabel={localize('com_portal_default_logo')}
              />
            </div>
          </section>
          <ServiceSection
            title={localize('com_portal_data_center_settings')}
            value={dataCenter}
            onChange={setDataCenter}
            nameLabel={localize('com_portal_setting_name')}
            addressLabel={localize('com_portal_setting_address')}
            enabledLabel={localize('com_portal_enabled')}
          />
          <ServiceSection
            title={localize('com_portal_knowledge_center_settings')}
            value={knowledgeCenter}
            onChange={setKnowledgeCenter}
            nameLabel={localize('com_portal_setting_name')}
            addressLabel={localize('com_portal_setting_address')}
            enabledLabel={localize('com_portal_enabled')}
          />
          <button
            type="submit"
            disabled={mutations.updateSettings.isLoading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {localize('com_portal_save_settings')}
          </button>
        </form>
      </main>
    </div>
  );
}

function LogoField({
  label,
  url,
  onChange,
  emptyLabel,
}: {
  label: string;
  url: string;
  onChange: (file?: File) => void;
  emptyLabel: string;
}) {
  return (
    <label className="block text-sm text-text-secondary">
      {label}
      <div className="mt-2 flex min-h-24 items-center gap-4 rounded-xl border border-dashed border-border-medium p-3">
        {url ? (
          <img src={url} alt="" className="max-h-16 max-w-[180px] object-contain" />
        ) : (
          <span>{emptyLabel}</span>
        )}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => onChange(event.target.files?.[0])}
          className="min-w-0 text-xs"
        />
      </div>
    </label>
  );
}

function ServiceSection({
  title,
  value,
  onChange,
  nameLabel,
  addressLabel,
  enabledLabel,
}: {
  title: string;
  value: ServiceForm;
  onChange: (value: ServiceForm) => void;
  nameLabel: string;
  addressLabel: string;
  enabledLabel: string;
}) {
  return (
    <section className="rounded-2xl border border-border-light p-5 dark:border-border-medium">
      <h2 className="mb-4 text-lg font-semibold text-text-primary">{title}</h2>
      <div className="grid gap-4 md:grid-cols-[160px_1fr]">
        <label className="text-sm text-text-secondary">
          {nameLabel}
          <input
            required
            maxLength={40}
            value={value.label}
            onChange={(event) => onChange({ ...value, label: event.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-border-medium bg-surface-primary px-3 text-text-primary"
          />
        </label>
        <label className="text-sm text-text-secondary">
          {addressLabel}
          <input
            required
            type="url"
            value={value.url}
            onChange={(event) => onChange({ ...value, url: event.target.value })}
            className="mt-1 h-10 w-full rounded-lg border border-border-medium bg-surface-primary px-3 text-text-primary"
          />
        </label>
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
        />
        {enabledLabel}
      </label>
    </section>
  );
}
