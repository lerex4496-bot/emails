import 'dotenv/config';
import { buildApp } from './app.js';
import { getPrismaClient, AccountProvider } from '@mailtrace/database';

async function ensureDatabaseInitialized() {
  try {
    const prisma = getPrismaClient();
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[Init] Fresh database detected. Auto-creating initial owner user...');
      const user = await prisma.user.create({
        data: {
          email: 'owner@mailtrace.io',
          displayName: 'MailTrace System Owner',
          passwordHash: '$2b$10$wT0E8Y7O0n3KkV9y9Fj2/u4pT1Q18Z9B1v/rK90r2v1h5.9yH4Lq2', // Password123!
          privacySettings: {
            storeRawIp: false,
            retainCoarseGeo: true,
            eventRetentionDays: 90,
            anonymizeSubnet: true,
          },
        },
      });

      await prisma.account.create({
        data: {
          userId: user.id,
          provider: AccountProvider.SMTP,
          emailAddress: 'owner@mailtrace.io',
          displayName: 'Primary Sender',
          encryptedCredentials: 'default-unconfigured',
          isDefault: true,
        },
      });
      console.log('[Init] Default owner account initialized (owner@mailtrace.io / Password123!).');
    }
  } catch (err: any) {
    console.warn('[Init] Auto-init check skipped:', err?.message || err);
  }
}

async function main() {
  await ensureDatabaseInitialized();
  const app = await buildApp();
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    app.log.info(`MailTrace API listening on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
