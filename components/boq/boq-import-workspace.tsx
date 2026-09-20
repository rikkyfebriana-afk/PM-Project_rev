'use client';

import {
  type ChangeEvent,
  type DragEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  History,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  TableProperties,
  UploadCloud,
  X,
} from 'lucide-react';

import type {
  BoqApprovalActionState,
  BoqApprovalPayload,
  BoqImportCommitRequest,
  BoqImportActionState,
  BoqWorkspaceData,
} from '@/lib/boq/types';
import {
  BOQ_MAX_FILE_SIZE,
  MAX_BOQ_IMPORT_ROWS as BOQ_MAX_IMPORT_ROWS,
} from '@/lib/boq/types';
import type {
  BoqImportIssue,
  BoqImportPreviewRow,
  BoqParsedWorkbook,
} from '@/lib/boq/import-types';
import { parseBoqFile } from '@/lib/boq/parser';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';

type BoqSummary = {
  id: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  version: number;
  status: 'DRAFT' | 'APPROVED' | 'SUPERSEDED';
  sourceFileName: string | null;
  sourceSheetName: string | null;
  itemCount: number;
  totalValue: string;
  createdAt: string;
  approvedAt: string | null;
  approvedByName: string | null;
};

type BoqImportWorkspaceProps = {
  data: BoqWorkspaceData;
  commitAction: (input: BoqImportCommitRequest) => Promise<BoqImportActionState>;
  approveAction: (input: BoqApprovalPayload) => Promise<BoqApprovalActionState>;
};

const moneyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('id-ID');

function formatMoney(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? moneyFormatter.format(number) : 'Rp0';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusStyle(status: BoqSummary['status']) {
  return {
    DRAFT: 'border-[#c9d5db] bg-[#f3f6f7] text-[#506875]',
    APPROVED: 'border-[#b9dfd4] bg-[#edf8f4] text-[#17765f]',
    SUPERSEDED: 'border-[#e5d9cc] bg-[#faf5ef] text-[#88715e]',
  }[status];
}

function statusLabel(status: BoqSummary['status']) {
  return {
    DRAFT: 'Draft',
    APPROVED: 'Approved',
    SUPERSEDED: 'Superseded',
  }[status];
}

function RowStatus({ row }: { row: BoqImportPreviewRow }) {
  const hasError = row.issues.some((issue) => issue.severity === 'error');
  const hasWarning = row.issues.some((issue) => issue.severity === 'warning');
  if (hasError) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#c44735]">
        <X className="size-3.5" /> Perlu diperbaiki
      </span>
    );
  }
  if (hasWarning) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#a96d15]">
        <AlertCircle className="size-3.5" /> Periksa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#17765f]">
      <Check className="size-3.5" /> Valid
    </span>
  );
}

function IssueList({ issues }: { issues: BoqImportIssue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-xs leading-5">
      {issues.slice(0, 3).map((issue, index) => (
        <li
          key={`${issue.code}-${issue.field ?? 'file'}-${index}`}
          className={
            issue.severity === 'error' ? 'text-[#b94333]' : 'text-[#976116]'
          }
        >
          {issue.message}
        </li>
      ))}
      {issues.length > 3 && (
        <li className="text-[#74838c]">+{issues.length - 3} temuan lain</li>
      )}
    </ul>
  );
}

export function BoqImportWorkspace({
  data,
  commitAction,
  approveAction,
}: BoqImportWorkspaceProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstEditableProject = data.projects.find((project) => project.canEdit);
  const [projectId, setProjectId] = useState(
    firstEditableProject?.id ?? data.projects[0]?.id ?? '',
  );
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<BoqParsedWorkbook | null>(null);
  const [parseError, setParseError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [commitResult, setCommitResult] = useState<BoqImportActionState | null>(
    null,
  );
  const [approvalTarget, setApprovalTarget] = useState<BoqSummary | null>(null);
  const [approvalResult, setApprovalResult] =
    useState<BoqApprovalActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  const project = data.projects.find((item) => item.id === projectId) ?? null;
  const revisions = useMemo(
    () => data.boqs.filter((boq) => boq.projectId === projectId),
    [data.boqs, projectId],
  );
  const hasGlobalError = parsed?.issues.some(
    (issue) => issue.severity === 'error',
  );
  const canCommit = Boolean(
    parsed &&
    project?.canEdit &&
    !data.demoMode &&
    !hasGlobalError &&
    parsed.errorRowCount === 0 &&
    parsed.validRowCount > 0 &&
    !isPending,
  );

  async function readFile(nextFile: File, sheetName?: string) {
    setFile(nextFile);
    setIsParsing(true);
    setParseError('');
    setCommitResult(null);
    try {
      setParsed(await parseBoqFile(nextFile, sheetName));
    } catch (error) {
      setParsed(null);
      setParseError(
        error instanceof Error
          ? `File tidak dapat dibaca: ${error.message}`
          : 'File tidak dapat dibaca. Pastikan workbook tidak rusak atau dilindungi password.',
      );
    } finally {
      setIsParsing(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];
    if (nextFile) void readFile(nextFile);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile) void readFile(nextFile);
  }

  function clearFile() {
    setFile(null);
    setParsed(null);
    setParseError('');
    setCommitResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function downloadTemplate() {
    const anchor = document.createElement('a');
    anchor.href = '/templates/boq-import-template.xlsx';
    anchor.download = 'boq-import-template.xlsx';
    anchor.click();
  }

  function commitImport() {
    if (!canCommit || !parsed || !project || !file) return;
    const selectedFile = file;
    const selectedProjectId = project.id;
    const selectedSheetName = parsed.sheetName;
    startTransition(async () => {
      try {
        const extension = selectedFile.name.toLocaleLowerCase('en-US');
        const mimeType = extension.endsWith('.xlsx')
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv';
        const uploadFile = new File([selectedFile], selectedFile.name, {
          type: mimeType,
        });
        const intentResponse = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            projectId: selectedProjectId,
            category: 'BOQ',
            fileName: uploadFile.name,
            mimeType,
            sizeBytes: uploadFile.size,
          }),
        });
        const intent = (await intentResponse.json()) as {
          error?: string;
          document?: { id: string };
          upload?: { signedUrl: string };
        };
        if (!intentResponse.ok || !intent.document || !intent.upload) {
          throw new Error(intent.error || 'Izin upload tidak dapat dibuat.');
        }

        const uploadForm = new FormData();
        uploadForm.append('cacheControl', '3600');
        uploadForm.append('', uploadFile);
        const storageResponse = await fetch(intent.upload.signedUrl, {
          method: 'PUT',
          body: uploadForm,
          headers: { 'x-upsert': 'false' },
        });
        if (!storageResponse.ok) {
          throw new Error('Upload file asli ke private storage gagal.');
        }

        const completeResponse = await fetch(
          `/api/documents/${encodeURIComponent(intent.document.id)}/complete`,
          { method: 'POST' },
        );
        const completed = (await completeResponse.json()) as { error?: string };
        if (!completeResponse.ok) {
          throw new Error(
            completed.error || 'Verifikasi file di private storage gagal.',
          );
        }

        const result = await commitAction({
          projectId: selectedProjectId,
          documentId: intent.document.id,
          sheetName: selectedSheetName,
        });
        setCommitResult(result);
        if (result.status === 'success') router.refresh();
      } catch (error) {
        setCommitResult({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Import gagal. Periksa koneksi dan coba lagi.',
        });
      } finally {
        setConfirmOpen(false);
      }
    });
  }

  function approveRevision() {
    if (!approvalTarget || isPending) return;
    const expectedApprovedBoqId =
      data.boqs.find(
        (boq) =>
          boq.projectId === approvalTarget.projectId &&
          boq.status === 'APPROVED',
      )?.id ?? null;

    startTransition(async () => {
      const result = await approveAction({
        boqId: approvalTarget.id,
        expectedApprovedBoqId,
      });
      setApprovalResult(result);
      setApprovalTarget(null);
      if (result.status === 'success') router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 pb-24 md:p-7 lg:pb-9 xl:p-9">
      <section className="border border-[#dce2e6] bg-white p-5 md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="section-kicker text-[#d85832]!">Cost baseline</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-[#172d3e] md:text-3xl">
              Bill of Quantities
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#6e7e88]">
              Impor BoQ dari Excel, periksa pemetaan kolom dan nilai setiap
              item, lalu simpan sebagai revisi baru dengan jejak audit.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={downloadTemplate}
            className="h-10 rounded-none border-[#d7e0e4] px-4"
          >
            <Download /> Template Excel
          </Button>
        </div>
        {data.demoMode && (
          <div className="mt-5 flex items-start gap-3 border border-[#ecd6b1] bg-[#fff9ee] px-4 py-3 text-xs leading-5 text-[#8e6224]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" /> Mode demo
            bersifat read-only. Preview file tetap dapat digunakan, tetapi
            revisi tidak dapat disimpan.
          </div>
        )}
      </section>

      <section className="grid overflow-hidden border border-[#dce2e6] bg-white sm:grid-cols-3">
        {[
          {
            label: 'BoQ revisions',
            value: numberFormatter.format(data.metrics.versions),
            note: `${numberFormatter.format(data.metrics.approved)} approved · ${numberFormatter.format(data.metrics.drafts)} draft`,
            accent: 'bg-[#17364a]',
          },
          {
            label: 'Controlled items',
            value: numberFormatter.format(data.metrics.items),
            note: 'Item pada baseline approved',
            accent: 'bg-[#1c9377]',
          },
          {
            label: 'Portfolio value',
            value: formatMoney(data.metrics.totalValue),
            note: 'Total baseline approved',
            accent: 'bg-[#d85832]',
          },
        ].map((metric, index) => (
          <article
            key={metric.label}
            className={`relative min-h-32 p-5 ${index ? 'sm:border-l sm:border-[#e5e9ec]' : ''}`}
          >
            <span
              className={`absolute inset-y-0 left-0 w-1 ${metric.accent}`}
            />
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#7d8b95]">
              {metric.label}
            </p>
            <p className="mt-4 font-mono text-2xl font-semibold tracking-[-0.05em] text-[#17364a] md:text-3xl">
              {metric.value}
            </p>
            <p className="mt-2 text-[11px] text-[#88949c]">{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <article className="border border-[#dce2e6] bg-white">
            <div className="border-b border-[#e5e9ec] p-5 md:p-6">
              <p className="section-kicker">New revision</p>
              <h3 className="section-title">1. Pilih proyek dan file sumber</h3>
            </div>
            <div className="grid gap-5 p-5 md:p-6">
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#5f707b]">
                Project
                <NativeSelect
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setCommitResult(null);
                  }}
                  className="w-full"
                  disabled={!data.projects.length}
                >
                  {!data.projects.length && (
                    <NativeSelectOption value="">
                      Tidak ada project
                    </NativeSelectOption>
                  )}
                  {data.projects.map((option) => (
                    <NativeSelectOption key={option.id} value={option.id}>
                      {option.code} — {option.name}
                      {!option.canEdit ? ' (read-only)' : ''}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>

              {project && !project.canEdit && (
                <div className="flex items-start gap-2 border border-[#d9e0e4] bg-[#f5f7f8] px-4 py-3 text-xs leading-5 text-[#62737e]">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0" /> Anda dapat
                  melihat riwayat proyek ini, tetapi hanya Admin atau Project
                  Manager resmi yang dapat mengimpor revisi.
                </div>
              )}

              <label
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDrop}
                className={`group grid min-h-48 cursor-pointer place-items-center border border-dashed p-6 text-center transition-colors focus-within:ring-2 focus-within:ring-[#183b4f]/30 ${
                  isDragging
                    ? 'border-[#d85832] bg-[#fff5f1]'
                    : 'border-[#b9c6cd] bg-[#f8fafb] hover:border-[#79909c] hover:bg-[#f3f7f8]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={onFileChange}
                  className="sr-only"
                />
                {isParsing ? (
                  <div>
                    <LoaderCircle className="mx-auto size-8 animate-spin text-[#d85832]" />
                    <p className="mt-4 text-sm font-semibold text-[#243c4b]">
                      Membaca workbook…
                    </p>
                    <p className="mt-1 text-xs text-[#7b8992]">
                      Kolom dan nilai sedang divalidasi di browser Anda.
                    </p>
                  </div>
                ) : file ? (
                  <div className="w-full max-w-lg">
                    <FileSpreadsheet className="mx-auto size-8 text-[#1c9377]" />
                    <p className="mt-4 break-all text-sm font-semibold text-[#243c4b]">
                      {file.name}
                    </p>
                    <p className="mt-1 text-xs text-[#7b8992]">
                      {formatFileSize(file.size)} · Klik atau jatuhkan file lain
                      untuk mengganti
                    </p>
                  </div>
                ) : (
                  <div>
                    <UploadCloud className="mx-auto size-8 text-[#365d72]" />
                    <p className="mt-4 text-sm font-semibold text-[#243c4b]">
                      Jatuhkan file BoQ di sini
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#7b8992]">
                      atau klik untuk memilih .xlsx atau .csv · maksimum{' '}
                      {formatFileSize(BOQ_MAX_FILE_SIZE)}
                    </p>
                  </div>
                )}
              </label>

              {(file || parseError) && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[#7b8992]">
                    Maksimum {numberFormatter.format(BOQ_MAX_IMPORT_ROWS)} item
                    per revisi.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={clearFile}
                    className="rounded-none text-[#526875]"
                  >
                    <RefreshCw /> Reset file
                  </Button>
                </div>
              )}

              {parseError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 border border-[#efc4bd] bg-[#fff1ee] px-4 py-3 text-xs leading-5 text-[#b94333]"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />{' '}
                  {parseError}
                </div>
              )}
            </div>
          </article>

          {parsed && (
            <article className="border border-[#dce2e6] bg-white">
              <div className="flex flex-col gap-4 border-b border-[#e5e9ec] p-5 md:flex-row md:items-end md:justify-between md:p-6">
                <div>
                  <p className="section-kicker">Validation preview</p>
                  <h3 className="section-title">2. Periksa hasil import</h3>
                </div>
                {parsed.sheetNames.length > 1 && (
                  <label className="grid gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#71808a]">
                    Sheet
                    <NativeSelect
                      value={parsed.sheetName}
                      onChange={(event) => {
                        if (file) void readFile(file, event.target.value);
                      }}
                      className="min-w-48"
                    >
                      {parsed.sheetNames.map((sheetName) => (
                        <NativeSelectOption key={sheetName} value={sheetName}>
                          {sheetName}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                )}
              </div>

              <div className="grid border-b border-[#e5e9ec] sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: 'Valid items',
                    value: parsed.validRowCount,
                    tone: 'text-[#17765f]',
                  },
                  {
                    label: 'Rows with errors',
                    value: parsed.errorRowCount,
                    tone: parsed.errorRowCount
                      ? 'text-[#c44735]'
                      : 'text-[#17364a]',
                  },
                  {
                    label: 'Rows with warnings',
                    value: parsed.warningRowCount,
                    tone: parsed.warningRowCount
                      ? 'text-[#a96d15]'
                      : 'text-[#17364a]',
                  },
                  {
                    label: 'Valid total',
                    value: formatMoney(parsed.totalValue),
                    tone: 'text-[#17364a]',
                  },
                ].map((metric, index) => (
                  <div
                    key={metric.label}
                    className={`p-4 ${index ? 'lg:border-l lg:border-[#e5e9ec]' : ''}`}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#839099]">
                      {metric.label}
                    </p>
                    <p
                      className={`mt-2 font-mono text-xl font-semibold ${metric.tone}`}
                    >
                      {typeof metric.value === 'number'
                        ? numberFormatter.format(metric.value)
                        : metric.value}
                    </p>
                  </div>
                ))}
              </div>

              {parsed.issues.length > 0 && (
                <div className="border-b border-[#e5e9ec] p-5 md:p-6">
                  <div
                    role="alert"
                    className="border border-[#efc4bd] bg-[#fff1ee] px-4 py-3"
                  >
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#b94333]">
                      <AlertCircle className="size-4" /> File belum dapat
                      disimpan
                    </p>
                    <IssueList issues={parsed.issues} />
                  </div>
                </div>
              )}

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1020px] border-collapse text-left">
                  <thead className="bg-[#f4f7f8] text-[9px] font-bold uppercase tracking-[0.11em] text-[#71818b]">
                    <tr>
                      <th className="w-16 px-4 py-3">Row</th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3 text-right">Quantity</th>
                      <th className="px-4 py-3 text-right">Unit price</th>
                      <th className="px-4 py-3 text-right">Line total</th>
                      <th className="w-40 px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf0f2] text-xs text-[#435966]">
                    {parsed.rows.slice(0, 100).map((row) => (
                      <tr
                        key={`${row.sourceRow}-${row.itemNo}`}
                        className={
                          row.issues.some((issue) => issue.severity === 'error')
                            ? 'bg-[#fff9f7]'
                            : undefined
                        }
                      >
                        <td className="px-4 py-4 font-mono text-[#88969e]">
                          {row.sourceRow}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold text-[#263f4e]">
                            {row.itemNo || '—'}
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-[#87949c]">
                            {row.itemCode || 'No code'}
                          </p>
                        </td>
                        <td className="px-4 py-4 align-top">
                          <span className="border border-[#d6e0e4] bg-[#f5f8f9] px-2 py-1 text-[9px] font-bold tracking-[0.07em] text-[#526875]">
                            {row.itemType}
                          </span>
                        </td>
                        <td className="max-w-xs px-4 py-4 align-top">
                          <p className="leading-5">{row.description || '—'}</p>
                          <IssueList issues={row.issues} />
                        </td>
                        <td className="px-4 py-4 font-mono">
                          {row.unit || '—'}
                        </td>
                        <td className="px-4 py-4 text-right font-mono">
                          {row.quantity || '—'}
                        </td>
                        <td className="px-4 py-4 text-right font-mono">
                          {row.unitPrice ? formatMoney(row.unitPrice) : '—'}
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-semibold text-[#263f4e]">
                          {formatMoney(row.lineTotal)}
                        </td>
                        <td className="px-4 py-4 align-top">
                          <RowStatus row={row} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-[#edf0f2] md:hidden">
                {parsed.rows.slice(0, 100).map((row) => (
                  <div key={`${row.sourceRow}-${row.itemNo}`} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold text-[#263f4e]">
                          {row.itemNo || 'Item tanpa nomor'}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-[#87949c]">
                          Row {row.sourceRow} · {row.itemType} ·{' '}
                          {row.itemCode || 'No code'}
                        </p>
                      </div>
                      <RowStatus row={row} />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[#536873]">
                      {row.description || 'Description kosong'}
                    </p>
                    <div className="mt-4 grid grid-cols-3 gap-3 bg-[#f6f8f9] p-3 text-[10px]">
                      <div>
                        <p className="uppercase tracking-[0.08em] text-[#85929a]">
                          Qty
                        </p>
                        <p className="mt-1 font-mono font-semibold text-[#2f4654]">
                          {row.quantity || '—'} {row.unit}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.08em] text-[#85929a]">
                          Price
                        </p>
                        <p className="mt-1 font-mono font-semibold text-[#2f4654]">
                          {row.unitPrice ? formatMoney(row.unitPrice) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.08em] text-[#85929a]">
                          Total
                        </p>
                        <p className="mt-1 font-mono font-semibold text-[#2f4654]">
                          {formatMoney(row.lineTotal)}
                        </p>
                      </div>
                    </div>
                    <IssueList issues={row.issues} />
                  </div>
                ))}
              </div>

              {parsed.rows.length > 100 && (
                <p className="border-t border-[#e5e9ec] bg-[#f8fafb] px-5 py-3 text-center text-xs text-[#74838c]">
                  Preview menampilkan 100 dari{' '}
                  {numberFormatter.format(parsed.rows.length)} item. Seluruh
                  item tetap divalidasi sebelum disimpan.
                </p>
              )}

              <div className="flex flex-col gap-4 border-t border-[#e5e9ec] bg-[#f8fafb] p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
                <div>
                  <p className="text-sm font-semibold text-[#263f4e]">
                    {canCommit
                      ? 'Semua baris siap disimpan sebagai revisi baru.'
                      : 'Selesaikan seluruh error sebelum menyimpan.'}
                  </p>
                  <p className="mt-1 text-xs text-[#7b8992]">
                    Nilai total dihitung ulang oleh server saat commit.
                  </p>
                </div>
                <Button
                  type="button"
                  disabled={!canCommit}
                  onClick={() => setConfirmOpen(true)}
                  className="h-10 rounded-none bg-[#d85832] px-5 text-white hover:bg-[#bd4727]"
                >
                  {isPending ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <TableProperties />
                  )}
                  Save revision
                </Button>
              </div>
            </article>
          )}

          {commitResult && (
            <div
              role="status"
              className={`flex items-start gap-3 border px-5 py-4 text-sm leading-6 ${
                commitResult.status === 'success'
                  ? 'border-[#b9dfd4] bg-[#edf8f4] text-[#17765f]'
                  : commitResult.status === 'duplicate'
                    ? 'border-[#efd7a8] bg-[#fff8e9] text-[#8f621f]'
                    : 'border-[#efc4bd] bg-[#fff1ee] text-[#b94333]'
              }`}
            >
              {commitResult.status === 'success' ? (
                <CheckCircle2 className="mt-1 size-5 shrink-0" />
              ) : (
                <AlertCircle className="mt-1 size-5 shrink-0" />
              )}
              <div>
                <p className="font-semibold">{commitResult.message}</p>
                {commitResult.status !== 'error' && (
                  <p className="mt-1 text-xs opacity-80">
                    Revision {commitResult.boq.version} ·{' '}
                    {numberFormatter.format(commitResult.boq.itemCount)} item ·{' '}
                    {formatMoney(commitResult.boq.totalValue)}
                  </p>
                )}
                {commitResult.status === 'error' &&
                commitResult.issues?.length ? (
                  <ul className="mt-2 space-y-1 text-xs">
                    {commitResult.issues.slice(0, 5).map((issue, index) => (
                      <li key={`${issue.row}-${issue.field}-${index}`}>
                        Item {issue.row}: {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}

          {approvalResult && (
            <div
              role="status"
              className={`flex items-start gap-3 border px-5 py-4 text-sm leading-6 ${
                approvalResult.status === 'success'
                  ? 'border-[#b9dfd4] bg-[#edf8f4] text-[#17765f]'
                  : 'border-[#efc4bd] bg-[#fff1ee] text-[#b94333]'
              }`}
            >
              {approvalResult.status === 'success' ? (
                <CheckCircle2 className="mt-1 size-5 shrink-0" />
              ) : (
                <AlertCircle className="mt-1 size-5 shrink-0" />
              )}
              <div>
                <p className="font-semibold">{approvalResult.message}</p>
                {approvalResult.status === 'success' ? (
                  <p className="mt-1 text-xs opacity-80">
                    {approvalResult.approval.createdMaterials} material baru ·{' '}
                    {approvalResult.approval.updatedMaterials} diperbarui ·{' '}
                    {approvalResult.approval.deactivatedMaterials} dinonaktifkan
                  </p>
                ) : approvalResult.issues?.length ? (
                  <ul className="mt-2 space-y-1 text-xs">
                    {approvalResult.issues.slice(0, 5).map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <section className="border border-[#dce2e6] bg-[#153044] p-5 text-white md:p-6">
            <FileSpreadsheet className="size-6 text-[#63d0af]" />
            <h3 className="mt-5 text-lg font-semibold">Format yang dikenali</h3>
            <div className="mt-5 space-y-3 text-xs leading-5 text-white/65">
              {[
                ['Item No', 'wajib dan unik'],
                ['Item Type', 'MATERIAL / SERVICE / OTHER'],
                ['Item Code', 'wajib untuk MATERIAL'],
                ['Description', 'wajib'],
                ['Unit / UOM', 'wajib'],
                ['Quantity', 'angka positif, maks. 4 desimal'],
                ['Unit Price', 'angka, maks. 2 desimal'],
              ].map(([label, note]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-3 border-b border-white/10 pb-2"
                >
                  <span className="font-semibold text-white/90">{label}</span>
                  <span className="text-right">{note}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-[11px] leading-5 text-white/45">
              Baris judul sebelum header diperbolehkan. Sistem mencari header
              pada 30 baris pertama dan memilih sheet dengan kecocokan terbaik.
            </p>
          </section>

          <section className="border border-[#dce2e6] bg-white">
            <div className="border-b border-[#e5e9ec] p-5">
              <div className="flex items-center gap-2">
                <History className="size-4 text-[#526b79]" />
                <p className="section-kicker">Revision history</p>
              </div>
              <h3 className="section-title">
                {project
                  ? `${project.code} · ${project.name}`
                  : 'Pilih project'}
              </h3>
              <p className="mt-2 text-[11px] text-[#8a979f]">
                Baseline aktif dan 100 revisi terdahulu terbaru di portofolio.
              </p>
            </div>
            {revisions.length ? (
              <div className="divide-y divide-[#edf0f2]">
                {revisions.map((revision) => (
                  <article key={revision.id} className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-sm font-semibold text-[#263f4e]">
                        Revision {revision.version}
                      </p>
                      <span
                        className={`border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${statusStyle(revision.status)}`}
                      >
                        {statusLabel(revision.status)}
                      </span>
                    </div>
                    <p className="mt-3 truncate text-xs text-[#677985]">
                      {revision.sourceFileName || 'Imported BoQ'}
                      {revision.sourceSheetName
                        ? ` · ${revision.sourceSheetName}`
                        : ''}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-[#86939b]">
                      <span>
                        {numberFormatter.format(revision.itemCount)} item
                      </span>
                      <span>{formatMoney(revision.totalValue)}</span>
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-[10px] text-[#95a0a7]">
                      <Clock3 className="size-3" />{' '}
                      {formatDate(revision.createdAt)}
                    </p>
                    {revision.approvedAt && (
                      <p className="mt-2 text-[10px] leading-4 text-[#71818b]">
                        Approved {formatDate(revision.approvedAt)}
                        {revision.approvedByName
                          ? ` oleh ${revision.approvedByName}`
                          : ''}
                      </p>
                    )}
                    {data.canApprove &&
                      !data.demoMode &&
                      revision.status === 'DRAFT' && (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => {
                            setApprovalResult(null);
                            setApprovalTarget(revision);
                          }}
                          className="mt-4 h-9 w-full rounded-none border-[#b9dfd4] bg-[#edf8f4] text-[#17765f] hover:bg-[#dff2eb]"
                        >
                          <CheckCircle2 /> Approve baseline
                        </Button>
                      )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center">
                <Clock3 className="mx-auto size-6 text-[#a0abb1]" />
                <p className="mt-3 text-sm font-semibold text-[#526875]">
                  Belum ada revisi
                </p>
                <p className="mt-1 text-xs leading-5 text-[#8a969e]">
                  Revisi pertama akan tampil setelah file valid disimpan.
                </p>
              </div>
            )}
          </section>
        </aside>
      </section>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogMedia className="rounded-none bg-[#fff0eb] text-[#d85832]">
              <TableProperties />
            </AlertDialogMedia>
            <AlertDialogTitle>Simpan revisi BoQ baru?</AlertDialogTitle>
            <AlertDialogDescription>
              {project && parsed
                ? `${numberFormatter.format(parsed.validRowCount)} item dari ${parsed.fileName} akan disimpan ke ${project.code}. File yang sama tidak akan membuat revisi duplikat.`
                : 'Periksa kembali project dan file sumber sebelum melanjutkan.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-3 border-y border-[#e4e9ec] py-4 text-xs">
            <div>
              <p className="uppercase tracking-[0.08em] text-[#87949c]">
                Valid total
              </p>
              <p className="mt-1 font-mono font-semibold text-[#263f4e]">
                {formatMoney(parsed?.totalValue ?? '0')}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-[0.08em] text-[#87949c]">
                Sheet
              </p>
              <p className="mt-1 truncate font-semibold text-[#263f4e]">
                {parsed?.sheetName ?? '—'}
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={commitImport}
              disabled={!canCommit}
              className="bg-[#d85832] text-white hover:bg-[#bd4727]"
            >
              {isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Check />
              )}
              Confirm import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(approvalTarget)}
        onOpenChange={(open) => {
          if (!open && !isPending) setApprovalTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogMedia className="rounded-none bg-[#e9f6f1] text-[#17765f]">
              <CheckCircle2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Approve baseline BoQ?</AlertDialogTitle>
            <AlertDialogDescription>
              {approvalTarget
                ? `Revision ${approvalTarget.version} untuk ${approvalTarget.projectCode} akan menjadi baseline resmi. Baseline lama menjadi superseded dan Material Register disinkronkan.`
                : 'Pilih revisi draft yang akan disetujui.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="border-y border-[#e4e9ec] py-4 text-xs leading-5 text-[#667985]">
            Data supplier, PO, ordered, received, installed, dan ETA yang sudah
            tercatat tetap dipertahankan. Konflik kuantitas atau perubahan
            satuan akan menghentikan approval.
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={approveRevision}
              disabled={!approvalTarget || isPending}
              className="bg-[#17765f] text-white hover:bg-[#115f4c]"
            >
              {isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <CheckCircle2 />
              )}
              Approve & sync materials
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
