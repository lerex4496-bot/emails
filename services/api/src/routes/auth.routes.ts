import { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { loginSchema, registerSchema } from '@mailtrace/shared';
import { getPrismaClient } from '@mailtrace/database';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = getPrismaClient();

  fastify.post('/api/v1/auth/register', async (request, reply) => {
    const parseResult = registerSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        issues: parseResult.error.format(),
      });
    }

    const { email, password, displayName } = parseResult.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return reply.status(409).send({ error: 'User already exists with this email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName: displayName || email.split('@')[0],
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        privacySettings: true,
        createdAt: true,
      },
    });

    const token = fastify.jwt.sign({ userId: user.id, email: user.email });
    return reply.status(201).send({ user, token });
  });

  fastify.post('/api/v1/auth/login', async (request, reply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        issues: parseResult.error.format(),
      });
    }

    const { email, password } = parseResult.data;
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return reply.status(401).send({ error: 'Invalid email or password' });
    }

    const token = fastify.jwt.sign({ userId: user.id, email: user.email });
    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        privacySettings: user.privacySettings,
        createdAt: user.createdAt,
      },
      token,
    });
  });

  fastify.get('/api/v1/auth/me', async (request, reply) => {
    try {
      await request.jwtVerify();
      const decoded = request.user as { userId: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          displayName: true,
          privacySettings: true,
          createdAt: true,
          accounts: {
            select: {
              id: true,
              provider: true,
              emailAddress: true,
              displayName: true,
              isDefault: true,
            },
          },
        },
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send({ user });
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });
};
