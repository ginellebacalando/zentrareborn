'use client';
import { usePathname } from 'next/navigation';
// Private workspaces have their own chrome and never appear in public navigation.
export default function PanelChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/developer' ||
    path.startsWith('/developer/')
    ? null
    : children;
}
