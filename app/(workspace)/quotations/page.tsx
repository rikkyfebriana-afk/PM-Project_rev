import { requireUser } from '@/lib/auth/require-user';
import { isLocalDemoMode } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { QuotationWorkspace } from '@/components/modules/quotation-workspace';

export const metadata = { title: 'Quotation / SPH' };
export default async function QuotationPage() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') return <p className="p-8">Quotation / SPH hanya dapat diakses Administrator.</p>;
  if (isLocalDemoMode()) return <p className="p-8">Quotation / SPH memerlukan koneksi database. Mode demo hanya baca.</p>;
  const [quotes, projects] = await Promise.all([
    prisma.quotation.findMany({ orderBy: { createdAt: 'desc' }, include: { projects: { select: { id: true, code: true, customerPoNumber: true, customerPoStatus: true, poValue: true, deletedAt: true } } } }),
    prisma.project.findMany({ where: { deletedAt: null, quotationId: null, customerPoNumber: { not: null }, customerPoStatus: { in: ['RECEIVED', 'IN_PROGRESS', 'COMPLETED'] } }, select: { id: true, code: true, clientName: true, customerPoNumber: true }, orderBy: { code: 'asc' } }),
  ]);
  const date = (d: Date | null) => d?.toISOString().slice(0, 10) ?? '';
  return <QuotationWorkspace projects={projects} quotes={quotes.map(q => ({
    id: q.id, number: q.number, clientName: q.clientName, title: q.title, value: q.value.toString(),
    issuedDate: date(q.issuedDate), sentDate: date(q.sentDate), validUntil: date(q.validUntil), followUpDate: date(q.followUpDate),
    status: q.status, pic: q.pic, notes: q.notes, version: q.version,
    projects: q.projects.map(p => ({ ...p, poValue: p.poValue.toString(), deletedAt: p.deletedAt?.toISOString() ?? null })),
  }))} />;
}
