import { render, screen } from '@testing-library/react';
import ConvoLink from './ConvoLink';

const localize = (key: string) => {
  if (key === 'com_ui_new_chat') {
    return '新对话';
  }
  if (key === 'com_ui_untitled') {
    return '无标题';
  }
  return key;
};

const renderLink = (title: string | null) =>
  render(
    <ConvoLink
      isActiveConvo={false}
      isPopoverActive={false}
      title={title}
      onRename={jest.fn()}
      isSmallScreen={false}
      isHovered={false}
      isSharedBadgeVisible={false}
      localize={localize}
    >
      <span data-testid="conversation-icon" />
    </ConvoLink>,
  );

describe('ConvoLink', () => {
  it('localizes the default New Chat title without changing normal titles', () => {
    const { rerender } = renderLink('New Chat');

    expect(screen.getByText('新对话')).toBeInTheDocument();
    expect(screen.queryByText('New Chat')).not.toBeInTheDocument();

    rerender(
      <ConvoLink
        isActiveConvo={false}
        isPopoverActive={false}
        title="月度经营分析"
        onRename={jest.fn()}
        isSmallScreen={false}
        isHovered={false}
        isSharedBadgeVisible={false}
        localize={localize}
      >
        <span data-testid="conversation-icon" />
      </ConvoLink>,
    );

    expect(screen.getByText('月度经营分析')).toBeInTheDocument();
  });
});
