import 'server-only';

import { N8nWorkflowStatus, Prisma } from '@prisma/client';
import { EMAIL_SPAM_NOTICE, requireOutboundWebhookSecret, requireOutboundWebhookUrl, webhookTimeoutSignal } from '@/lib/email-delivery';
import { prisma } from '@/lib/prisma';
export type OperationalWebhookEvent = 'inquiry.created';
type DeliveryMetadata = {
    attemptCount: number;
    maxAttempts: number;
    nextAttemptAt: string | null;
    httpStatus: number | null;
};
const EVENT_CONFIGURATION: Record<OperationalWebhookEvent, {
    envName: string;
    module: string;
    workflowName: string;
}> = {
    'inquiry.created': {
        envName: 'N8N_INQUIRY_WEBHOOK_URL',
        module: 'inquiry',
        workflowName: 'zion-inquiry-orchestration',
    },
};

export function operationalWebhooksEnabled() {
    return process.env.N8N_WEBHOOK_ENABLED?.trim().toLowerCase() === 'true';
}

function deliveryMetadata(value: Prisma.JsonValue | null | undefined): DeliveryMetadata {
    const response = value && typeof value === 'object' && !Array.isArray(value)
        ? value as Prisma.JsonObject
        : {};
    const delivery = response.delivery &&
        typeof response.delivery === 'object' &&
        !Array.isArray(response.delivery)
        ? response.delivery as Prisma.JsonObject
        : {};
    return {
        attemptCount: typeof delivery.attemptCount === 'number' ? delivery.attemptCount : 0,
        maxAttempts: typeof delivery.maxAttempts === 'number' ? delivery.maxAttempts : 5,
        nextAttemptAt: typeof delivery.nextAttemptAt === 'string' ? delivery.nextAttemptAt : null,
        httpStatus: typeof delivery.httpStatus === 'number' ? delivery.httpStatus : null,
    };
}
function retryAt(attemptCount: number) {
    const baseMs = Math.max(Number(process.env.N8N_WEBHOOK_RETRY_BASE_MS ?? 30000), 1000);
    const delayMs = Math.min(baseMs * (2 ** Math.max(attemptCount - 1, 0)), 30 * 60000);
    return new Date(Date.now() + delayMs);
}
function safeResponseBody(value: string) {
    return value.slice(0, 2000);
}
export async function queueOperationalWebhook(input: {
    event: OperationalWebhookEvent;
    relatedRecordId: string;
    payload: Record<string, unknown>;
}) {
    const configuration = EVENT_CONFIGURATION[input.event];
    const maxAttempts = Math.min(Math.max(Number(process.env.N8N_WEBHOOK_MAX_ATTEMPTS ?? 5), 1), 10);
    return prisma.n8nWorkflowLog.create({
        data: {
            workflowName: configuration.workflowName,
            relatedModule: configuration.module,
            relatedRecordId: input.relatedRecordId,
            triggerSource: input.event,
            requestPayload: {
                event: input.event,
                occurredAt: new Date().toISOString(),
                payload: input.payload,
            } as Prisma.InputJsonValue,
            responsePayload: {
                delivery: {
                    attemptCount: 0,
                    maxAttempts,
                    nextAttemptAt: null,
                    httpStatus: null,
                },
            } as Prisma.InputJsonValue,
            status: N8nWorkflowStatus.QUEUED,
        },
        select: { id: true },
    });
}
export async function deliverOperationalWebhook(workflowLogId: string) {
    const log = await prisma.n8nWorkflowLog.findUnique({
        where: { id: workflowLogId },
    });
    if (!log || !log.triggerSource || !(log.triggerSource in EVENT_CONFIGURATION)) {
        return { delivered: false, status: 'not_found' as const };
    }
    if (log.status === N8nWorkflowStatus.SUCCESS) {
        return { delivered: true, status: 'already_delivered' as const };
    }
    const event = log.triggerSource as OperationalWebhookEvent;
    const configuration = EVENT_CONFIGURATION[event];
    const previous = deliveryMetadata(log.responsePayload);
    const attemptCount = previous.attemptCount + 1;
    const maxAttempts = previous.maxAttempts;
    await prisma.n8nWorkflowLog.update({
        where: { id: log.id },
        data: {
            status: N8nWorkflowStatus.PROCESSING,
            startedAt: log.startedAt ?? new Date(),
            errorMessage: null,
        },
    });
    let httpStatus: number | null = null;
    try {
        const webhookUrl = requireOutboundWebhookUrl(process.env[configuration.envName], configuration.envName);
        const webhookSecret = requireOutboundWebhookSecret();
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-zion-source': 'backend',
                'x-zion-event': event,
                'x-zion-idempotency-key': log.id,
                'x-zion-workflow-secret': webhookSecret,
            },
            signal: webhookTimeoutSignal(),
            body: JSON.stringify({
                workflowLogId: log.id,
                relatedRecordId: log.relatedRecordId,
                spamNotice: EMAIL_SPAM_NOTICE,
                ...(log.requestPayload as Record<string, unknown> | null),
            }),
        });
        httpStatus = response.status;
        const responseText = safeResponseBody(await response.text());
        if (!response.ok) {
            throw new Error(`n8n webhook returned HTTP ${response.status}.`);
        }
        await prisma.n8nWorkflowLog.update({
            where: { id: log.id },
            data: {
                status: N8nWorkflowStatus.SUCCESS,
                errorMessage: null,
                completedAt: new Date(),
                responsePayload: {
                    delivery: {
                        attemptCount,
                        maxAttempts,
                        nextAttemptAt: null,
                        httpStatus,
                    },
                    response: responseText,
                } as Prisma.InputJsonValue,
            },
        });
        return { delivered: true, status: 'delivered' as const };
    }
    catch (error) {
        const exhausted = attemptCount >= maxAttempts;
        const nextAttemptAt = exhausted ? null : retryAt(attemptCount);
        const errorMessage = error instanceof Error ? error.message : 'Operational webhook failed.';
        await prisma.n8nWorkflowLog.update({
            where: { id: log.id },
            data: {
                status: exhausted ? N8nWorkflowStatus.FAILED : N8nWorkflowStatus.RETRYING,
                errorMessage,
                completedAt: exhausted ? new Date() : null,
                responsePayload: {
                    delivery: {
                        attemptCount,
                        maxAttempts,
                        nextAttemptAt: nextAttemptAt?.toISOString() ?? null,
                        httpStatus,
                    },
                } as Prisma.InputJsonValue,
            },
        });
        return {
            delivered: false,
            status: exhausted ? 'failed' as const : 'retrying' as const,
        };
    }
}
