const express = require('express');
const multer = require('multer');
const { Readable } = require('node:stream');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const FormData = require('form-data');
const JSZip = require('jszip');
const mammoth = require('mammoth');
const sanitizeHtml = require('sanitize-html');
const XLSX = require('xlsx');
const { isEnabled } = require('@librechat/api');
const db = require('~/models');
const { requireJwtAuth } = require('~/server/middleware');
const {
  hasKnowledgeManageAccess,
  hasKnowledgeReadAccess,
} = require('~/server/services/portalKnowledgeAccess');

const router = express.Router();
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_PREVIEW_BUFFER_BYTES = 20 * 1024 * 1024;
const allowedFileExtensions = new Set([
  '.csv',
  '.doc',
  '.docx',
  '.html',
  '.htm',
  '.jpeg',
  '.jpg',
  '.json',
  '.md',
  '.pdf',
  '.png',
  '.ppt',
  '.pptx',
  '.txt',
  '.webp',
  '.xls',
  '.xlsx',
]);
const knowledgeAuditActions = [
  'portal.knowledge.document_uploaded',
  'portal.knowledge.document_previewed',
  'portal.knowledge.document_downloaded',
  'portal.knowledge.document_reparsed',
  'portal.knowledge.document_parse_cancelled',
  'portal.knowledge.document_moved',
  'portal.knowledge.document_deleted',
  'portal.knowledge.question_asked',
];
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, callback) =>
      fs.mkdtemp(path.join(os.tmpdir(), 'librechat-knowledge-'), (error, directory) => {
        if (!error) req.knowledgeUploadDir = directory;
        callback(error, directory);
      }),
    filename: (_req, file, callback) =>
      callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedFileExtensions.has(path.extname(file.originalname).toLowerCase())) {
      callback(new Error('Unsupported document type'));
      return;
    }
    callback(null, true);
  },
});

const enabled = () => isEnabled(process.env.KNOWLEDGE_PORTAL_ENABLED);
const baseUrl = () => (process.env.WEKNORA_BASE_URL || '').replace(/\/+$/, '');
const knowledgeBaseId = () => process.env.WEKNORA_COMPANY_POLICY_KB_ID || '';

function unavailable(res) {
  return res.status(503).json({ error: 'Knowledge center is not configured' });
}

function keyFor(action) {
  return action === 'manage'
    ? process.env.WEKNORA_COMPANY_POLICY_INGEST_KEY
    : process.env.WEKNORA_COMPANY_POLICY_READ_KEY;
}

function configuration(action, req, res) {
  const key = keyFor(action);
  if (!enabled()) {
    res.status(404).json({ error: 'Knowledge center is disabled' });
    return null;
  }
  if (!baseUrl() || !knowledgeBaseId() || !key) {
    unavailable(res);
    return null;
  }
  const isMaintainer = hasKnowledgeManageAccess(req);
  if (!hasKnowledgeReadAccess(req)) {
    res.status(403).json({ error: 'Knowledge access is not granted' });
    return null;
  }
  if (action === 'manage' && !isMaintainer) {
    res.status(403).json({ error: 'Knowledge management access is not granted' });
    return null;
  }
  return { key, kbId: knowledgeBaseId() };
}

const requireKnowledgeManage = (req, res, next) => {
  const config = configuration('manage', req, res);
  if (!config) return;
  req.knowledgeConfig = config;
  return next();
};

const parseDocumentUpload = (req, res, next) =>
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    if (req.knowledgeUploadDir) {
      void fsp.rm(req.knowledgeUploadDir, { recursive: true, force: true }).catch(() => undefined);
    }
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({
      error:
        error.code === 'LIMIT_FILE_SIZE'
          ? 'Document exceeds the 20 MB upload limit'
          : 'Unsupported or invalid document upload',
    });
  });

const requestUserId = (req) => String(req.user?.id ?? req.user?._id ?? '');

const auditText = (value, maximum = 200) =>
  String(value || '')
    .trim()
    .slice(0, maximum);

const repairMojibake = (value) => {
  const input = String(value || '');
  const bytes = Array.from(input, (char) => char.charCodeAt(0));
  if (!/[\u0080-\u00ff]/.test(input) || bytes.some((byte) => byte > 0xff)) return input;
  try {
    const decoded = Buffer.from(input, 'latin1').toString('utf8');
    const cjkCount = (text) => (text.match(/[\u3400-\u9fff]/g) || []).length;
    return cjkCount(decoded) > cjkCount(input) ? decoded : input;
  } catch {
    return input;
  }
};

const recordKnowledgeAudit = (req, config, action, metadata = {}) => {
  const userId = requestUserId(req);
  if (!userId) return;
  const actorName = auditText(req.user?.name ?? req.user?.username ?? req.user?.email ?? userId);
  return db
    .recordAuditEntry({
      action,
      actor: { type: 'user', id: userId, name: actorName || userId },
      target: { type: 'knowledge_base', id: config.kbId, name: '选哲产品' },
      metadata: { knowledgeBaseId: config.kbId, provider: 'weknora', ...metadata },
      context: {
        requestId: auditText(req.id, 100) || undefined,
        ip: auditText(req.ip, 100) || undefined,
        userAgent: auditText(req.get('user-agent'), 500) || undefined,
      },
    })
    .catch(() => undefined);
};

const documentAuditMetadata = (documentId, document) => ({
  documentId: auditText(documentId),
  documentName: auditText(repairMojibake(document?.file_name ?? document?.name)),
});

const recordRecent = (req, config, targetType, targetId, titleSnapshot) => {
  const userId = requestUserId(req);
  if (!userId) return;
  return db
    .recordPortalKnowledgeRecent({
      userId,
      targetType,
      targetId,
      knowledgeBaseId: config.kbId,
      titleSnapshot,
    })
    .catch(() => undefined);
};

const filenameFromDisposition = (value) => {
  const encoded = String(value || '').match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }
  return String(value || '').match(/filename="?([^";]+)"?/i)?.[1] || '';
};

function upstreamHeaders(key, requestId, extra = {}) {
  return {
    'X-API-Key': key,
    // WeKnora persists this header in a varchar(36) column.
    'X-Request-ID': String(requestId || randomUUID()).slice(0, 36),
    ...extra,
  };
}

async function respondJson(response, res) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    return res
      .status(response.status >= 400 && response.status < 500 ? response.status : 502)
      .json({
        error: 'Knowledge provider request failed',
      });
  }
  return res.status(response.status).json(body);
}

const safeDocumentId = (value) => {
  const documentId = String(value || '').trim();
  return documentId && documentId.length <= 200 ? documentId : null;
};

const safeFolderPath = (value) => {
  if (typeof value !== 'string') return null;
  const folderPath = value
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\/+|\/+$/g, '');
  if (!folderPath) return '';
  // eslint-disable-next-line no-control-regex
  if (folderPath.length > 500 || /[\u0000-\u001f]/.test(folderPath)) return null;
  if (folderPath.split('/').some((part) => part === '.' || part === '..' || !part)) return null;
  return folderPath;
};

const safeWikiSlug = (value) => {
  const slug = String(value || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  // eslint-disable-next-line no-control-regex
  if (!slug || slug.length > 500 || /[\u0000-\u001f]/.test(slug)) return null;
  if (slug.split('/').some((part) => !part || part === '.' || part === '..')) return null;
  return slug;
};

const encodedWikiSlug = (slug) => slug.split('/').map(encodeURIComponent).join('/');
const wikiBaseUrl = (config) =>
  `${baseUrl()}/knowledgebase/${encodeURIComponent(config.kbId)}/wiki`;

async function requireScopedDocument(req, res, config) {
  const documentId = safeDocumentId(req.params.documentId);
  if (!documentId) {
    res.status(400).json({ error: 'Invalid knowledge document id' });
    return null;
  }

  const response = await fetch(`${baseUrl()}/knowledge/${encodeURIComponent(documentId)}`, {
    headers: upstreamHeaders(config.key, req.id || randomUUID()),
  }).catch(() => null);
  if (!response) {
    unavailable(res);
    return null;
  }
  if (!response.ok) {
    await respondJson(response, res);
    return null;
  }
  const body = await response.json().catch(() => ({}));
  const document = body?.data && typeof body.data === 'object' ? body.data : body;
  if (String(document?.knowledge_base_id || '') !== config.kbId) {
    res.status(404).json({ error: 'Knowledge document is not available' });
    return null;
  }
  return { documentId, document };
}

const requestRange = (req) => {
  const range = req.get('range');
  return typeof range === 'string' && /^bytes=\d*-\d*(?:,\d*-\d*)*$/.test(range) ? range : '';
};

const safeHeader = (value) => String(value || '').replace(/[\r\n]/g, '');

const forwardFileHeaders = (response, res) => {
  for (const header of [
    'content-type',
    'content-disposition',
    'content-length',
    'content-range',
    'accept-ranges',
  ]) {
    const value = response.headers.get(header);
    if (value) res.set(header, safeHeader(value));
  }
};

async function bufferResponse(response, maxBytes) {
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new RangeError('Preview exceeds size limit');
  }
  if (!response.body) return Buffer.alloc(0);

  const chunks = [];
  let total = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RangeError('Preview exceeds size limit');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const previewHtml = (body) => {
  const safeBody = sanitizeHtml(body, {
    allowedTags: [
      'a',
      'blockquote',
      'br',
      'code',
      'em',
      'h1',
      'h2',
      'h3',
      'h4',
      'hr',
      'li',
      'ol',
      'p',
      'pre',
      'strong',
      'table',
      'tbody',
      'td',
      'th',
      'thead',
      'tr',
      'ul',
    ],
    allowedAttributes: {
      a: ['href', 'title'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    :root { color-scheme: light dark; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    body { margin: 0; padding: 24px; line-height: 1.65; color: #1f2937; background: #fff; }
    @media (prefers-color-scheme: dark) { body { color: #e5e7eb; background: #111827; } }
    main { max-width: 1100px; margin: 0 auto; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; }
  </style></head><body><main>${safeBody}</main></body></html>`;
};

const decodeXml = (value) =>
  String(value)
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&');

async function pptxPreview(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1]) - Number(b.match(/slide(\d+)/i)?.[1]));
  const slides = await Promise.all(
    slideNames.map(async (name, index) => {
      const xml = await zip.files[name].async('text');
      const text = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/gi)]
        .map((match) => decodeXml(match[1]))
        .join(' ')
        .trim();
      return `<section><h2>第 ${index + 1} 页</h2><p>${escapeHtml(text || '（本页无可提取文本）')}</p></section>`;
    }),
  );
  return slides.join('') || '<p>未能从演示文稿中提取可预览文本。</p>';
}

async function officePreview(buffer, contentType) {
  const lowerType = String(contentType || '').toLowerCase();
  if (
    lowerType.includes('wordprocessingml.document') ||
    lowerType.includes('msword') ||
    lowerType.includes('.docx') ||
    lowerType.includes('.doc')
  ) {
    const result = await mammoth.convertToHtml({ buffer });
    return result.value || '<p>文档内容为空。</p>';
  }
  if (
    lowerType.includes('spreadsheetml.sheet') ||
    lowerType.includes('ms-excel') ||
    lowerType.includes('text/csv') ||
    lowerType.includes('tab-separated-values') ||
    lowerType.includes('.xlsx') ||
    lowerType.includes('.xls') ||
    lowerType.includes('.csv')
  ) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return workbook.SheetNames.map((sheetName) => {
      const sheet = XLSX.utils.sheet_to_html(workbook.Sheets[sheetName]);
      return `<h2>${escapeHtml(sheetName)}</h2>${sheet}`;
    }).join('');
  }
  if (
    lowerType.includes('presentationml.presentation') ||
    lowerType.includes('ms-powerpoint') ||
    lowerType.includes('.pptx') ||
    lowerType.includes('.ppt')
  ) {
    return pptxPreview(buffer);
  }
  return null;
}

const isOfficePreview = (contentType) => {
  const lowerType = String(contentType || '').toLowerCase();
  return (
    lowerType.includes('wordprocessingml.document') ||
    lowerType.includes('msword') ||
    lowerType.includes('spreadsheetml.sheet') ||
    lowerType.includes('ms-excel') ||
    lowerType.includes('text/csv') ||
    lowerType.includes('tab-separated-values') ||
    lowerType.includes('presentationml.presentation') ||
    lowerType.includes('ms-powerpoint') ||
    lowerType.includes('.docx') ||
    lowerType.includes('.doc') ||
    lowerType.includes('.xlsx') ||
    lowerType.includes('.xls') ||
    lowerType.includes('.csv') ||
    lowerType.includes('.pptx') ||
    lowerType.includes('.ppt')
  );
};

router.use((req, res, next) =>
  enabled() ? next() : res.status(404).json({ error: 'Knowledge center is disabled' }),
);
router.use(requireJwtAuth);

router.get('/audit', async (req, res) => {
  const config = configuration('manage', req, res);
  if (!config) return;
  const requestedLimit = Number.parseInt(String(req.query.limit || 12), 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 12;
  try {
    const page = await db.listAuditLogPage(undefined, {
      action: knowledgeAuditActions,
      targetType: 'knowledge_base',
      targetId: config.kbId,
      limit,
    });
    return res.json(page);
  } catch {
    return res.status(500).json({ error: 'Knowledge audit history is unavailable' });
  }
});

router.get('/bases', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const response = await fetch(`${baseUrl()}/knowledge-bases/${encodeURIComponent(config.kbId)}`, {
    headers: upstreamHeaders(config.key, req.id || randomUUID()),
  }).catch(() => null);
  if (!response) return unavailable(res);
  return respondJson(response, res);
});

router.get('/wiki/index', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const response = await fetch(`${wikiBaseUrl(config)}/index`, {
    headers: upstreamHeaders(config.key, req.id || randomUUID()),
  }).catch(() => null);
  if (!response) return unavailable(res);
  return respondJson(response, res);
});

router.get('/wiki/pages', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const page = Number.parseInt(String(req.query.page || 1), 10);
  const pageSize = Number.parseInt(String(req.query.page_size || 50), 10);
  const query = new URLSearchParams({
    page: String(Number.isFinite(page) ? Math.max(1, page) : 1),
    page_size: String(Number.isFinite(pageSize) ? Math.min(100, Math.max(1, pageSize)) : 50),
  });
  const response = await fetch(`${wikiBaseUrl(config)}/pages?${query}`, {
    headers: upstreamHeaders(config.key, req.id || randomUUID()),
  }).catch(() => null);
  if (!response) return unavailable(res);
  return respondJson(response, res);
});

router.get('/wiki/page', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const slug = safeWikiSlug(req.query.slug);
  if (!slug) return res.status(400).json({ error: 'A valid Wiki page slug is required' });
  const response = await fetch(`${wikiBaseUrl(config)}/pages/${encodedWikiSlug(slug)}`, {
    headers: upstreamHeaders(config.key, req.id || randomUUID()),
  }).catch(() => null);
  if (!response) return unavailable(res);
  return respondJson(response, res);
});

router.get('/wiki/folders', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const response = await fetch(`${wikiBaseUrl(config)}/folders`, {
    headers: upstreamHeaders(config.key, req.id || randomUUID()),
  }).catch(() => null);
  if (!response) return unavailable(res);
  return respondJson(response, res);
});

router.get('/wiki/graph', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const response = await fetch(`${wikiBaseUrl(config)}/graph`, {
    headers: upstreamHeaders(config.key, req.id || randomUUID()),
  }).catch(() => null);
  if (!response) return unavailable(res);
  return respondJson(response, res);
});

router.get('/wiki/search', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query || query.length > 500)
    return res.status(400).json({ error: 'A valid Wiki search query is required' });
  const response = await fetch(
    `${wikiBaseUrl(config)}/search?${new URLSearchParams({ q: query })}`,
    {
      headers: upstreamHeaders(config.key, req.id || randomUUID()),
    },
  ).catch(() => null);
  if (!response) return unavailable(res);
  return respondJson(response, res);
});

router.get('/documents', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const page = Number.parseInt(String(req.query.page || 1), 10);
  const pageSize = Number.parseInt(String(req.query.page_size || 50), 10);
  const query = new URLSearchParams({
    page: String(Number.isFinite(page) ? Math.max(1, page) : 1),
    page_size: String(Number.isFinite(pageSize) ? Math.min(100, Math.max(1, pageSize)) : 50),
  });
  const queryFields = [
    ['keyword', 'keyword'],
    ['file_type', 'file_type'],
    ['parse_status', 'parse_status'],
    ['source', 'source'],
    ['start_time', 'start_time'],
    ['end_time', 'end_time'],
    ['folder_path', 'folder_path'],
  ];
  for (const [name, upstreamName] of queryFields) {
    const value = req.query[name];
    if (typeof value === 'string' && value.length <= 200) query.set(upstreamName, value);
  }
  if (req.query.folder_recursive === 'true') query.set('folder_recursive', 'true');
  const response = await fetch(
    `${baseUrl()}/knowledge-bases/${encodeURIComponent(config.kbId)}/knowledge?${query}`,
    {
      headers: upstreamHeaders(config.key, req.id || randomUUID()),
    },
  ).catch(() => null);
  if (!response) return unavailable(res);
  return respondJson(response, res);
});

router.post('/search', express.json(), async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  if (!query || query.length > 4000)
    return res.status(400).json({ error: 'A valid search query is required' });
  const knowledgeIds = Array.isArray(req.body?.knowledge_ids)
    ? req.body.knowledge_ids.filter((id) => typeof id === 'string' && id.length <= 100).slice(0, 50)
    : undefined;
  const response = await fetch(`${baseUrl()}/knowledge-search`, {
    method: 'POST',
    headers: upstreamHeaders(config.key, req.id || randomUUID(), {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      query,
      knowledge_base_ids: [config.kbId],
      ...(knowledgeIds?.length ? { knowledge_ids: knowledgeIds } : {}),
      resource_urls: 'handle',
    }),
  }).catch(() => null);
  if (!response) return unavailable(res);
  return respondJson(response, res);
});

router.get('/folders', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const response = await fetch(
    `${baseUrl()}/knowledge-bases/${encodeURIComponent(config.kbId)}/knowledge/folders`,
    {
      headers: upstreamHeaders(config.key, req.id || randomUUID()),
    },
  ).catch(() => null);
  if (!response) return unavailable(res);
  return respondJson(response, res);
});

router.get('/documents/:documentId/preview', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const scopedDocument = await requireScopedDocument(req, res, config);
  if (!scopedDocument) return;
  const range = requestRange(req);
  const response = await fetch(
    `${baseUrl()}/knowledge/${encodeURIComponent(scopedDocument.documentId)}/preview`,
    {
      headers: upstreamHeaders(config.key, req.id || randomUUID(), range ? { Range: range } : {}),
    },
  ).catch(() => null);
  if (!response) return unavailable(res);
  if (!response.ok || !response.body) return respondJson(response, res);

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const disposition = response.headers.get('content-disposition') || '';
  void recordKnowledgeAudit(
    req,
    config,
    'portal.knowledge.document_previewed',
    documentAuditMetadata(scopedDocument.documentId, scopedDocument.document),
  );
  void recordRecent(
    req,
    config,
    'document',
    scopedDocument.documentId,
    filenameFromDisposition(disposition) ||
      String(scopedDocument.document.file_name || scopedDocument.documentId),
  );
  if (isOfficePreview(`${contentType} ${disposition}`)) {
    try {
      const buffer = await bufferResponse(response, MAX_PREVIEW_BUFFER_BYTES);
      const converted = await officePreview(buffer, `${contentType} ${disposition}`);
      if (converted != null) {
        res
          .status(200)
          .set('Content-Type', 'text/html; charset=utf-8')
          .set('Content-Disposition', 'inline')
          .set('Cache-Control', 'private, max-age=300, no-transform')
          .send(previewHtml(converted));
        return;
      }
    } catch (error) {
      if (error instanceof RangeError) {
        return res.status(413).json({ error: 'Document preview exceeds the 20 MB limit' });
      }
      return res.status(502).json({ error: 'Document preview conversion failed' });
    }
  }

  res.status(response.status);
  forwardFileHeaders(response, res);
  res
    .set('Content-Disposition', 'inline')
    .set('Cache-Control', 'private, max-age=300, no-transform');
  return Readable.fromWeb(response.body).pipe(res);
});

router.get('/documents/:documentId/download', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const scopedDocument = await requireScopedDocument(req, res, config);
  if (!scopedDocument) return;
  const range = requestRange(req);
  const response = await fetch(
    `${baseUrl()}/knowledge/${encodeURIComponent(scopedDocument.documentId)}/download`,
    {
      headers: upstreamHeaders(config.key, req.id || randomUUID(), range ? { Range: range } : {}),
    },
  ).catch(() => null);
  if (!response) return unavailable(res);
  if (!response.ok || !response.body) return respondJson(response, res);

  void recordKnowledgeAudit(
    req,
    config,
    'portal.knowledge.document_downloaded',
    documentAuditMetadata(scopedDocument.documentId, scopedDocument.document),
  );
  void recordRecent(
    req,
    config,
    'document',
    scopedDocument.documentId,
    filenameFromDisposition(response.headers.get('content-disposition')) ||
      String(scopedDocument.document.file_name || scopedDocument.documentId),
  );

  res.status(response.status);
  forwardFileHeaders(response, res);
  res.set('Cache-Control', 'private, max-age=300, no-transform');
  return Readable.fromWeb(response.body).pipe(res);
});

const documentAction = async (req, res, method, action, auditAction) => {
  const config = configuration('manage', req, res);
  if (!config) return;
  const scopedDocument = await requireScopedDocument(req, res, config);
  if (!scopedDocument) return;
  const response = await fetch(
    `${baseUrl()}/knowledge/${encodeURIComponent(scopedDocument.documentId)}${action}`,
    {
      method,
      headers: upstreamHeaders(config.key, req.id || randomUUID()),
    },
  ).catch(() => null);
  if (!response) return unavailable(res);
  if (response.ok) {
    void recordKnowledgeAudit(
      req,
      config,
      auditAction,
      documentAuditMetadata(scopedDocument.documentId, scopedDocument.document),
    );
  }
  return respondJson(response, res);
};

router.post('/documents/:documentId/reparse', (req, res) =>
  documentAction(req, res, 'POST', '/reparse', 'portal.knowledge.document_reparsed'),
);

router.post('/documents/:documentId/cancel-parse', (req, res) =>
  documentAction(req, res, 'POST', '/cancel-parse', 'portal.knowledge.document_parse_cancelled'),
);

router.post('/documents/:documentId/move', express.json(), async (req, res) => {
  const config = configuration('manage', req, res);
  if (!config) return;
  const folderPath = safeFolderPath(req.body?.folder_path);
  if (folderPath === null) return res.status(400).json({ error: 'Invalid knowledge folder path' });
  const scopedDocument = await requireScopedDocument(req, res, config);
  if (!scopedDocument) return;
  const response = await fetch(`${baseUrl()}/knowledge/folder`, {
    method: 'POST',
    headers: upstreamHeaders(config.key, req.id || randomUUID(), {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      kb_id: config.kbId,
      knowledge_ids: [scopedDocument.documentId],
      folder_path: folderPath,
    }),
  }).catch(() => null);
  if (!response) return unavailable(res);
  if (response.ok) {
    void recordKnowledgeAudit(req, config, 'portal.knowledge.document_moved', {
      ...documentAuditMetadata(scopedDocument.documentId, scopedDocument.document),
      folderPath: auditText(folderPath, 500),
    });
  }
  return respondJson(response, res);
});

router.delete('/documents/:documentId', (req, res) =>
  documentAction(req, res, 'DELETE', '', 'portal.knowledge.document_deleted'),
);

router.post('/documents', requireKnowledgeManage, parseDocumentUpload, async (req, res) => {
  const config = req.knowledgeConfig;
  if (!req.file) return res.status(400).json({ error: 'A document file is required' });
  const folderPath = safeFolderPath(req.body?.folder_path ?? '');
  if (folderPath === null) {
    const tempDirectory = req.file.destination || req.knowledgeUploadDir;
    if (tempDirectory)
      await fsp.rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
    return res.status(400).json({ error: 'Invalid knowledge folder path' });
  }
  const filename = path.basename(req.file.originalname);
  const form = new FormData();
  try {
    form.append('file', fs.createReadStream(req.file.path), {
      filename,
      contentType: req.file.mimetype || 'application/octet-stream',
      knownLength: req.file.size,
    });
    form.append('fileName', folderPath ? `${folderPath}/${filename}` : filename);
    form.append('enable_multimodel', 'false');
    const response = await fetch(
      `${baseUrl()}/knowledge-bases/${encodeURIComponent(config.kbId)}/knowledge/file`,
      {
        method: 'POST',
        headers: upstreamHeaders(config.key, req.id || randomUUID(), form.getHeaders()),
        body: form,
        duplex: 'half',
      },
    ).catch(() => null);
    if (!response) return unavailable(res);
    if (response.ok) {
      void recordKnowledgeAudit(req, config, 'portal.knowledge.document_uploaded', {
        documentName: auditText(filename),
        documentSize: req.file.size,
        folderPath: auditText(folderPath, 500),
      });
    }
    return respondJson(response, res);
  } finally {
    const tempDirectory = req.file.destination || req.knowledgeUploadDir;
    if (tempDirectory) {
      await fsp.rm(tempDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  }
});

router.get('/favorites', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  try {
    return res.json(await db.listPortalKnowledgeFavorites(requestUserId(req), config.kbId));
  } catch {
    return res.status(500).json({ error: 'Knowledge favorites unavailable' });
  }
});

router.put('/favorites/:targetType/:targetId', express.json(), async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const targetType = req.params.targetType;
  const targetId =
    targetType === 'knowledge_base' && req.params.targetId === 'current'
      ? config.kbId
      : req.params.targetId;
  try {
    await db.addPortalKnowledgeFavorite({
      userId: requestUserId(req),
      targetType,
      targetId,
      knowledgeBaseId: config.kbId,
      titleSnapshot: typeof req.body?.title_snapshot === 'string' ? req.body.title_snapshot : '',
    });
    return res.sendStatus(204);
  } catch (error) {
    const status = Number(error?.status);
    return res.status(status >= 400 && status < 500 ? status : 400).json({
      error: 'Invalid knowledge favorite',
    });
  }
});

router.delete('/favorites/:targetType/:targetId', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const targetType = req.params.targetType;
  const targetId =
    targetType === 'knowledge_base' && req.params.targetId === 'current'
      ? config.kbId
      : req.params.targetId;
  try {
    await db.removePortalKnowledgeFavorite(requestUserId(req), config.kbId, targetType, targetId);
    return res.sendStatus(204);
  } catch (error) {
    const status = Number(error?.status);
    return res.status(status >= 400 && status < 500 ? status : 400).json({
      error: 'Invalid knowledge favorite',
    });
  }
});

router.get('/recents', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  try {
    return res.json(await db.listPortalKnowledgeRecents(requestUserId(req), config.kbId));
  } catch {
    return res.status(500).json({ error: 'Knowledge recents unavailable' });
  }
});

async function requirePortalSession(req, res, config) {
  const portalSessionId = safeDocumentId(req.params.sessionId);
  if (!portalSessionId) {
    res.status(400).json({ error: 'Invalid knowledge session id' });
    return null;
  }
  try {
    const session = await db.getPortalKnowledgeSession(
      requestUserId(req),
      config.kbId,
      portalSessionId,
    );
    if (!session) {
      res.status(404).json({ error: 'Knowledge session is not available' });
      return null;
    }
    return session;
  } catch {
    res.status(500).json({ error: 'Knowledge session is unavailable' });
    return null;
  }
}

router.post('/sessions', express.json(), async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const response = await fetch(`${baseUrl()}/sessions`, {
    method: 'POST',
    headers: upstreamHeaders(config.key, req.id || randomUUID(), {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      knowledge_base_id: config.kbId,
      session_strategy: 'single',
      title: 'LibreChat knowledge session',
    }),
  }).catch(() => null);
  if (!response) return unavailable(res);
  const body = await response.json().catch(() => ({}));
  const providerSessionId = body?.data?.id ?? body?.id;
  if (!response.ok || !providerSessionId) return res.status(response.status).json(body);

  const portalSessionId = randomUUID();
  try {
    await db.createPortalKnowledgeSession({
      userId: requestUserId(req),
      portalSessionId,
      providerSessionId: String(providerSessionId),
      knowledgeBaseId: config.kbId,
    });
  } catch {
    void fetch(`${baseUrl()}/sessions/${encodeURIComponent(String(providerSessionId))}`, {
      method: 'DELETE',
      headers: upstreamHeaders(config.key, req.id || randomUUID()),
    });
    return res.status(500).json({ error: 'Knowledge session could not be saved' });
  }

  if (providerSessionId) void recordRecent(req, config, 'knowledge_base', config.kbId, '选哲产品');
  return res.status(201).json({ data: { id: portalSessionId } });
});

router.post('/chat/:sessionId', express.json(), async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const session = await requirePortalSession(req, res, config);
  if (!session) return;
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  if (!query || query.length > 4000)
    return res.status(400).json({ error: 'A valid question is required' });
  const response = await fetch(
    `${baseUrl()}/knowledge-chat/${encodeURIComponent(session.providerSessionId)}`,
    {
      method: 'POST',
      headers: upstreamHeaders(config.key, req.id || randomUUID(), {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ query, channel: 'api', knowledge_base_ids: [config.kbId] }),
    },
  ).catch(() => null);
  if (!response) return unavailable(res);
  if (!response.ok || !response.body) return respondJson(response, res);
  void db
    .touchPortalKnowledgeSession(requestUserId(req), config.kbId, session.portalSessionId)
    .catch(() => undefined);
  void recordKnowledgeAudit(req, config, 'portal.knowledge.question_asked', {
    questionLength: query.length,
  });
  res
    .status(response.status)
    .set('Content-Type', 'text/event-stream; charset=utf-8')
    .set('Cache-Control', 'no-cache, no-transform')
    .set('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  const stream = Readable.fromWeb(response.body);
  const stopStream = () => stream.destroy();
  res.once('close', stopStream);
  stream.once('close', () => res.removeListener('close', stopStream));
  stream.pipe(res);
});

router.get('/sessions/:sessionId/messages', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const session = await requirePortalSession(req, res, config);
  if (!session) return;
  const response = await fetch(
    `${baseUrl()}/messages/${encodeURIComponent(session.providerSessionId)}/load?limit=40`,
    { headers: upstreamHeaders(config.key, req.id || randomUUID()) },
  ).catch(() => null);
  if (!response) return unavailable(res);
  if (response.ok) {
    void db
      .touchPortalKnowledgeSession(requestUserId(req), config.kbId, session.portalSessionId)
      .catch(() => undefined);
  }
  return respondJson(response, res);
});

router.post('/sessions/:sessionId/stop', express.json(), async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const session = await requirePortalSession(req, res, config);
  if (!session) return;
  const response = await fetch(
    `${baseUrl()}/sessions/${encodeURIComponent(session.providerSessionId)}/stop`,
    {
      method: 'POST',
      headers: upstreamHeaders(config.key, req.id || randomUUID(), {
        ...(typeof req.body?.message_id === 'string' && req.body.message_id.length <= 200
          ? { 'Content-Type': 'application/json' }
          : {}),
      }),
      ...(typeof req.body?.message_id === 'string' && req.body.message_id.length <= 200
        ? { body: JSON.stringify({ message_id: req.body.message_id }) }
        : {}),
    },
  ).catch(() => null);
  if (!response) return unavailable(res);
  return respondJson(response, res);
});

router.delete('/sessions/:sessionId', async (req, res) => {
  const config = configuration('read', req, res);
  if (!config) return;
  const session = await requirePortalSession(req, res, config);
  if (!session) return;
  const response = await fetch(
    `${baseUrl()}/sessions/${encodeURIComponent(session.providerSessionId)}`,
    {
      method: 'DELETE',
      headers: upstreamHeaders(config.key, req.id || randomUUID()),
    },
  ).catch(() => null);
  if (!response) return unavailable(res);
  if (!response.ok && response.status !== 404) return respondJson(response, res);
  await db
    .deletePortalKnowledgeSession(requestUserId(req), config.kbId, session.portalSessionId)
    .catch(() => undefined);
  return res.sendStatus(204);
});

module.exports = router;
