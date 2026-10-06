'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { MonthlyPoData } from '@/lib/dashboard/po-monthly';
import { exactPoMoney } from '@/lib/finance/po-summary';
const months = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];
export function PoMonthlyChart({ data }: { data: MonthlyPoData }) {
  const [year, setYear] = useState(data.currentYear);
  const [mode, setMode] = useState<'count' | 'value'>('count');
  const [selected, setSelected] = useState<number | null>(null);
  const rows = (data.years.find((y) => y.year === year) ?? data.years[0])
    .months;
  const units = (value: string) => BigInt(value.replace('.', ''));
  const values = rows.flatMap((m) =>
    mode === 'count'
      ? [BigInt(m.incomingCount), BigInt(m.completedCount)]
      : [units(m.incomingValue), units(m.completedValue)],
  );
  const maximum = values.reduce((max, n) => (n > max ? n : max), 0n);
  const height = (n: bigint) =>
    maximum === 0n ? 0 : Number((n * 10000n) / maximum) / 100;
  const row = selected === null ? null : rows[selected];
  const label = (m: (typeof rows)[number]) =>
    `${months[m.month - 1]} ${year}: PO Masuk ${m.incomingCount}, ${exactPoMoney(m.incomingValue)}; PO Selesai ${m.completedCount}, ${exactPoMoney(m.completedValue)}`;
  return (
    <section
      className="min-w-0 border border-[#dde3e7] bg-white p-5 md:p-6"
      aria-label="Grafik PO bulanan"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-kicker">PO Customer · Tren bulanan</p>
          <h2 className="mt-2 text-lg font-semibold">
            PO Masuk &amp; PO Selesai per Bulan
          </h2>
          <p className="mt-2 text-xs text-slate-500">
            Seluruh proyek sesuai hak akses, termasuk proyek selesai. Nilai PO
            tanpa PPN.
          </p>
        </div>
        <div className="flex gap-3">
          <label className="text-xs">
            Tahun
            <select
              aria-label="Tahun grafik PO"
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setSelected(null);
              }}
              className="ml-2 border bg-white p-2"
            >
              {data.years.map((y) => (
                <option key={y.year} value={y.year}>
                  {y.year}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Tampilkan
            <select
              aria-label="Ukuran grafik PO"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'count' | 'value')}
              className="ml-2 border bg-white p-2"
            >
              <option value="count">Jumlah PO</option>
              <option value="value">Nilai PO (Rp)</option>
            </select>
          </label>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-5 text-xs">
        <span>
          <span className="mr-2 inline-block size-3 bg-sky-600" />
          PO Masuk
        </span>
        <span>
          <span className="mr-2 inline-block size-3 bg-teal-600" />
          PO Selesai
        </span>
        <span className="text-slate-500">
          {mode === 'count'
            ? 'Satuan: jumlah PO'
            : 'Skala relatif nilai rupiah; nominal lengkap tersedia di detail'}
        </span>
      </div>
      {maximum === 0n && (
        <p className="mt-4 text-sm text-slate-500">
          {mode === 'count'
            ? 'Belum ada PO bertanggal pada tahun ini.'
            : 'Nilai PO pada tahun ini masih nol.'}
        </p>
      )}
      <div className="mt-4 overflow-x-auto">
        <div
          className="grid min-w-[660px] grid-cols-12 gap-3 border-b border-slate-200 pt-4"
          role="group"
          aria-label="Batang bulanan, klik untuk detail"
        >
          {rows.map((m, i) => {
            const a =
                mode === 'count'
                  ? BigInt(m.incomingCount)
                  : units(m.incomingValue),
              b =
                mode === 'count'
                  ? BigInt(m.completedCount)
                  : units(m.completedValue);
            return (
              <button
                type="button"
                key={m.month}
                aria-label={label(m)}
                title={label(m)}
                onClick={() => setSelected(i)}
                onFocus={() => setSelected(i)}
                onMouseEnter={() => setSelected(i)}
                className={`min-w-0 rounded-t px-1 pt-2 focus-visible:outline-2 focus-visible:outline-sky-700 ${selected === i ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <div className="flex h-44 items-end justify-center gap-1">
                  {[a, b].map((v, j) => (
                    <div
                      key={j}
                      className={`relative w-5 rounded-t ${j === 0 ? 'bg-sky-600' : 'bg-teal-600'}`}
                      style={{
                        height: `${height(v)}%`,
                        minHeight: v > 0n ? 2 : 0,
                      }}
                    >
                      {mode === 'count' && v > 0n && (
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-slate-600">
                          {String(v)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <span className="my-3 block text-xs text-slate-600">
                  {months[i]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mt-4 min-h-8 text-sm" role="status">
        {row
          ? label(row)
          : 'Sorot atau klik bulan untuk melihat jumlah dan nominal PO.'}
      </p>
      {(data.missingCompleted > 0 || data.missingIncoming > 0) && (
        <p className="mt-3 border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          Data belum lengkap (semua tahun): {data.missingIncoming} PO tanpa
          tanggal PO; {data.missingCompleted} PO Selesai tanpa tanggal selesai.
          Belum dimasukkan ke seri bulan terkait.{' '}
          <Link href="/customer-po" className="underline">
            Lengkapi di PO Customer
          </Link>
          .
        </p>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Lihat tabel angka bulanan
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-xs">
            <thead>
              <tr>
                {[
                  'Bulan',
                  'Masuk (PO)',
                  'Nilai masuk',
                  'Selesai (PO)',
                  'Nilai selesai',
                ].map((t) => (
                  <th key={t} className="border-b p-2">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.month}>
                  <th className="border-b p-2">{months[m.month - 1]}</th>
                  <td className="border-b p-2">{m.incomingCount}</td>
                  <td className="border-b p-2">
                    {exactPoMoney(m.incomingValue)}
                  </td>
                  <td className="border-b p-2">{m.completedCount}</td>
                  <td className="border-b p-2">
                    {exactPoMoney(m.completedValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        Masuk memakai tanggal pada PO Customer; Selesai memakai tanggal selesai
        PO. Satu PO dihitung satu kali pada masing-masing seri, bukan
        dijumlahkan sebagai PO baru. Draft, Cancelled, dan PO tanpa nomor
        dikecualikan ({data.excluded} proyek). Grafik memakai status dan nilai
        PO terbaru; koreksi atau pembukaan kembali PO akan memperbarui grafik.
        Bukan grafik pembayaran.
      </p>
    </section>
  );
}
