import { z, ZodError } from 'zod';
import { AdminError, adminResponse, checkMutationOrigin } from '@/lib/admin/access';
import { acceptInvitation } from '@/lib/admin/invitations';

export const runtime = 'nodejs';

const acceptance = z
  .object({ token: z.string().min(20).max(100), password: z.string().min(1).max(128) })
  .strict();

/** Sets the password of an invited administrator (lib/admin/invitations.ts). Public by design. */
export async function POST(request: Request) {
  try {
    checkMutationOrigin(request);
    const body = await request.text();
    if (body.length > 2000) throw new AdminError('Request is too large.', 413);
    const input = acceptance.parse(JSON.parse(body));
    const result = await acceptInvitation(input.token, input.password);
    return adminResponse({ ok: true, email: result.email });
  } catch (error) {
    if (error instanceof AdminError) return adminResponse({ error: error.message }, error.status);
    if (error instanceof ZodError || error instanceof SyntaxError)
      return adminResponse({ error: 'Check the form and try again.' }, 400);
    console.error('Invitation acceptance failed:', error instanceof Error ? error.name : 'unknown');
    return adminResponse(
      { error: 'Account setup is unavailable right now. Try again later.' },
      503,
    );
  }
}
