'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Check,
  ChevronRight,
  CircleHelp,
  FileText,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Network,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import type { Overview } from '@/lib/developer/types';
import { developerApi } from './api';
import SourceEditor from './SourceEditor';
import KnowledgeTools from './KnowledgeTools';
import PublicContentEditor from './PublicContentEditor';
import styles from './developer.module.css';

type Section =
  | 'overview'
  | 'connections'
  | 'orchestration'
  | 'templates'
  | 'knowledge'
  | 'content'
  | 'security'
  | 'audit';
type WorkspaceSession = {
  csrf: string;
  developer: {
    name: string;
    email: string;
    expiresAt: string;
    localDevelopmentAccess?: boolean;
  };
};
const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'connections', label: 'Connections', icon: Network },
  { id: 'orchestration', label: 'Orchestration', icon: GitBranch },
  { id: 'templates', label: 'Task templates', icon: ListChecks },
  { id: 'knowledge', label: 'Assistant knowledge', icon: BookOpen },
  { id: 'content', label: 'Public content', icon: FileText },
  { id: 'security', label: 'Access & security', icon: ShieldCheck },
  { id: 'audit', label: 'Audit trail', icon: Activity },
] as const;
const descriptions: Record<Section, string> = {
  overview: 'A clear view of the systems behind Zion.',
  connections: 'Inspect the services used by the client and admin panels.',
  orchestration: 'Manage approved n8n workflows and inquiry delivery behavior.',
  templates: 'Versioned checklists for general and event-specific orchestration.',
  knowledge: 'Maintain the verified information your assistant can use.',
  content: 'Draft, review, and publish information across the client website.',
  security: 'Control developer access and revoke active sessions.',
  audit: 'A record of developer sign-ins, changes, and external operations.',
};
function date(value: string) {
  return new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
export default function DeveloperWorkspace({
  temporaryAccessUntil,
}: {
  temporaryAccessUntil?: string;
}) {
  const [section, setSection] = useState<Section>('overview'),
    [data, setData] = useState<Overview | null>(null);
  const [identity, setIdentity] = useState<{
    name: string;
    email: string;
    expiresAt: string;
    localDevelopmentAccess?: boolean;
  } | null>(null);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [menu, setMenu] = useState(false),
    [code, setCode] = useState('');
  const [csrf, setCsrf] = useState('');
  const sessionRequest = useRef<Promise<WorkspaceSession> | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await developerApi<Overview>('/api/developer/control'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load workspace.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    // Reuse the handshake during Strict Mode effect replay so concurrent cookies
    // cannot leave the mounted form with another session's CSRF value.
    sessionRequest.current ??= developerApi<WorkspaceSession>(
      '/api/developer/session',
      temporaryAccessUntil
        ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ localAccess: true }),
          }
        : undefined,
    );
    void sessionRequest.current
      .then((result) => {
        if (!cancelled) {
          setCsrf(result.csrf);
          setIdentity(result.developer);
          void load();
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load, temporaryAccessUntil]);
  useEffect(() => {
    if (!identity) return;
    const timer = window.setTimeout(
      () => window.location.replace('/developer/access'),
      Math.max(0, new Date(identity.expiresAt).getTime() - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [identity]);
  const mutate = async (input: Record<string, unknown>) => {
    if (!identity?.localDevelopmentAccess && !/^\d{6}$/.test(code)) {
      const message =
        'Enter a fresh 6-digit authenticator code in the verification bar before changing the system.';
      setError(message);
      document.getElementById('developer-confirm-code')?.focus();
      throw new Error(message);
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await developerApi<{ message?: string }>('/api/developer/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-developer-csrf': csrf,
        },
        body: JSON.stringify({ ...input, code }),
      });
      setNotice(result.message || 'Change saved.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to complete the action.');
      throw e;
    } finally {
      setBusy(false);
      setCode('');
    }
  };
  const run = (input: Record<string, unknown>) => {
    void mutate(input).catch(() => {});
  };
  const select = (id: Section) => {
    setSection(id);
    setMenu(false);
    setError('');
    setNotice('');
  };
  const connected = data?.checks.filter((c) => c.state === 'connected').length || 0;
  return (
    <div className={styles.root}>
      <aside className={`${styles.sidebar} ${menu ? styles.sidebarOpen : ''}`}>
        <div className={styles.wordmark}>
          <span>
            <Terminal size={23} />
          </span>
          <div>
            ZION<span>DEVELOPER SYSTEMS</span>
          </div>
        </div>
        <div className={styles.workspaceTag}>
          <span />
          Private workspace
          <LockKeyhole size={12} />
        </div>
        <p className={styles.navLabel}>COMMAND CENTER</p>
        <nav aria-label="Developer workspace">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => select(s.id)}
              className={section === s.id ? styles.navActive : ''}
              aria-current={section === s.id ? 'page' : undefined}
            >
              <s.icon size={18} />
              {s.label}
              {section === s.id && <ChevronRight size={14} />}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <ShieldCheck size={22} />
          <strong>Developer access only</strong>
          <p>
            Independent accounts.
            <br />
            Verified changes. Full traceability.
          </p>
          <span>Asia/Manila · PHT</span>
        </div>
      </aside>
      {menu && (
        <button
          className={styles.scrim}
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className={styles.body}>
        <header className={styles.topbar}>
          <div>
            <button
              className={styles.mobileMenu}
              onClick={() => setMenu(!menu)}
              aria-label="Toggle navigation"
              aria-expanded={menu}
            >
              <Menu size={20} />
            </button>
            <span className={styles.breadcrumb}>
              Workspace
              <ChevronRight size={13} />
              <strong>{sections.find((s) => s.id === section)?.label}</strong>
            </span>
          </div>
          <div>
            <span className={styles.restricted}>
              <LockKeyhole size={12} />
              RESTRICTED
            </span>
            <span className={styles.identity} title={identity?.email}>
              {identity?.name || 'Developer'}
            </span>
            {!temporaryAccessUntil && (
              <button
                className={styles.iconButton}
                title="Sign out"
                aria-label="Sign out"
                onClick={() => {
                  void developerApi('/api/developer/session', {
                    method: 'DELETE',
                    headers: { 'x-developer-csrf': csrf },
                  })
                    .then(() => window.location.replace('/developer/access'))
                    .catch((e) => setError(e.message));
                }}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </header>
        <main className={styles.main}>
          <div className={styles.heading}>
            <div>
              <p className={styles.eyebrow}>ZION / CONTROL PLANE</p>
              <h1>
                {section === 'overview'
                  ? 'Command center'
                  : sections.find((s) => s.id === section)?.label}
              </h1>
              <p>{descriptions[section]}</p>
            </div>
            <button
              className={styles.secondary}
              onClick={() => {
                setError('');
                void load();
              }}
              disabled={loading || busy}
            >
              <RefreshCw size={15} className={loading ? styles.spin : ''} />
              Refresh
            </button>
          </div>
          {temporaryAccessUntil ? (
            <div className={styles.verification} role="status">
              <div>
                <ShieldCheck size={19} />
                <span>
                  <strong>Temporary local access</strong>
                  <small>
                    Available until {date(temporaryAccessUntil)} PHT. Login protection returns
                    automatically afterward.
                  </small>
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.verification}>
              <div>
                <ShieldCheck size={19} />
                <span>
                  <strong>Verify a system change</strong>
                  <small>Use a fresh code for each change. Codes can be used once.</small>
                </span>
              </div>
              <label htmlFor="developer-confirm-code">
                Authenticator
                <input
                  id="developer-confirm-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </label>
            </div>
          )}
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className={styles.success} role="status">
              <Check size={17} />
              {notice}
            </div>
          )}
          {!data ? (
            <div className={styles.empty} role="status">
              <LoaderCircle size={24} className={loading ? styles.spin : ''} />
              <h2>{loading ? 'Loading command center…' : 'Workspace data unavailable'}</h2>
              <p>
                {loading
                  ? 'Checking your developer session and connected services.'
                  : 'Check server configuration, then refresh.'}
              </p>
            </div>
          ) : (
            <>
              {section === 'overview' && (
                <>
                  <section className={styles.hero}>
                    <div>
                      <span className={styles.pill}>
                        <span />
                        DEVELOPER OPERATIONS
                      </span>
                      <h2>
                        Keep every system
                        <br />
                        working together.
                      </h2>
                      <p>
                        Manage your connections, govern assistant knowledge,
                        <br className={styles.desktopBreak} /> and keep every change accountable.
                      </p>
                      <button onClick={() => select('connections')} className={styles.primary}>
                        Inspect connections
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                    <div
                      className={styles.heroDiagram}
                      aria-label="Client and admin connect through orchestration"
                    >
                      <div>
                        <Boxes size={20} />
                        CLIENT
                      </div>
                      <i />
                      <div className={styles.diagramCenter}>
                        <GitBranch size={25} />
                        ORCHESTRATION<span>n8n · governed workflows</span>
                      </div>
                      <i />
                      <div>
                        <ShieldCheck size={20} />
                        ADMIN
                      </div>
                    </div>
                  </section>
                  <section className={styles.metrics}>
                    <Metric
                      label="VERIFIED CONNECTIONS"
                      value={connected.toString().padStart(2, '0')}
                      detail={`${data.checks.length} services inspected`}
                      icon={<Network />}
                    />
                    <Metric
                      label="PUBLISHED KNOWLEDGE"
                      value={String(data.publishedCount).padStart(2, '0')}
                      detail={`${data.faqCount} published FAQ entries`}
                      icon={<BookOpen />}
                    />
                    <Metric
                      label="TASK TEMPLATES"
                      value={String(data.templateCount).padStart(2, '0')}
                      detail="Published orchestration checklists"
                      icon={<ListChecks />}
                    />
                    <Metric
                      label="REVIEW QUEUE"
                      value={String(data.review.length).padStart(2, '0')}
                      detail="Unresolved assistant topic gaps"
                      icon={<CircleHelp />}
                    />
                  </section>
                  <div className={styles.twoColumns}>
                    <section className={styles.card}>
                      <CardTitle
                        title="Connection health"
                        detail={`Last checked ${date(data.checkedAt)}`}
                      />
                      {data.checks.slice(0, 5).map((c) => (
                        <div className={styles.listRow} key={c.id}>
                          <span className={styles.serviceIcon}>
                            <Network size={16} />
                          </span>
                          <div>
                            <strong>{c.name}</strong>
                            <small>{c.scope}</small>
                          </div>
                          <Status value={c.state} />
                        </div>
                      ))}
                      <button className={styles.textButton} onClick={() => select('connections')}>
                        View all connections
                        <ArrowUpRight size={14} />
                      </button>
                    </section>
                    <section className={styles.card}>
                      <CardTitle
                        title="Continue your work"
                        detail="The Command Center workspaces"
                      />
                      {(
                        [
                          {
                            id: 'templates',
                            title: 'Task templates',
                            desc: 'Build and publish workflow checklists.',
                            icon: ListChecks,
                          },
                          {
                            id: 'knowledge',
                            title: 'Assistant knowledge',
                            desc: 'Review FAQs and maintain approved sources.',
                            icon: BookOpen,
                          },
                          {
                            id: 'content',
                            title: 'Public content',
                            desc: 'Draft and review client-facing information.',
                            icon: FileText,
                          },
                        ] as const
                      ).map((item) => (
                        <button
                          className={styles.workspaceLink}
                          onClick={() => select(item.id)}
                          key={item.id}
                        >
                          <span className={styles.serviceIcon}>
                            <item.icon size={19} />
                          </span>
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.desc}</small>
                          </span>
                          <ChevronRight size={17} />
                        </button>
                      ))}
                      <div className={styles.subtleNote}>
                        <ShieldCheck size={16} />
                        Your session expires at{' '}
                        {date(identity?.expiresAt || new Date().toISOString())}.
                      </div>
                    </section>
                  </div>
                </>
              )}
              {section === 'connections' && (
                <>
                  <div className={styles.connectionGrid}>
                    {data.checks.map((c) => (
                      <article className={styles.card} key={c.id}>
                        <div className={styles.cardTop}>
                          <span className={styles.largeIcon}>
                            <Network size={23} />
                          </span>
                          <Status value={c.state} />
                        </div>
                        <h2>{c.name}</h2>
                        <p className={styles.muted}>{c.scope}</p>
                        <p>{c.detail}</p>
                        {c.latencyMs !== undefined && (
                          <span className={styles.mono}>{c.latencyMs} ms · verified query</span>
                        )}
                      </article>
                    ))}
                  </div>
                  <div className={styles.subtleNote}>
                    “Configured” confirms required settings are present. “Connected” means an
                    authenticated request or database query completed.
                  </div>
                </>
              )}
              {section === 'orchestration' && (
                <>
                  <div className={styles.twoColumns}>
                    <OrchestrationForm
                      key={data.settingsRevision}
                      data={data}
                      busy={busy}
                      mutate={run}
                    />
                    <section className={styles.card}>
                      <CardTitle
                        title="Approved n8n workflows"
                        detail="Only server-allowlisted workflows can be controlled here."
                      />
                      {data.workflowError && <p className={styles.error}>{data.workflowError}</p>}
                      {!data.workflows.length && (
                        <div className={styles.empty}>
                          <GitBranch size={27} />
                          <h3>No workflows connected</h3>
                          <p>
                            Configure the approved n8n API connection and workflow IDs on the
                            server.
                          </p>
                        </div>
                      )}
                      {data.workflows.map((w) => (
                        <div key={w.id} className={styles.workflow}>
                          <div>
                            <strong>{w.name}</strong>
                            <Status value={w.active ? 'active' : 'paused'} />
                          </div>
                          <code>{w.id}</code>
                          <div className={styles.actions}>
                            <a
                              className={styles.secondary}
                              href={w.editorUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Edit in n8n
                              <ArrowUpRight size={14} />
                            </a>
                            <button
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `${w.active ? 'Pause' : 'Activate'} ${w.name} in n8n?`,
                                  )
                                )
                                  run({
                                    op: 'workflow',
                                    id: w.id,
                                    active: !w.active,
                                  });
                              }}
                            >
                              {w.active ? 'Pause workflow' : 'Activate workflow'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </section>
                  </div>
                  <section className={styles.card}>
                    <CardTitle
                      title="Webhook delivery history"
                      detail="Recent inquiry deliveries. Retrying respects the attempt limit and idempotency key."
                    />
                    {!data.recentDeliveries.length ? (
                      <p className={styles.muted}>No webhook deliveries have been recorded.</p>
                    ) : (
                      <div className={styles.tableWrap}>
                        <table>
                          <thead>
                            <tr>
                              <th>Workflow</th>
                              <th>Status</th>
                              <th>Created</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.recentDeliveries.map((d) => (
                              <tr key={d.id}>
                                <td>
                                  {d.workflow_name}
                                  <small className={styles.mono}>{d.id}</small>
                                </td>
                                <td>
                                  <Status value={d.status} />
                                </td>
                                <td>{date(d.created_at)}</td>
                                <td>
                                  {[
                                    'RETRYING',
                                    'FAILED',
                                    'QUEUED',
                                    'retrying',
                                    'failed',
                                    'queued',
                                  ].includes(d.status) && (
                                    <button
                                      disabled={busy}
                                      onClick={() => run({ op: 'delivery-retry', id: d.id })}
                                    >
                                      Retry delivery
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </>
              )}
              {section === 'templates' && (
                <SourceEditor
                  key="templates"
                  kind="template"
                  documents={data.documents.filter((d) => d.kind === 'template')}
                  busy={busy}
                  mutate={mutate}
                />
              )}
              {section === 'knowledge' && (
                <KnowledgeTools data={data} busy={busy} mutate={mutate} csrf={csrf} />
              )}
              {section === 'content' && <PublicContentEditor busy={busy} mutate={mutate} />}
              {section === 'security' && (
                <>
                  <div className={styles.connectionGrid}>
                    <SecurityCard
                      title={temporaryAccessUntil ? 'Temporary local access' : 'Mandatory MFA'}
                      detail={
                        temporaryAccessUntil
                          ? `Login and authenticator checks are temporarily skipped on this computer until ${date(temporaryAccessUntil)} PHT. Production still requires MFA.`
                          : 'Password and a one-time authenticator code at sign-in. Every system change requires a fresh code.'
                      }
                    />
                    <SecurityCard
                      title="Explicit developer accounts"
                      detail={`${data.security.allowlistedDevelopers} approved email(s). Client and administrator accounts grant no developer permissions.`}
                    />
                    <SecurityCard
                      title={
                        temporaryAccessUntil ? 'Fixed access deadline' : 'Short, revocable sessions'
                      }
                      detail={
                        temporaryAccessUntil
                          ? 'The local session cannot outlive its seven-day window. Disabling the temporary access setting revokes this exception immediately.'
                          : '30-minute absolute expiry, 10-minute inactivity expiry, and one active session per developer.'
                      }
                    />
                    <SecurityCard
                      title={
                        data.security.gateway
                          ? 'Production gateway enforced'
                          : 'Local development mode'
                      }
                      detail={
                        data.security.gateway
                          ? 'The server also requires the private ingress verification header.'
                          : 'Production requires HTTPS and a private gateway secret before this panel can open.'
                      }
                    />
                  </div>
                  <section className={styles.card}>
                    <CardTitle
                      title="Active developer sessions"
                      detail="Revocation takes effect on the next request."
                    />
                    <div className={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>Developer</th>
                            <th>Signed in</th>
                            <th>Expires</th>
                            <th>Access</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.sessions.map((s) => (
                            <tr key={s.session_id}>
                              <td>
                                <strong>
                                  {s.name}
                                  {s.current ? ' · You' : ''}
                                </strong>
                                <small>{s.email}</small>
                              </td>
                              <td>{date(s.created_at)}</td>
                              <td>{date(s.expires_at)}</td>
                              <td>
                                <div className={styles.actions}>
                                  <button
                                    disabled={busy}
                                    onClick={() =>
                                      run({
                                        op: 'session-revoke',
                                        id: s.session_id,
                                      })
                                    }
                                  >
                                    Revoke session
                                  </button>
                                  {!s.current && (
                                    <button
                                      className={styles.danger}
                                      disabled={busy}
                                      onClick={() => {
                                        if (
                                          window.confirm(`Disable developer access for ${s.email}?`)
                                        )
                                          run({
                                            op: 'account-disable',
                                            id: s.id,
                                          });
                                      }}
                                    >
                                      Disable access
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
              {section === 'audit' && (
                <section className={styles.card}>
                  <CardTitle
                    title="Developer audit trail"
                    detail="Latest 50 events. Passwords, authenticator seeds, tokens, and knowledge text are excluded."
                  />
                  {!data.audit.length ? (
                    <p>No audit events yet.</p>
                  ) : (
                    <div className={styles.tableWrap}>
                      <table>
                        <thead>
                          <tr>
                            <th>Time · PHT</th>
                            <th>Action</th>
                            <th>Actor</th>
                            <th>Target</th>
                            <th>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.audit.map((a) => (
                            <tr key={a.id}>
                              <td>{date(a.created_at)}</td>
                              <td className={styles.mono}>{a.action}</td>
                              <td className={styles.mono}>{a.actor.slice(0, 16)}</td>
                              <td className={styles.mono}>{a.target}</td>
                              <td>
                                <Status value={a.result} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          <footer className={styles.footer}>
            <span>
              <span />
              Zion Developer Systems
            </span>
            <span>Private control plane · All times PHT</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className={styles.metric}>
      <div>
        {label}
        <span>{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
export function CardTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={styles.cardTitle}>
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`${styles.status} ${['connected', 'active', 'success', 'published'].includes(value.toLowerCase()) ? styles.good : ['error', 'failed', 'denied'].includes(value.toLowerCase()) ? styles.bad : styles.neutral}`}
    >
      <i />
      {value.replaceAll('_', ' ').toLowerCase()}
    </span>
  );
}
function SecurityCard({ title, detail }: { title: string; detail: string }) {
  return (
    <article className={styles.card}>
      <ShieldCheck className={styles.accent} size={23} />
      <h2>{title}</h2>
      <p>{detail}</p>
    </article>
  );
}
function OrchestrationForm({
  data,
  busy,
  mutate,
}: {
  data: Overview;
  busy: boolean;
  mutate: (input: Record<string, unknown>) => void;
}) {
  const [value, setValue] = useState(data.settings);
  return (
    <section className={styles.card}>
      <CardTitle
        title="Inquiry delivery controls"
        detail="These settings apply to the existing client inquiry orchestration."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutate({ op: 'settings', revision: data.settingsRevision, value });
        }}
      >
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={value.inquiryEnabled}
            onChange={(e) => setValue({ ...value, inquiryEnabled: e.target.checked })}
          />
          Enable inquiry webhook delivery
        </label>
        <div className={styles.formGrid}>
          {(
            [
              {
                key: 'timeoutMs',
                label: 'Timeout (milliseconds)',
                min: 1000,
                max: 30000,
              },
              {
                key: 'maxAttempts',
                label: 'Maximum attempts per new job',
                min: 1,
                max: 10,
              },
              {
                key: 'retryBaseMs',
                label: 'Retry backoff base (milliseconds)',
                min: 1000,
                max: 1800000,
              },
            ] as const
          ).map((f) => (
            <label key={f.key}>
              {f.label}
              <input
                type="number"
                required
                min={f.min}
                max={f.max}
                value={value[f.key]}
                onChange={(e) => setValue({ ...value, [f.key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
        <p className={styles.help}>
          Secrets and destination URLs are managed in server configuration. Existing jobs retain
          their original attempt budget.
        </p>
        <button className={styles.primary} disabled={busy}>
          Save orchestration settings
        </button>
      </form>
    </section>
  );
}
