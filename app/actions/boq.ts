'use server';

import { revalidatePath } from 'next/cache';
import { createHash } from 'node:crypto';
import { z } from 'zod';

import { Prisma } from '@/generated/prisma/client';
import { getCurrentUser, isLocalDemoMode } from '@/lib/auth/session';
import type {
  BoqApprovalActionState,
  BoqApprovalPayload,
  BoqImportCommitRequest,
  BoqImportActionState,
  BoqImportPayload,
} from '@/lib/boq/types';
import { BOQ_MAX_FILE_SIZE } from '@/lib/boq/types';
import { parseBoqBytes } from '@/lib/boq/parser';
import { validateBoqImportPayload } from '@/lib/boq/validation';
import { reconcileMaterialStatus } from '@/lib/materials/validation';
import { prisma } from '@/lib/prisma';
import { editableProjectWhere } from '@/lib/projects/access';
import { getSupabaseAdmin } from '@/lib/storage/supabase-admin';

const INSERT_BATCH_SIZE = 250;
const commitSchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  documentId: z.string().trim().min(1).max(128),
  sheetName: z.string().trim().min(1).max(100),
});
const approvalSchema = z.object({
  boqId: z.string().trim().min(1).max(128),
  expectedApprovedBoqId: z.string().trim().min(1).max(128).nullable(),
});

function normalizedMaterialCode(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleUpperCase('en-US');
}

function actionError(error: unknown): BoqImportActionState {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  ) {
    return {
      status: 'error',
      message:
        'Import bertabrakan dengan perubahan lain. Muat ulang daftar BoQ lalu coba lagi.',
    };
  }

  return {
    status: 'error',
    message: 'BoQ belum dapat disimpan. Silakan coba lagi.',
  };
}

export async function commitBoqImportAction(
  input: BoqImportCommitRequest,
): Promise<BoqImportActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: 'error', message: 'Sesi Anda telah berakhir.' };
  }
  if (isLocalDemoMode()) {
    return {
      status: 'error',
      message:
        'Mode demo hanya baca. Hubungkan PostgreSQL untuk mengimpor BoQ.',
    };
  }
  if (user.role === 'VIEWER') {
    return {
      status: 'error',
      message: 'Akun Viewer tidak dapat mengimpor BoQ.',
    };
  }

  const request = commitSchema.safeParse(input);
  if (!request.success) {
    return { status: 'error', message: 'Permintaan impor tidak valid.' };
  }

  const document = await prisma.document.findFirst({
    where: {
      id: request.data.documentId,
      projectId: request.data.projectId,
      category: 'BOQ',
      status: 'READY',
      deletedAt: null,
      ...(user.role === 'ADMIN' ? {} : { uploadedById: user.id }),
      project: { is: editableProjectWhere(user) },
    },
    select: {
      id: true,
      originalName: true,
      bucket: true,
      objectKey: true,
      sizeBytes: true,
    },
  });
  if (!document || document.sizeBytes > BigInt(BOQ_MAX_FILE_SIZE)) {
    return {
      status: 'error',
      message: 'Dokumen BoQ tidak ditemukan, belum siap, atau terlalu besar.',
    };
  }

  let sourceBytes: Uint8Array;
  try {
    const { data, error } = await getSupabaseAdmin()
      .storage.from(document.bucket)
      .download(document.objectKey);
    if (error || !data || data.size !== Number(document.sizeBytes)) {
      return {
        status: 'error',
        message:
          'File sumber di private storage tidak cocok dengan metadata upload.',
      };
    }
    sourceBytes = new Uint8Array(await data.arrayBuffer());
  } catch {
    return {
      status: 'error',
      message: 'File sumber belum dapat dibaca dari private storage.',
    };
  }

  let source;
  try {
    source = await parseBoqBytes(
      sourceBytes,
      document.originalName,
      request.data.sheetName,
    );
  } catch {
    return {
      status: 'error',
      message: 'Workbook tidak dapat dibaca atau formatnya tidak didukung.',
    };
  }
  if (
    source.sheetName !== request.data.sheetName ||
    source.issues.some((issue) => issue.severity === 'error') ||
    source.errorRowCount > 0 ||
    source.rows.length === 0
  ) {
    return {
      status: 'error',
      message: 'File asli mengandung error. Periksa preview dan upload ulang.',
      issues: [
        ...source.issues
          .filter((issue) => issue.severity === 'error')
          .map((issue) => ({
            field: issue.field ?? ('rows' as const),
            row: issue.sourceRow,
            message: issue.message,
          })),
        ...source.rows.flatMap((row) =>
          row.issues
            .filter((issue) => issue.severity === 'error')
            .map((issue) => ({
              field: issue.field ?? ('rows' as const),
              row: row.sourceRow,
              message: issue.message,
            })),
        ),
      ].slice(0, 100),
    };
  }

  const sourceChecksum = createHash('sha256').update(sourceBytes).digest('hex');
  const payload: BoqImportPayload = {
    projectId: request.data.projectId,
    fileName: document.originalName,
    sheetName: request.data.sheetName,
    rows: source.rows.map((row) => ({
      itemNo: row.itemNo,
      itemCode: row.itemCode,
      itemType: row.itemType,
      description: row.description,
      unit: row.unit,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
    })),
  };
  const parsed = validateBoqImportPayload(payload);
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Periksa kembali data BoQ sebelum mengimpor.',
      issues: parsed.issues,
    };
  }

  try {
    const outcome = await prisma.$transaction(
      async (transaction) => {
        // Serialize version allocation and duplicate detection per project.
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${parsed.data.projectId}, 0))
        `;

        // Coordinate with project archive/reassignment transactions.
        const lockedProjects = await transaction.$queryRaw<
          Array<{ id: string }>
        >`
          SELECT "id"
          FROM "Project"
          WHERE "id" = ${parsed.data.projectId}
            AND "deletedAt" IS NULL
          FOR UPDATE
        `;
        if (lockedProjects.length !== 1) {
          return { outcome: 'not-found' as const };
        }

        const project = await transaction.project.findFirst({
          where: {
            id: parsed.data.projectId,
            ...editableProjectWhere(user),
          },
          select: { id: true, code: true },
        });
        if (!project) return { outcome: 'not-found' as const };

        const readyDocument = await transaction.document.findFirst({
          where: {
            id: document.id,
            projectId: project.id,
            category: 'BOQ',
            status: 'READY',
            deletedAt: null,
            ...(user.role === 'ADMIN' ? {} : { uploadedById: user.id }),
          },
          select: { id: true },
        });
        if (!readyDocument) return { outcome: 'not-found' as const };

        await transaction.document.update({
          where: { id: document.id },
          data: { checksum: sourceChecksum },
        });

        const duplicate = await transaction.boq.findFirst({
          where: {
            projectId: project.id,
            sourceHash: parsed.data.sourceHash,
          },
          select: { id: true, version: true },
        });
        if (duplicate) {
          return {
            outcome: 'duplicate' as const,
            boq: {
              id: duplicate.id,
              version: duplicate.version,
              itemCount: parsed.data.rows.length,
              totalValue: parsed.data.totalValue,
            },
          };
        }

        const latestVersion = await transaction.boq.aggregate({
          where: { projectId: project.id },
          _max: { version: true },
        });
        const version = (latestVersion._max.version ?? 0) + 1;

        const priorDrafts = await transaction.boq.updateMany({
          where: { projectId: project.id, status: 'DRAFT' },
          data: { status: 'SUPERSEDED' },
        });

        const boq = await transaction.boq.create({
          data: {
            projectId: project.id,
            createdById: user.id,
            version,
            status: 'DRAFT',
            sourceHash: parsed.data.sourceHash,
            sourceFileName: parsed.data.fileName,
            sourceSheetName: parsed.data.sheetName,
            sourceDocumentId: document.id,
          },
          select: { id: true, version: true },
        });

        for (
          let offset = 0;
          offset < parsed.data.rows.length;
          offset += INSERT_BATCH_SIZE
        ) {
          const batch = parsed.data.rows.slice(
            offset,
            offset + INSERT_BATCH_SIZE,
          );
          await transaction.boqItem.createMany({
            data: batch.map((row, batchIndex) => ({
              boqId: boq.id,
              itemType: row.itemType,
              sortOrder: offset + batchIndex,
              itemNo: row.itemNo,
              itemCode: row.itemCode,
              description: row.description,
              unit: row.unit,
              quantity: new Prisma.Decimal(row.quantity),
              unitPrice: new Prisma.Decimal(row.unitPrice),
              lineTotal: new Prisma.Decimal(row.lineTotal),
            })),
          });
        }

        await transaction.auditLog.create({
          data: {
            userId: user.id,
            projectId: project.id,
            action: 'BOQ_IMPORTED',
            entityType: 'Boq',
            entityId: boq.id,
            metadata: {
              projectCode: project.code,
              version: boq.version,
              sourceFileName: parsed.data.fileName,
              sourceSheetName: parsed.data.sheetName,
              sourceHash: parsed.data.sourceHash,
              sourceDocumentId: document.id,
              sourceChecksum,
              itemCount: parsed.data.rows.length,
              totalValue: parsed.data.totalValue,
              supersededDraftCount: priorDrafts.count,
            },
          },
        });

        return {
          outcome: 'created' as const,
          boq: {
            id: boq.id,
            version: boq.version,
            itemCount: parsed.data.rows.length,
            totalValue: parsed.data.totalValue,
          },
        };
      },
      { timeout: 15_000 },
    );

    if (outcome.outcome === 'not-found') {
      return {
        status: 'error',
        message:
          'Project tidak ditemukan atau Anda tidak memiliki akses impor.',
      };
    }

    if (outcome.outcome === 'duplicate') {
      return {
        status: 'duplicate',
        message: `Data yang sama sudah tersimpan sebagai BoQ versi ${outcome.boq.version}.`,
        boq: outcome.boq,
      };
    }

    revalidatePath('/boq');
    return {
      status: 'success',
      message: `BoQ versi ${outcome.boq.version} berhasil diimpor.`,
      boq: outcome.boq,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function approveBoqRevisionAction(
  input: BoqApprovalPayload,
): Promise<BoqApprovalActionState> {
  const user = await getCurrentUser();
  if (!user) return { status: 'error', message: 'Sesi Anda telah berakhir.' };
  if (isLocalDemoMode()) {
    return {
      status: 'error',
      message: 'Mode demo hanya baca. Hubungkan PostgreSQL untuk approval.',
    };
  }
  if (user.role !== 'ADMIN') {
    return {
      status: 'error',
      message: 'Hanya Admin yang dapat menyetujui baseline BoQ.',
    };
  }

  const parsed = approvalSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', message: 'Permintaan approval tidak valid.' };
  }

  try {
    const outcome = await prisma.$transaction(
      async (transaction) => {
        const locator = await transaction.boq.findUnique({
          where: { id: parsed.data.boqId },
          select: { projectId: true },
        });
        if (!locator) return { outcome: 'not-found' as const };

        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${locator.projectId}, 0))
        `;
        const lockedProjects = await transaction.$queryRaw<
          Array<{ id: string }>
        >`
          SELECT "id"
          FROM "Project"
          WHERE "id" = ${locator.projectId}
            AND "deletedAt" IS NULL
          FOR UPDATE
        `;
        if (lockedProjects.length !== 1) {
          return { outcome: 'not-found' as const };
        }

        const draft = await transaction.boq.findFirst({
          where: {
            id: parsed.data.boqId,
            projectId: locator.projectId,
            status: 'DRAFT',
          },
          include: {
            project: { select: { code: true } },
            items: { orderBy: [{ sortOrder: 'asc' }, { itemNo: 'asc' }] },
          },
        });
        if (!draft) return { outcome: 'not-draft' as const };

        const currentApproved = await transaction.boq.findFirst({
          where: { projectId: draft.projectId, status: 'APPROVED' },
          select: { id: true, version: true },
        });
        if (
          currentApproved?.id !==
          (parsed.data.expectedApprovedBoqId ?? undefined)
        ) {
          return { outcome: 'baseline-conflict' as const };
        }

        const materialItems = draft.items.filter(
          (item) => item.itemType === 'MATERIAL',
        );
        const itemCodes = new Set<string>();
        const inputIssues: string[] = [];
        for (const item of materialItems) {
          if (!item.itemCode) {
            inputIssues.push(
              `Item ${item.itemNo}: Item Code wajib untuk material.`,
            );
            continue;
          }
          const code = normalizedMaterialCode(item.itemCode);
          if (itemCodes.has(code)) {
            inputIssues.push(`Kode material ${code} muncul lebih dari sekali.`);
          }
          itemCodes.add(code);
        }
        if (inputIssues.length) {
          return { outcome: 'data-conflict' as const, issues: inputIssues };
        }

        const existingMaterials = await transaction.material.findMany({
          where: { projectId: draft.projectId },
        });
        const existingByCode = new Map(
          existingMaterials
            .filter((material) => material.normalizedCode)
            .map((material) => [material.normalizedCode!, material]),
        );
        const reconciliationIssues: string[] = [];

        for (const item of materialItems) {
          const code = normalizedMaterialCode(item.itemCode!);
          const existing = existingByCode.get(code);
          if (!existing) continue;
          const hasMovement =
            existing.orderedQty.gt(0) ||
            existing.receivedQty.gt(0) ||
            existing.installedQty.gt(0);
          if (
            hasMovement &&
            existing.unit.toLocaleUpperCase('en-US') !==
              item.unit.toLocaleUpperCase('en-US')
          ) {
            reconciliationIssues.push(
              `${code}: satuan tidak dapat diubah setelah transaksi material.`,
            );
          }
          if (
            item.quantity.lt(existing.receivedQty) ||
            item.quantity.lt(existing.installedQty)
          ) {
            reconciliationIssues.push(
              `${code}: kebutuhan baru lebih kecil dari jumlah diterima/terpasang.`,
            );
          }
        }
        if (reconciliationIssues.length) {
          return {
            outcome: 'data-conflict' as const,
            issues: reconciliationIssues,
          };
        }

        if (currentApproved) {
          await transaction.boq.update({
            where: { id: currentApproved.id },
            data: { status: 'SUPERSEDED' },
          });
        }

        let createdMaterials = 0;
        let updatedMaterials = 0;
        for (const item of materialItems) {
          const code = normalizedMaterialCode(item.itemCode!);
          const existing = existingByCode.get(code);
          if (existing) {
            await transaction.material.update({
              where: { id: existing.id },
              data: {
                boqItemId: item.id,
                code: item.itemCode,
                normalizedCode: code,
                description: item.description,
                unit: item.unit,
                requiredQty: item.quantity,
                status: reconcileMaterialStatus(existing.status, {
                  requiredQty: item.quantity,
                  orderedQty: existing.orderedQty,
                  receivedQty: existing.receivedQty,
                  installedQty: existing.installedQty,
                }),
                isActive: true,
              },
            });
            updatedMaterials += 1;
          } else {
            await transaction.material.create({
              data: {
                projectId: draft.projectId,
                boqItemId: item.id,
                code: item.itemCode,
                normalizedCode: code,
                description: item.description,
                unit: item.unit,
                requiredQty: item.quantity,
              },
            });
            createdMaterials += 1;
          }
        }

        const materialCodes = [...itemCodes];
        const deactivated = await transaction.material.updateMany({
          where: {
            projectId: draft.projectId,
            isActive: true,
            boqItemId: { not: null },
            ...(materialCodes.length
              ? {
                  OR: [
                    { normalizedCode: null },
                    { normalizedCode: { notIn: materialCodes } },
                  ],
                }
              : {}),
          },
          data: { isActive: false },
        });

        const approved = await transaction.boq.updateMany({
          where: { id: draft.id, status: 'DRAFT' },
          data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedById: user.id,
          },
        });
        if (approved.count !== 1) {
          return { outcome: 'baseline-conflict' as const };
        }

        await transaction.auditLog.create({
          data: {
            userId: user.id,
            projectId: draft.projectId,
            action: 'BOQ_APPROVED',
            entityType: 'Boq',
            entityId: draft.id,
            metadata: {
              projectCode: draft.project.code,
              version: draft.version,
              priorApprovedVersion: currentApproved?.version ?? null,
              createdMaterials,
              updatedMaterials,
              deactivatedMaterials: deactivated.count,
            },
          },
        });

        return {
          outcome: 'approved' as const,
          approval: {
            id: draft.id,
            version: draft.version,
            createdMaterials,
            updatedMaterials,
            deactivatedMaterials: deactivated.count,
          },
        };
      },
      { timeout: 20_000 },
    );

    if (outcome.outcome === 'not-found') {
      return {
        status: 'error',
        message: 'BoQ tidak ditemukan atau project sudah tidak aktif.',
      };
    }
    if (outcome.outcome === 'not-draft') {
      return {
        status: 'conflict',
        message: 'Hanya revisi berstatus Draft yang dapat disetujui.',
      };
    }
    if (outcome.outcome === 'baseline-conflict') {
      return {
        status: 'conflict',
        message:
          'Baseline berubah sejak halaman dibuka. Muat ulang sebelum approval.',
      };
    }
    if (outcome.outcome === 'data-conflict') {
      return {
        status: 'conflict',
        message: 'Approval memerlukan rekonsiliasi material.',
        issues: outcome.issues.slice(0, 20),
      };
    }

    revalidatePath('/boq');
    revalidatePath('/materials');
    revalidatePath('/dashboard');
    return {
      status: 'success',
      message: `BoQ versi ${outcome.approval.version} menjadi baseline approved.`,
      approval: outcome.approval,
    };
  } catch {
    return {
      status: 'error',
      message: 'BoQ belum dapat disetujui. Silakan coba lagi.',
    };
  }
}
