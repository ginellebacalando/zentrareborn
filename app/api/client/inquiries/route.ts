import { after } from 'next/server';
import { inquiryErrorResponse, submitInquiry } from '@/lib/inquiry-service';
import { requireClientFeature, settingsErrorResponse } from '@/lib/system-settings';
import {
  deliverOperationalWebhook,
  operationalWebhooksEnabled,
  queueOperationalWebhook,
} from '@/services/orchestration/operational-webhook.service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    await requireClientFeature('inquirySubmissions');
    const result = await submitInquiry(request);
    const { orchestrationPayload } = result;
    const response = {
      id: result.id,
      inquiryReference: result.inquiryReference,
      message: result.message,
    };
    if (await operationalWebhooksEnabled()) {
      const workflow = await queueOperationalWebhook({
        event: 'inquiry.created',
        relatedRecordId: result.id,
        payload: {
          inquiryId: result.id,
          inquiryReference: result.inquiryReference,
          ...orchestrationPayload,
        },
      });
      after(() => deliverOperationalWebhook(workflow.id));
    }
    return Response.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ClientFeatureDisabledError') {
      return settingsErrorResponse(error, 'Unable to submit your inquiry.');
    }

    return inquiryErrorResponse(error, 'Unable to submit your inquiry.');
  }
}
