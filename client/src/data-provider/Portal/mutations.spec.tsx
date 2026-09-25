import { act, renderHook } from '@testing-library/react';
import { dataService, QueryKeys } from 'librechat-data-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { usePortalAdminMutations } from './mutations';

jest.mock('librechat-data-provider', () => {
  const actual = jest.requireActual('librechat-data-provider');
  return {
    ...actual,
    dataService: {
      ...actual.dataService,
      createPortalApp: jest.fn(),
    },
  };
});

describe('usePortalAdminMutations', () => {
  it('refreshes the admin and user catalogs after creating an application', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const createPortalApp = dataService.createPortalApp as jest.MockedFunction<
      typeof dataService.createPortalApp
    >;
    createPortalApp.mockResolvedValue(undefined);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => usePortalAdminMutations(), { wrapper });
    const form = new FormData();

    await act(async () => result.current.createApp.mutateAsync(form));

    expect(invalidate).toHaveBeenCalledWith([QueryKeys.portalAdminCatalog]);
    expect(invalidate).toHaveBeenCalledWith([QueryKeys.portalCatalog]);
  });
});
