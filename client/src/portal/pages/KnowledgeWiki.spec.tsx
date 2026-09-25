import { fireEvent, render, screen } from '@testing-library/react';
import KnowledgeWiki from './KnowledgeWiki';

jest.mock('~/components/Chat/Messages/Content/MarkdownLite', () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));

jest.mock('librechat-data-provider', () => ({
  dataService: {
    getPortalKnowledgeBase: jest.fn().mockResolvedValue({
      data: { extract_config: { enabled: false } },
    }),
    getPortalKnowledgeWikiIndex: jest.fn().mockResolvedValue({
      data: { intro: '产品知识 Wiki', groups: [{ title: '产品能力' }] },
    }),
    getPortalKnowledgeWikiPages: jest.fn().mockResolvedValue({
      data: {
        pages: [
          {
            slug: 'concept/业财一体化',
            title: '业财一体化',
            summary: '业务与财务一体化协同。',
            content: '# 业财一体化\n产品能力说明',
            page_type: 'concept',
            source_refs: ['document-1|产品手册'],
          },
          {
            slug: 'entity/指标魔方',
            title: '指标魔方',
            summary: '企业指标分析产品。',
            content: '# 指标魔方',
            page_type: 'entity',
          },
        ],
        total: 2,
      },
    }),
    getPortalKnowledgeWikiFolders: jest.fn().mockResolvedValue({
      data: { folders: [{ id: 'folder-1', name: '产品能力', page_count: 2 }] },
    }),
    getPortalKnowledgeWikiPage: jest.fn().mockResolvedValue({
      data: {
        slug: 'entity/指标魔方',
        title: '指标魔方',
        content: '# 指标魔方\n指标分析产品。',
        page_type: 'entity',
      },
    }),
    searchPortalKnowledgeWiki: jest.fn().mockResolvedValue({ data: { pages: [] } }),
    getPortalKnowledgeWikiGraph: jest.fn().mockResolvedValue({
      data: {
        nodes: [
          { slug: 'concept/业财一体化', title: '业财一体化', page_type: 'concept', link_count: 2 },
          { slug: 'entity/指标魔方', title: '指标魔方', page_type: 'entity', link_count: 1 },
        ],
        edges: [{ source: 'concept/业财一体化', target: 'entity/指标魔方' }],
      },
    }),
  },
}));

describe('KnowledgeWiki', () => {
  it('renders Wiki pages and opens a selected page', async () => {
    render(<KnowledgeWiki surface="wiki" />);

    expect(await screen.findByRole('heading', { name: '业财一体化' })).toBeInTheDocument();
    expect(screen.getByText('产品能力')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '打开 Wiki 页面：指标魔方' }));
    expect(await screen.findByText(/指标分析产品。/)).toBeInTheDocument();
  });

  it('renders a selected Wiki link graph with its neighboring page', async () => {
    render(<KnowledgeWiki surface="graph" />);

    expect(await screen.findByText('2 个页面')).toBeInTheDocument();
    expect(screen.getByText('1 条链接关系')).toBeInTheDocument();
    expect(screen.getByLabelText('Wiki 关系图预览')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '查看图谱节点：指标魔方' }));
    expect(await screen.findByText('关联页面（1）')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '业财一体化' })).toBeInTheDocument();
  });
});
