import 'server-only';

import {
  createReceptionistBookingAdapter,
  type ReceptionistBookingAdapter,
} from './receptionist-booking.adapter';
import {
  receptionistBookingRequestSchema,
  type ReceptionistBookingResult,
} from './receptionist-booking.contract';
import {
  createReceptionistCalendarAvailability,
  type ReceptionistCalendarAvailability,
} from './receptionist-calendar';

export type ReceptionistOrchestrationDispatchDependencies = {
  calendar?: ReceptionistCalendarAvailability;
  booking?: ReceptionistBookingAdapter;
};

export type ReceptionistOrchestrationDispatch = {
  execute(request: unknown): Promise<ReceptionistBookingResult>;
};

export function createReceptionistOrchestrationDispatch(
  dependencies: ReceptionistOrchestrationDispatchDependencies = {},
): ReceptionistOrchestrationDispatch {
  const calendar = dependencies.calendar ?? createReceptionistCalendarAvailability();
  const booking = dependencies.booking ?? createReceptionistBookingAdapter();

  return {
    async execute(rawRequest) {
      const request = receptionistBookingRequestSchema.parse(rawRequest);
      if (request.intent === 'availability_check') return calendar.check(request);
      return booking.execute(request);
    },
  };
}
