import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import type { z } from 'zod';
import { membershipSchema, MembershipInputError } from './membership';
import { hasFullAccess } from '@/lib/auth/roles';

// The caller enforces full access before entering this transaction.
export async function applyMembershipBatch(
  tx: Prisma.TransactionClient,
  input: z.infer<typeof membershipSchema>,
  actorId: string,
) {
  const {projectIds,userId,operation}=input;
  const initial=await tx.user.findUnique({where:{id:userId},select:{role:true,isActive:true}});
  if(!initial?.isActive) throw new MembershipInputError('Pengguna tidak ditemukan atau sudah tidak aktif. Muat ulang dan pilih pengguna aktif.');
  if(hasFullAccess(initial.role)) return initial.role==='ADMIN'?'ADMIN_UNCHANGED' as const:'PROJECT_MANAGER_UNCHANGED' as const;

  // Match single-project mutations: advisory locks, project row locks, then user.
  // Batch round trips stay constant even when hundreds of projects are selected.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(requested.id,0))
    FROM unnest(${projectIds}::text[]) AS requested(id) ORDER BY requested.id COLLATE "C"`;
  const projects=await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "Project"
    WHERE "id"=ANY(${projectIds}::text[]) AND "deletedAt" IS NULL
    ORDER BY "id" COLLATE "C" FOR UPDATE`;
  if(projects.length!==projectIds.length) throw new MembershipInputError('Ada proyek yang sudah diarsipkan atau tidak ditemukan. Muat ulang daftar proyek; belum ada perubahan disimpan.');
  const targets=await tx.$queryRaw<{role:string;isActive:boolean}[]>`SELECT "role","isActive" FROM "User" WHERE "id"=${userId} FOR UPDATE`;
  const target=targets[0];
  if(!target?.isActive) throw new MembershipInputError('Pengguna tidak ditemukan atau sudah tidak aktif. Muat ulang dan pilih pengguna aktif.');
  if(hasFullAccess(target.role)) return target.role==='ADMIN'?'ADMIN_UNCHANGED' as const:'PROJECT_MANAGER_UNCHANGED' as const;
  if(operation==='add') {
    await tx.projectMember.createMany({data:projectIds.map(projectId=>({projectId,userId})),skipDuplicates:true});
  } else {
    await tx.projectMember.deleteMany({where:{userId,projectId:{in:projectIds}}});
  }
  await tx.auditLog.createMany({data:projectIds.map(projectId=>({
    userId:actorId,projectId,action:operation==='add'?'MEMBER_ADDED':'MEMBER_REMOVED',
    entityType:'ProjectMember',metadata:{memberUserId:userId,selectedProjectCount:projectIds.length},
  }))});
  return 'UPDATED' as const;
}
