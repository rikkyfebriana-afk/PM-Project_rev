import 'server-only';

import type { CurrentUser } from '@/lib/auth/session';
import { isLocalDemoMode } from '@/lib/auth/session';
import { dateOnlyInTimeZone } from '@/lib/business-date';
import type {
  MaterialRecord,
  MaterialWorkspaceData,
} from '@/lib/materials/types';
import { prisma } from '@/lib/prisma';
import { accessibleProjectWhere } from '@/lib/projects/access';

const demoMaterials: MaterialRecord[] = [
  {
    id: 'demo-mat-1',
    projectId: 'demo-cirebon',
    projectCode: 'PCC-024',
    projectName: 'Cirebon Substation Upgrade',
    boqItemNo: '1.01',
    code: 'SWG-24KV-01',
    description: '24 kV switchgear panel',
    unit: 'UNIT',
    requiredQty: '8',
    orderedQty: '8',
    receivedQty: '6',
    installedQty: '0',
    supplier: 'PT Panel Nusantara',
    purchaseOrderNo: 'PO-24091',
    needByDate: '2026-09-20',
    estimatedArrival: '2026-09-18',
    status: 'PARTIAL',
    isActive: true,
    updatedAt: '2026-09-12T04:20:00.000Z',
    canEdit: true,
  },
  {
    id: 'demo-mat-2',
    projectId: 'demo-cirebon',
    projectCode: 'PCC-024',
    projectName: 'Cirebon Substation Upgrade',
    boqItemNo: '1.02',
    code: 'RELAY-PROT-01',
    description: 'Protection relay',
    unit: 'PCS',
    requiredQty: '16',
    orderedQty: '12',
    receivedQty: '0',
    installedQty: '0',
    supplier: 'PT Sistem Proteksi',
    purchaseOrderNo: 'PO-24108',
    needByDate: '2026-09-17',
    estimatedArrival: '2026-09-25',
    status: 'SHORTAGE',
    isActive: true,
    updatedAt: '2026-09-11T02:10:00.000Z',
    canEdit: true,
  },
  {
    id: 'demo-mat-3',
    projectId: 'demo-bogor',
    projectCode: 'PCC-031',
    projectName: 'Bogor Control Panel',
    boqItemNo: '2.04',
    code: 'CABLE-CU-240',
    description: 'Power cable Cu 240 mm²',
    unit: 'M',
    requiredQty: '1200',
    orderedQty: '1200',
    receivedQty: '1200',
    installedQty: '850',
    supplier: 'PT Kabel Indonesia',
    purchaseOrderNo: 'PO-24077',
    needByDate: '2026-10-01',
    estimatedArrival: '2026-09-14',
    status: 'RECEIVED',
    isActive: true,
    updatedAt: '2026-09-10T06:15:00.000Z',
    canEdit: true,
  },
  {
    id: 'demo-mat-4',
    projectId: 'demo-bekasi',
    projectCode: 'PCC-018',
    projectName: 'Bekasi Switchgear Revamp',
    boqItemNo: '3.08',
    code: 'BUSDUCT-1600',
    description: 'Busduct 1600 A',
    unit: 'M',
    requiredQty: '42',
    orderedQty: '42',
    receivedQty: '42',
    installedQty: '42',
    supplier: 'PT Busbar Teknik',
    purchaseOrderNo: 'PO-23982',
    needByDate: '2026-09-05',
    estimatedArrival: '2026-08-30',
    status: 'INSTALLED',
    isActive: true,
    updatedAt: '2026-09-09T08:45:00.000Z',
    canEdit: true,
  },
];

function dateInput(date: Date | null) {
  return date?.toISOString().slice(0, 10) ?? null;
}

function metrics(materials: MaterialRecord[]) {
  const active = materials.filter((material) => material.isActive);
  const today = dateOnlyInTimeZone(
    new Date(),
    process.env.APP_TIME_ZONE || 'Asia/Jakarta',
  )
    .toISOString()
    .slice(0, 10);
  const readiness = active
    .filter((material) => Number(material.requiredQty) > 0)
    .map((material) =>
      Math.min(1, Number(material.receivedQty) / Number(material.requiredQty)),
    );
  return {
    active: active.length,
    shortage: active.filter((material) => material.status === 'SHORTAGE')
      .length,
    lateEta: active.filter(
      (material) =>
        material.estimatedArrival !== null &&
        material.estimatedArrival < today &&
        Number(material.receivedQty) < Number(material.requiredQty),
    ).length,
    readinessPct: readiness.length
      ? Math.round(
          (readiness.reduce((sum, ratio) => sum + ratio, 0) /
            readiness.length) *
            1000,
        ) / 10
      : 0,
  };
}

export async function getMaterialWorkspaceData(
  user: CurrentUser,
): Promise<MaterialWorkspaceData> {
  if (isLocalDemoMode()) {
    const materials = demoMaterials.map((material) => ({
      ...material,
      canEdit: false,
    }));
    return { demoMode: true, materials, metrics: metrics(materials) };
  }

  const rows = await prisma.material.findMany({
    where: { project: accessibleProjectWhere(user) },
    orderBy: [
      { isActive: 'desc' },
      { status: 'asc' },
      { project: { code: 'asc' } },
      { code: 'asc' },
    ],
    include: {
      project: { select: { code: true, name: true, projectManagerId: true } },
      boqItem: { select: { itemNo: true } },
    },
  });
  const materials: MaterialRecord[] = rows.map((material) => ({
    id: material.id,
    projectId: material.projectId,
    projectCode: material.project.code,
    projectName: material.project.name,
    boqItemNo: material.boqItem?.itemNo ?? null,
    code: material.code,
    description: material.description,
    unit: material.unit,
    requiredQty: material.requiredQty.toString(),
    orderedQty: material.orderedQty.toString(),
    receivedQty: material.receivedQty.toString(),
    installedQty: material.installedQty.toString(),
    supplier: material.supplier,
    purchaseOrderNo: material.purchaseOrderNo,
    needByDate: dateInput(material.needByDate),
    estimatedArrival: dateInput(material.estimatedArrival),
    status: material.status,
    isActive: material.isActive,
    updatedAt: material.updatedAt.toISOString(),
    canEdit:
      user.role === 'ADMIN' ||
      (user.role === 'PROJECT_MANAGER' &&
        material.project.projectManagerId === user.id),
  }));
  return { demoMode: false, materials, metrics: metrics(materials) };
}
