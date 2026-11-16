import 'server-only';

import { randomUUID } from 'node:crypto';

import { hasFullAccess } from '@/lib/auth/roles';
import { isLocalDemoMode, type CurrentUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { moneyCents } from '@/lib/quotations/model';
import {
  invoiceAmounts,
  invoiceDecimal,
  summarizeInvoiceAmounts,
} from './summary';
import { invoiceToday } from './validation';

type InvoiceSummaryRow = {
  amount: string;
  paid: string;
  dueDate: string;
  sent: boolean;
  voided: boolean;
};

function calendarDate(value: Date | null) {
  return value?.toISOString().slice(0, 10) ?? '';
}

export async function getInvoiceSummary(user: CurrentUser, today: string) {
  if (!hasFullAccess(user.role)) return null;

  // Aggregate payments in the same database statement as the invoice read so
  // the dashboard sees one snapshot and does not load payment history.
  const rows = await prisma.$queryRaw<InvoiceSummaryRow[]>`
    SELECT i."amount"::text AS amount,
           COALESCE(SUM(p."amount"), 0)::text AS paid,
           to_char(i."dueDate", 'YYYY-MM-DD') AS "dueDate",
           i."sentDate" IS NOT NULL AS sent,
           i."voidedAt" IS NOT NULL AS voided
    FROM "Invoice" AS i
    LEFT JOIN "InvoicePayment" AS p
      ON p."invoiceId" = i."id" AND p."voidedAt" IS NULL
    GROUP BY i."id"
  `;
  return summarizeInvoiceAmounts(
    rows.map((row) =>
      invoiceAmounts(
        {
          ...row,
          amount: moneyCents(row.amount),
          paid: moneyCents(row.paid),
        },
        today,
      ),
    ),
  );
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

  const calculated: ReturnType<typeof invoiceAmounts>[] = [];
  const invoices = invoiceRows.map((invoice) => {
    const paid = invoice.payments.reduce(
      (sum, payment) =>
        payment.voidedAt ? sum : sum + moneyCents(payment.amount.toFixed(2)),
      0n,
    );
    const dueDate = calendarDate(invoice.dueDate);
    const financials = invoiceAmounts(
      {
        amount: moneyCents(invoice.amount.toFixed(2)),
        paid,
        sent: !!invoice.sentDate,
        voided: !!invoice.voidedAt,
        dueDate,
      },
      today,
    );
    calculated.push(financials);

    return {
      id: invoice.id,
      projectId: invoice.projectId,
      number: invoice.number,
      description: invoice.description,
      issueDate: calendarDate(invoice.issueDate),
      dueDate,
      sentDate: calendarDate(invoice.sentDate),
      amount: invoiceDecimal(financials.amount),
      notes: invoice.notes,
      paidAmount: invoiceDecimal(financials.paid),
      balance: invoiceDecimal(financials.balance),
      status: financials.status,
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
    totals: summarizeInvoiceAmounts(calculated).totals,
  };
}

export type InvoiceData = Awaited<ReturnType<typeof getInvoiceData>>;
