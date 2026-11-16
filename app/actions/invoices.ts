'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@/generated/prisma/client';
import { hasFullAccess } from '@/lib/auth/roles';
import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import {
  invoicePaymentSchema,
  invoiceSchema,
  invoiceToday,
  voidInvoicePaymentSchema,
  voidInvoiceSchema,
} from '@/lib/invoices/validation';
import type { MutationState } from '@/lib/operations/validation';
import { prisma } from '@/lib/prisma';
import type { z } from 'zod';

const transactionOptions = {
  maxWait: 10_000,
  timeout: 15_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

const denied: MutationState = {
  status: 'error',
  message: 'Invoice hanya dapat dikelola Admin atau Project Manager.',
};

class InvoiceMutationError extends Error {}

const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);
const asDay = (value: Date) => value.toISOString().slice(0, 10);

function validationFailure(error: z.ZodError): MutationState {
  return {
    status: 'error',
    message: error.issues[0]?.message ?? 'Periksa kembali isian invoice.',
  };
}

function errorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : 'UNKNOWN';
}

async function runInvoiceMutation(
  operation: () => Promise<string>,
  duplicateMessage = 'Data sudah tercatat. Muat ulang halaman.',
): Promise<MutationState> {
  try {
    const message = await operation();
    revalidatePath('/invoices');
    return { status: 'success', message };
  } catch (error) {
    if (error instanceof InvoiceMutationError)
      return { status: 'error', message: error.message };
    const code = errorCode(error);
    if (code === 'P2002') return { status: 'error', message: duplicateMessage };
    console.error('Invoice mutation failed', { code });
    return {
      status: 'error',
      message:
        'Perubahan belum dapat diproses. Coba lagi dengan formulir yang sama.',
    };
  }
}

async function lockInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  // All writers acquire this lock before reading or changing invoice balances.
  await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new InvoiceMutationError('Invoice tidak ditemukan.');
  return invoice;
}

type InvoiceRow = Awaited<ReturnType<typeof lockInvoice>>;

function requireOpenInvoice(invoice: InvoiceRow) {
  if (invoice.voidedAt)
    throw new InvoiceMutationError('Invoice sudah dibatalkan.');
}

function requireCurrentVersion(invoice: InvoiceRow, version?: string) {
  if (invoice.updatedAt.toISOString() !== version)
    throw new InvoiceMutationError(
      'Invoice sudah berubah. Muat ulang halaman sebelum menyimpan.',
    );
}

function nextVersion(invoice: InvoiceRow) {
  return new Date(Math.max(Date.now(), invoice.updatedAt.getTime() + 1));
}

function invoiceSnapshot(invoice: InvoiceRow) {
  return {
    projectId: invoice.projectId,
    number: invoice.number,
    description: invoice.description,
    issueDate: asDay(invoice.issueDate),
    dueDate: asDay(invoice.dueDate),
    sentDate: invoice.sentDate ? asDay(invoice.sentDate) : '',
    amount: invoice.amount.toFixed(2),
    notes: invoice.notes,
  };
}

function activePayments(tx: Prisma.TransactionClient, invoiceId: string) {
  return tx.invoicePayment.aggregate({
    where: { invoiceId, voidedAt: null },
    _sum: { amount: true },
    _min: { paidDate: true },
  });
}

export async function saveInvoice(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || !hasFullAccess(user.role) || isLocalDemoMode()) return denied;
  const parsed = invoiceSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return validationFailure(parsed.error);
  const {
    invoiceId,
    updatedAt,
    projectId,
    issueDate,
    dueDate,
    sentDate,
    amount,
    ...details
  } = parsed.data;
  const today = invoiceToday();
  if (issueDate > today || sentDate > today)
    return {
      status: 'error',
      message:
        'Tanggal terbit dan tanggal kirim invoice tidak boleh di masa depan.',
    };

  const fields = {
    ...details,
    issueDate: asDate(issueDate),
    dueDate: asDate(dueDate),
    sentDate: sentDate ? asDate(sentDate) : null,
    amount: new Prisma.Decimal(amount),
  };

  return runInvoiceMutation(async () => {
    await prisma.$transaction(async (tx) => {
      let current: InvoiceRow | null = null;
      if (invoiceId) {
        current = await lockInvoice(tx, invoiceId);
        requireOpenInvoice(current);
        requireCurrentVersion(current, updatedAt);
        if (current.projectId !== projectId)
          throw new InvoiceMutationError(
            'Proyek untuk invoice yang sudah tercatat tidak dapat diganti.',
          );
        const payments = await activePayments(tx, current.id);
        if (fields.amount.lt(payments._sum.amount ?? 0))
          throw new InvoiceMutationError(
            'Nominal invoice tidak boleh lebih kecil dari pembayaran tercatat.',
          );
        const firstPayment = payments._min.paidDate;
        if (firstPayment && !sentDate)
          throw new InvoiceMutationError(
            'Tanggal kirim wajib diisi karena sudah ada pembayaran.',
          );
        if (firstPayment && issueDate > asDay(firstPayment))
          throw new InvoiceMutationError(
            'Tanggal terbit tidak boleh setelah tanggal pembayaran pertama.',
          );
      } else {
        const [project] = await tx.$queryRaw<
          { customerPoNumber: string | null }[]
        >`
          SELECT "customerPoNumber" FROM "Project"
          WHERE "id" = ${projectId} AND "deletedAt" IS NULL FOR UPDATE
        `;
        if (!project?.customerPoNumber?.trim())
          throw new InvoiceMutationError(
            'Pilih proyek yang belum diarsipkan dan sudah memiliki nomor PO Customer.',
          );
      }

      const invoice = current
        ? await tx.invoice.update({
            where: { id: current.id },
            data: { ...fields, updatedAt: nextVersion(current) },
          })
        : await tx.invoice.create({ data: { ...fields, projectId } });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId: invoice.projectId,
          entityType: 'Invoice',
          entityId: invoice.id,
          action: current ? 'INVOICE_UPDATED' : 'INVOICE_CREATED',
          metadata: {
            before: current ? invoiceSnapshot(current) : null,
            after: invoiceSnapshot(invoice),
          },
        },
      });
    }, transactionOptions);
    return 'Invoice tersimpan.';
  }, 'Nomor invoice sudah digunakan pada proyek ini.');
}

type PaymentInput = z.infer<typeof invoicePaymentSchema>;

async function checkPaymentReplay(
  db: Pick<Prisma.TransactionClient, 'invoicePayment'>,
  input: PaymentInput,
  actorId: string,
) {
  const previous = await db.invoicePayment.findUnique({
    where: { requestId: input.requestId },
  });
  if (!previous) return false;
  if (
    previous.actorId !== actorId ||
    previous.invoiceId !== input.invoiceId ||
    !previous.amount.eq(input.amount) ||
    asDay(previous.paidDate) !== input.paidDate ||
    previous.reference !== input.reference ||
    previous.notes !== input.notes
  )
    throw new InvoiceMutationError(
      'Referensi permintaan sudah dipakai untuk pembayaran lain. Muat ulang halaman.',
    );
  return true;
}

export async function recordInvoicePayment(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || !hasFullAccess(user.role) || isLocalDemoMode()) return denied;
  const parsed = invoicePaymentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return validationFailure(parsed.error);
  const input = parsed.data;
  if (input.paidDate > invoiceToday())
    return {
      status: 'error',
      message: 'Tanggal pembayaran tidak boleh di masa depan.',
    };

  return runInvoiceMutation(async () => {
    try {
      return await prisma.$transaction(async (tx) => {
        const invoice = await lockInvoice(tx, input.invoiceId);
        if (await checkPaymentReplay(tx, input, user.id))
          return 'Pembayaran sudah tercatat.';
        requireOpenInvoice(invoice);
        if (!invoice.sentDate)
          throw new InvoiceMutationError(
            'Isi tanggal kirim invoice sebelum mencatat pembayaran.',
          );
        if (input.paidDate < asDay(invoice.issueDate))
          throw new InvoiceMutationError(
            'Tanggal pembayaran tidak boleh sebelum tanggal terbit invoice.',
          );
        const amount = new Prisma.Decimal(input.amount);
        const payments = await activePayments(tx, invoice.id);
        const available = invoice.amount.minus(payments._sum.amount ?? 0);
        if (amount.gt(available))
          throw new InvoiceMutationError(
            'Nominal pembayaran melebihi sisa tagihan.',
          );
        const payment = await tx.invoicePayment.create({
          data: {
            ...input,
            amount,
            paidDate: asDate(input.paidDate),
            actorId: user.id,
          },
        });
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { updatedAt: nextVersion(invoice) },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            projectId: invoice.projectId,
            entityType: 'InvoicePayment',
            entityId: payment.id,
            action: 'INVOICE_PAYMENT_RECORDED',
            metadata: {
              invoiceId: invoice.id,
              amount: payment.amount.toFixed(2),
              paidDate: input.paidDate,
              reference: payment.reference,
            },
          },
        });
        return 'Pembayaran tercatat.';
      }, transactionOptions);
    } catch (error) {
      // A request can also race for the unique key from a different invoice.
      if (
        errorCode(error) === 'P2002' &&
        (await checkPaymentReplay(prisma, input, user.id))
      )
        return 'Pembayaran sudah tercatat.';
      throw error;
    }
  });
}

export async function voidInvoicePayment(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || !hasFullAccess(user.role) || isLocalDemoMode()) return denied;
  const parsed = voidInvoicePaymentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return validationFailure(parsed.error);
  const { invoiceId, paymentId, reason } = parsed.data;

  return runInvoiceMutation(() =>
    prisma.$transaction(async (tx) => {
      const invoice = await lockInvoice(tx, invoiceId);
      const payment = await tx.invoicePayment.findFirst({
        where: { id: paymentId, invoiceId },
      });
      if (!payment)
        throw new InvoiceMutationError(
          'Pembayaran tidak ditemukan pada invoice ini.',
        );
      if (payment.voidedAt) return 'Pembayaran sudah dibatalkan.';
      requireOpenInvoice(invoice);
      const voidedAt = new Date();
      await tx.invoicePayment.update({
        where: { id: payment.id },
        data: { voidedAt, voidReason: reason },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { updatedAt: nextVersion(invoice) },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId: invoice.projectId,
          entityType: 'InvoicePayment',
          entityId: payment.id,
          action: 'INVOICE_PAYMENT_VOIDED',
          metadata: { invoiceId, amount: payment.amount.toFixed(2), reason },
        },
      });
      return 'Pembayaran dibatalkan.';
    }, transactionOptions),
  );
}

export async function voidInvoice(
  _state: MutationState,
  form: FormData,
): Promise<MutationState> {
  const user = await getCurrentUser();
  if (!user || !hasFullAccess(user.role) || isLocalDemoMode()) return denied;
  const parsed = voidInvoiceSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return validationFailure(parsed.error);
  const { invoiceId, updatedAt, reason } = parsed.data;

  return runInvoiceMutation(() =>
    prisma.$transaction(async (tx) => {
      const invoice = await lockInvoice(tx, invoiceId);
      if (invoice.voidedAt) return 'Invoice sudah dibatalkan.';
      requireCurrentVersion(invoice, updatedAt);
      if (
        await tx.invoicePayment.count({ where: { invoiceId, voidedAt: null } })
      )
        throw new InvoiceMutationError(
          'Batalkan pembayaran aktif sebelum membatalkan invoice.',
        );
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          voidedAt: new Date(),
          voidReason: reason,
          updatedAt: nextVersion(invoice),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          projectId: invoice.projectId,
          entityType: 'Invoice',
          entityId: invoice.id,
          action: 'INVOICE_VOIDED',
          metadata: {
            number: invoice.number,
            amount: invoice.amount.toFixed(2),
            reason,
          },
        },
      });
      return 'Invoice dibatalkan.';
    }, transactionOptions),
  );
}
