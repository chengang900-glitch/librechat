import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import type { TPortalGroup } from 'librechat-data-provider';
import PortalSidebar from './Sidebar';

jest.mock('~/hooks/useLocalize', () => ({
  __esModule: true,
  default: () => (key: string) =>
    ({
      com_portal_app_center: '应用中心',
      com_portal_my_favorites: '收藏应用',
      com_portal_all_apps: '全部应用',
      com_portal_category_menu: '应用分类',
      com_portal_management_menu: '应用管理',
      com_portal_group_management: '分类管理',
      com_portal_app_management: '应用管理',
      com_portal_system_settings: '系统设置',
      com_portal_portal_settings: '门户设置',
    })[key] ?? key,
}));

const groups: TPortalGroup[] = [
  { id: 'finance', name: '财务', iconRef: 'finance', sortOrder: 1, enabled: true },
  { id: 'production', name: '生产', iconRef: 'workflow', sortOrder: 2, enabled: true },
];

describe('PortalSidebar', () => {
  it('renders two-level application, category, and management navigation with icons', () => {
    render(
      <MemoryRouter>
        <PortalSidebar groups={groups} selected="finance" canManage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('应用中心')).toHaveLength(1);
    expect(screen.getByText('应用分类')).toBeInTheDocument();
    expect(screen.getAllByText('应用管理')).toHaveLength(2);
    expect(screen.getByRole('link', { name: '收藏应用' })).toHaveAttribute(
      'href',
      '/portal/apps?section=favorites',
    );
    expect(screen.getByRole('link', { name: '财务' })).toHaveAttribute(
      'href',
      '/portal/apps?section=finance',
    );
    expect(screen.getByRole('link', { name: '分类管理' })).toHaveAttribute(
      'href',
      '/portal/admin/groups',
    );
    expect(screen.getByRole('link', { name: '门户设置' })).toHaveAttribute(
      'href',
      '/portal/admin/settings/portal',
    );
    expect(screen.getByRole('navigation').querySelectorAll('a svg')).toHaveLength(7);
  });

  it('hides management navigation from ordinary users', () => {
    render(
      <MemoryRouter>
        <PortalSidebar groups={groups} selected="all" canManage={false} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: '分类管理' })).not.toBeInTheDocument();
  });
});
