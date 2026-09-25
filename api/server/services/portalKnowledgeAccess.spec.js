const { hasKnowledgeManageAccess, hasKnowledgeReadAccess } = require('./portalKnowledgeAccess');

const idToken = (claims) =>
  `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;

describe('portal knowledge access', () => {
  it('allows readers to read but not manage', () => {
    const req = {
      user: { openidId: 'reader' },
      session: {
        openidTokens: { idToken: idToken({ sub: 'reader', groups: ['/knowledge-readers'] }) },
      },
    };

    expect(hasKnowledgeReadAccess(req)).toBe(true);
    expect(hasKnowledgeManageAccess(req)).toBe(false);
  });

  it('allows maintainers to read and manage', () => {
    const req = {
      user: { openidId: 'maintainer' },
      session: {
        openidTokens: {
          idToken: idToken({ sub: 'maintainer', groups: ['knowledge-maintainers'] }),
        },
      },
    };

    expect(hasKnowledgeReadAccess(req)).toBe(true);
    expect(hasKnowledgeManageAccess(req)).toBe(true);
  });

  it('rejects a token for another signed-in user', () => {
    const req = {
      user: { openidId: 'reader' },
      session: {
        openidTokens: { idToken: idToken({ sub: 'other', groups: ['knowledge-readers'] }) },
      },
    };

    expect(hasKnowledgeReadAccess(req)).toBe(false);
  });
});
