import { NextResponse } from 'next/server';

import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { accessibleProjectWhere } from '@/lib/projects/access';
import { getSupabaseAdmin } from '@/lib/storage/supabase-admin';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (isLocalDemoMode())
    return NextResponse.json(
      { error: 'Download dinonaktifkan pada mode demo lokal.' },
      { status: 503 },
    );

  const { id } = await context.params;
  const document = await prisma.document.findFirst({
    where: {
      id,
      deletedAt: null,
      status: 'READY',
      project: {
        is: accessibleProjectWhere(user),
      },
    },
    select: { bucket: true, objectKey: true, originalName: true },
  });

  if (!document)
    return NextResponse.json(
      { error: 'Dokumen tidak ditemukan.' },
      { status: 404 },
    );

  const { data, error } = await getSupabaseAdmin()
    .storage.from(document.bucket)
    .createSignedUrl(document.objectKey, 60, {
      download: document.originalName,
    });

  if (error || !data.signedUrl)
    return NextResponse.json(
      { error: 'Tautan unduhan gagal dibuat.' },
      { status: 502 },
    );
  return NextResponse.redirect(data.signedUrl, { status: 303 });
}
