function getOpenIdGroups(req) {
  const token = req.session?.openidTokens?.idToken;
  if (typeof token !== 'string') return new Set();

  try {
    const [, payload] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (req.user?.openidId && claims.sub !== req.user.openidId) return new Set();

    return new Set(
      (Array.isArray(claims.groups) ? claims.groups : [])
        .filter((group) => typeof group === 'string')
        .map((group) => group.split('/').filter(Boolean).at(-1)),
    );
  } catch {
    return new Set();
  }
}

function hasKnowledgeManageAccess(req) {
  return getOpenIdGroups(req).has('knowledge-maintainers');
}

function hasKnowledgeReadAccess(req) {
  const groups = getOpenIdGroups(req);
  return groups.has('knowledge-maintainers') || groups.has('knowledge-readers');
}

module.exports = {
  getOpenIdGroups,
  hasKnowledgeManageAccess,
  hasKnowledgeReadAccess,
};
