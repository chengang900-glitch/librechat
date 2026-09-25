jest.mock('./request', () => ({
  __esModule: true,
  default: {
    getResponse: jest.fn(),
    post: jest.fn(),
    postText: jest.fn(),
    postMultiPart: jest.fn(),
    patch: jest.fn(),
    patchMultiPart: jest.fn(),
  },
}));

import request from './request';
import { createPortalApp, getPortalIcon, updatePortalApp } from './data-service';
import type { CreatePortalAppInput } from './portal';

const mockGetResponse = request.getResponse as jest.Mock;
const mockPost = request.post as jest.Mock;
const mockPostMultiPart = request.postMultiPart as jest.Mock;
const mockPatch = request.patch as jest.Mock;
const mockPatchMultiPart = request.patchMultiPart as jest.Mock;

const app: CreatePortalAppInput = {
  groupId: 'group-1',
  name: '经营分析',
  description: '',
  url: 'https://example.com/',
  iconType: 'preset',
  iconRef: 'chart',
  sortOrder: 0,
  enabled: true,
};

describe('portal application requests', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses JSON requests when no icon file is supplied', () => {
    createPortalApp(app);
    updatePortalApp('app-1', app);

    expect(mockPost).toHaveBeenCalledWith(expect.stringContaining('/api/admin/portal/apps'), app);
    expect(mockPatch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/portal/apps/app-1'),
      app,
    );
    expect(mockPostMultiPart).not.toHaveBeenCalled();
    expect(mockPatchMultiPart).not.toHaveBeenCalled();
  });

  it('preserves FormData for create and update icon uploads', () => {
    const form = new FormData();
    form.append('payload', JSON.stringify(app));

    createPortalApp(form);
    updatePortalApp('app-1', form);

    expect(mockPostMultiPart).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/portal/apps'),
      form,
    );
    expect(mockPatchMultiPart).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/portal/apps/app-1'),
      form,
    );
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('loads uploaded icons through the authenticated request client', () => {
    getPortalIcon('/images/portal/icon.webp');

    expect(mockGetResponse).toHaveBeenCalledWith('/images/portal/icon.webp', {
      responseType: 'blob',
    });
  });
});
