import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import type { CurrentUser } from '@/lib/auth/session';
import { isLocalDemoMode } from '@/lib/auth/session';
import { hasFullAccess } from '@/lib/auth/roles';
import { dateOnlyInTimeZone } from '@/lib/business-date';
import { prisma } from '@/lib/prisma';
import {
  activeMaterialOrderStatuses,
  type MaterialOrderStatusValue,
  type MaterialOrderWorkspaceData,
} from './types';

export async function getMaterialOrderWorkspaceData(
  user: CurrentUser,
): Promise<MaterialOrderWorkspaceData> {
  if (!hasFullAccess(user.role))
    throw new Error(
      'Material Status Order hanya untuk Admin atau Project Manager.',
    );
  const today = dateOnlyInTimeZone(
    new Date(),
    process.env.APP_TIME_ZONE || 'Asia/Jakarta',
  )
    .toISOString()
    .slice(0, 10);
  if (isLocalDemoMode())
    return {
      demoMode: true,
      today,
      items: [],
      orders: [],
      metrics: { lowStock: 0, openOrders: 0, lateOrders: 0, receivedOrders: 0 },
    };
  const [stock, activeOrders, recentHistory, receivedOrders] =
    await Promise.all([
      prisma.warehouseItem.findMany({
        where: {
          OR: [
            { quantity: { lte: prisma.warehouseItem.fields.minQty } },
            {
              materialOrders: {
                some: { status: { in: [...activeMaterialOrderStatuses] } },
              },
            },
          ],
        },
        orderBy: { code: 'asc' },
        include: {
          materialOrders: {
            where: { status: { in: [...activeMaterialOrderStatuses] } },
            select: {
              id: true,
              status: true,
              quantity: true,
              receivedQty: true,
            },
          },
        },
      }),
      prisma.materialOrder.findMany({
        where: { status: { in: [...activeMaterialOrderStatuses] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { createdBy: { select: { displayName: true } } },
      }),
      prisma.materialOrder.findMany({
        where: { status: { notIn: [...activeMaterialOrderStatuses] } },
        take: 100,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { createdBy: { select: { displayName: true } } },
      }),
      prisma.materialOrder.count({ where: { status: 'RECEIVED' } }),
    ]);
  const orders = [...activeOrders, ...recentHistory].sort(
    (a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
  );
  const items = stock
    .filter(
      (item) =>
        item.quantity.lte(item.minQty) || item.materialOrders.length > 0,
    )
    .map((item) => ({
      id: item.id,
      code: item.code,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity.toString(),
      minQty: item.minQty.toString(),
      openQty: item.materialOrders
        .reduce(
          (sum, order) =>
            order.status === 'DRAFT'
              ? sum
              : sum.plus(order.quantity.minus(order.receivedQty)),
          new Prisma.Decimal(0),
        )
        .toString(),
      belowMinimum: item.quantity.lte(item.minQty),
      openOrderId: item.materialOrders[0]?.id ?? null,
    }));
  return {
    demoMode: false,
    today,
    items,
    orders: orders.map((order) => ({
      id: order.id,
      warehouseItemId: order.warehouseItemId,
      code: order.itemCode,
      description: order.description,
      unit: order.unit,
      quantity: order.quantity.toString(),
      receivedQty: order.receivedQty.toString(),
      remainingQty: order.quantity.minus(order.receivedQty).toString(),
      supplier: order.supplier,
      referenceNo: order.referenceNo,
      expectedArrival:
        order.expectedArrival?.toISOString().slice(0, 10) ?? null,
      status: order.status as MaterialOrderStatusValue,
      notes: order.notes,
      cancellationReason: order.cancellationReason,
      createdByName: order.createdBy.displayName,
      updatedAt: order.updatedAt.toISOString(),
      createdAt: order.createdAt.toISOString(),
    })),
    metrics: {
      lowStock: items.filter((item) => item.belowMinimum).length,
      openOrders: activeOrders.length,
      lateOrders: activeOrders.filter(
        (order) =>
          ['ORDERED', 'PARTIAL'].includes(order.status) &&
          order.expectedArrival &&
          order.expectedArrival.toISOString().slice(0, 10) < today,
      ).length,
      receivedOrders,
    },
  };
}
