import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';

/**
 * 演示用的流程资产页面。原型随门户前端一起发布在
 * `client/public/assets/portal/process-assets.html`，以 `embed=1` 加载时
 * 会隐藏原型自带顶栏并直接进入「流程资产」，只保留内容区。
 */
const PROCESS_ASSETS_URL = '/assets/portal/process-assets.html?embed=1';

export default function ProcessAssets() {
  const configQuery = useGetStartupConfig();
  const localize = useLocalize();
  const [loading, setLoading] = useState(true);
  const config = configQuery.data?.portal;

  if (configQuery.isLoading) {
    return null;
  }
  if (!config?.enabled) {
    return <Navigate to="/c/new" replace />;
  }

  return (
    <main className="flex h-full min-h-0 flex-col bg-surface-primary">
      <div className="relative min-h-0 flex-1">
        {loading && (
          <p
            role="status"
            className="absolute inset-x-0 top-2 text-center text-sm text-text-secondary"
          >
            {localize('com_ui_loading')}
          </p>
        )}
        <iframe
          title="流程资产"
          src={PROCESS_ASSETS_URL}
          className="h-full w-full border-0"
          referrerPolicy="same-origin"
          onLoad={() => setLoading(false)}
        />
      </div>
    </main>
  );
}
