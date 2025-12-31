import type { Metadata } from 'next';
import Link from 'next/link';
import { Sofa } from 'lucide-react';

import { DarkModeToggle } from '@/components/dark-mode-toggle';

export const metadata: Metadata = {
  title: 'KouchParty Admin',
  description: 'Admin tools for KouchParty',
};

function AdminHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="group flex items-start gap-2 transition-opacity hover:opacity-90">
            <Sofa className="h-8 w-8 -rotate-12 text-gray-800 transition-transform group-hover:-translate-y-0.5 dark:text-gray-200" aria-hidden />
            <div className="flex flex-col leading-none">
              <span className="text-2xl font-black tracking-tight">KouchParty</span>
              <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-blue-400/60 bg-blue-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-blue-800 shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_10px_30px_-18px_rgba(59,130,246,0.8)] ring-1 ring-blue-300/40 backdrop-blur dark:border-blue-200/40 dark:bg-blue-900/40 dark:text-blue-100 dark:shadow-[0_0_0_1px_rgba(191,219,254,0.25),0_10px_30px_-18px_rgba(191,219,254,0.8)] dark:ring-blue-200/30">
                Admin Access
              </span>
            </div>
          </Link>
          <nav className="self-center flex items-center gap-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Link href="/admin/contribute" className="rounded-full px-3 py-1 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
              Contribute
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <DarkModeToggle />
        </div>
      </div>
    </header>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-50">
      <AdminHeader />
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-6">{children}</main>
    </div>
  );
}
