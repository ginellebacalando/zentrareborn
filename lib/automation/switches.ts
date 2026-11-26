import 'server-only';

import { prisma } from '@/lib/prisma';
import { AUTOMATIONS } from './automations';

/**
 * On/off switches for the automations that may be turned off (lib/automation/automations.ts),
 * kept in zion_automation_state so no schema change is needed. Off means their emails are skipped
 * at delivery and logged as "Skipped"; the booking flow itself never stops.
 */
export const SWITCHED_OFF_STATE_KEY = 'switched-off';
export const SWITCHED_OFF_MESSAGE =
  'Not sent: this automation is turned off on the Automation page.';

export async function readSwitchedOff(): Promise<Set<string>> {
  const state = await prisma.automationState.findUnique({ where: { key: SWITCHED_OFF_STATE_KEY } });
  const keys =
    state?.detail && typeof state.detail === 'object' && 'keys' in state.detail
      ? (state.detail as { keys?: unknown }).keys
      : [];
  const switchable = new Set(AUTOMATIONS.filter((a) => a.canSwitchOff).map((a) => a.key));
  return new Set(Array.isArray(keys) ? keys.filter((key) => switchable.has(String(key))) : []);
}

/** Outbox events whose automation is switched off. */
export async function switchedOffEvents(): Promise<Set<string>> {
  const off = await readSwitchedOff();
  return new Set(AUTOMATIONS.filter((a) => off.has(a.key)).flatMap((a) => a.events));
}

export async function setAutomationSwitch(key: string, enabled: boolean) {
  const automation = AUTOMATIONS.find((a) => a.key === key);
  if (!automation) return { ok: false as const, reason: 'This automation does not exist.' };
  if (!automation.canSwitchOff)
    return { ok: false as const, reason: 'This automation keeps the booking flow running.' };
  const off = await readSwitchedOff();
  if (enabled) off.delete(key);
  else off.add(key);
  await prisma.automationState.upsert({
    where: { key: SWITCHED_OFF_STATE_KEY },
    create: { key: SWITCHED_OFF_STATE_KEY, detail: { keys: [...off] } },
    update: { at: new Date(), detail: { keys: [...off] } },
  });
  return { ok: true as const, automation };
}
