import { NextResponse } from 'next/server';
import {
  currentDeveloper,
  loginDeveloper,
  requireDeveloper,
  sessionCsrf,
  createLocalDeveloperSession,
  developerFromToken,
} from '@/lib/developer/auth';
import { audit, developerDb, rateLimit } from '@/lib/developer/db';
import {
  assertDeveloperGate,
  assertDeveloperOrigin,
  developerCookieName,
  DeveloperError,
  developerResponse,
  readDeveloperJson,
} from '@/lib/developer/security';
import { localDeveloperAccessForRequest } from '@/lib/developer/local-access';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function failure(error: unknown) {
  return developerResponse(
    {
      error:
        error instanceof DeveloperError
          ? error.message
          : 'Developer sign-in is unavailable. Contact the system operator.',
    },
    error instanceof DeveloperError ? error.status : 503,
  );
}
export async function GET(request: Request) {
  try {
    assertDeveloperGate(request.headers);
    const actor = await currentDeveloper(request.headers);
    if (!actor) throw new DeveloperError('Developer authentication required.', 401);
    const csrf = await sessionCsrf(actor);
    return developerResponse({
      csrf,
      developer: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        expiresAt: actor.expiresAt,
        localDevelopmentAccess: Boolean(actor.localDevelopmentAccess),
      },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertDeveloperOrigin(request);
    const input = await readDeveloperJson(request);
    if (
      z
        .object({ localAccess: z.literal(true) })
        .strict()
        .safeParse(input).success
    ) {
      const lease = localDeveloperAccessForRequest(request.headers);
      if (!lease)
        throw new DeveloperError('Temporary local access is unavailable or has expired.', 403);
      await rateLimit(`local-access:${lease.id}`, 30, 60);
      let actor = await currentDeveloper(request.headers);
      let token: string | undefined;
      let localCsrf: string | undefined;
      if (!actor?.localDevelopmentAccess) {
        const created = await createLocalDeveloperSession(request.headers);
        token = created.token;
        localCsrf = created.csrf;
        actor = await developerFromToken(token, request.headers);
      }
      if (!actor) throw new DeveloperError('Unable to open local developer access.', 403);
      const response = NextResponse.json(
        {
          csrf: localCsrf ?? (await sessionCsrf(actor)),
          developer: {
            id: actor.id,
            name: actor.name,
            email: actor.email,
            expiresAt: actor.expiresAt,
            localDevelopmentAccess: true,
          },
        },
        {
          headers: {
            'Cache-Control': 'private, no-store',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        },
      );
      if (token)
        response.cookies.set(developerCookieName(), token, {
          httpOnly: true,
          secure: false,
          sameSite: 'strict',
          path: '/',
          maxAge: Math.max(0, Math.floor((lease.expiresAt - Date.now()) / 1000)),
        });
      return response;
    }
    const result = await loginDeveloper(input, request.headers);
    const response = NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      },
    );
    response.cookies.set(developerCookieName(), result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 1800,
    });
    return response;
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertDeveloperOrigin(request);
    const actor = await requireDeveloper(request, true);
    await developerDb.query('UPDATE zion_developer_sessions SET revoked_at=now() WHERE id=$1', [
      actor.sessionId,
    ]);
    await audit(actor.id, 'SIGN_OUT', 'developer');
    const response = NextResponse.json(
      { ok: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
    response.cookies.set(developerCookieName(), '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return failure(error);
  }
}
