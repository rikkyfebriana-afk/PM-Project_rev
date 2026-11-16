import { InvoiceWorkspace } from '@/components/modules/invoice-workspace';
import { requireUser } from '@/lib/auth/require-user';
import { hasFullAccess } from '@/lib/auth/roles';
import { getInvoiceData } from '@/lib/invoices/queries';

export const metadata = { title: 'Status Invoice' };

export default async function InvoicesPage() {
  const user = await requireUser();
  if (!hasFullAccess(user.role)) {
    return (
      <p className="p-8">
        Status Invoice hanya dapat diakses Admin atau Project Manager.
      </p>
    );
  }
  return <InvoiceWorkspace data={await getInvoiceData(user)} />;
}
