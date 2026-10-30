import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import type { CurrentUser } from '@/lib/auth/session';
import { isLocalDemoMode } from '@/lib/auth/session';
import { hasFullAccess } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';
import type { WarehouseWorkspaceData } from './types';

export async function getWarehouseWorkspaceData(user: CurrentUser, returnSearch = ''): Promise<WarehouseWorkspaceData> {
  if (!hasFullAccess(user.role)) throw new Error('Akses stok gudang hanya untuk Admin atau Project Manager.');
  const search = returnSearch.normalize('NFKC').trim().slice(0, 100);
  if (isLocalDemoMode()) return {
    demoMode: true, items: [], materials: [], movements: [], returnableIssues: [], returnSearch: search,
    metrics: { items: 0, lowStock: 0, emptyStock: 0, movements: 0 },
  };
  const [items, materials, movements, issues, movementCount] = await Promise.all([
    prisma.warehouseItem.findMany({ orderBy: { code: 'asc' } }),
    prisma.material.findMany({
      where: {
        isActive: true, normalizedCode: { not: null },
        project: { deletedAt: null, status: { in: ['ACTIVE', 'ON_HOLD'] } },
        boqItem: { is: { itemType: 'MATERIAL', boq: { status: 'APPROVED' } } },
      },
      include: { project: { select: { code: true, name: true } }, boqItem: { include: { boq: { select: { version: true } } } } },
      orderBy: [{ project: { code: 'asc' } }, { code: 'asc' }],
    }),
    prisma.warehouseMovement.findMany({
      orderBy: { createdAt: 'desc' }, take: 100,
      include: {
        warehouseItem: { select: { code: true, description: true, unit: true } },
        actor: { select: { displayName: true } },
        project: { select: { code: true, name: true } },
        boqItem: { select: { itemNo: true, boq: { select: { version: true } } } },
      },
    }),
    prisma.warehouseMovement.findMany({
      where: {
        type: 'ISSUE',
        ...(search ? { OR: [
          { referenceNo: { contains: search, mode: 'insensitive' as const } },
          { project: { is: { OR: [{ code: { contains: search, mode: 'insensitive' as const } }, { name: { contains: search, mode: 'insensitive' as const } }] } } },
          { warehouseItem: { is: { code: { contains: search, mode: 'insensitive' as const } } } },
        ] } : {}),
      },
      orderBy: { createdAt: 'desc' }, take: 200,
      include: {
        warehouseItem: { select: { code: true, unit: true } },
        project: { select: { code: true, name: true } },
        material: { select: { receivedQty: true, installedQty: true, warehouseIssuedQty: true } },
        returns: { select: { quantity: true } },
      },
    }),
    prisma.warehouseMovement.count(),
  ]);
  const zero = new Prisma.Decimal(0);
  return {
    demoMode: false, returnSearch: search,
    items: items.map(item => ({
      id: item.id, code: item.code, normalizedCode: item.normalizedCode, description: item.description,
      unit: item.unit, location: item.location, minQty: item.minQty.toString(), quantity: item.quantity.toString(),
      lowStock: item.quantity.lte(item.minQty),
    })),
    materials: materials.map(material => ({
      id: material.id, projectId: material.projectId, projectLabel: `${material.project.code} — ${material.project.name}`,
      itemNo: material.boqItem!.itemNo, boqVersion: material.boqItem!.boq.version,
      code: material.code ?? '', normalizedCode: material.normalizedCode!, description: material.description, unit: material.unit,
      requiredQty: material.requiredQty.toString(), receivedQty: material.receivedQty.toString(),
      installedQty: material.installedQty.toString(), warehouseIssuedQty: material.warehouseIssuedQty.toString(),
      remainingQty: Prisma.Decimal.max(zero, material.requiredQty.minus(material.receivedQty)).toString(),
    })),
    movements: movements.map(movement => ({
      id: movement.id, type: movement.type, itemCode: movement.warehouseItem.code,
      description: movement.warehouseItem.description, unit: movement.warehouseItem.unit,
      quantity: movement.quantity.toString(), balanceAfter: movement.balanceAfter.toString(),
      referenceNo: movement.referenceNo, recipient: movement.recipient, notes: movement.notes,
      actor: movement.actor.displayName, projectLabel: movement.project ? `${movement.project.code} — ${movement.project.name}` : null,
      boqLabel: movement.boqItem ? `BoQ v${movement.boqItem.boq.version} · item ${movement.boqItem.itemNo}` : null,
      createdAt: movement.createdAt.toISOString(),
    })),
    returnableIssues: issues.flatMap(issue => {
      if (!issue.material || !issue.project) return [];
      const returned = issue.returns.reduce((sum, row) => sum.plus(row.quantity), zero);
      const allowed = Prisma.Decimal.max(zero, Prisma.Decimal.min(
        issue.quantity.minus(returned), issue.material.receivedQty.minus(issue.material.installedQty), issue.material.warehouseIssuedQty,
      ));
      if (!allowed.gt(0)) return [];
      return [{ id: issue.id, itemCode: issue.warehouseItem.code, unit: issue.warehouseItem.unit,
        projectLabel: `${issue.project.code} — ${issue.project.name}`, referenceNo: issue.referenceNo, recipient: issue.recipient,
        issuedQty: issue.quantity.toString(), returnedQty: returned.toString(), returnableQty: allowed.toString(), createdAt: issue.createdAt.toISOString() }];
    }),
    metrics: { items: items.length, lowStock: items.filter(item => item.quantity.lte(item.minQty)).length,
      emptyStock: items.filter(item => item.quantity.isZero()).length, movements: movementCount },
  };
}
