'use client';

import {
  BarChart3,
  Bell,
  Boxes,
  BriefcaseBusiness,
  ChevronDown,
  ClipboardCheck,
  Factory,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Settings,
  ShieldCheck,
  Truck,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { logoutAction } from '@/app/actions/auth';

const navigation = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: BriefcaseBusiness },
  { label: 'BoQ', href: '/boq', icon: FileSpreadsheet },
  { label: 'Materials', href: '/materials', icon: Boxes },
  { label: 'Production', href: '/production', icon: Factory },
  { label: 'FAT', href: '/fat', icon: ClipboardCheck },
  { label: 'Delivery', href: '/delivery', icon: Truck },
  { label: 'Site Work', href: '/site-work', icon: Wrench },
  { label: 'Finance', href: '/finance', icon: BarChart3 },
  { label: 'Reports', href: '/reports', icon: PackageCheck },
  { label: 'Action Center', href: '/actions', icon: Bell },
];

type WorkspaceShellProps = {
  children: ReactNode;
  user: { displayName: string; username: string; role: string };
};

export function WorkspaceShell({ children, user }: WorkspaceShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const pageTitle =
    navigation.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.label ?? (pathname === '/settings' ? 'Settings' : 'Workspace');
  const initials = user.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f3f5f7] text-[#172536]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] flex-col bg-[#102334] text-white lg:flex">
        <Link
          href="/dashboard"
          className="flex h-[82px] items-center gap-3 border-b border-white/10 px-6"
        >
          <span className="grid size-10 place-items-center bg-[#f36b3e] font-mono text-sm font-bold tracking-tight">
            PC
          </span>
          <span>
            <strong className="block text-[15px] font-semibold tracking-tight">
              Project Control
            </strong>
            <small className="mt-0.5 block text-xs font-medium uppercase tracking-[0.16em] text-white/45">
              Operations center
            </small>
          </span>
        </Link>

        <nav
          aria-label="Navigasi utama"
          className="flex-1 overflow-y-auto px-3 py-6"
        >
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/35">
            Workspace
          </p>
          <div className="space-y-1">
            {navigation.map(({ label, href, icon: Icon }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`group flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition ${active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                >
                  <Icon
                    className={`size-4 ${active ? 'text-[#ff7b4f]' : 'text-white/45 group-hover:text-white/75'}`}
                  />
                  {label}
                  {active && (
                    <span className="ml-auto h-4 w-0.5 bg-[#f36b3e]" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            href="/settings"
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-white/55 hover:text-white"
          >
            <Settings className="size-4" /> Settings
          </Link>
          <div className="mt-2 border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center bg-[#dce6ea] text-xs font-bold text-[#153246]">
                {initials}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs">
                  {user.displayName}
                </strong>
                <small className="block truncate text-xs capitalize text-white/40">
                  {user.role.toLowerCase().replace('_', ' ')}
                </small>
              </span>
              <ChevronDown className="size-3.5 text-white/40" />
            </div>
            <form
              action={logoutAction}
              className="mt-3 border-t border-white/10 pt-2"
            >
              <button className="flex w-full items-center gap-2 py-1.5 text-xs font-medium text-white/55 hover:text-white">
                <LogOut className="size-3.5" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-20 flex h-[82px] items-center gap-4 border-b border-[#dfe4e8] bg-white/95 px-4 backdrop-blur md:px-7 xl:px-9">
          <Link
            href="/dashboard"
            className="grid size-9 place-items-center bg-[#102334] font-mono text-xs font-bold text-white lg:hidden"
          >
            PC
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#83909c]">
              Project Control Center
            </p>
            <h1 className="mt-1 truncate text-lg font-semibold tracking-[-0.025em] text-[#132738] md:text-xl">
              {pageTitle}
            </h1>
          </div>
          <div className="hidden items-center gap-2 border border-[#dce4e7] bg-[#f6f8f9] px-3 py-2 text-xs font-medium text-[#5e707c] md:flex">
            <ShieldCheck className="size-4 text-[#1c8d74]" /> Secure workspace
          </div>
          <Link
            href="/actions"
            aria-label="Action Center"
            className="grid size-10 place-items-center border border-[#dce2e6] bg-white"
          >
            <Bell className="size-[17px]" />
          </Link>
          <button
            type="button"
            aria-label="Menu navigasi"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
            className="border border-slate-200 px-3 py-2 text-sm lg:hidden"
          >
            Menu
          </button>
          {menuOpen && (
            <nav
              aria-label="Semua modul"
              className="absolute right-4 top-[76px] max-h-[70vh] w-64 overflow-y-auto border border-slate-200 bg-white p-3 shadow-xl lg:hidden"
            >
              {[
                ...navigation,
                { label: 'Settings', href: '/settings', icon: Settings },
              ].map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-sm hover:bg-slate-100"
                >
                  {label}
                </Link>
              ))}
              <form action={logoutAction}>
                <button className="px-3 py-2 text-sm text-red-700">
                  Sign out
                </button>
              </form>
            </nav>
          )}
        </header>

        {children}

        <nav
          aria-label="Navigasi seluler"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#dce2e6] bg-white/96 px-2 py-2 backdrop-blur lg:hidden"
        >
          {[navigation[0], navigation[1], navigation[3], navigation[9]].map(
            ({ label, href, icon: Icon }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center gap-1 py-1 text-xs font-semibold ${active ? 'text-[#d85832]' : 'text-[#7d8b95]'}`}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            },
          )}
        </nav>
      </div>
    </div>
  );
}
