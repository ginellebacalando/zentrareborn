import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', '.next', 'node_modules']);
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const thisScript = path.normalize('scripts/check-removed-features.mjs');

const removedPaths = [
  'app/book',
  'app/booking-receipt',
  'app/payment',
  'app/api/client/assistant',
  'app/api/client/bookings',
  'app/api/client/calendar-availability',
  'app/api/client/appointment-availability',
  'components/booking',
  'components/client/ReservationSection.tsx',
  'components/client/SmartGuide.tsx',
  'config/appointment-services.ts',
  'lib/booking-validation.ts',
  'lib/client-calendar-availability.ts',
  'services/booking-orchestration',
  'services/calendar',
  'services/rate-limit.service.ts',
  'services/smart-assistant',
  'services/task-template',
  'public/images/payment',
];

const forbiddenRuntimePatterns = [
  /["'`]\/(?:book|booking-receipt|payment)(?:\/|["'`?#])/i,
  /["'`]\/api\/client\/(?:assistant|bookings|calendar-availability|appointment-availability)(?:\/|["'`?])/i,
  /@\/components\/(?:booking|client\/(?:ReservationSection|SmartGuide))(?:\/|["'])/i,
  /@\/(?:services\/(?:booking-orchestration|calendar|smart-assistant|task-template)|lib\/(?:booking-validation|client-calendar-availability))(?:\/|["'])/i,
  // The legacy Smart Assistant's settings stay retired. GEMINI_API_KEY is allowed again because Zeni's
  // LLM-assisted retrieval (services/chatbot/gemini.ts, docs/chatbot.md) uses it on purpose.
  /\b(?:ASSISTANT_DATABASE_URL|ASSISTANT_DATA_TERMS_ACCEPTED|GEMINI_ENABLED|GEMINI_ASSISTANT_MODEL|N8N_BOOKING_WEBHOOK_URL)\b/,
  /\b(?:assistantEnabled|bookingRequestsEnabled|lastUsedByAssistantAt)\b/,
  /\b(?:prisma|db|tx)\.booking(?:PackageSnapshot)?\b/,
];

const forbiddenSchemaPatterns = [
  /\bbooking\w*\b/i,
  /\bappointment\w*\b/i,
  /\b(?:model|enum)\s+(?:Assistant\w*|Knowledge\w*|OrchestrationRateLimit|Contract(?:Version|Template|Timeline|SendAttempt)?|Payment(?:Record|History|Milestone)|TaskTemplate(?:Item|MigrationRun)?|DashboardTask|ClientAccessGrant)\b/,
];

function walk(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walk(absolute));
    else output.push(absolute);
  }
  return output;
}

const failures = [];

for (const relativePath of removedPaths) {
  if (fs.existsSync(path.join(root, relativePath))) {
    failures.push(`Removed feature artifact still exists: ${relativePath}`);
  }
}

for (const absolute of walk(root)) {
  const relative = path.normalize(path.relative(root, absolute));
  if (relative === thisScript || !sourceExtensions.has(path.extname(relative))) continue;

  const source = fs.readFileSync(absolute, 'utf8');
  for (const pattern of forbiddenRuntimePatterns) {
    if (pattern.test(source)) {
      failures.push(`Removed feature runtime reference remains in: ${relative}`);
      break;
    }
  }
}

const environmentExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
for (const pattern of forbiddenRuntimePatterns.slice(4, 5)) {
  if (pattern.test(environmentExample)) {
    failures.push('Removed feature environment configuration remains in: .env.example');
  }
}

// Admin-only operational models are allowed; removed public booking models remain forbidden.
const prismaSchema = fs
  .readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
  .replace(/model Admin\w+\s*\{[\s\S]*?\n\}/g, '');
for (const pattern of forbiddenSchemaPatterns) {
  if (pattern.test(prismaSchema)) {
    failures.push(
      `Removed feature database contract remains in: prisma/schema.prisma (${pattern})`,
    );
  }
}

// The external workflow integration and the Resend transport were replaced by the built-in
// outbox automation (docs/automation.md). Keep them from returning.
const retiredIntegrationPaths = [
  'services/orchestration/operational-webhook.service.ts',
  'services/orchestration/developer-settings.ts',
  'services/orchestration/workflows',
  'scripts/run-admin-notifications.ts',
];
const retiredIntegrationPattern =
  /\b(?:N8N_[A-Z0-9_]+|n8nWorkflowLog|N8nWorkflow\w*|ADMIN_RESEND_API_KEY|ADMIN_MAIL_FROM)\b|operational-webhook/;
for (const relativePath of retiredIntegrationPaths) {
  if (fs.existsSync(path.join(root, relativePath))) {
    failures.push(`Retired integration artifact still exists: ${relativePath}`);
  }
}
for (const absolute of walk(root)) {
  const relative = path.normalize(path.relative(root, absolute));
  if (relative === thisScript || !sourceExtensions.has(path.extname(relative))) continue;
  if (retiredIntegrationPattern.test(fs.readFileSync(absolute, 'utf8'))) {
    failures.push(`Retired integration reference remains in: ${relative}`);
  }
}
if (retiredIntegrationPattern.test(environmentExample)) {
  failures.push('Retired integration configuration remains in: .env.example');
}
if (/\b(?:model|enum)\s+N8n\w*/.test(prismaSchema)) {
  failures.push('Retired integration database contract remains in: prisma/schema.prisma');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Smart Assistant and online booking boundaries are absent.');
