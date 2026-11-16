import { InvoiceWorkspace } from '@/components/modules/invoice-workspace';
import { requireUser } from '@/lib/auth/require-user';
import { hasFullAccess } from '@/lib/auth/roles';
import { getInvoiceData } from '@/lib/invoices/queries';
import { isInvoiceStatus } from '@/lib/invoices/summary';

export const metadata = { title: 'Status Invoice' };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const user = await requireUser();
  if (!hasFullAccess(user.role)) {
    return (
      <p className="p-8">
        Status Invoice hanya dapat diakses Admin atau Project Manager.
      </p>
    );
  }
  const { status } = await searchParams;
  const initialStatus = isInvoiceStatus(status) ? status : undefined;
  return (
    <InvoiceWorkspace
      key={initialStatus ?? 'all'}
      data={await getInvoiceData(user)}
      initialStatus={initialStatus}
    />
  );
}
