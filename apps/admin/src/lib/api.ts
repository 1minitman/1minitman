import { createAdminClient } from '@1minitman/contracts/client';
import { queryOptions } from '@tanstack/react-query';
import { env } from './env';

/** The one API client for the console: typed from the OpenAPI document, cookie session included. */
export const api = createAdminClient({ baseUrl: env.apiUrl });

export const healthQuery = queryOptions({
  queryKey: ['system', 'health'],
  queryFn: async () => {
    const { data, error } = await api.GET('/health');
    if (error || !data) throw new Error('The API did not answer.');
    return data;
  },
  refetchInterval: 30_000,
  retry: false,
});

export const readinessQuery = queryOptions({
  queryKey: ['system', 'ready'],
  queryFn: async () => {
    // 503 carries the same body as 200: a degraded report is still a report.
    const { data, error } = await api.GET('/ready');
    const report = data ?? error;
    if (!report) throw new Error('The API did not answer.');
    return report;
  },
  refetchInterval: 30_000,
  retry: false,
});
