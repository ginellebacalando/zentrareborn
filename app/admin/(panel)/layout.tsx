import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentAdmin } from '@/lib/admin/access';
import AdminShell from '@/components/admin/AdminShell';
import { AdminPreferencesProvider } from '@/components/admin/AdminPreferencesProvider';
import { getAdminPreferences } from '@/lib/admin/preferences';
import { ADMIN_THEME_COOKIE, adminThemeValue } from '@/lib/admin/preferences-types';
export const dynamic = 'force-dynamic';
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await currentAdmin();
  if (!user) redirect('/admin');
  const [{ settings }, cookieStore] = await Promise.all([getAdminPreferences(), cookies()]);
  return (
    <AdminPreferencesProvider
      initial={settings}
      personalTheme={adminThemeValue(cookieStore.get(ADMIN_THEME_COOKIE)?.value)}
    >
      <AdminShell
        user={{
          fullName: user.fullName,
          username: user.username,
          email: user.email,
          profileImage: user.profileImage,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        }}
      >
        {children}
      </AdminShell>
    </AdminPreferencesProvider>
  );
}
