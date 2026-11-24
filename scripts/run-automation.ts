// One automation run from a terminal or an external scheduler: the same work as the cron route.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });

async function main() {
  const { runAutomation } = await import('../lib/automation/run');
  const { prisma } = await import('../lib/prisma');
  try {
    // Counts only: no addresses, message content or secrets are printed.
    console.log(JSON.stringify(await runAutomation({ trigger: 'cli' })));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    'Automation run failed. Check the database connection, the automation schema (npm run db:automation:check) and mail settings.',
    error instanceof Error ? error.name : 'unknown',
  );
  process.exitCode = 1;
});
