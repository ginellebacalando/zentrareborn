'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { canDo, canOpenPage, type AdminAction } from '@/lib/admin/permissions';

/**
 * The signed-in role for admin screens, so a button or link a role may not use is never shown
 * (lib/admin/permissions.ts). Hiding is a courtesy: the server refuses the same requests anyway.
 */
const AdminRoleContext = createContext<string>('ADMIN');

export function AdminRoleProvider({ role, children }: { role: string; children: ReactNode }) {
  return <AdminRoleContext.Provider value={role}>{children}</AdminRoleContext.Provider>;
}

export function useAdminRole() {
  const role = useContext(AdminRoleContext);
  return {
    role,
    can: (action: AdminAction) => canDo(role, action),
    canOpen: (page: string) => canOpenPage(role, page),
  };
}
