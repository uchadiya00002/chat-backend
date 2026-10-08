import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prima';
import { authenticate } from '../middleware/authenticate';

const router = Router();
router.use(authenticate);

const createWorkspaceSchema = z.object({
  name: z.string().min(1),
});

const createChannelSchema = z.object({
  name: z.string().min(1),
  isPrivate: z.boolean().optional(),
});

router.post('/', async (req, res) => {
  const parsed = createWorkspaceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: 'Invalid input', details: parsed.error.flatten().fieldErrors } });
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: parsed.data.name,
      members: { create: { userId: req.user!.id, role: 'OWNER' } },
    },
  });

  res.status(201).json(workspace);
});

router.get('/', async (req, res) => {
  const workspaces = await prisma.workspace.findMany({
    where: { members: { some: { userId: req.user!.id } } },
    orderBy: { createdAt: 'asc' },
  });

  res.status(200).json(workspaces);
});

router.post('/:workspaceId/channels', async (req, res) => {
  const parsed = createChannelSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { message: 'Invalid input', details: parsed.error.flatten().fieldErrors } });
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: req.user!.id, workspaceId: req.params.workspaceId } },
  });
  if (!membership) {
    return res.status(403).json({ error: { message: 'Not a member of this workspace' } });
  }

  try {
    const channel = await prisma.channel.create({
      data: {
        name: parsed.data.name,
        isPrivate: parsed.data.isPrivate ?? false,
        workspaceId: req.params.workspaceId,
      },
    });
    res.status(201).json(channel);
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      return res.status(409).json({ error: { message: 'A channel with this name already exists in this workspace' } });
    }
    throw err;
  }
});

router.get('/:workspaceId/channels', async (req, res) => {
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: req.user!.id, workspaceId: req.params.workspaceId } },
  });
  if (!membership) {
    return res.status(403).json({ error: { message: 'Not a member of this workspace' } });
  }

  const channels = await prisma.channel.findMany({
    where: { workspaceId: req.params.workspaceId },
    orderBy: { createdAt: 'asc' },
  });

  res.status(200).json(channels);
});

export default router;
