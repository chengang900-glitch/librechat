import { render, screen } from '@testing-library/react';
import Footer from './Footer';

jest.mock('react-gtm-module', () => ({ initialize: jest.fn() }));
jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({ data: undefined }),
}));
jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

describe('Chat footer in portal mode', () => {
  it('hides every footer element when the portal is enabled', () => {
    render(<Footer startupConfig={{ portal: { enabled: true } } as never} />);

    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('keeps the native footer when the portal is disabled', () => {
    render(<Footer startupConfig={{ portal: { enabled: false } } as never} />);

    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
