import { validatePortalAppUrl } from './url';

describe('validatePortalAppUrl', () => {
  it('normalizes valid HTTPS URLs', () => {
    expect(validatePortalAppUrl(' https://example.com/path ')).toBe('https://example.com/path');
  });

  it('allows HTTP only when the deployment opts in', () => {
    expect(validatePortalAppUrl('http://10.0.0.8:8080/', { PORTAL_ALLOW_HTTP: 'true' })).toBe(
      'http://10.0.0.8:8080/',
    );
    expect(() => validatePortalAppUrl('http://10.0.0.8:8080/', {})).toThrow(
      'must use an allowed HTTP(S) URL',
    );
  });

  it.each(['javascript:alert(1)', 'https://user:secret@example.com/'])(
    'rejects unsafe target %s',
    (url) => {
      expect(() => validatePortalAppUrl(url, { PORTAL_ALLOW_HTTP: 'true' })).toThrow();
    },
  );
});
