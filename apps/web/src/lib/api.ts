import { createMemberClient } from '@1minitman/contracts/client';
import { queryOptions } from '@tanstack/react-query';
import { env } from './env';

/** Typed client for the member surface (/v1). The session is an HttpOnly cookie. */
export const api = createMemberClient({ baseUrl: env.apiUrl, credentials: 'include' });

export const healthQuery = queryOptions({
  queryKey: ['system', 'health'],
  queryFn: async () => {
    const { data, error } = await api.GET('/health');
    if (error || !data) throw new Error('The API did not answer.');
    return data;
  },
  retry: false,
});
