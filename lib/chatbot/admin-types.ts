import type { ZeniLanguage } from './language';
import type { ChatReply } from './types';

/** Shapes shared by the admin Zeni page, its API route and the client panel. */
export type ZeniGapReasonLabel = 'no_source' | 'low_confidence' | 'handoff' | 'conflict';

export type ZeniGapGroup = {
  hash: string;
  question: string;
  topic: string;
  language: ZeniLanguage;
  reasons: ZeniGapReasonLabel[];
  count: number;
  firstAsked: string;
  lastAsked: string;
};

export type ZeniKnowledgeSummary = {
  id: 'packages' | 'faqs' | 'facilities' | 'policies';
  label: string;
  count: number;
  updatedAt: string | null;
  note: string;
  edit: { label: string; href?: string };
};

export type ZeniAdminOverview = {
  checkedAt: string;
  ai: {
    enabled: boolean;
    keyConfigured: boolean;
    model: string;
    switchValue: 'default' | 'on' | 'off';
    reason?: 'no_key' | 'switched_off';
    usage: {
      perMinute: number;
      perDay: number;
      lastMinute: number;
      today: number;
      coolingDownUntil: string | null;
    };
  };
  knowledge: ZeniKnowledgeSummary[];
  gaps: {
    available: boolean;
    open: ZeniGapGroup[];
    resolvedLast30Days: number;
  };
  handoffs: {
    available: boolean;
    total: number;
    last30Days: number;
    open: number;
  };
};

export type ZeniPreviewDiagnostics = {
  intent: string;
  topic: string;
  language: ZeniLanguage;
  llm: { status: string; reason?: string; model?: string };
  sources: Array<{ title: string; href: string }>;
  gap?: { reason: ZeniGapReasonLabel; question: string };
  effect?: string;
};

export type ZeniPreviewResult = { reply: ChatReply; diagnostics: ZeniPreviewDiagnostics };
