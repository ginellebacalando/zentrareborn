import {
  clientPhotoErrorResponse,
  removeClientPhoto,
  submitClientPhoto,
} from '@/services/client-photos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Adds or changes a client's optional arrival photo (docs/client-photos.md). */
export async function POST(request: Request) {
  try {
    return Response.json(await submitClientPhoto(request), {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return clientPhotoErrorResponse(error);
  }
}

/** Removes the client's photo; it is deleted at once. */
export async function DELETE(request: Request) {
  try {
    await removeClientPhoto(request);
    return Response.json({ removed: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return clientPhotoErrorResponse(error);
  }
}
