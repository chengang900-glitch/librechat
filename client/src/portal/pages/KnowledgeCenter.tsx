/* eslint-disable i18next/no-literal-string */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dataService } from 'librechat-data-provider';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  FolderTree,
  LoaderCircle,
  MessageSquareText,
  Network,
  RotateCcw,
  Search,
  Send,
  Square,
  Star,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import type {
  PortalKnowledgeFavorite,
  PortalKnowledgeAuditEntry,
  PortalKnowledgeMessage,
  PortalKnowledgeRecent,
  PortalKnowledgeReference,
} from 'librechat-data-provider';
import MarkdownLite from '~/components/Chat/Messages/Content/MarkdownLite';
import { useGetStartupConfig } from '~/data-provider';
import KnowledgeWiki from './KnowledgeWiki';

type RecordLike = Record<string, unknown>;
type FolderNode = {
  path: string;
  name: string;
  document_count?: number;
  total_count?: number;
  children?: FolderNode[];
};
type KnowledgeView = 'root' | 'all' | 'favorites' | 'recents';
type KnowledgeSurface = 'documents' | 'wiki' | 'graph';
type FolderOption = { path: string; label: string };
type BreadcrumbItem = { path: string; name: string };
const getData = (value: unknown): RecordLike | RecordLike[] => {
  if (value && typeof value === 'object' && 'data' in value)
    return (value as { data: RecordLike | RecordLike[] }).data;
  return (value ?? {}) as RecordLike | RecordLike[];
};
const documentList = (value: unknown): RecordLike[] => {
  const data = getData(value);
  if (Array.isArray(data)) return data;
  return Array.isArray(data.items) ? (data.items as RecordLike[]) : [];
};
const folderList = (value: unknown): FolderNode[] => {
  const data = getData(value);
  if (Array.isArray(data)) return data as FolderNode[];
  return Array.isArray(data.folders) ? (data.folders as FolderNode[]) : [];
};
const searchResultList = (value: unknown): RecordLike[] => {
  const data = getData(value);
  return Array.isArray(data) ? data : [];
};
const messageList = (value: unknown): PortalKnowledgeMessage[] => {
  const data = getData(value);
  let items: unknown[] = [];
  if (Array.isArray(data)) items = data;
  else if (Array.isArray(data.items)) items = data.items;
  return items.filter((item): item is PortalKnowledgeMessage => !!item && typeof item === 'object');
};
const repairMojibake = (value: string) => {
  const bytes = Array.from(value, (char) => char.charCodeAt(0));
  if (bytes.some((byte) => byte > 0xff)) return value;
  if (!/[\u0080-\u00ff]/.test(value)) return value;
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    const cjkCount = (text: string) => (text.match(/[\u3400-\u9fff]/g) || []).length;
    return cjkCount(decoded) > cjkCount(value) ? decoded : value;
  } catch {
    return value;
  }
};
const title = (item: RecordLike) =>
  repairMojibake(
    String(
      item.file_name ??
        item.name ??
        item.title ??
        item.filename ??
        item.knowledge_filename ??
        '未命名文档',
    ),
  );
const parseStatus = (item: RecordLike) =>
  String(item.parse_status ?? item.status ?? item.index_status ?? '').toLowerCase();
const status = (item: RecordLike) => {
  const current = parseStatus(item);
  if (current === 'completed' && item.enable_status === 'disabled') return '已解析 · 未启用';
  return (
    {
      pending: '排队中',
      processing: '解析中',
      finalizing: '索引优化中',
      completed: '已索引',
      failed: '索引失败',
      cancelled: '已取消',
      deleting: '删除中',
    }[current] ??
    (current || '已提交')
  );
};
const isActiveStatus = (item: RecordLike) =>
  ['pending', 'processing', 'finalizing'].includes(parseStatus(item));
const targetKey = (targetType: string, targetId: string) => `${targetType}:${targetId}`;
const cleanAnswer = (value: string) =>
  value
    .replace(/<kb\b[^>]*\/?>/gi, '')
    .replace(/!\[[^\]]*\]\(resource:\/\/[^)]+\)/gi, '')
    .trim();
const uniqueReferences = (items: PortalKnowledgeReference[]) => {
  const seen = new Set<string>();
  return items.filter((reference) => {
    const key = String(
      reference.knowledge_id ?? reference.knowledge_title ?? reference.knowledge_filename ?? '',
    );
    if (!key || seen.has(key)) return !key;
    seen.add(key);
    return true;
  });
};
const flattenFolderOptions = (folders: FolderNode[], depth = 0): FolderOption[] =>
  folders.flatMap((folder) => [
    { path: folder.path, label: `${'　'.repeat(depth)}${folder.name}` },
    ...flattenFolderOptions(folder.children ?? [], depth + 1),
  ]);
const findFolderTrail = (folders: FolderNode[], path: string): FolderNode[] => {
  for (const folder of folders) {
    if (folder.path === path) return [folder];
    const trail = findFolderTrail(folder.children ?? [], path);
    if (trail.length) return [folder, ...trail];
  }
  return [];
};
const directChildren = (folders: FolderNode[], path: string) => {
  if (!path) return folders;
  const trail = findFolderTrail(folders, path);
  return trail.at(-1)?.children ?? [];
};
const folderCount = (folder: FolderNode) => folder.total_count ?? folder.document_count ?? 0;
const auditActionLabel = (action: string) =>
  ({
    'portal.knowledge.document_uploaded': '上传文档',
    'portal.knowledge.document_previewed': '预览文档',
    'portal.knowledge.document_downloaded': '下载文档',
    'portal.knowledge.document_reparsed': '重新解析',
    'portal.knowledge.document_parse_cancelled': '取消解析',
    'portal.knowledge.document_moved': '移动文档',
    'portal.knowledge.document_deleted': '删除文档',
    'portal.knowledge.question_asked': '知识问答',
  })[action] ?? '知识操作';
const auditTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};
const knowledgeSessionStorageKey = 'librechat.portal.knowledge.session';
const suggestedQuestions = [
  '选哲业财系统包含哪些核心功能？',
  '指标魔方适合哪些管理场景？',
  '产品如何支持业财一体化？',
];
const documentFolder = (item: RecordLike) => repairMojibake(String(item.folder_path ?? ''));
const statusClassName = (item: RecordLike) => {
  const current = parseStatus(item);
  if (current === 'failed') return 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300';
  if (isActiveStatus(item))
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
  if (current === 'completed')
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
  return 'bg-surface-secondary text-text-secondary';
};

type FolderTreeNodeProps = {
  folder: FolderNode;
  depth: number;
  selectedFolder: string;
  expandedFolders: Set<string>;
  ancestorFolders: Set<string>;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
};

function FolderTreeNode({
  folder,
  depth,
  selectedFolder,
  expandedFolders,
  ancestorFolders,
  onSelect,
  onToggle,
}: FolderTreeNodeProps) {
  const children = folder.children ?? [];
  const hasChildren = children.length > 0;
  const expanded =
    hasChildren && (expandedFolders.has(folder.path) || ancestorFolders.has(folder.path));
  const selected = selectedFolder === folder.path;

  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: `${4 + depth * 14}px` }}>
        {hasChildren ? (
          <button
            type="button"
            aria-label={`${expanded ? '收起' : '展开'}文件夹：${folder.name}`}
            aria-expanded={expanded}
            onClick={() => onToggle(folder.path)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-7 shrink-0" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => onSelect(folder.path)}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
            selected
              ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
              : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
          }`}
        >
          {selected ? (
            <FolderOpen className="h-4 w-4 shrink-0" />
          ) : (
            <Folder className="h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate">{folder.name}</span>
          <span className="text-[10px] text-text-secondary">{folderCount(folder)}</span>
        </button>
      </div>
      {expanded &&
        children.map((child) => (
          <FolderTreeNode
            key={child.path}
            folder={child}
            depth={depth + 1}
            selectedFolder={selectedFolder}
            expandedFolders={expandedFolders}
            ancestorFolders={ancestorFolders}
            onSelect={onSelect}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}

export default function KnowledgeCenter() {
  const configQuery = useGetStartupConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState<RecordLike[]>([]);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [favoriteTargets, setFavoriteTargets] = useState<Set<string>>(new Set());
  const [recentTargets, setRecentTargets] = useState<Set<string>>(new Set());
  const [recentItems, setRecentItems] = useState<PortalKnowledgeRecent[]>([]);
  const [auditEntries, setAuditEntries] = useState<PortalKnowledgeAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [showAudit, setShowAudit] = useState(false);
  const [favoriteBusyId, setFavoriteBusyId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [references, setReferences] = useState<PortalKnowledgeReference[]>([]);
  const [messages, setMessages] = useState<PortalKnowledgeMessage[]>([]);
  const [liveQuestion, setLiveQuestion] = useState('');
  const [contentResults, setContentResults] = useState<RecordLike[] | null>(null);
  const [contentSearching, setContentSearching] = useState(false);
  const [asking, setAsking] = useState(false);
  const [busyDocumentId, setBusyDocumentId] = useState('');
  const [movingDocument, setMovingDocument] = useState<RecordLike>();
  const [moveDestination, setMoveDestination] = useState('');
  const askControllerRef = useRef<AbortController | null>(null);
  const knowledgeSessionIdRef = useRef('');
  const answerRef = useRef('');
  const referencesRef = useRef<PortalKnowledgeReference[]>([]);
  const [previewDocument, setPreviewDocument] = useState<
    { item: RecordLike; url: string } | undefined
  >();
  const [previewingId, setPreviewingId] = useState('');
  const canAccessKnowledge = configQuery.data?.portal?.canAccessKnowledge === true;
  const canManageKnowledge = configQuery.data?.portal?.canManageKnowledge === true;

  useEffect(
    () => () => {
      if (previewDocument?.url) URL.revokeObjectURL(previewDocument.url);
    },
    [previewDocument],
  );

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const result = await dataService.getPortalKnowledgeDocuments();
      setDocuments(documentList(result));
      try {
        setFolders(folderList(await dataService.getPortalKnowledgeFolders()));
      } catch {
        setFolders([]);
      }
      const [favorites, recents] = await Promise.all([
        dataService.getPortalKnowledgeFavorites().catch(() => [] as PortalKnowledgeFavorite[]),
        dataService.getPortalKnowledgeRecents().catch(() => [] as PortalKnowledgeRecent[]),
      ]);
      setFavoriteTargets(
        new Set(favorites.map((item) => targetKey(item.targetType, item.targetId))),
      );
      setRecentItems(recents);
      setRecentTargets(
        new Set(
          recents
            .filter((item) => item.targetType === 'document')
            .map((item) => targetKey(item.targetType, item.targetId)),
        ),
      );
    } catch {
      setError('暂时无法读取知识库，请稍后重试。');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const clearStoredSession = useCallback(() => {
    knowledgeSessionIdRef.current = '';
    window.sessionStorage.removeItem(knowledgeSessionStorageKey);
  }, []);

  const loadSessionMessages = useCallback(
    async (sessionId: string): Promise<boolean> => {
      try {
        const result = await dataService.getPortalKnowledgeSessionMessages(sessionId);
        const nextMessages = messageList(result).sort(
          (left, right) =>
            new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime(),
        );
        setMessages(nextMessages);
        return true;
      } catch (requestError) {
        const status =
          typeof requestError === 'object' && requestError != null && 'response' in requestError
            ? Number((requestError as { response?: { status?: number } }).response?.status)
            : 0;
        if (status === 403 || status === 404) {
          clearStoredSession();
          setMessages([]);
          return false;
        }
        setError('暂时无法恢复知识问答记录，请稍后重试。');
        return false;
      }
    },
    [clearStoredSession],
  );

  useEffect(() => {
    if (!canAccessKnowledge) return;
    void refresh();
    const sessionId = window.sessionStorage.getItem(knowledgeSessionStorageKey);
    if (sessionId) {
      knowledgeSessionIdRef.current = sessionId;
      void loadSessionMessages(sessionId);
    }
  }, [canAccessKnowledge, loadSessionMessages, refresh]);

  useEffect(() => {
    if (!canAccessKnowledge || !documents.some(isActiveStatus)) return undefined;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      if (document.visibilityState !== 'hidden') await refresh(false);
      if (!cancelled) timer = window.setTimeout(poll, 5000);
    };
    timer = window.setTimeout(poll, 5000);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [canAccessKnowledge, documents, refresh]);
  const selectedFolder = searchParams.get('folder') ?? '';
  const requestedSurface = searchParams.get('surface');
  const knowledgeSurface: KnowledgeSurface =
    requestedSurface === 'wiki' || requestedSurface === 'graph' ? requestedSurface : 'documents';
  const requestedView = searchParams.get('view');
  let knowledgeView: KnowledgeView = 'root';
  if (!selectedFolder) {
    if (requestedView === 'all' || requestedView === 'favorites' || requestedView === 'recents') {
      knowledgeView = requestedView;
    }
  }
  const mobileFolderOptions = useMemo(() => flattenFolderOptions(folders), [folders]);
  const folderTrail = useMemo(
    () => (selectedFolder ? findFolderTrail(folders, selectedFolder) : []),
    [folders, selectedFolder],
  );
  const ancestorFolders = useMemo(
    () => new Set(folderTrail.slice(0, -1).map((folder) => folder.path)),
    [folderTrail],
  );
  const childFolders = useMemo(
    () => (knowledgeView === 'root' ? directChildren(folders, selectedFolder) : []),
    [folders, knowledgeView, selectedFolder],
  );
  const currentScopeName = useMemo(() => {
    if (knowledgeView === 'all') return '全部文档';
    if (knowledgeView === 'favorites') return '收藏文档';
    if (knowledgeView === 'recents') return '最近使用';
    return folderTrail.at(-1)?.name ?? '选哲产品';
  }, [folderTrail, knowledgeView]);
  const breadcrumbItems = useMemo<BreadcrumbItem[]>(
    () => [
      { path: '', name: '选哲产品' },
      ...folderTrail.map((folder) => ({ path: folder.path, name: folder.name })),
    ],
    [folderTrail],
  );
  const visibleDocuments = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    return documents.filter((item) => {
      const documentId = String(item.id ?? '');
      const folderPath = String(item.folder_path ?? '');
      let inView = true;
      if (knowledgeView === 'favorites') {
        inView = favoriteTargets.has(targetKey('document', documentId));
      } else if (knowledgeView === 'recents') {
        inView = recentTargets.has(targetKey('document', documentId));
      } else if (knowledgeView === 'root') {
        inView = folderPath === selectedFolder;
      }
      return inView && (!keyword || title(item).toLocaleLowerCase().includes(keyword));
    });
  }, [documents, favoriteTargets, knowledgeView, recentTargets, search, selectedFolder]);
  const navigateToFolder = useCallback(
    (path = '') => {
      setSearch('');
      setContentResults(null);
      if (path) {
        setExpandedFolders((current) => new Set(current).add(path));
      }
      setSearchParams(path ? { folder: path } : {});
    },
    [setSearchParams],
  );
  const navigateToView = useCallback(
    (view: Exclude<KnowledgeView, 'root'>) => {
      setSearch('');
      setContentResults(null);
      setSearchParams({ view });
    },
    [setSearchParams],
  );
  const navigateToSurface = useCallback(
    (surface: KnowledgeSurface) => {
      setSearch('');
      setContentResults(null);
      if (surface === 'documents') {
        setSearchParams(selectedFolder ? { folder: selectedFolder } : {});
        return;
      }
      setSearchParams({ surface });
    },
    [selectedFolder, setSearchParams],
  );
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError('');
    try {
      const page = await dataService.getPortalKnowledgeAudit();
      setAuditEntries(page.entries);
    } catch {
      setAuditError('暂时无法读取操作记录，请稍后重试。');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const toggleAudit = () => {
    const next = !showAudit;
    setShowAudit(next);
    if (next) void loadAudit();
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      if (knowledgeView === 'root' && selectedFolder) form.append('folder_path', selectedFolder);
      await dataService.uploadPortalKnowledgeDocument(form);
      await refresh();
    } catch {
      setError('上传失败，请检查文件格式和大小后重试。');
    } finally {
      setUploading(false);
    }
  };

  const preview = async (item: RecordLike) => {
    const documentId = String(item.id ?? item.knowledge_id ?? '');
    if (!documentId) return;
    setPreviewingId(documentId);
    setError('');
    try {
      const response = await dataService.getPortalKnowledgeDocumentPreview(documentId);
      setPreviewDocument({ item, url: URL.createObjectURL(response.data) });
    } catch {
      setError('预览失败，请稍后重试。');
    } finally {
      setPreviewingId('');
    }
  };

  const download = async (item: RecordLike) => {
    const documentId = String(item.id ?? '');
    if (!documentId) return;
    setBusyDocumentId(documentId);
    setError('');
    try {
      const response = await dataService.getPortalKnowledgeDocumentDownload(documentId);
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = title(item);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setError('下载失败，请稍后重试。');
    } finally {
      setBusyDocumentId('');
    }
  };

  const reparse = async (item: RecordLike) => {
    const documentId = String(item.id ?? '');
    if (!documentId || !window.confirm(`确定重新解析“${title(item)}”吗？`)) return;
    setBusyDocumentId(documentId);
    setError('');
    try {
      await dataService.reparsePortalKnowledgeDocument(documentId);
      await refresh(false);
    } catch {
      setError('重新解析失败，请稍后重试。');
    } finally {
      setBusyDocumentId('');
    }
  };

  const cancelParse = async (item: RecordLike) => {
    const documentId = String(item.id ?? '');
    if (!documentId || !window.confirm(`确定取消“${title(item)}”的解析吗？`)) return;
    setBusyDocumentId(documentId);
    setError('');
    try {
      await dataService.cancelPortalKnowledgeDocumentParse(documentId);
      await refresh(false);
    } catch {
      setError('取消解析失败，请稍后重试。');
    } finally {
      setBusyDocumentId('');
    }
  };

  const remove = async (item: RecordLike) => {
    const documentId = String(item.id ?? '');
    if (!documentId || !window.confirm(`确定删除“${title(item)}”吗？删除后不可在门户中恢复。`))
      return;
    setBusyDocumentId(documentId);
    setError('');
    try {
      await dataService.deletePortalKnowledgeDocument(documentId);
      await refresh(false);
    } catch {
      setError('删除失败，请稍后重试。');
    } finally {
      setBusyDocumentId('');
    }
  };

  const openMoveDialog = (item: RecordLike) => {
    setMovingDocument(item);
    setMoveDestination(documentFolder(item));
  };

  const moveDocument = async () => {
    if (!movingDocument) return;
    const documentId = String(movingDocument.id ?? '');
    if (!documentId) return;
    if (documentFolder(movingDocument) === moveDestination) {
      setMovingDocument(undefined);
      return;
    }
    setBusyDocumentId(documentId);
    setError('');
    try {
      await dataService.movePortalKnowledgeDocument(documentId, moveDestination);
      setMovingDocument(undefined);
      await refresh(false);
      navigateToFolder(moveDestination);
    } catch {
      setError('移动文档失败，请稍后重试。');
    } finally {
      setBusyDocumentId('');
    }
  };

  const searchContent = async () => {
    const query = search.trim();
    if (!query) return;
    setContentSearching(true);
    setContentResults(null);
    setError('');
    try {
      const result = await dataService.searchPortalKnowledge(query);
      setContentResults(searchResultList(result));
    } catch {
      setError('正文检索失败，请稍后重试。');
    } finally {
      setContentSearching(false);
    }
  };

  const previewSearchResult = (item: RecordLike) => {
    const documentId = String(item.knowledge_id ?? item.id ?? '');
    if (!documentId) return;
    void preview({ ...item, id: documentId });
  };

  const isKnowledgeBaseFavorite = [...favoriteTargets].some((key) =>
    key.startsWith('knowledge_base:'),
  );

  const toggleFavorite = async (
    targetType: 'knowledge_base' | 'document',
    targetId: string,
    titleSnapshot: string,
  ) => {
    const key = targetKey(targetType, targetId);
    const favorite =
      targetType === 'knowledge_base' ? isKnowledgeBaseFavorite : favoriteTargets.has(key);
    setFavoriteBusyId(key);
    setError('');
    try {
      if (favorite) {
        await dataService.removePortalKnowledgeFavorite(targetType, targetId);
        setFavoriteTargets((current) => {
          const next = new Set(current);
          if (targetType === 'knowledge_base') {
            [...next]
              .filter((item) => item.startsWith('knowledge_base:'))
              .forEach((item) => next.delete(item));
          } else {
            next.delete(key);
          }
          return next;
        });
      } else {
        await dataService.addPortalKnowledgeFavorite(targetType, targetId, titleSnapshot);
        setFavoriteTargets((current) => new Set(current).add(key));
      }
    } catch {
      setError('收藏操作失败，请稍后重试。');
    } finally {
      setFavoriteBusyId('');
    }
  };

  const ask = async () => {
    const text = question.trim();
    if (!text) return;
    const controller = new AbortController();
    askControllerRef.current = controller;
    setAsking(true);
    setAnswer('');
    setReferences([]);
    setLiveQuestion(text);
    answerRef.current = '';
    referencesRef.current = [];
    try {
      let sessionId = knowledgeSessionIdRef.current;
      if (!sessionId) {
        const created = getData(await dataService.createPortalKnowledgeSession()) as RecordLike;
        sessionId = String(created.id ?? '');
        if (!sessionId) throw new Error('No session');
        knowledgeSessionIdRef.current = sessionId;
        window.sessionStorage.setItem(knowledgeSessionStorageKey, sessionId);
      }
      setQuestion('');
      const response = await dataService.streamPortalKnowledge(
        sessionId,
        text,
        (event) => {
          if (event.answerDelta) {
            answerRef.current += event.answerDelta;
            setAnswer(answerRef.current);
          }
          if (event.references?.length) {
            referencesRef.current = uniqueReferences([
              ...referencesRef.current,
              ...event.references,
            ]);
            setReferences(referencesRef.current);
          }
        },
        { signal: controller.signal },
      );
      if (!answerRef.current) setAnswer(response.answer || '知识库没有返回可展示的回答。');
      if (!referencesRef.current.length && response.references.length) {
        referencesRef.current = uniqueReferences(response.references);
        setReferences(referencesRef.current);
      }
      const loaded = await loadSessionMessages(sessionId);
      if (loaded) {
        setLiveQuestion('');
        setAnswer('');
        setReferences([]);
      }
    } catch {
      if (controller.signal.aborted) {
        setAnswer((current) => `${current ? `${current}\n\n` : ''}已停止生成。`);
      } else setAnswer('知识助手暂时不可用，请稍后重试。');
    } finally {
      askControllerRef.current = null;
      setAsking(false);
    }
  };

  const stopAsk = async () => {
    const sessionId = knowledgeSessionIdRef.current;
    const controller = askControllerRef.current;
    if (!sessionId && !controller) return;
    if (sessionId) await dataService.stopPortalKnowledgeSession(sessionId).catch(() => undefined);
    controller?.abort();
  };

  const resetSession = async () => {
    const sessionId = knowledgeSessionIdRef.current;
    clearStoredSession();
    setMessages([]);
    setLiveQuestion('');
    setAnswer('');
    setReferences([]);
    referencesRef.current = [];
    if (!sessionId) return;
    try {
      await dataService.deletePortalKnowledgeSession(sessionId);
    } catch {
      setError('未能清理上一轮问答记录，请稍后重试。');
    }
  };

  if (configQuery.isLoading) return null;
  if (!configQuery.data?.portal?.enabled) return <Navigate to="/c/new" replace />;
  if (!canAccessKnowledge) {
    return (
      <main className="flex h-full items-center justify-center bg-surface-primary p-6">
        <section className="max-w-md rounded-2xl border border-border-light bg-surface-secondary p-6 text-center shadow-sm dark:border-border-medium">
          <h1 className="text-lg font-semibold text-text-primary">暂无知识中心访问权限</h1>
          <p className="mt-2 text-sm text-text-secondary">
            请联系管理员将你加入知识阅读或维护用户组。
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-surface-primary">
      <aside className="hidden w-60 shrink-0 border-r border-border-light bg-surface-secondary p-3 dark:border-border-medium md:block">
        {canManageKnowledge && knowledgeSurface === 'documents' && (
          <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
            {uploading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {knowledgeView === 'root' && selectedFolder ? '上传至当前目录' : '上传文档'}
            <input
              type="file"
              className="hidden"
              aria-label={`上传文档至${currentScopeName}`}
              disabled={uploading}
              onChange={(event) => void upload(event.target.files?.[0])}
            />
          </label>
        )}
        <div className="mt-6 space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            个人入口
          </p>
          <button
            type="button"
            onClick={() => navigateToView('favorites')}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
              knowledgeView === 'favorites'
                ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
            }`}
          >
            <Star className="h-4 w-4" />
            收藏文档
            <span className="ml-auto text-[10px] text-text-secondary">
              {[...favoriteTargets].filter((key) => key.startsWith('document:')).length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigateToView('recents')}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
              knowledgeView === 'recents'
                ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
            }`}
          >
            <RotateCcw className="h-4 w-4" />
            最近使用
            <span className="ml-auto text-[10px] text-text-secondary">
              {recentItems.filter((item) => item.targetType === 'document').length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigateToView('all')}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
              knowledgeView === 'all'
                ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
            }`}
          >
            <FolderTree className="h-4 w-4" />
            全部文档
          </button>
          <p className="mt-6 px-2 text-xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
            知识空间
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigateToFolder()}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                knowledgeSurface === 'documents' && knowledgeView === 'root' && !selectedFolder
                  ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
              }`}
            >
              <BookOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">选哲产品</span>
            </button>
            <button
              type="button"
              aria-label={isKnowledgeBaseFavorite ? '取消收藏知识库' : '收藏知识库'}
              disabled={favoriteBusyId === targetKey('knowledge_base', 'current')}
              onClick={() => void toggleFavorite('knowledge_base', 'current', '选哲产品')}
              className="rounded-md p-2 text-amber-500 hover:bg-surface-tertiary disabled:opacity-50"
            >
              <Star className={`h-4 w-4 ${isKnowledgeBaseFavorite ? 'fill-current' : ''}`} />
            </button>
          </div>
          <button
            type="button"
            aria-label="打开企业 Wiki"
            onClick={() => navigateToSurface('wiki')}
            className={`mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
              knowledgeSurface === 'wiki'
                ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            企业 Wiki
          </button>
          <button
            type="button"
            aria-label="打开 Wiki 关系图谱"
            onClick={() => navigateToSurface('graph')}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
              knowledgeSurface === 'graph'
                ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
            }`}
          >
            <Network className="h-4 w-4" />
            知识图谱
          </button>
          <div className="mt-1 space-y-0.5">
            {knowledgeSurface === 'documents' &&
              folders.map((folder) => (
                <FolderTreeNode
                  key={folder.path}
                  folder={folder}
                  depth={0}
                  selectedFolder={selectedFolder}
                  expandedFolders={expandedFolders}
                  ancestorFolders={ancestorFolders}
                  onSelect={navigateToFolder}
                  onToggle={toggleFolder}
                />
              ))}
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto bg-surface-primary">
        <div className="mx-auto grid min-h-full max-w-[1560px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="order-2 min-w-0 p-4 sm:p-6 lg:order-1 lg:p-7">
            <div className="mb-4 flex gap-2 overflow-x-auto md:hidden">
              <button
                type="button"
                onClick={() => navigateToSurface('documents')}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                  knowledgeSurface === 'documents'
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-secondary text-text-secondary'
                }`}
              >
                文档
              </button>
              <button
                type="button"
                onClick={() => navigateToSurface('wiki')}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                  knowledgeSurface === 'wiki'
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-secondary text-text-secondary'
                }`}
              >
                企业 Wiki
              </button>
              <button
                type="button"
                onClick={() => navigateToSurface('graph')}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                  knowledgeSurface === 'graph'
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-secondary text-text-secondary'
                }`}
              >
                知识图谱
              </button>
            </div>
            <div className={knowledgeSurface === 'documents' ? undefined : 'hidden'}>
              <div className="mb-5">
                {knowledgeView === 'root' ? (
                  <nav
                    aria-label="知识路径"
                    className="flex flex-wrap items-center gap-1 text-xs text-text-secondary"
                  >
                    <span>知识中心</span>
                    {breadcrumbItems.map((item, index) => {
                      const current = index === breadcrumbItems.length - 1;
                      return (
                        <span key={item.path || 'root'} className="flex items-center gap-1">
                          <ChevronRight className="h-3 w-3" aria-hidden="true" />
                          <button
                            type="button"
                            onClick={() => navigateToFolder(item.path)}
                            disabled={current}
                            aria-current={current ? 'page' : undefined}
                            className={
                              current
                                ? 'cursor-default text-text-secondary'
                                : 'text-text-secondary hover:text-blue-600 hover:underline'
                            }
                          >
                            {item.name}
                          </button>
                        </span>
                      );
                    })}
                  </nav>
                ) : (
                  <p className="text-xs text-text-secondary">知识中心 / {currentScopeName}</p>
                )}
                <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
                      {currentScopeName}
                    </h1>
                    <p className="mt-1 text-sm text-text-secondary">
                      {childFolders.length > 0 ? `${childFolders.length} 个子文件夹 · ` : ''}
                      {visibleDocuments.length} 份文档 · 企业文档与知识问答
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex w-full gap-2">
                  <label className="relative block min-w-0 flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-text-secondary" />
                    <input
                      className="h-10 w-full rounded-lg border border-border-medium bg-surface-primary pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setContentResults(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void searchContent();
                      }}
                      placeholder="搜索文档名称或正文"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void searchContent()}
                    disabled={!search.trim() || contentSearching}
                    className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-border-medium px-3 text-sm text-text-secondary hover:bg-surface-secondary disabled:opacity-50"
                  >
                    <Search className="h-4 w-4" />
                    {contentSearching ? '检索中…' : '搜正文'}
                  </button>
                </div>
              </div>
              <div className="mb-4 space-y-3 md:hidden">
                {canManageKnowledge && (
                  <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700">
                    {uploading ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {knowledgeView === 'root' && selectedFolder ? '上传至当前目录' : '上传文档'}
                    <input
                      type="file"
                      className="hidden"
                      aria-label={`上传文档至${currentScopeName}`}
                      disabled={uploading}
                      onChange={(event) => void upload(event.target.files?.[0])}
                    />
                  </label>
                )}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => navigateToFolder()}
                    className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                      knowledgeView === 'root' && !selectedFolder
                        ? 'bg-blue-600 text-white'
                        : 'bg-surface-secondary text-text-secondary'
                    }`}
                  >
                    选哲产品
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToView('all')}
                    className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                      knowledgeView === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-surface-secondary text-text-secondary'
                    }`}
                  >
                    全部文档
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToView('favorites')}
                    className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                      knowledgeView === 'favorites'
                        ? 'bg-blue-600 text-white'
                        : 'bg-surface-secondary text-text-secondary'
                    }`}
                  >
                    收藏文档
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToView('recents')}
                    className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                      knowledgeView === 'recents'
                        ? 'bg-blue-600 text-white'
                        : 'bg-surface-secondary text-text-secondary'
                    }`}
                  >
                    最近使用
                  </button>
                </div>
                {mobileFolderOptions.length > 0 && (
                  <select
                    aria-label="选择文件夹"
                    value={knowledgeView === 'root' ? selectedFolder : ''}
                    onChange={(event) => navigateToFolder(event.target.value)}
                    className="h-10 w-full rounded-lg border border-border-medium bg-surface-primary px-3 text-sm text-text-primary"
                  >
                    <option value="">选哲产品（根目录）</option>
                    {mobileFolderOptions.map((folder) => (
                      <option key={folder.path} value={folder.path}>
                        {folder.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="overflow-hidden rounded-xl border border-border-light bg-surface-primary shadow-sm dark:border-border-medium">
                <div className="flex items-center justify-between border-b border-border-light px-4 py-3 dark:border-border-medium">
                  <span className="text-sm font-medium text-text-primary">
                    {knowledgeView === 'root' ? '文件夹和文档' : '文档列表'}
                  </span>
                  <div className="flex items-center gap-3">
                    {canManageKnowledge && (
                      <button
                        type="button"
                        onClick={toggleAudit}
                        className="text-sm text-text-secondary hover:text-text-primary"
                      >
                        {showAudit ? '收起记录' : '操作记录'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void refresh()}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      刷新
                    </button>
                  </div>
                </div>
                <div className="hidden grid-cols-[minmax(0,1fr)_7.5rem_auto] gap-4 border-b border-border-light px-4 py-2.5 text-xs text-text-secondary dark:border-border-medium sm:grid">
                  <span>名称</span>
                  <span>索引状态</span>
                  <span className="text-right">操作</span>
                </div>
                {loading ? (
                  <div className="flex justify-center p-12">
                    <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <>
                    {error && <p className="p-6 text-sm text-red-600">{error}</p>}
                    {!error && (
                      <div className="divide-y divide-border-light dark:divide-border-medium">
                        {childFolders.map((folder) => (
                          <button
                            key={folder.path}
                            type="button"
                            aria-label={`进入文件夹：${folder.name}`}
                            onClick={() => navigateToFolder(folder.path)}
                            className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3.5 text-left hover:bg-surface-secondary sm:grid-cols-[minmax(0,1fr)_7.5rem_auto] sm:gap-4"
                          >
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="rounded-lg bg-amber-50 p-2 text-amber-600 dark:bg-amber-950">
                                <Folder className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-text-primary">
                                  {folder.name}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-text-secondary">
                                  文件夹 · {folderCount(folder)} 项内容
                                </span>
                              </span>
                            </span>
                            <span className="justify-self-start text-xs text-text-secondary">
                              —
                            </span>
                            <span className="col-span-2 inline-flex items-center justify-end gap-1 border-t border-border-light pt-2 text-xs text-blue-600 sm:col-span-1 sm:border-0 sm:pt-0">
                              进入
                              <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </button>
                        ))}
                        {visibleDocuments.map((item, index) => (
                          <div
                            key={String(item.id ?? index)}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_7.5rem_auto] sm:gap-4"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-950">
                                <FileText className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-text-primary">
                                  {title(item)}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-text-secondary">
                                  {documentFolder(item) || '选哲产品'}
                                </span>
                              </span>
                            </div>
                            <span
                              className={`justify-self-start rounded-full px-2.5 py-1 text-xs font-medium ${statusClassName(item)}`}
                            >
                              {status(item)}
                            </span>
                            <div className="col-span-2 flex items-center justify-end gap-3 border-t border-border-light pt-2 text-xs dark:border-border-medium sm:col-span-1 sm:border-0 sm:pt-0">
                              <button
                                type="button"
                                aria-label={
                                  favoriteTargets.has(targetKey('document', String(item.id ?? '')))
                                    ? `取消收藏：${title(item)}`
                                    : `收藏：${title(item)}`
                                }
                                disabled={
                                  favoriteBusyId === targetKey('document', String(item.id ?? ''))
                                }
                                onClick={() =>
                                  void toggleFavorite(
                                    'document',
                                    String(item.id ?? ''),
                                    title(item),
                                  )
                                }
                                className="rounded-md p-1 text-amber-500 hover:bg-surface-secondary disabled:opacity-50"
                              >
                                <Star
                                  className={`h-3.5 w-3.5 ${
                                    favoriteTargets.has(
                                      targetKey('document', String(item.id ?? '')),
                                    )
                                      ? 'fill-current'
                                      : ''
                                  }`}
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => void preview(item)}
                                disabled={
                                  previewingId === String(item.id ?? '') || !!busyDocumentId
                                }
                                className="text-blue-600 hover:underline disabled:opacity-50"
                              >
                                {previewingId === String(item.id ?? '') ? '加载中…' : '预览'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void download(item)}
                                disabled={busyDocumentId === String(item.id ?? '')}
                                className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary disabled:opacity-50"
                              >
                                <Download className="h-3.5 w-3.5" />
                                下载
                              </button>
                              {canManageKnowledge && (
                                <>
                                  <button
                                    type="button"
                                    aria-label={`移动文档：${title(item)}`}
                                    onClick={() => openMoveDialog(item)}
                                    disabled={!!busyDocumentId}
                                    className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary disabled:opacity-50"
                                  >
                                    <FolderInput className="h-3.5 w-3.5" />
                                    移动
                                  </button>
                                  {isActiveStatus(item) ? (
                                    <button
                                      type="button"
                                      onClick={() => void cancelParse(item)}
                                      disabled={!!busyDocumentId}
                                      className="inline-flex items-center gap-1 text-amber-600 hover:underline disabled:opacity-50"
                                    >
                                      <XCircle className="h-3.5 w-3.5" />
                                      取消
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => void reparse(item)}
                                      disabled={!!busyDocumentId}
                                      className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary disabled:opacity-50"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      重解析
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void remove(item)}
                                    disabled={!!busyDocumentId}
                                    className="inline-flex items-center gap-1 text-red-600 hover:underline disabled:opacity-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    删除
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        {visibleDocuments.length === 0 && childFolders.length === 0 && (
                          <p className="p-10 text-center text-sm text-text-secondary">
                            暂无匹配文档
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              {contentResults && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-border-light bg-surface-primary shadow-sm dark:border-border-medium">
                  <div className="flex items-center justify-between border-b border-border-light px-4 py-3 dark:border-border-medium">
                    <span className="text-sm font-medium text-text-primary">
                      正文检索结果（{contentResults.length}）
                    </span>
                    <button
                      type="button"
                      onClick={() => setContentResults(null)}
                      className="text-xs text-text-secondary hover:text-text-primary"
                    >
                      清除
                    </button>
                  </div>
                  {contentResults.length === 0 ? (
                    <p className="p-8 text-center text-sm text-text-secondary">没有找到相关正文</p>
                  ) : (
                    <div className="divide-y divide-border-light dark:divide-border-medium">
                      {contentResults.slice(0, 10).map((item, index) => {
                        const documentId = String(item.knowledge_id ?? item.id ?? '');
                        return (
                          <div key={`${documentId}-${index}`} className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                                {title(item)}
                              </span>
                              {documentId && (
                                <button
                                  type="button"
                                  onClick={() => previewSearchResult(item)}
                                  className="shrink-0 text-xs text-blue-600 hover:underline"
                                >
                                  预览文档
                                </button>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-text-secondary">
                              {repairMojibake(String(item.content ?? ''))}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              {canManageKnowledge && showAudit && (
                <section className="mt-4 overflow-hidden rounded-2xl border border-border-light bg-surface-primary shadow-sm dark:border-border-medium">
                  <div className="flex items-center justify-between border-b border-border-light px-4 py-3 dark:border-border-medium">
                    <span className="text-sm font-medium text-text-primary">最近操作记录</span>
                    <button
                      type="button"
                      onClick={() => void loadAudit()}
                      disabled={auditLoading}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                    >
                      刷新记录
                    </button>
                  </div>
                  {auditLoading && (
                    <div className="flex justify-center p-6">
                      <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />
                    </div>
                  )}
                  {!auditLoading && auditError && (
                    <p className="p-4 text-sm text-red-600">{auditError}</p>
                  )}
                  {!auditLoading && !auditError && auditEntries.length === 0 && (
                    <p className="p-6 text-center text-sm text-text-secondary">暂无操作记录</p>
                  )}
                  {!auditLoading && !auditError && auditEntries.length > 0 && (
                    <div className="divide-y divide-border-light dark:divide-border-medium">
                      {auditEntries.map((entry) => {
                        const documentName = repairMojibake(
                          String(entry.metadata?.documentName ?? '选哲产品'),
                        );
                        return (
                          <div
                            key={entry.id}
                            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
                          >
                            <span className="font-medium text-text-primary">
                              {auditActionLabel(entry.action)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-text-secondary">
                              {documentName}
                            </span>
                            <span className="text-xs text-text-secondary">{entry.actor.name}</span>
                            <time className="text-xs text-text-secondary">
                              {auditTime(entry.timestamp)}
                            </time>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>
            {knowledgeSurface !== 'documents' && <KnowledgeWiki surface={knowledgeSurface} />}
          </section>
          <aside className="order-1 flex min-h-[360px] flex-col rounded-xl border border-border-light bg-surface-primary p-4 shadow-sm dark:border-border-medium md:p-5 lg:order-2 lg:min-h-0 lg:rounded-none lg:border-y-0 lg:border-l lg:border-r-0 lg:shadow-none">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-blue-600" />
                <h2 className="font-semibold text-text-primary">知识助手</h2>
              </div>
              <button
                type="button"
                onClick={() => void resetSession()}
                disabled={asking}
                className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              >
                新建问答
              </button>
            </div>
            <p className="mt-1 text-xs text-text-secondary">问答范围：整个选哲产品知识库</p>
            {knowledgeSurface === 'documents' && knowledgeView === 'root' && (
              <p className="mt-1 text-xs text-text-secondary">当前浏览：{currentScopeName}</p>
            )}
            <div className="mt-5 flex min-h-44 flex-1 flex-col overflow-y-auto text-sm text-text-primary">
              <div className="space-y-3">
                {messages.map((message, index) => {
                  const isUser = message.role === 'user';
                  const content = String(message.content || '');
                  const messageReferences = uniqueReferences(message.knowledge_references ?? []);
                  return (
                    <div
                      key={message.id || `${message.created_at || 'message'}-${index}`}
                      className={
                        isUser ? 'ml-6 rounded-lg bg-blue-600 px-3 py-2 text-white' : 'mr-2'
                      }
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{content}</p>
                      ) : (
                        <>
                          <div className="markdown prose prose-sm dark:prose-invert max-w-none break-words">
                            <MarkdownLite content={cleanAnswer(content)} codeExecution={false} />
                          </div>
                          {!!messageReferences.length && (
                            <div className="mt-2 space-y-1 text-xs text-text-secondary">
                              {messageReferences.slice(0, 3).map((reference, referenceIndex) => {
                                const documentId = String(reference.knowledge_id ?? '');
                                const referenceTitle = repairMojibake(
                                  String(
                                    reference.knowledge_title ??
                                      reference.knowledge_filename ??
                                      '知识片段',
                                  ),
                                );
                                return documentId ? (
                                  <button
                                    key={`${documentId}-${referenceIndex}`}
                                    type="button"
                                    className="block w-full truncate text-left text-blue-600 hover:underline"
                                    onClick={() =>
                                      void preview({ id: documentId, file_name: referenceTitle })
                                    }
                                  >
                                    {referenceTitle}
                                  </button>
                                ) : null;
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
                {liveQuestion && (
                  <>
                    <div className="ml-6 rounded-lg bg-blue-600 px-3 py-2 text-white">
                      <p className="whitespace-pre-wrap">{liveQuestion}</p>
                    </div>
                    <div className="mr-2">
                      {asking && !answer && <p className="text-text-secondary">正在检索知识库…</p>}
                      {answer && (
                        <div className="markdown prose prose-sm dark:prose-invert max-w-none break-words">
                          <MarkdownLite content={cleanAnswer(answer)} codeExecution={false} />
                        </div>
                      )}
                    </div>
                  </>
                )}
                {!messages.length && !liveQuestion && (
                  <div className="flex gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs text-blue-200 dark:bg-blue-500/20 dark:text-blue-200">
                      ✦
                    </span>
                    <div className="min-w-0">
                      <p className="leading-6 text-text-secondary">
                        你好，我可以基于当前知识范围回答问题，并给出引用来源。
                      </p>
                      <p className="mt-4 text-xs font-medium text-text-primary">你可以这样问：</p>
                      <div className="mt-2 space-y-2">
                        {suggestedQuestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setQuestion(suggestion)}
                            className="block w-full rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-left text-xs text-text-secondary hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-border-medium dark:hover:bg-blue-950"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {references.length > 0 && (
              <div className="mt-3 space-y-1 text-xs text-text-secondary">
                <p className="font-medium text-text-primary">依据文档</p>
                {uniqueReferences(references)
                  .slice(0, 5)
                  .map((reference, index) => {
                    const documentId = String(reference.knowledge_id ?? '');
                    const referenceTitle = repairMojibake(
                      String(
                        reference.knowledge_title ?? reference.knowledge_filename ?? '知识片段',
                      ),
                    );
                    return documentId ? (
                      <button
                        key={`${documentId}-${index}`}
                        type="button"
                        className="block w-full truncate text-left text-blue-600 hover:underline"
                        aria-label={`预览依据文档：${referenceTitle}`}
                        onClick={() => void preview({ id: documentId, file_name: referenceTitle })}
                      >
                        {referenceTitle}
                      </button>
                    ) : (
                      <p key={`${referenceTitle}-${index}`} className="truncate">
                        {referenceTitle}
                      </p>
                    );
                  })}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-border-medium bg-surface-primary px-3 text-sm outline-none focus:border-blue-500"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void ask();
                }}
                placeholder="向知识库提问"
              />
              <button
                type="button"
                disabled={!asking && !question.trim()}
                onClick={() => void (asking ? stopAsk() : ask())}
                className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-white disabled:opacity-50"
              >
                {asking ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </aside>
        </div>
      </main>
      {previewDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`预览 ${title(previewDocument.item)}`}
        >
          <div className="flex h-[min(88vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-surface-primary shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-light px-5 py-3 dark:border-border-medium">
              <h2 className="truncate pr-4 text-sm font-semibold text-text-primary">
                {title(previewDocument.item)}
              </h2>
              <button
                type="button"
                onClick={() => setPreviewDocument(undefined)}
                className="shrink-0 rounded-md px-3 py-1 text-sm text-text-secondary hover:bg-surface-secondary"
              >
                关闭
              </button>
            </div>
            <iframe
              title={`预览 ${title(previewDocument.item)}`}
              src={previewDocument.url}
              sandbox=""
              className="min-h-0 flex-1 border-0 bg-white"
            />
          </div>
        </div>
      )}
      {movingDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="移动文档"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface-primary p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-text-primary">移动文档</h2>
            <p className="mt-2 truncate text-sm text-text-secondary">{title(movingDocument)}</p>
            <label className="mt-5 block text-sm font-medium text-text-primary">
              移动到文件夹
              <select
                aria-label="移动到文件夹"
                value={moveDestination}
                onChange={(event) => setMoveDestination(event.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-border-medium bg-surface-primary px-3 text-sm text-text-primary outline-none focus:border-blue-500"
              >
                <option value="">选哲产品（根目录）</option>
                {mobileFolderOptions.map((folder) => (
                  <option key={folder.path} value={folder.path}>
                    {folder.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-xs text-text-secondary">
              移动后将按新目录重新归类，不会重新上传文档。
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setMovingDocument(undefined)}
                disabled={!!busyDocumentId}
                className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:bg-surface-secondary disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void moveDocument()}
                disabled={!!busyDocumentId || documentFolder(movingDocument) === moveDestination}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busyDocumentId ? '移动中…' : '确认移动'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
