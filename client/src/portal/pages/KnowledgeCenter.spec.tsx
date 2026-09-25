import { MemoryRouter, useLocation } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import KnowledgeCenter from './KnowledgeCenter';

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({
    isLoading: false,
    data: {
      portal: {
        enabled: true,
        canAccessKnowledge: true,
        canManageKnowledge: true,
      },
    },
  }),
}));

jest.mock('~/components/Chat/Messages/Content/MarkdownLite', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));

jest.mock('librechat-data-provider', () => ({
  dataService: {
    getPortalKnowledgeDocuments: jest.fn().mockResolvedValue({
      data: {
        items: [
          {
            id: 'document-root',
            file_name: '门户操作说明.pdf',
            folder_path: '',
            parse_status: 'completed',
          },
          {
            id: 'document-product',
            file_name: '选哲业财系统（功能清单）.xlsx',
            folder_path: '产品资料',
            parse_status: 'completed',
          },
          {
            id: 'document-metric',
            file_name: '指标魔方白皮书.pdf',
            folder_path: '产品资料/指标魔方',
            parse_status: 'completed',
          },
        ],
      },
    }),
    getPortalKnowledgeFolders: jest.fn().mockResolvedValue({
      data: {
        folders: [
          {
            path: '产品资料',
            name: '产品资料',
            total_count: 2,
            children: [
              {
                path: '产品资料/指标魔方',
                name: '指标魔方',
                document_count: 1,
              },
            ],
          },
        ],
      },
    }),
    getPortalKnowledgeFavorites: jest.fn().mockResolvedValue([]),
    getPortalKnowledgeRecents: jest.fn().mockResolvedValue([]),
    uploadPortalKnowledgeDocument: jest.fn().mockResolvedValue({}),
    movePortalKnowledgeDocument: jest.fn().mockResolvedValue({}),
  },
}));

const LocationDisplay = () => {
  const location = useLocation();
  return (
    <output data-testid="location">{`${location.pathname}${decodeURIComponent(location.search)}`}</output>
  );
};

describe('KnowledgeCenter', () => {
  it('keeps tree, folder list, breadcrumbs, and the address synchronized', async () => {
    const mockMovePortalKnowledgeDocument = jest.requireMock('librechat-data-provider').dataService
      .movePortalKnowledgeDocument as jest.Mock;
    const mockUploadPortalKnowledgeDocument = jest.requireMock('librechat-data-provider')
      .dataService.uploadPortalKnowledgeDocument as jest.Mock;
    render(
      <MemoryRouter>
        <KnowledgeCenter />
        <LocationDisplay />
      </MemoryRouter>,
    );

    expect(await screen.findByText('门户操作说明.pdf')).toBeInTheDocument();
    expect(screen.getByText('个人入口')).toBeInTheDocument();
    expect(screen.getByText('知识空间')).toBeInTheDocument();
    expect(screen.getByText('名称')).toBeInTheDocument();
    expect(screen.getByText('索引状态')).toBeInTheDocument();
    expect(screen.getByText('操作')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入文件夹：产品资料' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '展开文件夹：产品资料' }));
    expect(screen.getByRole('button', { name: '指标魔方 1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '进入文件夹：产品资料' }));

    expect(await screen.findByText('选哲业财系统（功能清单）.xlsx')).toBeInTheDocument();
    const breadcrumb = screen.getByRole('navigation', { name: '知识路径' });
    expect(within(breadcrumb).getByRole('button', { name: '选哲产品' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/?folder=产品资料');

    fireEvent.click(within(breadcrumb).getByRole('button', { name: '选哲产品' }));
    expect(await screen.findByText('门户操作说明.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/');

    const suggestion = screen.getByRole('button', { name: '指标魔方适合哪些管理场景？' });
    fireEvent.click(suggestion);

    expect(screen.getByPlaceholderText('向知识库提问')).toHaveValue('指标魔方适合哪些管理场景？');

    fireEvent.click(screen.getByRole('button', { name: '进入文件夹：产品资料' }));
    fireEvent.change(screen.getAllByLabelText('上传文档至产品资料')[0], {
      target: { files: [new File(['test'], '当前目录上传.txt', { type: 'text/plain' })] },
    });
    await waitFor(() => expect(mockUploadPortalKnowledgeDocument).toHaveBeenCalledTimes(1));
    expect(mockUploadPortalKnowledgeDocument.mock.calls[0][0].get('folder_path')).toBe('产品资料');

    fireEvent.click(
      await screen.findByRole('button', { name: '移动文档：选哲业财系统（功能清单）.xlsx' }),
    );
    const moveDialog = screen.getByRole('dialog', { name: '移动文档' });
    fireEvent.change(within(moveDialog).getByLabelText('移动到文件夹'), {
      target: { value: '产品资料/指标魔方' },
    });
    fireEvent.click(within(moveDialog).getByRole('button', { name: '确认移动' }));

    await waitFor(() =>
      expect(mockMovePortalKnowledgeDocument).toHaveBeenCalledWith(
        'document-product',
        '产品资料/指标魔方',
      ),
    );
  });
});
