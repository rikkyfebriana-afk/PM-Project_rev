'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buttonClass, inputClass } from './workspace-ui';

export function DocumentUpload({
  projectId,
  milestoneId,
  category,
}: {
  projectId: string;
  milestoneId: string;
  category: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function upload() {
    const source = ref.current?.files?.[0];
    if (!source) {
      setMessage('Pilih file pendukung terlebih dahulu.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const mime =
        source.type ||
        (source.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          milestoneId,
          category,
          fileName: source.name,
          mimeType: mime,
          sizeBytes: source.size,
        }),
      });
      const intent = await response.json();
      if (!response.ok)
        throw new Error(intent.error ?? 'Upload belum tersedia.');
      const body = new FormData();
      body.append('cacheControl', '3600');
      body.append('', source);
      const stored = await fetch(intent.upload.signedUrl, {
        method: 'PUT',
        headers: { 'x-upsert': 'false' },
        body,
      });
      if (!stored.ok) throw new Error('Upload ke penyimpanan gagal.');
      const completed = await fetch(
        `/api/documents/${encodeURIComponent(intent.document.id)}/complete`,
        { method: 'POST' },
      );
      const result = await completed.json();
      if (!completed.ok)
        throw new Error(result.error ?? 'Verifikasi file gagal.');
      setMessage('Dokumen tersimpan.');
      if (ref.current) ref.current.value = '';
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload gagal.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
      <label className="block text-xs font-semibold text-slate-600">
        Dokumen pendukung ({category})
        <input
          ref={ref}
          className={`${inputClass} mt-2`}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          disabled={busy}
        />
      </label>
      <button
        type="button"
        className={buttonClass}
        disabled={busy}
        onClick={upload}
      >
        {busy ? 'Mengunggah…' : 'Unggah dokumen'}
      </button>
      {message && (
        <p role="status" className="text-sm text-slate-600">
          {message}
        </p>
      )}
    </div>
  );
}
