'use client';
import { Fragment, useState } from 'react';
import type { TimePlanData } from '@/lib/time-plan/queries';
import { phaseLabels, taskStatus } from '@/lib/time-plan/model';
import {
  barPosition,
  calendarDays,
  calendarGroups,
  dateAt,
  dayNumber,
  monday,
  validDate,
} from '@/lib/time-plan/calendar';
import { inputClass } from './workspace-ui';

type Project = TimePlanData['projects'][number];
const CELL = 28;
const widths = [180, 220, 150, 96, 96, 64, 64, 72, 104];
const detailWidth = widths.reduce((a, b) => a + b, 0);
const labels = [
  'Proyek / No. PO',
  'Pekerjaan / PIC',
  'Catatan',
  'Mulai',
  'Selesai',
  'Hari',
  'Bobot',
  'Progres',
  'Status',
];
const shortDate = (s: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${s}T00:00:00Z`));

export function TimePlanSheet({
  projects,
  today,
  onSelect,
}: {
  projects: Project[];
  today: string;
  onSelect: (id: string) => void;
}) {
  const [start, setStart] = useState(monday(today));
  const [weeks, setWeeks] = useState(8);
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [expanded, setExpanded] = useState(false);
  const days = calendarDays(start, weeks);
  const groups = calendarGroups(days, mode);
  const tasks = projects.flatMap((p) => p.tasks);
  const outside = tasks.filter(
    (t) =>
      !barPosition(
        t.plannedStart,
        t.plannedFinish,
        t.progressPct,
        start,
        days.length,
      ),
  ).length;
  const earliest = tasks.reduce(
    (s, t) => (t.plannedStart < s ? t.plannedStart : s),
    tasks[0]?.plannedStart ?? today,
  );
  const grid = `repeating-linear-gradient(to right, transparent 0, transparent ${CELL - 1}px, #d5d4b7 ${CELL - 1}px, #d5d4b7 ${CELL}px)`;
  const single = projects.length === 1 ? projects[0] : null;
  return (
    <section
      className={`${expanded ? 'fixed inset-2 z-50 flex flex-col shadow-2xl' : 'relative'} min-w-0 border border-slate-200 bg-white`}
      aria-label="Lembar Time Plan"
    >
      <div className="flex flex-wrap items-start justify-between gap-5 border-b p-4 md:p-5">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-600">
            PT. Arsko Sukses Bersama
          </p>
          <h2 className="mt-1 text-xl font-bold text-sky-700">
            Time Plan — {single?.name ?? 'Semua proyek'}
          </h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-xs text-slate-600">
            <dt>Customer</dt>
            <dd>
              {single?.clientName ||
                (single ? '—' : 'Sesuai masing-masing proyek')}
            </dd>
            <dt>No. PO Customer</dt>
            <dd>
              {single?.customerPoNumber ||
                (single
                  ? 'Belum dicatat'
                  : `${projects.length} proyek sesuai hak akses`)}
            </dd>
            <dt>Project Start</dt>
            <dd>
              {single?.plannedStart ? shortDate(single.plannedStart) : '—'}
            </dd>
            <dt>Project Lead</dt>
            <dd>
              {single?.projectManagerName ||
                (single ? 'Belum ditetapkan' : 'Lihat kelompok proyek')}
            </dd>
          </dl>
        </div>
        <div className="flex max-w-full flex-wrap items-end gap-3">
          <label className="text-xs font-semibold">
            Mulai kalender
            <input
              aria-label="Mulai kalender"
              type="date"
              value={start}
              onChange={(e) => {
                if (validDate(e.target.value)) setStart(e.target.value);
              }}
              className={`${inputClass} mt-1 block w-40`}
            />
          </label>
          <label className="text-xs font-semibold">
            Display Weeks
            <input
              aria-label="Display Weeks"
              type="number"
              min={1}
              max={26}
              value={weeks}
              onChange={(e) =>
                setWeeks(
                  Math.max(
                    1,
                    Math.min(26, Math.trunc(Number(e.target.value)) || 1),
                  ),
                )
              }
              className={`${inputClass} mt-1 block w-24`}
            />
          </label>
          <label className="text-xs font-semibold">
            Kelompok kalender
            <select
              aria-label="Kelompok kalender"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'week' | 'month')}
              className={`${inputClass} mt-1 block w-28`}
            >
              <option value="week">Minggu</option>
              <option value="month">Bulan</option>
            </select>
          </label>
          <button
            type="button"
            aria-pressed={expanded}
            onClick={() => setExpanded(!expanded)}
            className="border px-3 py-2 text-xs font-semibold"
          >
            {expanded ? 'Tutup layar penuh' : 'Layar penuh'}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-xs">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStart(dateAt(dayNumber(start) - 7))}
            className="border bg-white px-3 py-1.5"
          >
            ← 1 minggu
          </button>
          <button
            type="button"
            onClick={() => setStart(monday(today))}
            className="border bg-white px-3 py-1.5"
          >
            Hari ini
          </button>
          <button
            type="button"
            onClick={() => setStart(monday(earliest))}
            className="border bg-white px-3 py-1.5"
          >
            Awal pekerjaan
          </button>
          <button
            type="button"
            onClick={() => setStart(dateAt(dayNumber(start) + 7))}
            className="border bg-white px-3 py-1.5"
          >
            1 minggu →
          </button>
        </div>
        <p>
          <span className="text-amber-600">■</span> Rencana ·{' '}
          <span className="text-sky-600">■</span> Progres ·{' '}
          <span className="text-red-600">│</span> Hari ini · Durasi hari
          kalender
        </p>
      </div>
      <p className="border-b px-4 py-2 text-xs text-slate-500" role="status">
        {tasks.length} pekerjaan · {shortDate(start)} —{' '}
        {shortDate(days.at(-1)!)}.{' '}
        {outside > 0
          ? `${outside} pekerjaan di luar rentang kalender; tanggal tetap ditampilkan.`
          : 'Geser mendatar untuk melihat seluruh kalender.'}{' '}
        Bobot dihitung per proyek, bukan dijumlahkan antarproyek.
      </p>
      <div
        tabIndex={0}
        aria-label="Tabel jadwal, geser untuk melihat kalender"
        className={`${expanded ? 'min-h-0 flex-1' : 'max-h-[68vh]'} overflow-auto overscroll-contain`}
      >
        <table
          className="table-fixed border-separate border-spacing-0 text-left text-xs"
          style={{ width: detailWidth + days.length * CELL }}
        >
          <caption className="sr-only">
            Jadwal rinci proyek dan PO customer dengan kalender harian. Biru
            menunjukkan proporsi progres, bukan tanggal aktual.
          </caption>
          <colgroup>
            {widths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
            <col style={{ width: days.length * CELL }} />
          </colgroup>
          <thead className="sticky top-0 z-30">
            <tr>
              {labels.map((label, i) => (
                <th
                  key={label}
                  scope="col"
                  rowSpan={3}
                  style={
                    i === 0 ? { left: 0 } : i === 1 ? { left: 180 } : undefined
                  }
                  className={`border-b border-r border-amber-400 bg-amber-400 px-3 py-3 text-slate-950 ${i === 0 ? 'sticky z-40' : i === 1 ? 'md:sticky z-40' : ''}`}
                >
                  {label}
                </th>
              ))}
              <th className="bg-slate-100 p-0 font-normal">
                <div className="flex">
                  {groups.map((g) => (
                    <div
                      key={g.key}
                      style={{ width: g.count * CELL }}
                      className="overflow-hidden border-r border-slate-300 py-2 text-center whitespace-nowrap"
                    >
                      {mode === 'week'
                        ? `Minggu · ${shortDate(g.key)}`
                        : new Intl.DateTimeFormat('id-ID', {
                            month: 'long',
                            year: 'numeric',
                            timeZone: 'UTC',
                          }).format(new Date(`${g.start}T00:00:00Z`))}
                    </div>
                  ))}
                </div>
              </th>
            </tr>
            <tr>
              <th className="bg-[#08265c] p-0 font-normal text-white">
                <div className="flex">
                  {days.map((d) => (
                    <span
                      key={d}
                      style={{ width: CELL }}
                      className={`border-r border-white/20 py-2 text-center ${d === today ? 'bg-red-600' : ''}`}
                    >
                      {Number(d.slice(8))}
                    </span>
                  ))}
                </div>
              </th>
            </tr>
            <tr>
              <th className="bg-[#08265c] p-0 text-[10px] font-normal text-white">
                <div className="flex">
                  {days.map((d) => (
                    <span
                      key={d}
                      style={{ width: CELL }}
                      className="border-r border-white/20 pb-2 text-center"
                    >
                      {
                        ['Mi', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb'][
                          new Date(`${d}T00:00:00Z`).getUTCDay()
                        ]
                      }
                    </span>
                  ))}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p, index) => (
              <Fragment key={p.id}>
                <tr>
                  <th
                    colSpan={9}
                    className="border-t border-slate-200 bg-[#08265c] px-3 py-3 text-white"
                  >
                    <div className="sticky left-3 w-fit max-w-[calc(100vw-5rem)]">
                      <button
                        type="button"
                        onClick={() => {
                          setExpanded(false);
                          onSelect(p.id);
                        }}
                        className="text-left underline underline-offset-4"
                      >
                        {index + 1}. {p.code} · {p.name}
                      </button>
                      <span className="ml-4 text-[10px] font-normal text-blue-100">
                        {p.timePlanActive ? 'Aktif' : 'Draft'} · Lead:{' '}
                        {p.projectManagerName || '—'} · Bobot{' '}
                        {p.summary.totalWeight}% · Progres {p.summary.progress}%
                      </span>
                    </div>
                  </th>
                  <td className="bg-[#08265c]" />
                </tr>
                {!p.tasks.length ? (
                  <tr>
                    <td className="sticky left-0 z-10 border-b bg-white p-3">
                      {p.customerPoNumber || 'PO belum dicatat'}
                    </td>
                    <td
                      colSpan={8}
                      className="border-b bg-white p-4 text-slate-500"
                    >
                      Belum ada rincian pekerjaan. Pilih proyek untuk menambah
                      pekerjaan.
                    </td>
                    <td className="bg-[#f5f1d3]" />
                  </tr>
                ) : (
                  p.tasks.map((t) => {
                    const bar = barPosition(
                      t.plannedStart,
                      t.plannedFinish,
                      t.progressPct,
                      start,
                      days.length,
                    );
                    const status = taskStatus(t, today);
                    const todayOffset = dayNumber(today) - dayNumber(start);
                    return (
                      <tr key={t.id}>
                        <td className="sticky left-0 z-10 border-b border-r border-blue-200 bg-[#08265c] p-3 text-white">
                          <p className="font-semibold break-words">
                            {p.customerPoNumber || 'PO belum dicatat'}
                          </p>
                          <p className="mt-1 text-[10px] text-blue-200">
                            {p.code}
                          </p>
                        </td>
                        <th
                          scope="row"
                          className="md:sticky md:left-[180px] z-10 border-b border-r bg-white p-3 font-normal"
                        >
                          <p className="font-semibold break-words">{t.title}</p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {phaseLabels[t.phase]} · {t.responsible}
                          </p>
                        </th>
                        <td className="border-b border-r bg-white p-2 break-words whitespace-pre-wrap">
                          {t.notes || '—'}
                        </td>
                        <td className="border-b border-r bg-slate-100 p-2">
                          {shortDate(t.plannedStart)}
                        </td>
                        <td className="border-b border-r bg-slate-100 p-2">
                          {shortDate(t.plannedFinish)}
                        </td>
                        <td className="border-b border-r bg-slate-100 p-2 text-center">
                          {dayNumber(t.plannedFinish) -
                            dayNumber(t.plannedStart) +
                            1}
                        </td>
                        <td className="border-b border-r bg-slate-100 p-2">
                          {t.weight}%
                        </td>
                        <td className="border-b border-r bg-slate-100 p-2">
                          {t.progressPct}%
                        </td>
                        <td
                          className={`border-b border-r bg-white p-2 font-semibold ${status === 'Terlambat' ? 'text-red-700' : 'text-teal-700'}`}
                        >
                          {status}
                        </td>
                        <td
                          className="relative border-b border-dotted border-slate-400 bg-[#f5f1d3] p-0"
                          style={{ backgroundImage: grid }}
                        >
                          {bar && (
                            <div
                              title={`${t.title}: ${t.plannedStart} → ${t.plannedFinish}; ${t.progressPct}%`}
                              className="absolute inset-y-2 overflow-hidden bg-amber-400"
                              style={{
                                left: bar.left * CELL,
                                width: bar.width * CELL,
                              }}
                            >
                              <div
                                className="h-full bg-sky-500"
                                style={{ width: bar.completed * CELL }}
                              />
                            </div>
                          )}
                          {todayOffset >= 0 && todayOffset < days.length && (
                            <div
                              className="pointer-events-none absolute inset-y-0 border-l-2 border-red-500"
                              style={{ left: todayOffset * CELL }}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-3 text-xs text-slate-500">
        Batang biru adalah proporsi progres terhadap durasi rencana, bukan
        durasi aktual. Klik nama proyek untuk mengelola rincian dan aktivasi
        bobot. Pada layar kecil, geser tabel secara mendatar.
      </p>
    </section>
  );
}
