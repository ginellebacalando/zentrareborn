import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: {
    default: 'Zion Events Place Admin Panel',
    template: '%s | Zion Events Place Admin Panel',
  },
  robots: { index: false, follow: false },
};
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
