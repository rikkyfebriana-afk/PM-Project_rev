export const invoiceStatusLabels = {
  DRAFT: 'Draf',
  SENT: 'Terkirim',
  PARTIAL: 'Dibayar sebagian',
  PAID: 'Lunas',
  OVERDUE: 'Lewat jatuh tempo',
  VOID: 'Dibatalkan',
} as const;

export type InvoiceStatus = keyof typeof invoiceStatusLabels;

export function isInvoiceStatus(status: unknown): status is InvoiceStatus {
  return (
    typeof status === 'string' && Object.hasOwn(invoiceStatusLabels, status)
  );
}

export function invoiceDecimal(cents: bigint) {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

type InvoiceAmounts = {
  amount: bigint;
  paid: bigint;
  balance: bigint;
  status: InvoiceStatus;
};

export function invoiceAmounts(
  invoice: {
    amount: bigint;
    paid: bigint;
    dueDate: string;
    sent: boolean;
    voided: boolean;
  },
  today: string,
): InvoiceAmounts {
  const { amount, paid } = invoice;
  const balance = invoice.voided ? 0n : amount - paid;
  let status: InvoiceStatus;
  if (invoice.voided) status = 'VOID';
  else if (!invoice.sent) status = 'DRAFT';
  else if (balance === 0n) status = 'PAID';
  else if (invoice.dueDate < today) status = 'OVERDUE';
  else status = paid > 0n ? 'PARTIAL' : 'SENT';
  return { amount, paid, balance, status };
}

export function summarizeInvoiceAmounts(invoices: InvoiceAmounts[]) {
  const counts: Record<InvoiceStatus, number> = {
    DRAFT: 0,
    SENT: 0,
    PARTIAL: 0,
    PAID: 0,
    OVERDUE: 0,
    VOID: 0,
  };
  let billed = 0n;
  let paid = 0n;
  let balance = 0n;
  let overdue = 0n;
  for (const invoice of invoices) {
    counts[invoice.status]++;
    if (invoice.status === 'DRAFT' || invoice.status === 'VOID') continue;
    billed += invoice.amount;
    paid += invoice.paid;
    balance += invoice.balance;
    if (invoice.status === 'OVERDUE') overdue += invoice.balance;
  }
  return {
    counts,
    totals: {
      billed: invoiceDecimal(billed),
      paid: invoiceDecimal(paid),
      balance: invoiceDecimal(balance),
      overdue: invoiceDecimal(overdue),
    },
  };
}
