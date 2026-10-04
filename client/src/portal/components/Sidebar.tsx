import { Link } from 'react-router-dom';
import { FolderCog, Grid2X2, Settings, Settings2, Star } from 'lucide-react';
import type { TPortalGroup } from 'librechat-data-provider';
import type { ComponentType } from 'react';
import useLocalize from '~/hooks/useLocalize';
import { portalIcons } from './icons';

type Props = {
  groups: TPortalGroup[];
  selected: string;
  canManage: boolean;
};

type Item = {
  id: string;
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
};

export default function PortalSidebar({ groups, selected, canManage }: Props) {
  const localize = useLocalize();
  const sections: Array<{ label: string; items: Item[] }> = [
    {
      label: localize('com_portal_app_center'),
      items: [
        {
          id: 'favorites',
          label: localize('com_portal_my_favorites'),
          to: '/portal/apps?section=favorites',
          icon: Star,
        },
        {
          id: 'all',
          label: localize('com_portal_all_apps'),
          to: '/portal/apps?section=all',
          icon: Grid2X2,
        },
      ],
    },
    {
      label: localize('com_portal_category_menu'),
      items: groups.map((group) => ({
        id: group.id,
        label: group.name,
        to: `/portal/apps?section=${encodeURIComponent(group.id)}`,
        icon: portalIcons[group.iconRef] ?? portalIcons.app,
      })),
    },
    ...(canManage
      ? [
          {
            label: localize('com_portal_management_menu'),
            items: [
              {
                id: 'manage-groups',
                label: localize('com_portal_group_management'),
                to: '/portal/admin/groups',
                icon: FolderCog,
              },
              {
                id: 'manage-apps',
                label: localize('com_portal_app_management'),
                to: '/portal/admin/apps',
                icon: Settings,
              },
            ],
          },
          {
            label: localize('com_portal_system_settings'),
            items: [
              {
                id: 'portal-settings',
                label: localize('com_portal_portal_settings'),
                to: '/portal/admin/settings/portal',
                icon: Settings2,
              },
            ],
          },
        ]
      : []),
  ];

  return (
    <aside className="w-full shrink-0 border-b border-border-light bg-surface-secondary p-3 dark:border-border-medium md:w-64 md:border-b-0 md:border-r md:p-4">
      <nav
        className="flex gap-4 overflow-x-auto md:block md:space-y-5"
        aria-label={localize('com_portal_app_center')}
      >
        {sections.map((section) => (
          <section key={section.label} className="shrink-0">
            <h2 className="mb-1 px-3 text-xs font-semibold text-text-secondary">{section.label}</h2>
            <div className="flex gap-1 md:block md:space-y-1">
              {section.items.map(({ id, label, to, icon: Icon }) => (
                <Link
                  key={id}
                  to={to}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition md:w-full ${
                    selected === id
                      ? 'bg-blue-100 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
