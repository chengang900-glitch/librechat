import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';

export default function KnowledgeCenter() {
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

  const { url, label } = config.navigation.documentCenter;
  let canEmbed = false;
  try {
    const target = new URL(url);
    canEmbed = target.origin === window.location.origin && !target.username && !target.password;
  } catch {
    // Startup configuration validates the URL; fail closed if it is malformed.
  }

  return (
    <main className="flex h-full min-h-0 flex-col bg-surface-primary">
      {canEmbed ? (
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
            title={label}
            src={url}
            className="h-full w-full border-0"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setLoading(false)}
          />
        </div>
      ) : (
        <p role="status" className="p-6 text-sm text-text-secondary">
          {localize('com_ui_portal_knowledge_external')}{' '}
          <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
            {localize('com_ui_portal_knowledge_open')}
          </a>
        </p>
      )}
    </main>
  );
}
