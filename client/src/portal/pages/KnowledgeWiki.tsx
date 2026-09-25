/* eslint-disable i18next/no-literal-string */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { dataService } from 'librechat-data-provider';
import { BookOpen, FileText, Folder, GitBranch, LoaderCircle, Search } from 'lucide-react';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';

type KnowledgeWikiProps = { surface: 'wiki' | 'graph' };
type RecordLike = Record<string, unknown>;

const getData = (value: unknown): RecordLike | RecordLike[] => {
  if (value && typeof value === 'object' && 'data' in value) {
    return (value as { data: RecordLike | RecordLike[] }).data;
  }
  return (value ?? {}) as RecordLike | RecordLike[];
};

const asRecord = (value: unknown): RecordLike =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordLike) : {};

const recordList = (value: unknown, key: string) => {
  const data = getData(value);
  return !Array.isArray(data) && Array.isArray(data[key]) ? (data[key] as RecordLike[]) : [];
};

const pageTitle = (page: RecordLike) => String(page.title ?? page.slug ?? '未命名 Wiki 页面');
const pageSlug = (page: RecordLike) => String(page.slug ?? '');
const pageType = (page: RecordLike) => String(page.page_type ?? 'page');
const readableWikiContent = (value: unknown) =>
  String(value ?? '')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
const truncate = (value: string, maximum = 18) =>
  value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value;

type GraphPreviewProps = {
  center: RecordLike;
  nodes: RecordLike[];
  edges: RecordLike[];
};

function WikiEgoGraph({ center, nodes, edges }: GraphPreviewProps) {
  const centerSlug = pageSlug(center);
  const nodeBySlug = useMemo(
    () =>
      new Map<string, RecordLike>(
        nodes
          .map((node): [string, RecordLike] => [pageSlug(node), node])
          .filter(([slug]) => !!slug),
      ),
    [nodes],
  );
  const neighbours = useMemo(() => {
    const slugs = new Set<string>();
    edges.forEach((edge) => {
      const source = String(edge.source ?? '');
      const target = String(edge.target ?? '');
      if (source === centerSlug) slugs.add(target);
      if (target === centerSlug) slugs.add(source);
    });
    return [...slugs]
      .map((slug) => nodeBySlug.get(slug))
      .filter((node): node is RecordLike => !!node)
      .slice(0, 8);
  }, [centerSlug, edges, nodeBySlug]);

  return (
    <svg
      aria-label="Wiki 关系图预览"
      className="h-64 w-full rounded-xl border border-border-light bg-surface-secondary dark:border-border-medium"
      viewBox="0 0 520 250"
      role="img"
    >
      {neighbours.map((node, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(neighbours.length, 1) - Math.PI / 2;
        const x = 260 + Math.cos(angle) * 165;
        const y = 125 + Math.sin(angle) * 84;
        return (
          <g key={pageSlug(node)}>
            <line x1="260" y1="125" x2={x} y2={y} stroke="currentColor" opacity="0.2" />
            <circle
              cx={x}
              cy={y}
              r="25"
              className="fill-blue-50 text-blue-500 dark:fill-blue-950"
            />
            <text x={x} y={y + 4} textAnchor="middle" className="fill-current text-[9px]">
              {truncate(pageTitle(node), 10)}
            </text>
          </g>
        );
      })}
      <circle cx="260" cy="125" r="39" className="fill-blue-600" />
      <text x="260" y="121" textAnchor="middle" className="fill-white text-[10px] font-medium">
        {truncate(pageTitle(center), 13)}
      </text>
      <text x="260" y="136" textAnchor="middle" className="fill-blue-100 text-[8px]">
        当前页面
      </text>
    </svg>
  );
}

export default function KnowledgeWiki({ surface }: KnowledgeWikiProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pages, setPages] = useState<RecordLike[]>([]);
  const [folders, setFolders] = useState<RecordLike[]>([]);
  const [indexInfo, setIndexInfo] = useState<RecordLike>({});
  const [knowledgeBase, setKnowledgeBase] = useState<RecordLike>({});
  const [nodes, setNodes] = useState<RecordLike[]>([]);
  const [edges, setEdges] = useState<RecordLike[]>([]);
  const [selectedPage, setSelectedPage] = useState<RecordLike | null>(null);
  const [selectedNode, setSelectedNode] = useState<RecordLike | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const loadWiki = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [baseResponse, indexResponse, pagesResponse, foldersResponse] = await Promise.all([
        dataService.getPortalKnowledgeBase(),
        dataService.getPortalKnowledgeWikiIndex(),
        dataService.getPortalKnowledgeWikiPages(),
        dataService.getPortalKnowledgeWikiFolders(),
      ]);
      const nextPages = recordList(pagesResponse, 'pages');
      setKnowledgeBase(asRecord(getData(baseResponse)));
      setIndexInfo(asRecord(getData(indexResponse)));
      setPages(nextPages);
      setFolders(recordList(foldersResponse, 'folders'));
      setSelectedPage((current) => current ?? nextPages[0] ?? null);
    } catch {
      setError('暂时无法读取 Wiki，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [baseResponse, graphResponse] = await Promise.all([
        dataService.getPortalKnowledgeBase(),
        dataService.getPortalKnowledgeWikiGraph(),
      ]);
      const graph = asRecord(getData(graphResponse));
      const nextNodes = Array.isArray(graph.nodes) ? (graph.nodes as RecordLike[]) : [];
      setKnowledgeBase(asRecord(getData(baseResponse)));
      setNodes(nextNodes);
      setEdges(Array.isArray(graph.edges) ? (graph.edges as RecordLike[]) : []);
      setSelectedNode((current) => current ?? nextNodes[0] ?? null);
    } catch {
      setError('暂时无法读取 Wiki 关系图谱，请稍后重试。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (surface === 'wiki') void loadWiki();
    else void loadGraph();
  }, [loadGraph, loadWiki, surface]);

  const openPage = useCallback(async (page: RecordLike) => {
    const slug = pageSlug(page);
    setSelectedPage(page);
    if (!slug) return;
    try {
      const response = await dataService.getPortalKnowledgeWikiPage(slug);
      setSelectedPage(asRecord(getData(response)));
    } catch {
      setError('未能打开该 Wiki 页面，请稍后重试。');
    }
  }, []);

  const searchWiki = useCallback(async () => {
    const keyword = query.trim();
    if (!keyword) {
      void loadWiki();
      return;
    }
    setSearching(true);
    setError('');
    try {
      const response = await dataService.searchPortalKnowledgeWiki(keyword);
      const results = recordList(response, 'pages');
      setPages(results);
      setSelectedPage(results[0] ?? null);
    } catch {
      setError('Wiki 搜索暂不可用，请稍后重试。');
    } finally {
      setSearching(false);
    }
  }, [loadWiki, query]);

  const nodeBySlug = useMemo(
    () =>
      new Map<string, RecordLike>(
        nodes
          .map((node): [string, RecordLike] => [pageSlug(node), node])
          .filter(([slug]) => !!slug),
      ),
    [nodes],
  );
  const connectedNodes = useMemo(() => {
    if (!selectedNode) return [];
    const selectedSlug = pageSlug(selectedNode);
    const slugs = new Set<string>();
    edges.forEach((edge) => {
      const source = String(edge.source ?? '');
      const target = String(edge.target ?? '');
      if (source === selectedSlug) slugs.add(target);
      if (target === selectedSlug) slugs.add(source);
    });
    return [...slugs]
      .map((slug) => nodeBySlug.get(slug))
      .filter((node): node is RecordLike => !!node);
  }, [edges, nodeBySlug, selectedNode]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-sm text-text-secondary">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-blue-600" />
        正在读取知识内容…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        {error}
        <button
          type="button"
          onClick={() => void (surface === 'wiki' ? loadWiki() : loadGraph())}
          className="ml-3 underline"
        >
          重试
        </button>
      </div>
    );
  }

  if (surface === 'graph') {
    const extractionEnabled = Boolean(asRecord(knowledgeBase.extract_config).enabled);
    return (
      <div className="space-y-5">
        <header>
          <div className="flex items-center gap-2 text-blue-600">
            <GitBranch className="h-5 w-5" />
            <span className="text-sm font-medium">知识关联</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
            Wiki 关系图谱
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {extractionEnabled
              ? '当前展示 Wiki 页面链接关系。'
              : '当前展示 Wiki 页面链接关系；实体关系抽取尚未启用。'}
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border-light bg-surface-secondary p-4 dark:border-border-medium">
            <p className="text-2xl font-semibold text-text-primary">{nodes.length} 个页面</p>
            <p className="mt-1 text-xs text-text-secondary">已纳入 Wiki 关联视图</p>
          </div>
          <div className="rounded-xl border border-border-light bg-surface-secondary p-4 dark:border-border-medium">
            <p className="text-2xl font-semibold text-text-primary">{edges.length} 条链接关系</p>
            <p className="mt-1 text-xs text-text-secondary">页面之间的显式引用</p>
          </div>
        </div>
        {!selectedNode ? (
          <p className="rounded-xl border border-border-light p-8 text-center text-sm text-text-secondary dark:border-border-medium">
            暂无 Wiki 关系数据
          </p>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_240px]">
            <div className="rounded-2xl border border-border-light bg-surface-primary p-4 shadow-sm dark:border-border-medium">
              <WikiEgoGraph center={selectedNode} nodes={nodes} edges={edges} />
              <h2 className="mt-4 text-base font-semibold text-text-primary">
                {pageTitle(selectedNode)}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                关联页面（{connectedNodes.length}）
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {connectedNodes.length ? (
                  connectedNodes.map((node) => (
                    <button
                      key={pageSlug(node)}
                      type="button"
                      onClick={() => setSelectedNode(node)}
                      className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
                    >
                      {pageTitle(node)}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-text-secondary">
                    该页面暂未关联其他 Wiki 页面。
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-border-light bg-surface-primary p-3 shadow-sm dark:border-border-medium">
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                图谱节点
              </p>
              <div className="max-h-[360px] space-y-1 overflow-y-auto">
                {nodes.slice(0, 24).map((node) => (
                  <button
                    key={pageSlug(node)}
                    type="button"
                    aria-label={`查看图谱节点：${pageTitle(node)}`}
                    onClick={() => setSelectedNode(node)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                      pageSlug(node) === pageSlug(selectedNode)
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
                    }`}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{pageTitle(node)}</span>
                    <span className="text-[10px]">{String(node.link_count ?? 0)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const selectedContent = readableWikiContent(selectedPage?.content ?? selectedPage?.summary);
  const sourceReferences = Array.isArray(selectedPage?.source_refs)
    ? (selectedPage.source_refs as unknown[]).map(String).filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-2 text-blue-600">
          <BookOpen className="h-5 w-5" />
          <span className="text-sm font-medium">知识沉淀</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">企业 Wiki</h1>
        <p className="mt-2 text-sm text-text-secondary">
          {readableWikiContent(indexInfo.intro ?? '由知识库文档沉淀的可阅读 Wiki 页面。').replace(
            /^#{1,6}\s+/gm,
            '',
          )}
        </p>
      </header>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void searchWiki();
        }}
      >
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border-light bg-surface-primary px-3 dark:border-border-medium">
          <Search className="h-4 w-4 text-text-secondary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 Wiki 页面"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
          />
        </label>
        <button
          type="submit"
          disabled={searching}
          className="rounded-xl bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {searching ? '搜索中' : '搜索'}
        </button>
      </form>
      <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)_minmax(0,1.25fr)]">
        <aside className="rounded-2xl border border-border-light bg-surface-secondary p-3 dark:border-border-medium">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            Wiki 目录
          </p>
          <div className="space-y-1">
            {folders.length ? (
              folders.slice(0, 12).map((folder) => (
                <div
                  key={String(folder.id ?? folder.path ?? folder.name)}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-text-secondary"
                >
                  <Folder className="h-4 w-4 text-amber-500" />
                  <span className="min-w-0 flex-1 truncate">
                    {String(folder.name ?? '未命名目录')}
                  </span>
                  <span className="text-[10px]">{String(folder.page_count ?? 0)}</span>
                </div>
              ))
            ) : (
              <p className="px-2 py-3 text-xs text-text-secondary">暂无 Wiki 目录</p>
            )}
          </div>
        </aside>
        <div className="rounded-2xl border border-border-light bg-surface-primary p-3 shadow-sm dark:border-border-medium">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            Wiki 页面
          </p>
          <div className="max-h-[520px] space-y-1 overflow-y-auto">
            {pages.length ? (
              pages.map((page) => (
                <button
                  key={pageSlug(page)}
                  type="button"
                  aria-label={`打开 Wiki 页面：${pageTitle(page)}`}
                  onClick={() => void openPage(page)}
                  className={`w-full rounded-xl px-3 py-3 text-left ${
                    pageSlug(page) === pageSlug(selectedPage ?? {})
                      ? 'bg-blue-50 dark:bg-blue-950'
                      : 'hover:bg-surface-tertiary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                      {pageTitle(page)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">
                    {String(page.summary ?? pageType(page))}
                  </p>
                </button>
              ))
            ) : (
              <p className="p-5 text-center text-sm text-text-secondary">暂无匹配 Wiki 页面</p>
            )}
          </div>
        </div>
        <article className="min-w-0 rounded-2xl border border-border-light bg-surface-primary p-5 shadow-sm dark:border-border-medium">
          {selectedPage ? (
            <>
              <p className="text-xs font-medium text-blue-600">{pageType(selectedPage)}</p>
              <h2 className="mt-1 text-xl font-semibold text-text-primary">
                {pageTitle(selectedPage)}
              </h2>
              <div className="markdown prose prose-sm dark:prose-invert mt-5 max-w-none break-words">
                <MarkdownLite content={selectedContent} codeExecution={false} />
              </div>
              {!!sourceReferences.length && (
                <div className="mt-6 border-t border-border-light pt-4 dark:border-border-medium">
                  <p className="text-xs font-semibold text-text-secondary">来源文档</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sourceReferences.slice(0, 8).map((reference) => (
                      <span
                        key={reference}
                        className="rounded-full bg-surface-secondary px-2.5 py-1 text-xs text-text-secondary"
                      >
                        {reference}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[300px] items-center justify-center text-sm text-text-secondary">
              请选择一个 Wiki 页面
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
