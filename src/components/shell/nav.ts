import type { IconName } from './icons';

export type NavItem = { href: string; label: string; icon: IconName; key?: string; keywords?: string };
export type NavGroup = { grp: string; items: NavItem[] };

/** Sidebar structure. Labels are the app's vocabulary — keep them stable. */
export const NAV: NavGroup[] = [
  { grp: 'Weekly flow', items: [
    { href: '/app', label: 'Home', icon: 'home', keywords: 'dashboard overview start' },
    { href: '/app/stories', label: 'Story pool', icon: 'stories', key: 'stories', keywords: 'news articles fetch' },
    { href: '/app/editions', label: 'Editions', icon: 'editions', key: 'editions', keywords: 'newsletter issues drafts' },
    { href: '/app/leads', label: 'Leads', icon: 'leads', key: 'leads', keywords: 'interested hot pipeline' },
  ] },
  { grp: 'Inputs', items: [
    { href: '/app/knowledge', label: 'Our work (knowledge)', icon: 'knowledge', key: 'kb', keywords: 'case studies products kb' },
    { href: '/app/contacts', label: 'Contacts', icon: 'contacts', keywords: 'people audience list' },
    { href: '/app/sources', label: 'News sources', icon: 'sources', keywords: 'rss feeds' },
  ] },
  { grp: 'System', items: [
    { href: '/app/automations', label: 'Automations', icon: 'automations', keywords: 'jobs schedule cron' },
    { href: '/app/notifications', label: 'Notifications', icon: 'bell', key: 'notif', keywords: 'alerts activity' },
    { href: '/app/outbox', label: 'Email outbox', icon: 'tray', key: 'outbox', keywords: 'mail sent emails' },
    { href: '/app/settings', label: 'Settings', icon: 'gear', keywords: 'preferences config' },
    { href: '/app/guide', label: 'How it works', icon: 'help', keywords: 'help guide docs' },
  ] },
];

export const isActive = (href: string, path: string) => (href === '/app' ? path === '/app' : path === href || path.startsWith(href + '/'));
