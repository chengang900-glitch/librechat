import { useEffect, useState } from 'react';
import { ExternalLink, Star } from 'lucide-react';
import { dataService } from 'librechat-data-provider';
import type { TPortalApp } from 'librechat-data-provider';
import type { ReactNode } from 'react';
import useLocalize from '~/hooks/useLocalize';
import { portalIcons } from './icons';

type Props = {
  app: TPortalApp;
  favorite: boolean;
  onFavorite: (favorite: boolean) => void;
  onOpen: () => void;
};

type UploadedIconProps = {
  src: string;
  fallback: ReactNode;
};

function UploadedPortalIcon({ src, fallback }: UploadedIconProps) {
  const [objectUrl, setObjectUrl] = useState<string>();

  useEffect(() => {
    let active = true;
    let nextObjectUrl: string | undefined;
    setObjectUrl(undefined);

    dataService
      .getPortalIcon(src)
      .then((response) => {
        nextObjectUrl = window.URL.createObjectURL(response.data);
        if (active) {
          setObjectUrl(nextObjectUrl);
        } else {
          window.URL.revokeObjectURL(nextObjectUrl);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      if (nextObjectUrl) {
        window.URL.revokeObjectURL(nextObjectUrl);
      }
    };
  }, [src]);

  if (!objectUrl) {
    return fallback;
  }

  return <img src={objectUrl} alt="" className="h-full w-full object-cover" />;
}

export default function PortalCard({ app, favorite, onFavorite, onOpen }: Props) {
  const localize = useLocalize();
  const PresetIcon = portalIcons[app.iconRef] ?? portalIcons.app;
  const renderIcon = () => {
    const fallback = <span className="text-lg font-semibold">{app.name.slice(0, 1)}</span>;
    if (app.iconType === 'upload' && app.iconUrl) {
      return <UploadedPortalIcon src={app.iconUrl} fallback={fallback} />;
    }
    if (app.iconType === 'preset') {
      return <PresetIcon className="h-6 w-6" />;
    }
    return fallback;
  };

  return (
    <article className="group flex min-h-52 flex-col rounded-2xl border border-border-light bg-surface-primary p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-border-medium">
      <div className="mb-4 flex items-start justify-between gap-3">
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          onClick={onOpen}
          aria-label={localize('com_ui_open_var', { 0: app.name })}
        >
          {renderIcon()}
        </button>
        <button
          type="button"
          className="rounded-lg p-2 text-text-secondary hover:bg-surface-secondary hover:text-amber-500"
          onClick={() => onFavorite(!favorite)}
          aria-label={localize(favorite ? 'com_ui_unfavorite' : 'com_ui_favorite')}
        >
          <Star className={`h-5 w-5 ${favorite ? 'fill-amber-400 text-amber-500' : ''}`} />
        </button>
      </div>
      <button type="button" onClick={onOpen} className="text-left">
        <h3 className="text-base font-semibold text-text-primary">{app.name}</h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-text-secondary">
          {app.description || '—'}
        </p>
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="mt-auto flex items-center gap-1 pt-5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
      >
        {localize('com_portal_enter')}
        <ExternalLink className="h-4 w-4" />
      </button>
    </article>
  );
}
