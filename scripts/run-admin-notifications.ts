import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
async function main() {
  const { processAdminNotifications } = await import('../lib/admin/notifications');
  console.log(await processAdminNotifications());
}
main().catch(() => {
  console.error('Notification processing failed. Check server configuration.');
  process.exitCode = 1;
});
