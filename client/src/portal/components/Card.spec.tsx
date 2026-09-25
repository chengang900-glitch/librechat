import { render, screen } from '@testing-library/react';
import type { TPortalApp } from 'librechat-data-provider';
import PortalCard from './Card';

jest.mock('~/hooks/useLocalize', () => ({
  __esModule: true,
  default: () => (key: string) =>
    ({
      com_portal_enter: '点击进入',
      com_ui_favorite: '收藏',
      com_ui_open_var: '打开应用',
    })[key] ?? key,
}));

const app: TPortalApp = {
  id: 'app-1',
  groupId: 'group-1',
  name: '经营分析',
  description: '经营数据看板',
  iconType: 'preset',
  iconRef: 'dashboard',
  sortOrder: 1,
  enabled: true,
};

describe('PortalCard', () => {
  it('uses the application-center entry label on the card action', () => {
    render(<PortalCard app={app} favorite={false} onFavorite={jest.fn()} onOpen={jest.fn()} />);

    expect(screen.getByRole('button', { name: '点击进入' })).toBeInTheDocument();
    expect(screen.queryByText(/Open/i)).not.toBeInTheDocument();
  });
});
