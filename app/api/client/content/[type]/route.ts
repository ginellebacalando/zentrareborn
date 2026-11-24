import {
  handlePublicContentError,
  listPublishedContent,
  parseContentType,
} from '@/services/public-content';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    const { type } = await params;
    const contentType = parseContentType(decodeURIComponent(type));
    return Response.json({ success: true, data: await listPublishedContent(contentType) });
  } catch (error) {
    return handlePublicContentError(error);
  }
}
