import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import type { CurrentUser } from '@/lib/auth/session';
import { editableProjectWhere } from '@/lib/projects/access';

export async function lockEditableProject(
  tx: Prisma.TransactionClient,
  projectId: string,
  user: CurrentUser,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${projectId}, 0))`;
  await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} AND "deletedAt" IS NULL FOR UPDATE`;
  const project = await tx.project.findFirst({
    where: { id: projectId, ...editableProjectWhere(user) },
  });
  if (!project)
    throw new Error('Project tidak ditemukan atau akses edit ditolak.');
  return project;
}
