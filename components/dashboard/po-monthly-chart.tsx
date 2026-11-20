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
const moneyUnits = (value: string) => BigInt(value.replace('.', ''));
const selectClass =
  'h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';

export function PoMonthlyChart({ data }: { data: MonthlyPoData }) {
  const [year, setYear] = useState(data.currentYear);
  const [mode, setMode] = useState<'count' | 'value'>('count');
  const [selected, setSelected] = useState<number | null>(null);
  const rows = (data.years.find((item) => item.year === year) ?? data.years[0])
    .months;
  const values = rows.flatMap((month) =>
    mode === 'count'
      ? [BigInt(month.incomingCount), BigInt(month.completedCount)]
      : [moneyUnits(month.incomingValue), moneyUnits(month.completedValue)],
  );
  const maximum = values.reduce(
    (max, value) => (value > max ? value : max),
    0n,
  );
  const height = (value: bigint) =>
    maximum === 0n ? 0 : Number((value * 10000n) / maximum) / 100;
  const selectedMonth = selected === null ? null : rows[selected];
  const monthLabel = (month: (typeof rows)[number]) =>
    `${months[month.month - 1]} ${year}. PO Masuk ${month.incomingCount}, ${exactPoMoney(month.incomingValue)}. PO Selesai ${month.completedCount}, ${exactPoMoney(month.completedValue)}.`;

  return (
    <section
      aria-label="Grafik PO bulanan"
      className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 md:px-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Grafik PO bulanan
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            PO Customer masuk dan selesai sepanjang tahun · nilai sebelum PPN
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <label className="grid flex-1 gap-1.5 text-xs font-medium text-slate-600 sm:flex-none">
            Tahun
            <select
              aria-label="Tahun grafik PO"
              value={year}
              onChange={(event) => {
                setYear(Number(event.target.value));
                setSelected(null);
              }}
              className={selectClass}
            >
              {data.years.map((item) => (
                <option key={item.year} value={item.year}>
                  {item.year}
                </option>
              ))}
            </select>
          </label>
          <label className="grid flex-1 gap-1.5 text-xs font-medium text-slate-600 sm:flex-none">
            Tampilkan
            <select
              aria-label="Ukuran grafik PO"
              value={mode}
              onChange={(event) =>
                setMode(event.target.value as 'count' | 'value')
              }
              className={selectClass}
            >
              <option value="count">Jumlah PO</option>
              <option value="value">Nilai PO (Rp)</option>
            </select>
          </label>
        </div>
      </div>

      <div className="p-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-5 font-medium text-slate-700">
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-[#17364a]" />
              PO masuk
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-sm bg-[#15977c]" />
              PO selesai
            </span>
          </div>
          <p className="text-slate-500">
            Puncak bulanan{' '}
            <span className="font-medium text-slate-700">
              {mode === 'count'
                ? `${maximum} PO`
                : exactPoMoney(
                    `${maximum / 100n}.${String(maximum % 100n).padStart(2, '0')}`,
                  )}
            </span>
          </p>
        </div>

        {maximum === 0n && (
          <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {mode === 'count'
              ? 'Belum ada PO bertanggal pada tahun ini.'
              : 'Nilai PO pada tahun ini masih nol.'}
          </p>
        )}

        <div
          role="region"
          aria-label="Grafik PO per bulan, geser untuk melihat semua bulan"
          tabIndex={0}
          className="mt-5 overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-teal-700"
        >
          <div
            className="grid min-w-[660px] grid-cols-12 gap-2 border-b border-slate-200 px-1 pt-7"
            role="group"
            aria-label="Batang bulanan, klik untuk detail"
          >
            {rows.map((month, index) => {
              const incoming =
                mode === 'count'
                  ? BigInt(month.incomingCount)
                  : moneyUnits(month.incomingValue);
              const completed =
                mode === 'count'
                  ? BigInt(month.completedCount)
                  : moneyUnits(month.completedValue);
              return (
                <button
                  type="button"
                  key={month.month}
                  aria-label={monthLabel(month)}
                  title={monthLabel(month)}
                  aria-pressed={selected === index}
                  onClick={() => setSelected(index)}
                  onFocus={() => setSelected(index)}
                  onMouseEnter={() => setSelected(index)}
                  className={`min-w-0 rounded-t-lg px-1 pt-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700 ${selected === index ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex h-44 items-end justify-center gap-1.5">
                    {[incoming, completed].map((value, series) => (
                      <div
                        key={series}
                        className={`relative w-4 rounded-t-sm sm:w-5 ${series === 0 ? 'bg-[#17364a]' : 'bg-[#15977c]'}`}
                        style={{
                          height: `${height(value)}%`,
                          minHeight: value > 0n ? 3 : 0,
                        }}
                      >
                        {mode === 'count' && value > 0n && (
                          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium tabular-nums text-slate-700">
                            {String(value)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <span className="my-3 block text-xs font-medium text-slate-600">
                    {months[month.month - 1]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          className="mt-4 min-h-[88px] rounded-lg border border-slate-100 bg-slate-50 p-4"
        >
          {selectedMonth ? (
            <>
              <p className="text-xs font-semibold text-slate-600">
                {months[selectedMonth.month - 1]} {year}
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-[#17364a]">
                    {selectedMonth.incomingCount} PO masuk
                  </span>
                  <span className="mt-0.5 block break-words font-mono text-xs">
                    {exactPoMoney(selectedMonth.incomingValue)}
                  </span>
                </p>
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-[#15977c]">
                    {selectedMonth.completedCount} PO selesai
                  </span>
                  <span className="mt-0.5 block break-words font-mono text-xs">
                    {exactPoMoney(selectedMonth.completedValue)}
                  </span>
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm leading-6 text-slate-500">
              Sorot atau pilih bulan untuk melihat jumlah dan nominal PO secara
              lengkap.
            </p>
          )}
        </div>

        {(data.missingCompleted > 0 || data.missingIncoming > 0) && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            Pada seluruh tahun, {data.missingIncoming} PO belum memiliki tanggal
            PO dan {data.missingCompleted} PO selesai belum memiliki tanggal
            selesai.{' '}
            <Link
              href="/customer-po"
              className="font-semibold underline underline-offset-2"
            >
              Lengkapi tanggal di PO Customer
            </Link>{' '}
            agar tercatat pada grafik bulanan.
          </p>
        )}

        <details className="mt-4 border-t border-slate-100 pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#17364a]">
            Lihat tabel angka bulanan
          </summary>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[600px] text-left text-xs">
              <caption className="sr-only">
                Rincian jumlah dan nilai PO Customer setiap bulan pada tahun{' '}
                {year}
              </caption>
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {[
                    'Bulan',
                    'Masuk (PO)',
                    'Nilai masuk',
                    'Selesai (PO)',
                    'Nilai selesai',
                  ].map((title) => (
                    <th
                      key={title}
                      scope="col"
                      className="px-3 py-3 font-semibold"
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {rows.map((month) => (
                  <tr key={month.month}>
                    <th scope="row" className="px-3 py-3 font-medium">
                      {months[month.month - 1]}
                    </th>
                    <td className="px-3 py-3 tabular-nums">
                      {month.incomingCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono">
                      {exactPoMoney(month.incomingValue)}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {month.completedCount}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono">
                      {exactPoMoney(month.completedValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            PO masuk mengikuti tanggal PO Customer. PO selesai mengikuti tanggal
            selesai PO. Grafik menggunakan status dan nilai PO terbaru, termasuk
            koreksi atau pembukaan kembali PO. Draft, Cancelled, dan PO tanpa
            nomor dikecualikan ({data.excluded} proyek).
          </p>
        </details>
      </div>
    </section>
  );
}
