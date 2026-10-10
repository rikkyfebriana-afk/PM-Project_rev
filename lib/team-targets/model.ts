import { z } from 'zod';
export const dailyStatuses = ['NOT_STARTED','IN_PROGRESS','DONE','BLOCKED','CANCELLED'] as const;
export const dailyStatusLabels: Record<string,string> = { NOT_STARTED:'Belum mulai', IN_PROGRESS:'Dikerjakan', DONE:'Selesai', BLOCKED:'Terhambat', CANCELLED:'Dibatalkan' };
export const priorities = ['LOW','MEDIUM','HIGH','CRITICAL'] as const;
export const priorityLabels: Record<string,string> = { LOW:'Rendah', MEDIUM:'Normal', HIGH:'Tinggi', CRITICAL:'Mendesak' };
export const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10) === v && v >= '2000-01-01' && v <= '2100-12-31';
}, 'Tanggal harus valid antara tahun 2000–2100.');
const quantity = z.string().trim().regex(/^\d{1,14}(?:\.\d{1,4})?$/, 'Quantity tanpa pemisah ribuan, maksimal 4 desimal.');
export function scaledQty(value: string) {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4,'0'));
}
export const dailyTargetSchema = z.object({
  id: z.string().max(100).default(''), requestId: z.string().uuid(), version: z.coerce.number().int().min(0),
  projectId: z.string().max(100).default(''),
  title: z.string().trim().min(3,'Nama aktivitas minimal 3 karakter.').max(500),
  pic: z.string().trim().min(1,'Nama PIC wajib diisi.').max(160),
  scheduledDate: calendarDate,
  targetQty: quantity.refine(v => /[1-9]/.test(v),'Target harus lebih dari nol.'), actualQty: quantity,
  unit: z.string().trim().min(1).max(40), priority: z.enum(priorities), status: z.enum(dailyStatuses),
  notes: z.string().trim().max(4000), rescheduleReason: z.string().trim().max(1000).default(''),
}).superRefine((v, ctx) => {
  if (v.status === 'DONE' && quantity.safeParse(v.actualQty).success && quantity.safeParse(v.targetQty).success && scaledQty(v.actualQty) < scaledQty(v.targetQty)) ctx.addIssue({code:'custom',message:'Realisasi harus mencapai target sebelum ditandai selesai.'});
  if (v.status === 'NOT_STARTED' && /[1-9]/.test(v.actualQty)) ctx.addIssue({code:'custom',message:'Aktivitas dengan realisasi harus berstatus Dikerjakan, Terhambat, atau Selesai.'});
  if (['BLOCKED','CANCELLED'].includes(v.status) && !v.notes) ctx.addIssue({code:'custom',message:'Isi catatan kendala atau alasan pembatalan.'});
});
export function addDays(value: string, days: number) {
  const d = new Date(`${value}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10);
}
export function weekStart(value: string) {
  const date = new Date(`${value}T00:00:00Z`); return addDays(value,-((date.getUTCDay()+6)%7));
}
export function dailyAchievement(rows: {targetQty:string;actualQty:string;status:string}[]) {
  const active = rows.filter(t => t.status !== 'CANCELLED');
  const done = active.filter(t => t.status === 'DONE').length;
  const total = active.reduce((sum,t) => {
    const actual = scaledQty(t.actualQty), target = scaledQty(t.targetQty);
    return sum + (actual >= target ? 10000n : actual * 10000n / target);
  },0n);
  return { count: active.length, done, remaining: active.length - done, percent: active.length ? Number(total / BigInt(active.length)) / 100 : 0 };
}
export function dailyShareText(date: string, rows: DailyTargetRow[]) {
  const tasks = rows.filter(t => t.scheduledDate === date && t.status !== 'CANCELLED');
  const lines = tasks.map((t, i) => `${i + 1}. ${t.title}\n   Site: ${t.projectLabel}\n   PIC: ${t.pic}\n   Target: ${t.targetQty} ${t.unit} | Realisasi: ${t.actualQty} ${t.unit}\n   Status: ${dailyStatusLabels[t.status]} | Prioritas: ${priorityLabels[t.priority]}${t.notes ? `\n   Catatan: ${t.notes}` : ''}`);
  return ['TARGET HARIAN — PT. Arsko Sukses Bersama', `Tanggal: ${date}`, 'Jadwal berbagi manual: Senin–Jumat, 09.00 WIB', 'Ringkasan sesuai filter PIC/proyek dan hak akses pengirim.', '', ...lines, ...(tasks.length ? [] : ['Belum ada target aktif untuk tanggal dan filter ini.'])].join('\n');
}
export type DailyTargetRow = {
  id:string; requestId:string; version:number; projectId:string; projectLabel:string;
  title:string; pic:string; scheduledDate:string; originalDate:string; targetQty:string; actualQty:string;
  unit:string; priority:string; status:string; notes:string; canEdit:boolean;
  history: {at:string;actor:string;description:string}[];
};
