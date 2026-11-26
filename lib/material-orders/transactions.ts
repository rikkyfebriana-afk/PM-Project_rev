import 'server-only';
import { createHash } from 'node:crypto';
import { Prisma } from '@/generated/prisma/client';
import type { z } from 'zod';
import type { CurrentUser } from '@/lib/auth/session';
import { hasFullAccess } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';
import {
  recordWarehouseReceiptInTransaction,
  warehouseReceiptPayloadHash,
  type WarehouseReceiptInput,
} from '@/lib/warehouse/transactions';
import { activeMaterialOrderStatuses } from './types';
import {
  MaterialOrderError,
  type materialOrderCreateSchema,
  type materialOrderUpdateSchema,
  type materialOrderVersionSchema,
  type materialOrderCancelSchema,
  type materialOrderReceiptSchema,
} from './validation';

type CreateInput = z.infer<typeof materialOrderCreateSchema>;
type UpdateInput = z.infer<typeof materialOrderUpdateSchema>;
type VersionInput = z.infer<typeof materialOrderVersionSchema>;
type CancelInput = z.infer<typeof materialOrderCancelSchema>;
type ReceiptInput = z.infer<typeof materialOrderReceiptSchema>;
const transactionOptions = { timeout: 15000, maxWait: 10000 };

function assertManager(actor: CurrentUser) {
  if (!hasFullAccess(actor.role))
    throw new MaterialOrderError(
      'Hanya Admin atau Project Manager yang dapat mengelola pesanan material.',
    );
}

function checkReplay(previous: { payloadHash: string } | null, hash: string) {
  if (!previous) return false;
  if (previous.payloadHash !== hash)
    throw new MaterialOrderError(
      'Nomor permintaan sudah dipakai untuk transaksi berbeda. Muat ulang form.',
    );
  return true;
}

function errorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : '';
}

function draftData(input: CreateInput | UpdateInput) {
  return {
    quantity: new Prisma.Decimal(input.quantity),
    supplier: input.supplier,
    referenceNo: input.referenceNo,
    expectedArrival: input.expectedArrival
      ? new Date(`${input.expectedArrival}T00:00:00.000Z`)
      : null,
    notes: input.notes,
  };
}

function nextVersion(current: Date) {
  // Millisecond timestamps must still change if two writes finish in one tick.
  return new Date(Math.max(Date.now(), current.getTime() + 1));
}

async function lockOrder(tx: Prisma.TransactionClient, input: VersionInput) {
  const locator = await tx.materialOrder.findUnique({
    where: { id: input.id },
    select: { warehouseItemId: true },
  });
  if (!locator)
    throw new MaterialOrderError(
      'Pesanan material tidak ditemukan. Muat ulang daftar.',
    );
  // Every order writer locks the warehouse item first, including stock/unit edits.
  await tx.$queryRaw`SELECT "id" FROM "WarehouseItem" WHERE "id"=${locator.warehouseItemId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "MaterialOrder" WHERE "id"=${input.id} FOR UPDATE`;
  const order = await tx.materialOrder.findUnique({ where: { id: input.id } });
  if (!order || order.warehouseItemId !== locator.warehouseItemId)
    throw new MaterialOrderError(
      'Pesanan material sudah berubah. Muat ulang daftar.',
    );
  if (order.updatedAt.toISOString() !== input.updatedAt)
    throw new MaterialOrderError(
      'Pesanan sudah diperbarui sejak form dibuka. Muat ulang halaman.',
    );
  const stock = await tx.warehouseItem.findUnique({
    where: { id: locator.warehouseItemId },
  });
  if (!stock || stock.unit !== order.unit)
    throw new MaterialOrderError(
      'Satuan gudang tidak sama dengan pesanan. Periksa data material.',
    );
  return order;
}

export async function createMaterialOrderTransaction(
  actor: CurrentUser,
  input: CreateInput,
) {
  assertManager(actor);
  const hash = createHash('sha256')
    .update(JSON.stringify({ actorId: actor.id, input }))
    .digest('hex');
  try {
    return await prisma.$transaction(async (tx) => {
      if (
        checkReplay(
          await tx.materialOrder.findUnique({
            where: { requestId: input.requestId },
            select: { payloadHash: true },
          }),
          hash,
        )
      )
        return { duplicate: true };
      await tx.$queryRaw`SELECT "id" FROM "WarehouseItem" WHERE "id"=${input.warehouseItemId} FOR UPDATE`;
      const stock = await tx.warehouseItem.findUnique({
        where: { id: input.warehouseItemId },
      });
      if (!stock)
        throw new MaterialOrderError('Material gudang tidak ditemukan.');
      if (
        checkReplay(
          await tx.materialOrder.findUnique({
            where: { requestId: input.requestId },
            select: { payloadHash: true },
          }),
          hash,
        )
      )
        return { duplicate: true };
      if (stock.quantity.gt(stock.minQty))
        throw new MaterialOrderError(
          'Stok material sudah di atas batas minimum. Muat ulang daftar kebutuhan order.',
        );
      const active = await tx.materialOrder.findFirst({
        where: {
          warehouseItemId: stock.id,
          status: { in: [...activeMaterialOrderStatuses] },
        },
        select: { id: true },
      });
      if (active)
        throw new MaterialOrderError(
          'Material ini sudah memiliki draft atau pesanan aktif. Lanjutkan pesanan tersebut.',
        );
      const order = await tx.materialOrder.create({
        data: {
          ...draftData(input),
          requestId: input.requestId,
          payloadHash: hash,
          warehouseItemId: stock.id,
          itemCode: stock.code,
          description: stock.description,
          unit: stock.unit,
          createdById: actor.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          entityType: 'MaterialOrder',
          entityId: order.id,
          action: 'MATERIAL_ORDER_CREATED',
          metadata: {
            warehouseItemId: stock.id,
            code: stock.code,
            unit: stock.unit,
            quantity: order.quantity.toString(),
            stock: stock.quantity.toString(),
            minQty: stock.minQty.toString(),
          },
        },
      });
      return { duplicate: false };
    }, transactionOptions);
  } catch (error) {
    if (errorCode(error) === 'P2002') {
      if (
        checkReplay(
          await prisma.materialOrder.findUnique({
            where: { requestId: input.requestId },
            select: { payloadHash: true },
          }),
          hash,
        )
      )
        return { duplicate: true };
      throw new MaterialOrderError(
        'Material ini sudah memiliki draft atau pesanan aktif. Muat ulang daftar.',
      );
    }
    throw error;
  }
}

export async function updateMaterialOrderTransaction(
  actor: CurrentUser,
  input: UpdateInput,
) {
  assertManager(actor);
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, input);
    if (order.status !== 'DRAFT')
      throw new MaterialOrderError(
        'Hanya draft yang dapat diubah. Pesanan yang sudah dipesan harus diterima atau dibatalkan.',
      );
    const updated = await tx.materialOrder.update({
      where: { id: order.id },
      data: { ...draftData(input), updatedAt: nextVersion(order.updatedAt) },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        entityType: 'MaterialOrder',
        entityId: order.id,
        action: 'MATERIAL_ORDER_UPDATED',
        metadata: {
          before: {
            quantity: order.quantity.toString(),
            supplier: order.supplier,
            referenceNo: order.referenceNo,
            expectedArrival: order.expectedArrival?.toISOString() ?? null,
            notes: order.notes,
          },
          after: {
            quantity: updated.quantity.toString(),
            supplier: updated.supplier,
            referenceNo: updated.referenceNo,
            expectedArrival: updated.expectedArrival?.toISOString() ?? null,
            notes: updated.notes,
          },
        },
      },
    });
  }, transactionOptions);
}

export async function confirmMaterialOrderTransaction(
  actor: CurrentUser,
  input: VersionInput,
) {
  assertManager(actor);
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, input);
    if (order.status !== 'DRAFT')
      throw new MaterialOrderError(
        'Pesanan ini sudah diproses. Muat ulang daftar.',
      );
    if (!order.supplier.trim() || !order.referenceNo.trim())
      throw new MaterialOrderError(
        'Lengkapi dan simpan supplier serta nomor order pada draft terlebih dahulu.',
      );
    await tx.materialOrder.update({
      where: { id: order.id },
      data: { status: 'ORDERED', updatedAt: nextVersion(order.updatedAt) },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        entityType: 'MaterialOrder',
        entityId: order.id,
        action: 'MATERIAL_ORDER_ORDERED',
        metadata: {
          from: order.status,
          to: 'ORDERED',
          supplier: order.supplier,
          referenceNo: order.referenceNo,
          quantity: order.quantity.toString(),
        },
      },
    });
  }, transactionOptions);
}

export async function cancelMaterialOrderTransaction(
  actor: CurrentUser,
  input: CancelInput,
) {
  assertManager(actor);
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, input);
    if (!activeMaterialOrderStatuses.some((status) => status === order.status))
      throw new MaterialOrderError(
        'Pesanan yang sudah selesai atau dibatalkan tidak dapat dibatalkan kembali.',
      );
    await tx.materialOrder.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        cancellationReason: input.reason,
        updatedAt: nextVersion(order.updatedAt),
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        entityType: 'MaterialOrder',
        entityId: order.id,
        action: 'MATERIAL_ORDER_CANCELLED',
        metadata: {
          from: order.status,
          to: 'CANCELLED',
          reason: input.reason,
          receivedQty: order.receivedQty.toString(),
          cancelledQty: order.quantity.minus(order.receivedQty).toString(),
        },
      },
    });
  }, transactionOptions);
}

export async function receiveMaterialOrderTransaction(
  actor: CurrentUser,
  input: ReceiptInput,
) {
  assertManager(actor);
  // Resolve an immutable parent ID before taking locks; no order row is locked first.
  const locator = await prisma.materialOrder.findUnique({
    where: { id: input.orderId },
    select: { warehouseItemId: true },
  });
  if (!locator)
    throw new MaterialOrderError('Pesanan material tidak ditemukan.');
  const receipt: WarehouseReceiptInput = {
    requestId: input.requestId,
    quantity: input.quantity,
    referenceNo: input.referenceNo,
    recipient: input.recipient,
    notes: input.notes,
    warehouseItemId: locator.warehouseItemId,
    expectedUnit: input.expectedUnit,
  };
  const hash = warehouseReceiptPayloadHash(actor, receipt, input.orderId);
  try {
    return await prisma.$transaction(async (tx) => {
      if (
        checkReplay(
          await tx.warehouseMovement.findUnique({
            where: { requestId: input.requestId },
            select: { payloadHash: true },
          }),
          hash,
        )
      )
        return { duplicate: true };
      await tx.$queryRaw`SELECT "id" FROM "WarehouseItem" WHERE "id"=${locator.warehouseItemId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "MaterialOrder" WHERE "id"=${input.orderId} FOR UPDATE`;
      const order = await tx.materialOrder.findUnique({
        where: { id: input.orderId },
      });
      if (!order || order.warehouseItemId !== locator.warehouseItemId)
        throw new MaterialOrderError(
          'Pesanan material sudah berubah. Muat ulang daftar.',
        );
      // A simultaneous retry can arrive after the first receipt has completed the order.
      if (
        checkReplay(
          await tx.warehouseMovement.findUnique({
            where: { requestId: input.requestId },
            select: { payloadHash: true },
          }),
          hash,
        )
      )
        return { duplicate: true };
      if (!['ORDERED', 'PARTIAL'].includes(order.status))
        throw new MaterialOrderError(
          'Penerimaan hanya untuk pesanan berstatus sudah dipesan atau diterima sebagian.',
        );
      if (input.expectedUnit !== order.unit)
        throw new MaterialOrderError(
          'Satuan penerimaan berbeda dari pesanan. Muat ulang form.',
        );
      const qty = new Prisma.Decimal(input.quantity);
      if (qty.gt(order.quantity.minus(order.receivedQty)))
        throw new MaterialOrderError(
          'Jumlah diterima melebihi sisa pesanan. Muat ulang lalu periksa penerimaan terakhir.',
        );
      const result = await recordWarehouseReceiptInTransaction(
        tx,
        actor,
        receipt,
        order.id,
      );
      if (result.duplicate) return { duplicate: true };
      const receivedQty = order.receivedQty.plus(qty);
      const status = receivedQty.eq(order.quantity) ? 'RECEIVED' : 'PARTIAL';
      await tx.materialOrder.update({
        where: { id: order.id },
        data: { receivedQty, status, updatedAt: nextVersion(order.updatedAt) },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          entityType: 'MaterialOrder',
          entityId: order.id,
          action: 'MATERIAL_ORDER_RECEIVED',
          metadata: {
            warehouseMovementId: result.movementId,
            warehouseItemId: order.warehouseItemId,
            quantity: qty.toString(),
            receivedBefore: order.receivedQty.toString(),
            receivedAfter: receivedQty.toString(),
            from: order.status,
            to: status,
            referenceNo: input.referenceNo,
          },
        },
      });
      return { duplicate: false };
    }, transactionOptions);
  } catch (error) {
    if (
      errorCode(error) === 'P2002' &&
      checkReplay(
        await prisma.warehouseMovement.findUnique({
          where: { requestId: input.requestId },
          select: { payloadHash: true },
        }),
        hash,
      )
    )
      return { duplicate: true };
    throw error;
  }
}
