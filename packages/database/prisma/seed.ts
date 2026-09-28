import { PrismaClient, MessageStatus, AccountProvider, TokenType, TrackingEventType, ConfidenceLevel, Classification } from '@prisma/client';
import { encryptCredentials } from '../src/crypto.js';

const prisma = new PrismaClient();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

async function main() {
  console.log('[Seed] Seeding MailTrace Phase 1 database with realistic evidence-based telemetry...');

  // Clean previous records
  await prisma.auditLog.deleteMany({});
  await prisma.clickEvent.deleteMany({});
  await prisma.trackingEvent.deleteMany({});
  await prisma.replyEvent.deleteMany({});
  await prisma.deliveryEvent.deleteMany({});
  await prisma.trackedLink.deleteMany({});
  await prisma.trackingToken.deleteMany({});
  await prisma.messageRecipient.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.recipient.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.user.deleteMany({});

  // 1. Create Primary User
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

  // 2. Create Connected Email Account with encrypted credentials
  const encryptedSmtp = encryptCredentials(
    JSON.stringify({
      host: 'smtp.mailtrace.io',
      port: 587,
      secure: false,
      user: 'owner@mailtrace.io',
      pass: 'super-secret-smtp-password',
    }),
    ENCRYPTION_KEY
  );

  const account = await prisma.account.create({
    data: {
      userId: user.id,
      provider: AccountProvider.SMTP,
      emailAddress: 'owner@mailtrace.io',
      displayName: 'Executive Sender',
      encryptedCredentials: encryptedSmtp,
      isDefault: true,
    },
  });

  // 3. Create Sample Recipients
  const bob = await prisma.recipient.create({
    data: {
      email: 'bob.investor@acmecapital.com',
      name: 'Bob Investor',
      company: 'Acme Capital',
    },
  });

  const carol = await prisma.recipient.create({
    data: {
      email: 'carol.security@megacorp.net',
      name: 'Carol CISO',
      company: 'MegaCorp Security',
    },
  });

  const dave = await prisma.recipient.create({
    data: {
      email: 'dave.client@gmail.com',
      name: 'Dave Client',
      company: 'Gmail Personal',
    },
  });

  // 4. Message 1: Q3 Partnership Proposal (Sent to Bob - Has pixel open + link click)
  const openTokenBob = 'tok_open_bob_981273918237192837192837';
  const linkTokenBobProposal = 'tok_link_proposal_817263819283719283';
  const linkTokenBobCalendar = 'tok_link_cal_71625349182736451928';

  const msg1 = await prisma.message.create({
    data: {
      userId: user.id,
      accountId: account.id,
      subject: 'Q3 Enterprise Partnership & Licensing Proposal',
      status: MessageStatus.DELIVERED,
      sentAt: new Date(Date.now() - 3600 * 1000 * 4), // 4 hours ago
      deliveredAt: new Date(Date.now() - 3600 * 1000 * 4 + 1500),
      firstActivityAt: new Date(Date.now() - 3600 * 1000 * 3),
      lastActivityAt: new Date(Date.now() - 3600 * 1000 * 1),
    },
  });

  const mrBob = await prisma.messageRecipient.create({
    data: {
      messageId: msg1.id,
      recipientId: bob.id,
      openTrackingToken: openTokenBob,
      openResourceCount: 2,
      probableOpenCount: 1,
      confirmedViewCount: 0,
      totalClicks: 2,
      uniqueClicks: 1,
      deliveryStatus: MessageStatus.DELIVERED,
    },
  });

  await prisma.trackingToken.create({
    data: {
      token: openTokenBob,
      type: TokenType.OPEN_TRACKING,
      messageId: msg1.id,
      recipientId: bob.id,
      expiresAt: new Date(Date.now() + 90 * 86400 * 1000),
    },
  });

  const trackedLinkProposal = await prisma.trackedLink.create({
    data: {
      messageId: msg1.id,
      token: linkTokenBobProposal,
      originalUrl: 'https://docs.mailtrace.io/proposals/q3-acme-proposal.pdf',
      clickCount: 2,
      uniqueClicks: 1,
    },
  });

  await prisma.trackedLink.create({
    data: {
      messageId: msg1.id,
      token: linkTokenBobCalendar,
      originalUrl: 'https://cal.com/mailtrace/30min',
      clickCount: 0,
      uniqueClicks: 0,
    },
  });

  // Telemetry events for Msg 1:
  // Event 1a: Remote pixel fetch by desktop client
  await prisma.trackingEvent.create({
    data: {
      messageId: msg1.id,
      messageRecipientId: mrBob.id,
      type: TrackingEventType.TRACKING_RESOURCE_REQUESTED,
      confidence: ConfidenceLevel.MEDIUM,
      classification: Classification.POSSIBLE_HUMAN,
      timestamp: new Date(Date.now() - 3600 * 1000 * 3),
      source: 'remote_pixel',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      isProxy: false,
      metadata: {
        timeToFirstRequestSec: 3600,
        anonymizedIp: '198.51.100.0/24',
      },
    },
  });

  // Event 1b: Link Click on Proposal PDF (Probable human open)
  const clickEvt1 = await prisma.trackingEvent.create({
    data: {
      messageId: msg1.id,
      messageRecipientId: mrBob.id,
      type: TrackingEventType.LINK_CLICKED,
      confidence: ConfidenceLevel.HIGH,
      classification: Classification.PROBABLE_HUMAN,
      timestamp: new Date(Date.now() - 3600 * 1000 * 2),
      source: 'link_redirect',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      isProxy: false,
      metadata: {
        destinationUrl: trackedLinkProposal.originalUrl,
        anonymizedIp: '198.51.100.0/24',
      },
    },
  });

  await prisma.clickEvent.create({
    data: {
      trackingEventId: clickEvt1.id,
      trackedLinkId: trackedLinkProposal.id,
      isUnique: true,
      timestamp: new Date(Date.now() - 3600 * 1000 * 2),
    },
  });

  // 5. Message 2: Security Assessment (Sent to Carol - Scanned immediately by Corporate Gateway)
  const openTokenCarol = 'tok_open_carol_12893719283719283719283';
  const msg2 = await prisma.message.create({
    data: {
      userId: user.id,
      accountId: account.id,
      subject: 'Security Architecture & Penetration Test Report',
      status: MessageStatus.DELIVERED,
      sentAt: new Date(Date.now() - 3600 * 1000 * 10),
      deliveredAt: new Date(Date.now() - 3600 * 1000 * 10 + 800),
      firstActivityAt: new Date(Date.now() - 3600 * 1000 * 10 + 1200),
    },
  });

  const mrCarol = await prisma.messageRecipient.create({
    data: {
      messageId: msg2.id,
      recipientId: carol.id,
      openTrackingToken: openTokenCarol,
      openResourceCount: 1,
      probableOpenCount: 0,
      confirmedViewCount: 0,
      totalClicks: 0,
      uniqueClicks: 0,
      deliveryStatus: MessageStatus.DELIVERED,
    },
  });

  // Telemetry: Pre-fetch within 1.2s by automated scanner
  await prisma.trackingEvent.create({
    data: {
      messageId: msg2.id,
      messageRecipientId: mrCarol.id,
      type: TrackingEventType.TRACKING_RESOURCE_REQUESTED,
      confidence: ConfidenceLevel.LOW,
      classification: Classification.LIKELY_AUTOMATED,
      timestamp: new Date(Date.now() - 3600 * 1000 * 10 + 1200),
      source: 'security_filter',
      userAgent: 'Proofpoint-URL-Scanner/2.4 (compatible; proofpoint-corp)',
      isProxy: true,
      proxyType: 'SECURITY_GATEWAY',
      metadata: {
        timeToFirstRequestSec: 1.2,
        anonymizedIp: '192.0.2.0/24',
        scannerNote: 'Immediate prefetch detected under 2 seconds post-send',
      },
    },
  });

  // 6. Message 3: Gmail Webmail (Sent to Dave - Proxied by Google Image Proxy)
  const openTokenDave = 'tok_open_dave_81273918237192837192837';
  const msg3 = await prisma.message.create({
    data: {
      userId: user.id,
      accountId: account.id,
      subject: 'Weekly Product Roadmap Update',
      status: MessageStatus.DELIVERED,
      sentAt: new Date(Date.now() - 3600 * 1000 * 24),
      deliveredAt: new Date(Date.now() - 3600 * 1000 * 24 + 500),
      firstActivityAt: new Date(Date.now() - 3600 * 1000 * 23),
    },
  });

  const mrDave = await prisma.messageRecipient.create({
    data: {
      messageId: msg3.id,
      recipientId: dave.id,
      openTrackingToken: openTokenDave,
      openResourceCount: 1,
      probableOpenCount: 0,
      confirmedViewCount: 0,
      totalClicks: 0,
      uniqueClicks: 0,
      deliveryStatus: MessageStatus.DELIVERED,
    },
  });

  await prisma.trackingEvent.create({
    data: {
      messageId: msg3.id,
      messageRecipientId: mrDave.id,
      type: TrackingEventType.TRACKING_RESOURCE_REQUESTED,
      confidence: ConfidenceLevel.LOW,
      classification: Classification.LIKELY_AUTOMATED,
      timestamp: new Date(Date.now() - 3600 * 1000 * 23),
      source: 'google_image_proxy',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 GoogleImageProxy',
      isProxy: true,
      proxyType: 'GOOGLE_IMAGE_PROXY',
      metadata: {
        viaHeader: '1.1 google',
        anonymizedIp: '66.249.80.0/24',
        proxyNote: 'Cached by Google Image Proxy. Cannot prove recipient viewed email.',
      },
    },
  });

  console.log('[Seed] Database seeded successfully:');
  console.log(`- 1 Primary User (owner@mailtrace.io)`);
  console.log(`- 1 Connected Account with AES-256-GCM encrypted credentials`);
  console.log(`- 3 Recipients (Bob, Carol, Dave)`);
  console.log(`- 3 Messages with classified telemetry (Human Open, Scanner Prefetch, Proxy Cached)`);
  console.log(`- 2 Tracked Links with cryptographic tokens`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
