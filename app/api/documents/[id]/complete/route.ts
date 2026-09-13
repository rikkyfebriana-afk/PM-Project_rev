import { NextResponse } from 'next/server';

import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { accessibleProjectWhere } from '@/lib/projects/access';
import { getSupabaseAdmin } from '@/lib/storage/supabase-admin';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (isLocalDemoMode()) {
    return NextResponse.json(
      { error: 'Upload dinonaktifkan pada mode demo lokal.' },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const document = await prisma.document.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(user.role === 'ADMIN' ? {} : { uploadedById: user.id }),
      project: {
        is: accessibleProjectWhere(user),
      },
    },
    select: {
      id: true,
      projectId: true,
      status: true,
      bucket: true,
      objectKey: true,
      mimeType: true,
      sizeBytes: true,
    },
  });

  if (!document)
    return NextResponse.json(
      { error: 'Dokumen tidak ditemukan.' },
      { status: 404 },
    );
  if (document.status === 'READY')
    return NextResponse.json({
      document: { id: document.id, status: document.status },
    });
  if (document.status === 'FAILED')
    return NextResponse.json(
      { error: 'Upload sudah dinyatakan gagal.' },
      { status: 409 },
    );

  const supabase = getSupabaseAdmin();
  const { data: fileInfo, error: fileInfoError } = await supabase.storage
    .from(document.bucket)
    .info(document.objectKey);
  const storedSize =
    fileInfo?.size === undefined ? null : BigInt(fileInfo.size);
  const matchesIntent =
    !fileInfoError &&
    fileInfo &&
    storedSize === document.sizeBytes &&
    fileInfo.contentType === document.mimeType;

  if (!matchesIntent) {
    if (fileInfo)
      await supabase.storage.from(document.bucket).remove([document.objectKey]);
    await prisma.$transaction([
      prisma.document.update({
        where: { id: document.id },
        data: { status: 'FAILED' },
      }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          projectId: document.projectId,
          action: 'DOCUMENT_UPLOAD_REJECTED',
          entityType: 'Document',
          entityId: document.id,
        },
      }),
    ]);
    return NextResponse.json(
      { error: 'File tersimpan tidak cocok dengan izin upload.' },
      { status: 409 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.document.updateMany({
      where: { id: document.id, status: 'PENDING' },
      data: { status: 'READY' },
    });
    if (updated.count !== 1)
      throw new Error('Upload intent is no longer pending.');

    await tx.auditLog.create({
      data: {
        userId: user.id,
        projectId: document.projectId,
        action: 'DOCUMENT_UPLOAD_COMPLETED',
        entityType: 'Document',
        entityId: document.id,
      },
    });
    return { id: document.id, status: 'READY' as const };
  });

  return NextResponse.json({ document: result });
}
