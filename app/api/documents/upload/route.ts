import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { DocumentCategory } from '@/generated/prisma/enums';
import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdmin } from '@/lib/storage/supabase-admin';

export const runtime = 'nodejs';

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]);

const uploadSchema = z.object({
  projectId: z.string().min(1).max(100),
  category: z.enum(
    Object.values(DocumentCategory) as [
      DocumentCategory,
      ...DocumentCategory[],
    ],
  ),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(150),
  sizeBytes: z.number().int().positive(),
});

function maxUploadBytes() {
  const configured = Number.parseInt(process.env.MAX_UPLOAD_BYTES ?? '', 10);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 100 * 1024 * 1024)
    : 25 * 1024 * 1024;
}

function safeFileName(name: string) {
  const normalized = name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-');
  return normalized.slice(-140) || 'document';
}

async function canAccessProject(
  userId: string,
  role: string,
  projectId: string,
) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      ...(role === 'ADMIN'
        ? {}
        : role === 'PROJECT_MANAGER'
          ? {
              OR: [
                { projectManagerId: userId },
                { members: { some: { userId } } },
              ],
            }
          : { members: { some: { userId } } }),
    },
    select: { id: true },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (isLocalDemoMode()) {
    return NextResponse.json(
      { error: 'Upload dinonaktifkan pada mode demo lokal.' },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = uploadSchema.safeParse(body);
  if (
    !parsed.success ||
    !allowedMimeTypes.has(parsed.data.mimeType) ||
    parsed.data.sizeBytes > maxUploadBytes()
  ) {
    return NextResponse.json(
      { error: 'Metadata, tipe, atau ukuran file tidak diizinkan.' },
      { status: 400 },
    );
  }

  const { projectId, category, fileName, mimeType, sizeBytes } = parsed.data;
  const project = await canAccessProject(user.id, user.role, projectId);
  if (!project)
    return NextResponse.json(
      { error: 'Project tidak ditemukan atau akses ditolak.' },
      { status: 404 },
    );

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'project-documents';
  const objectKey = `${projectId}/${category.toLowerCase()}/${new Date().toISOString().slice(0, 10)}-${randomUUID()}-${safeFileName(fileName)}`;
  const supabase = getSupabaseAdmin();
  const { data: signedUpload, error: signedUploadError } =
    await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(objectKey, { upsert: false });

  if (signedUploadError || !signedUpload) {
    return NextResponse.json(
      { error: 'URL upload aman gagal dibuat.' },
      { status: 502 },
    );
  }

  try {
    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          projectId,
          uploadedById: user.id,
          category,
          originalName: fileName,
          bucket,
          objectKey,
          mimeType,
          sizeBytes: BigInt(sizeBytes),
        },
        select: {
          id: true,
          originalName: true,
          category: true,
          status: true,
          createdAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId,
          action: 'DOCUMENT_UPLOAD_STARTED',
          entityType: 'Document',
          entityId: created.id,
          metadata: { originalName: fileName, category, sizeBytes },
        },
      });
      return created;
    });

    return NextResponse.json(
      {
        document,
        upload: {
          bucket,
          path: signedUpload.path,
          token: signedUpload.token,
          signedUrl: signedUpload.signedUrl,
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: 'Metadata upload gagal disiapkan.' },
      { status: 500 },
    );
  }
}
