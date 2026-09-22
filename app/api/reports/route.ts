import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { getReport, reportSchema } from '@/lib/reports/queries';
import { renderPdf, renderExcel } from '@/lib/reports/render';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = reportSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Filter laporan tidak valid.' },
      { status: 400 },
    );
  try {
    const report = await getReport(user, parsed.data);
    const bytes =
      parsed.data.format === 'pdf'
        ? await renderPdf(report)
        : await renderExcel(report);
    return new Response(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
      {
        headers: {
          'Content-Type':
            parsed.data.format === 'pdf'
              ? 'application/pdf'
              : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${parsed.data.type}-${new Date().toISOString().slice(0, 10)}.${parsed.data.format}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && !('code' in error)
            ? error.message
            : 'Laporan belum dapat dibuat.',
      },
      { status: 400 },
    );
  }
}
