import 'server-only';

import { randomUUID } from 'node:crypto';

import { hasFullAccess } from '@/lib/auth/roles';
import { isLocalDemoMode, type CurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { moneyCents } from '@/lib/quotations/model';
import { invoiceToday } from './validation';

function decimalString(cents: bigint) {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

function calendarDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? '';
}

function billingStatus(
  invoice: { voidedAt: Date | null; sentDate: Date | null; dueDate: Date },
  paid: bigint,
  balance: bigint,
  today: string,
) {
  if (invoice.voidedAt) return 'VOID';
  if (!invoice.sentDate) return 'DRAFT';
  if (balance === 0n) return 'PAID';
  if (calendarDate(invoice.dueDate) < today) return 'OVERDUE';
  return paid > 0n ? 'PARTIAL' : 'SENT';
}

const projectSelect = {
  id: true,
  code: true,
  name: true,
  clientName: true,
  customerPoNumber: true,
} as const;

function projectLabels(project: {
  id: string;
  code: string;
  name: string;
  clientName: string | null;
  customerPoNumber: string | null;
}) {
  return {
    ...project,
    clientName: project.clientName ?? '',
    customerPoNumber: project.customerPoNumber ?? '',
  };
}

export async function getInvoiceData(user: CurrentUser) {
  if (!hasFullAccess(user.role)) throw new Error('Akses invoice dibatasi.');

  const today = invoiceToday();
  const demoMode = isLocalDemoMode();
  const [projectRows, invoiceRows] = demoMode
    ? ([[], []] as const)
    : await prisma.$transaction(
        [
          prisma.project.findMany({
            where: { deletedAt: null, customerPoNumber: { not: null } },
            select: projectSelect,
            orderBy: { code: 'asc' },
          }),
          prisma.invoice.findMany({
            orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
            include: {
              project: { select: projectSelect },
              payments: {
                orderBy: [{ paidDate: 'desc' }, { createdAt: 'desc' }],
                include: { actor: { select: { displayName: true } } },
              },
            },
          }),
        ],
        { isolationLevel: 'RepeatableRead' },
      );

  let billedTotal = 0n;
  let paidTotal = 0n;
  let balanceTotal = 0n;
  let overdueTotal = 0n;
  const invoices = invoiceRows.map((invoice) => {
    const amount = moneyCents(invoice.amount.toFixed(2));
    const paid = invoice.payments.reduce(
      (sum, payment) =>
        payment.voidedAt ? sum : sum + moneyCents(payment.amount.toFixed(2)),
      0n,
    );
    const balance = invoice.voidedAt ? 0n : amount - paid;
    const status = billingStatus(invoice, paid, balance, today);

    if (status !== 'DRAFT' && status !== 'VOID') {
      billedTotal += amount;
      paidTotal += paid;
      balanceTotal += balance;
      if (status === 'OVERDUE') overdueTotal += balance;
    }

    return {
      id: invoice.id,
      projectId: invoice.projectId,
      number: invoice.number,
      description: invoice.description,
      issueDate: calendarDate(invoice.issueDate),
      dueDate: calendarDate(invoice.dueDate),
      sentDate: calendarDate(invoice.sentDate),
      amount: decimalString(amount),
      notes: invoice.notes,
      paidAmount: decimalString(paid),
      balance: decimalString(balance),
      status,
      updatedAt: invoice.updatedAt.toISOString(),
      voidedAt: invoice.voidedAt ? invoiceToday(invoice.voidedAt) : '',
      voidReason: invoice.voidReason,
      paymentRequestId: randomUUID(),
      project: projectLabels(invoice.project),
      payments: invoice.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount.toFixed(2),
        paidDate: calendarDate(payment.paidDate),
        reference: payment.reference,
        notes: payment.notes,
        actor: payment.actor.displayName,
        voidedAt: payment.voidedAt ? invoiceToday(payment.voidedAt) : '',
        voidReason: payment.voidReason,
      })),
    };
  });

  return {
    demoMode,
    today,
    projects: projectRows
      .filter((project) => project.customerPoNumber?.trim())
      .map(projectLabels),
    invoices,
    totals: {
      billed: decimalString(billedTotal),
      paid: decimalString(paidTotal),
      balance: decimalString(balanceTotal),
      overdue: decimalString(overdueTotal),
    },
  };
}

export type InvoiceData = Awaited<ReturnType<typeof getInvoiceData>>;
