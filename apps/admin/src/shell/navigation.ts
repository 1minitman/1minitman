/**
 * The console's navigation, straight from the admin spec (A04 group order, Appendix B routes).
 * `module` is the spec id, `milestone` is when it is built, `permission` is the view permission
 * the API enforces. An item appears here once; the shell and the placeholder page both read it.
 */
export interface NavItem {
  label: string;
  to: string;
  module: string;
  milestone: 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8';
  permission: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Overview',
        to: '/overview',
        module: 'A33',
        milestone: 'M8',
        permission: 'analytics.read',
      },
    ],
  },
  {
    label: 'Members',
    items: [
      {
        label: 'Member directory',
        to: '/members',
        module: 'A09',
        milestone: 'M3',
        permission: 'users.read',
      },
      {
        label: 'Data and privacy',
        to: '/members/privacy',
        module: 'A36',
        milestone: 'M8',
        permission: 'privacy.requests',
      },
    ],
  },
  {
    label: 'Trust & Safety',
    items: [
      {
        label: 'Black Badge review',
        to: '/safety/badges',
        module: 'A12',
        milestone: 'M4',
        permission: 'badges.review',
      },
      {
        label: 'Media moderation',
        to: '/safety/media',
        module: 'A13',
        milestone: 'M4',
        permission: 'media.moderate',
      },
      {
        label: 'Cases',
        to: '/safety/cases',
        module: 'A14',
        milestone: 'M4',
        permission: 'cases.read',
      },
      {
        label: 'Safety desk',
        to: '/safety/desk',
        module: 'A15',
        milestone: 'M4',
        permission: 'safety.escalations',
      },
      {
        label: 'Appeals',
        to: '/safety/appeals',
        module: 'A16',
        milestone: 'M4',
        permission: 'appeals.decide',
      },
      {
        label: 'Abuse rules',
        to: '/safety/rules',
        module: 'A17',
        milestone: 'M4',
        permission: 'cases.read',
      },
    ],
  },
  {
    label: 'Revenue',
    items: [
      {
        label: 'Subscriptions',
        to: '/revenue/subscriptions',
        module: 'A19',
        milestone: 'M5',
        permission: 'billing.read',
      },
      {
        label: 'Refunds',
        to: '/revenue/refunds',
        module: 'A20',
        milestone: 'M5',
        permission: 'billing.read',
      },
      {
        label: 'Plans and prices',
        to: '/revenue/plans',
        module: 'A21',
        milestone: 'M5',
        permission: 'billing.read',
      },
      {
        label: 'Revenue reports',
        to: '/revenue/reports',
        module: 'A23',
        milestone: 'M5',
        permission: 'analytics.read',
      },
    ],
  },
  {
    label: 'Engagement',
    items: [
      {
        label: 'Groups',
        to: '/engagement/groups',
        module: 'A18',
        milestone: 'M4',
        permission: 'groups.moderate',
      },
      {
        label: 'Matching tuning',
        to: '/engagement/tuning',
        module: 'A24',
        milestone: 'M6',
        permission: 'config.remote',
      },
    ],
  },
  {
    label: 'Communications',
    items: [
      {
        label: 'Templates',
        to: '/comms/templates',
        module: 'A25',
        milestone: 'M6',
        permission: 'notifications.templates',
      },
      {
        label: 'Broadcasts',
        to: '/comms/broadcasts',
        module: 'A26',
        milestone: 'M6',
        permission: 'notifications.broadcast',
      },
    ],
  },
  {
    label: 'Support',
    items: [
      {
        label: 'Inbox',
        to: '/support/inbox',
        module: 'A27',
        milestone: 'M6',
        permission: 'support.tickets',
      },
    ],
  },
  {
    label: 'Content & CMS',
    items: [
      {
        label: 'Pages',
        to: '/content/pages',
        module: 'A28',
        milestone: 'M6',
        permission: 'content.manage',
      },
      {
        label: 'Collections',
        to: '/content/media',
        module: 'A29',
        milestone: 'M6',
        permission: 'content.manage',
      },
      {
        label: 'Legal documents',
        to: '/content/legal',
        module: 'A30',
        milestone: 'M6',
        permission: 'content.manage',
      },
    ],
  },
  {
    label: 'Platform & Config',
    items: [
      {
        label: 'Feature flags',
        to: '/platform/flags',
        module: 'A31',
        milestone: 'M7',
        permission: 'config.flags',
      },
    ],
  },
  {
    label: 'Network & Security',
    items: [
      {
        label: 'Network',
        to: '/network',
        module: 'A32',
        milestone: 'M7',
        permission: 'network.read',
      },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        label: 'Business analytics',
        to: '/analytics',
        module: 'A34',
        milestone: 'M8',
        permission: 'analytics.read',
      },
      {
        label: 'Research',
        to: '/analytics/research',
        module: 'A35',
        milestone: 'M8',
        permission: 'research.manage',
      },
    ],
  },
  {
    label: 'Admin & Access',
    items: [
      {
        label: 'Admins',
        to: '/access/admins',
        module: 'A08',
        milestone: 'M2',
        permission: 'admins.read',
      },
      {
        label: 'Roles',
        to: '/access/roles',
        module: 'A05',
        milestone: 'M2',
        permission: 'roles.read',
      },
      {
        label: 'Approvals',
        to: '/access/approvals',
        module: 'A06',
        milestone: 'M2',
        permission: 'approvals.read',
      },
      {
        label: 'Audit log',
        to: '/access/audit',
        module: 'A07',
        milestone: 'M2',
        permission: 'audit.read',
      },
    ],
  },
];

export const findNavItem = (path: string): NavItem | undefined =>
  NAVIGATION.flatMap((group) => group.items).find((item) => item.to === path);
