/**
 * Header and footer links in the order the website spec gives (W01, W02).
 * `ready` flips to true when the page is built; only ready links are rendered,
 * so the site never ships a link that leads nowhere.
 */
export interface SiteLink {
  label: string;
  path: string;
  module: string;
  ready: boolean;
}

export const HEADER_LINKS: SiteLink[] = [
  { label: 'How it works', path: '/how-it-works', module: 'W20', ready: false },
  { label: 'Safety', path: '/safety', module: 'W21', ready: false },
  { label: 'Plans', path: '/plans', module: 'W22', ready: false },
  { label: 'Stories', path: '/stories', module: 'W27', ready: false },
  { label: 'Help', path: '/help', module: 'W32', ready: false },
];

export const DOWNLOAD_LINK: SiteLink = {
  label: 'Get the app',
  path: '/download',
  module: 'W23',
  ready: false,
};

export const FOOTER_LINKS: SiteLink[] = [
  { label: 'Terms', path: '/terms', module: 'W35', ready: false },
  { label: 'Privacy', path: '/privacy', module: 'W35', ready: false },
  { label: 'Community Guidelines', path: '/guidelines', module: 'W35', ready: false },
];
