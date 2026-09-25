import {
  AppWindow,
  BarChart3,
  Bot,
  Database,
  FileText,
  Folder,
  LayoutDashboard,
  Link,
  Settings,
  Users,
  WalletCards,
  Workflow,
} from 'lucide-react';
import type { ComponentType } from 'react';

export const portalIcons: Record<string, ComponentType<{ className?: string }>> = {
  app: AppWindow,
  chart: BarChart3,
  database: Database,
  document: FileText,
  folder: Folder,
  workflow: Workflow,
  dashboard: LayoutDashboard,
  link: Link,
  robot: Bot,
  settings: Settings,
  users: Users,
  finance: WalletCards,
};
