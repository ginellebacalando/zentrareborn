'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, MailPlus, UserPlus, X } from 'lucide-react';
import type { TeamMember } from '@/lib/admin/team';
import { PAGE_ACCESS, type AdminRole } from '@/lib/admin/permissions';
import { adminPageLabel } from './navigation';
import { useAdminDate } from './AdminPreferencesProvider';
import AdminPageHeader from './AdminPageHeader';
import styles from './admin.module.css';
import { Button, IconButton } from '@/components/shared/Button';

/**
 * Team (super administrators only): staff accounts, invitations, roles and access. The server
 * enforces every rule (lib/admin/team.ts); this screen explains them and hides what cannot apply,
 * such as changing your own role.
 */
const ROLE_NAMES: Record<AdminRole, string> = { SUPERADMIN: 'Super admin', ADMIN: 'Admin' };

const STATUS: Record<TeamMember['status'], { label: string; tone: string }> = {
  ACTIVE: { label: 'Active', tone: styles.good },
  INVITED: { label: 'Invited', tone: styles.neutral },
  INVITATION_EXPIRED: { label: 'Invitation expired', tone: styles.bad },
  DISABLED: { label: 'Disabled', tone: styles.bad },
  PASSWORD_RESET_REQUIRED: { label: 'Must change password', tone: styles.neutral },
};

/** Pages each role may open, in sidebar order, for the "What each role can open" note. */
const PAGE_ORDER = Object.keys(PAGE_ACCESS).filter((page) => page !== 'profile');
function pagesFor(role: AdminRole) {
  return PAGE_ORDER.filter((page) =>
    (PAGE_ACCESS[page as keyof typeof PAGE_ACCESS] as readonly string[]).includes(role),
  ).map(adminPageLabel);
}

type Confirmation = {
  title: string;
  text: string;
  confirm: string;
  destructive: boolean;
  run: () => Promise<void>;
};

async function post(payload: Record<string, unknown>) {
  const response = await fetch('/api/admin/team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    link?: string;
    expiresAt?: string;
  };
  if (!response.ok) throw new Error(body.error || 'The change could not be saved.');
  return body;
}

export default function TeamPanel({
  members,
  canManage,
  onChanged,
  refresh,
}: {
  members: TeamMember[];
  canManage: boolean;
  onChanged: () => Promise<unknown>;
  /** The page's Refresh button (AdminWorkspace). */
  refresh?: ReactNode;
}) {
  const formatDate = useAdminDate();
  const titleId = useId();
  const inviteRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [invitation, setInvitation] = useState<{ email: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const pending = members.filter((m) => m.status === 'INVITED').length;
  const statusLine = `${members.length} ${members.length === 1 ? 'account' : 'accounts'}${
    pending ? ` · ${pending} ${pending === 1 ? 'invitation' : 'invitations'} waiting` : ''
  }`;

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      setMessage(await action());
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The change could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  function ask(next: Confirmation) {
    setConfirmation(next);
    confirmRef.current?.showModal();
  }

  function openInvite() {
    setInviteError('');
    setInvitation(null);
    setCopied(false);
    inviteRef.current?.showModal();
  }

  return (
    <>
      <AdminPageHeader
        title="Team"
        status={statusLine}
        actions={
          <>
            {refresh}
            {canManage && (
              <Button
                type="button"
                variant="primary"
                icon={<UserPlus aria-hidden="true" />}
                onClick={openInvite}
              >
                Invite admin
              </Button>
            )}
          </>
        }
      />
      <section className={styles.card} aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.srOnly}>
          Staff accounts
        </h2>
        <div aria-live="polite">
          {message && (
            <p className={styles.success} role="status">
              {message}
            </p>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.teamTable}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Last sign-in</th>
                {canManage && (
                  <th scope="col">
                    <span className={styles.srOnly}>Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const status = STATUS[member.status];
                const waiting =
                  member.status === 'INVITED' || member.status === 'INVITATION_EXPIRED';
                return (
                  <tr key={member.id}>
                    <td>
                      <strong>
                        {member.fullName}
                        {member.isYou ? ' (you)' : ''}
                      </strong>
                      <small>{member.email}</small>
                    </td>
                    <td>
                      <span className={styles.cellLabel} aria-hidden="true">
                        Role
                      </span>
                      {canManage && !member.isYou && member.status !== 'DISABLED' ? (
                        <select
                          className={styles.inlineSelect}
                          aria-label={`Role of ${member.fullName}`}
                          value={member.role}
                          disabled={busy}
                          onChange={(event) => {
                            const role = event.target.value as AdminRole;
                            event.target.value = member.role;
                            ask({
                              title: `Make ${member.fullName} ${ROLE_NAMES[role].toLowerCase()}?`,
                              text:
                                role === 'SUPERADMIN'
                                  ? 'They will also see Team, Automation, Activity log and Settings, and can change anyone’s role. They will be signed out so the new access applies.'
                                  : 'They will lose Team, Automation, Activity log, Settings, exports and voids. They will be signed out so the new access applies.',
                              confirm: `Make ${ROLE_NAMES[role].toLowerCase()}`,
                              destructive: false,
                              run: () =>
                                run(async () => {
                                  await post({ op: 'team-role', id: member.id, role });
                                  return `${member.fullName} is now ${ROLE_NAMES[role].toLowerCase()}.`;
                                }),
                            });
                          }}
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="SUPERADMIN">Super admin</option>
                        </select>
                      ) : (
                        ROLE_NAMES[member.role]
                      )}
                    </td>
                    <td>
                      <span className={styles.cellLabel} aria-hidden="true">
                        Status
                      </span>
                      <span className={`${styles.badge} ${status.tone}`}>{status.label}</span>
                      {member.status === 'INVITED' && member.invitedUntil && (
                        <small>Link expires {formatDate(member.invitedUntil)}</small>
                      )}
                    </td>
                    <td>
                      <span className={styles.cellLabel} aria-hidden="true">
                        Last sign-in
                      </span>
                      {member.lastSignInAt ? formatDate(member.lastSignInAt) : 'Never'}
                    </td>
                    {canManage && (
                      <td className={styles.rowActions}>
                        {!member.isYou && waiting && member.status !== 'DISABLED' && (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                const result = await post({ op: 'team-resend', id: member.id });
                                if (result.link)
                                  setInvitation({ email: member.email, link: result.link });
                                return `A new invitation is on its way to ${member.email}.`;
                              })
                            }
                          >
                            <MailPlus size={16} aria-hidden="true" />
                            Resend invite
                          </Button>
                        )}
                        {!member.isYou &&
                          (member.status === 'DISABLED' ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                run(async () => {
                                  await post({
                                    op: 'team-status',
                                    id: member.id,
                                    status: 'ACTIVE',
                                  });
                                  return `${member.fullName} can sign in again.`;
                                })
                              }
                            >
                              Enable
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="destructive"
                              disabled={busy}
                              onClick={() =>
                                ask({
                                  title: `Disable ${member.fullName}?`,
                                  text: 'They are signed out at once and cannot sign in until you enable the account again. Their bookings and notes stay.',
                                  confirm: 'Disable account',
                                  destructive: true,
                                  run: () =>
                                    run(async () => {
                                      await post({
                                        op: 'team-status',
                                        id: member.id,
                                        status: 'DISABLED',
                                      });
                                      return `${member.fullName}'s account is disabled.`;
                                    }),
                                })
                              }
                            >
                              Disable
                            </Button>
                          ))}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {invitation && (
          <div className={styles.inviteLink} role="status">
            <p>
              The invitation is queued for {invitation.email}. If email is not set up yet, send them
              this link yourself; it works once and only for them.
            </p>
            <div>
              <code>{invitation.link}</code>
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invitation.link);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <Copy size={16} aria-hidden="true" />
                )}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className={styles.card} aria-labelledby={`${titleId}-access`}>
        <div className={styles.cardHeading}>
          <h2 id={`${titleId}-access`}>What each role can open</h2>
        </div>
        <dl className={styles.accessSummary}>
          <div>
            <dt>Admin</dt>
            <dd>{pagesFor('ADMIN').join(', ')}. No exports, voids or price changes.</dd>
          </div>
          <div>
            <dt>Super admin</dt>
            <dd>
              Everything, including{' '}
              {pagesFor('SUPERADMIN')
                .filter((page) => !pagesFor('ADMIN').includes(page))
                .join(', ')}
              , exports, voids, package prices and role changes.
            </dd>
          </div>
        </dl>
      </section>

      <dialog
        ref={inviteRef}
        className={styles.catalogDialog}
        aria-labelledby={`${titleId}-invite`}
        onClose={() => setInviteError('')}
      >
        <form
          method="dialog"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const email = String(form.get('email') ?? '').trim();
            setBusy(true);
            setInviteError('');
            try {
              const result = await post({
                op: 'team-invite',
                fullName: String(form.get('fullName') ?? '').trim(),
                email,
                role: String(form.get('role') ?? 'ADMIN'),
              });
              inviteRef.current?.close();
              setError('');
              setMessage(`Invitation sent to ${email}.`);
              if (result.link) setInvitation({ email, link: result.link });
              await onChanged();
            } catch (e) {
              setInviteError(e instanceof Error ? e.message : 'The invitation could not be sent.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className={styles.catalogDialogHeading}>
            <div>
              <h2 id={`${titleId}-invite`}>Invite an admin</h2>
              <p>They get an email with a link to choose a password. It expires in 3 days.</p>
            </div>
            <IconButton
              type="button"
              label="Close"
              icon={<X aria-hidden="true" />}
              onClick={() => inviteRef.current?.close()}
            />
          </div>
          {inviteError && (
            <p className={styles.catalogFormError} role="alert">
              {inviteError}
            </p>
          )}
          <div className={`${styles.formGrid} ${styles.catalogFields}`}>
            <label>
              Full name
              <input name="fullName" required minLength={2} maxLength={180} autoComplete="off" />
            </label>
            <label>
              Email address
              <input name="email" type="email" required maxLength={255} autoComplete="off" />
            </label>
            <fieldset className={`${styles.full} ${styles.roleChoice}`}>
              <legend>Role</legend>
              <label>
                <input type="radio" name="role" value="ADMIN" defaultChecked />
                <strong>Admin</strong>
                <small>Daily work: bookings, front desk, payments, chats and reports.</small>
              </label>
              <label>
                <input type="radio" name="role" value="SUPERADMIN" />
                <strong>Super admin</strong>
                <small>Everything, plus team, settings, automation, exports and voids.</small>
              </label>
            </fieldset>
          </div>
          <div className={styles.catalogDialogActions}>
            <Button type="button" variant="secondary" onClick={() => inviteRef.current?.close()}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon={<MailPlus aria-hidden="true" />}
              loading={busy}
              loadingLabel="Sending…"
            >
              Send invitation
            </Button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={confirmRef}
        className={`${styles.catalogDialog} ${styles.confirmDialog}`}
        aria-labelledby={`${titleId}-confirm`}
        onClose={() => setConfirmation(null)}
      >
        {confirmation && (
          <>
            <div className={styles.catalogDialogHeading}>
              <h2 id={`${titleId}-confirm`}>{confirmation.title}</h2>
            </div>
            <p className={styles.confirmText}>{confirmation.text}</p>
            <div className={styles.catalogDialogActions}>
              <Button type="button" variant="secondary" onClick={() => confirmRef.current?.close()}>
                Cancel
              </Button>
              <Button
                type="button"
                variant={confirmation.destructive ? 'destructive' : 'primary'}
                onClick={async () => {
                  const next = confirmation;
                  confirmRef.current?.close();
                  await next.run();
                }}
              >
                {confirmation.confirm}
              </Button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
