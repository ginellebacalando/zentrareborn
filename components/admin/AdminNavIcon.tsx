import {
  CalendarCheck,
  CalendarDays,
  ChartLine,
  ConciergeBell,
  FileSignature,
  Headset,
  History,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Package,
  Settings,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { AdminModuleKey } from './navigation';
import styles from './admin.module.css';

/** One thin outline family (1.5px stroke) for every sidebar destination, as the plan asks. */
const icons: Record<AdminModuleKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  bookings: CalendarCheck,
  'front-desk': ConciergeBell,
  contracts: FileSignature,
  calendar: CalendarDays,
  inquiries: Inbox,
  'live-chat': Headset,
  payments: Wallet,
  services: Package,
  zeni: MessagesSquare,
  analytics: ChartLine,
  team: Users,
  automation: Workflow,
  logs: History,
  settings: Settings,
};
export type AdminNavIconName = AdminModuleKey;

export default function AdminNavIcon({ name }: { name: AdminNavIconName }) {
  const Icon = icons[name];
  return <Icon className={styles.sidebarIcon} size={20} strokeWidth={1.5} aria-hidden="true" />;
}
