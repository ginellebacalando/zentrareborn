export type OrchestrationSettings = {
  inquiryEnabled: boolean;
  timeoutMs: number;
  maxAttempts: number;
  retryBaseMs: number;
};
export type ConnectionCheck = {
  id: string;
  name: string;
  scope: string;
  state: 'connected' | 'configured' | 'missing' | 'error' | 'disabled';
  detail: string;
  latencyMs?: number;
};
export type DeveloperDocument = {
  id: string;
  kind: 'knowledge' | 'template';
  title: string;
  content: string;
  source: string;
  revision: number;
  published_revision: number | null;
  archived: boolean;
  updated_at: string;
};
export type DocumentRevision = {
  revision: number;
  title: string;
  content: string;
  source: string;
  actor: string;
  created_at: string;
};
export type TaskStep = {
  title: string;
  description: string;
  assignedRole: 'DEVELOPER' | 'ADMIN';
  priority: 'low' | 'medium' | 'high';
  required: boolean;
  dueOffsetDays: number;
};
export type PublicVersion = {
  id: string;
  version_number: number;
  status: string;
  payload: Record<string, unknown>;
  updated_at: string;
  lock: string;
};
export type PublicItem = {
  id: string;
  type: string;
  title: string;
  slug: string;
  versions: PublicVersion[];
};
export type Faq = {
  id: string;
  question: string;
  answer: string;
  category_id: string | null;
  status: string;
  lock: string;
  current_published_version_id: string | null;
  current_draft_version_id: string | null;
  client_visible: boolean;
};
export type FaqCategory = {
  id: string;
  name: string;
  status: string;
  client_visible: boolean;
};
export type ReviewItem = {
  id: string;
  question: string;
  occurrences: number;
  created_at: string;
};
export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  target: string;
  result: string;
  created_at: string;
};
export type Workflow = {
  id: string;
  name: string;
  active: boolean;
  editorUrl: string;
};
export type DeveloperSession = {
  id: string;
  name: string;
  email: string;
  session_id: string;
  created_at: string;
  expires_at: string;
  current: boolean;
};
export type Overview = {
  checks: ConnectionCheck[];
  checkedAt: string;
  settings: OrchestrationSettings;
  settingsRevision: number;
  documents: DeveloperDocument[];
  publishedCount: number;
  templateCount: number;
  faqCount: number;
  workflows: Workflow[];
  workflowError: string | null;
  delivery: { status: string; count: number }[];
  recentDeliveries: {
    id: string;
    workflow_name: string;
    status: string;
    created_at: string;
  }[];
  security: {
    gateway: boolean;
    allowlistedDevelopers: number;
    knowledgeFeed: boolean;
    syncConfigured: boolean;
  };
  sessions: DeveloperSession[];
  audit: AuditEntry[];
  review: ReviewItem[];
};
