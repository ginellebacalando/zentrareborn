import 'server-only';

import { ContentType } from '@prisma/client';
export class ContentValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ContentValidationError';
    }
}
export function parseContentType(value: unknown) {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!Object.values(ContentType).includes(normalized as ContentType)) {
        throw new ContentValidationError('Content type is invalid.');
    }
    return normalized as ContentType;
}
