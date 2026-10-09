import 'dotenv/config';
import { PrismaClient, WorkspaceRole } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });

const prisma = new PrismaClient({ adapter });

async function main() {
  const users = [
    {
      id: 'user_alice',
      email: 'alice@pulse.dev',
      passwordHash: '$2a$10$L9iK8p2b4uYxv0mQJv6t9u6vQ9sJ7g5jv6Q4f6f3j0Y6w0t4E7rS.',
      name: 'Alice Johnson',
    },
    {
      id: 'user_bob',
      email: 'bob@pulse.dev',
      passwordHash: '$2a$10$L9iK8p2b4uYxv0mQJv6t9u6vQ9sJ7g5jv6Q4f6f3j0Y6w0t4E7rS.',
      name: 'Bob Smith',
    },
    {
      id: 'user_charlie',
      email: 'charlie@pulse.dev',
      passwordHash: '$2a$10$L9iK8p2b4uYxv0mQJv6t9u6vQ9sJ7g5jv6Q4f6f3j0Y6w0t4E7rS.',
      name: 'Charlie Brown',
    },
    {
      id: 'user_diana',
      email: 'diana@pulse.dev',
      passwordHash: '$2a$10$L9iK8p2b4uYxv0mQJv6t9u6vQ9sJ7g5jv6Q4f6f3j0Y6w0t4E7rS.',
      name: 'Diana Ross',
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: user,
      create: user,
    });
  }

  const workspaces = [
    { id: 'ws_product', name: 'Product Team' },
    { id: 'ws_engineering', name: 'Engineering HQ' },
  ];

  for (const workspace of workspaces) {
    await prisma.workspace.upsert({
      where: { id: workspace.id },
      update: workspace,
      create: workspace,
    });
  }

  const memberships = [
    { id: 'wm_alice_product', userId: 'user_alice', workspaceId: 'ws_product', role: WorkspaceRole.OWNER },
    { id: 'wm_bob_product', userId: 'user_bob', workspaceId: 'ws_product', role: WorkspaceRole.ADMIN },
    { id: 'wm_charlie_product', userId: 'user_charlie', workspaceId: 'ws_product', role: WorkspaceRole.MEMBER },
    { id: 'wm_alice_engineering', userId: 'user_alice', workspaceId: 'ws_engineering', role: WorkspaceRole.OWNER },
    { id: 'wm_diana_engineering', userId: 'user_diana', workspaceId: 'ws_engineering', role: WorkspaceRole.ADMIN },
    { id: 'wm_bob_engineering', userId: 'user_bob', workspaceId: 'ws_engineering', role: WorkspaceRole.MEMBER },
  ];

  for (const membership of memberships) {
    await prisma.workspaceMember.upsert({
      where: {
        userId_workspaceId: {
          userId: membership.userId,
          workspaceId: membership.workspaceId,
        },
      },
      update: {
        role: membership.role,
      },
      create: membership,
    });
  }

  const channels = [
    { id: 'ch_general_product', name: 'general', isPrivate: false, workspaceId: 'ws_product' },
    { id: 'ch_design_product', name: 'design', isPrivate: false, workspaceId: 'ws_product' },
    { id: 'ch_backend_engineering', name: 'backend', isPrivate: false, workspaceId: 'ws_engineering' },
    { id: 'ch_release_engineering', name: 'release', isPrivate: true, workspaceId: 'ws_engineering' },
  ];

  for (const channel of channels) {
    await prisma.channel.upsert({
      where: {
        workspaceId_name: {
          workspaceId: channel.workspaceId,
          name: channel.name,
        },
      },
      update: channel,
      create: channel,
    });
  }

  const messages = [
    {
      id: 'msg_1',
      body: 'Welcome to the Product Team workspace!',
      channelId: 'ch_general_product',
      authorId: 'user_alice',
    },
    {
      id: 'msg_2',
      body: 'I uploaded the latest design draft for review.',
      channelId: 'ch_design_product',
      authorId: 'user_bob',
    },
    {
      id: 'msg_3',
      body: 'The backend API is ready for QA testing.',
      channelId: 'ch_backend_engineering',
      authorId: 'user_diana',
    },
    {
      id: 'msg_4',
      body: 'Please confirm the release checklist before deploy.',
      channelId: 'ch_release_engineering',
      authorId: 'user_alice',
    },
    {
      id: 'msg_5',
      body: 'Let’s keep the release notes updated for the sprint review.',
      channelId: 'ch_general_product',
      authorId: 'user_charlie',
    },
    {
      id: 'msg_6',
      body: 'I fixed the auth edge case in the login flow.',
      channelId: 'ch_backend_engineering',
      authorId: 'user_bob',
    },
  ];

  for (const message of messages) {
    await prisma.message.upsert({
      where: { id: message.id },
      update: {
        body: message.body,
        channelId: message.channelId,
        authorId: message.authorId,
      },
      create: message,
    });
  }

  console.log('Seed data inserted successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
