/**
 * The API is one service with four surfaces (Technical Reference 4.2).
 * Each surface has its own audience, auth model and OpenAPI document.
 */
export const SURFACES = {
  member: { basePath: '/v1', title: '1minitman Member API', audience: 'Member app and web app' },
  public: { basePath: '/public/v1', title: '1minitman Public API', audience: 'Website, no auth' },
  admin: { basePath: '/admin/v1', title: '1minitman Admin API', audience: 'Admin console (staff)' },
} as const;

export type SurfaceName = keyof typeof SURFACES;
export const SURFACE_NAMES = Object.keys(SURFACES) as SurfaceName[];

/** Vendor webhooks: signature verified, never called by our clients, not in any client SDK. */
export const WEBHOOKS_BASE_PATH = '/webhooks';
