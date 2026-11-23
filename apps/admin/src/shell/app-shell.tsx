import { useTheme, type ThemeSetting } from '@1minitman/ui-web';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { healthQuery } from '../lib/api';
import { BrandMark } from './brand-mark';
import { EnvironmentBadge } from './environment-badge';
import { NAVIGATION } from './navigation';

const THEMES: ThemeSetting[] = ['system', 'light', 'dark'];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const health = useQuery(healthQuery);
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:bg-background focus:p-2"
      >
        Skip to content
      </a>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <Link
          to="/overview"
          className="flex items-center gap-2 font-extrabold"
          data-testid="shell.brand.home"
        >
          <BrandMark className="h-6 w-auto" />
          <span>1minitman admin</span>
        </Link>
        <EnvironmentBadge environment={health.data?.environment} />
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[14px] text-fg-2" htmlFor="theme">
            Theme
          </label>
          <select
            id="theme"
            data-testid="shell.theme.select"
            className="h-9 rounded-sm border border-border-strong bg-background px-2 text-[14px]"
            value={theme}
            onChange={(event) => setTheme(event.target.value as ThemeSetting)}
          >
            {THEMES.map((value) => (
              <option key={value} value={value}>
                {value[0]?.toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Main"
          className="hidden w-64 shrink-0 overflow-y-auto border-r p-3 md:block"
        >
          {NAVIGATION.map((group) => (
            <section key={group.label} className="mb-4">
              <h2 className="px-2 pb-1 text-[12px] font-extrabold tracking-[0.12em] text-fg-3 uppercase">
                {group.label}
              </h2>
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="block rounded-sm px-2 py-2 text-[14px] text-fg-2 hover:bg-surface"
                      activeProps={{ className: 'bg-surface font-bold text-foreground' }}
                      activeOptions={{ exact: true }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        <main id="main" className="min-w-0 flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
