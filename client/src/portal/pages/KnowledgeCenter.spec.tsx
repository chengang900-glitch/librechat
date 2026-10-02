import { MemoryRouter, useLocation } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { useGetStartupConfig } from '~/data-provider';
import KnowledgeCenter from './KnowledgeCenter';

jest.mock('~/data-provider', () => ({ useGetStartupConfig: jest.fn() }));
jest.mock('~/hooks', () => ({ useLocalize: () => (key: string) => key }));

const mockConfig = useGetStartupConfig as jest.Mock;
const LocationDisplay = () => <span>{useLocation().pathname}</span>;
const renderCenter = () =>
  render(
    <MemoryRouter initialEntries={['/portal/knowledge']}>
      <KnowledgeCenter />
      <LocationDisplay />
    </MemoryRouter>,
  );

const configWithUrl = (url: string) => ({
  isLoading: false,
  data: {
    portal: {
      enabled: true,
      navigation: {
        documentCenter: { url, label: '知识中心' },
      },
    },
  },
});

beforeEach(() => {
  mockConfig.mockReturnValue(configWithUrl(`${window.location.origin}/weknora/`));
});

describe('WeKnora knowledge center', () => {
  it('embeds the configured same-origin WeKnora page without legacy access flags', () => {
    renderCenter();
    const frame = screen.getByTitle('知识中心');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', `${window.location.origin}/weknora/`);
    expect(frame).toHaveAttribute('referrerPolicy', 'strict-origin-when-cross-origin');
    expect(screen.getByRole('status')).toHaveTextContent('com_ui_loading');
    fireEvent.load(frame);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('opens cross-origin targets externally instead of embedding them', () => {
    mockConfig.mockReturnValue(configWithUrl('https://knowledge.example.com/'));
    renderCenter();
    expect(screen.queryByTitle('知识中心')).not.toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://knowledge.example.com/');
    expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not embed URLs with credentials even on the same origin', () => {
    mockConfig.mockReturnValue(
      configWithUrl(`${window.location.protocol}//user:pass@${window.location.host}/weknora/`),
    );
    renderCenter();
    expect(screen.queryByTitle('知识中心')).not.toBeInTheDocument();
  });

  it('waits for startup configuration', () => {
    mockConfig.mockReturnValue({ isLoading: true });
    renderCenter();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it.each([undefined, { enabled: false }])(
    'returns to chat when Portal is disabled (%p)',
    (portal) => {
      mockConfig.mockReturnValue({ isLoading: false, data: { portal } });
      renderCenter();
      expect(screen.getByText('/c/new')).toBeInTheDocument();
      expect(screen.queryByRole('main')).not.toBeInTheDocument();
    },
  );
});
