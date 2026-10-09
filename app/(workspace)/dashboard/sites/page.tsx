import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/require-user';
import { getDashboardData } from '@/lib/dashboard/queries';
import { dashboardCategories, isDashboardCategory } from '@/lib/dashboard/categories';

export const metadata = { title: 'Daftar site berdasarkan kategori' };
export default async function DashboardSitesPage({ searchParams }: { searchParams: Promise<{ category?: string | string[] }> }) {
  const user = await requireUser();
  const { category } = await searchParams;
  if (typeof category !== 'string' || !isDashboardCategory(category)) notFound();
  const data = await getDashboardData(user);
  const selected = new Set(data.categoryProjects?.[category] ?? []);
  const projects = data.projects.filter(p => selected.has(p.id));
  const info = dashboardCategories[category];
  return <main className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6 p-4 pb-24 md:p-7">
    <section className="border border-slate-200 bg-white p-5 md:p-7">
      <Link href="/dashboard" className="text-sm text-teal-800 underline">← Kembali ke dashboard</Link>
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">Daftar site — {info.label}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{info.description}</p>
      <p className="mt-3 font-semibold text-slate-800">{projects.length} site/proyek sesuai kategori</p>
      <p className="mt-2 text-xs text-slate-500">Data terkini sesuai akses akun Anda. Jumlah dapat berubah jika data proyek diperbarui setelah dashboard dibuka.</p>
    </section>
    <nav aria-label="Kategori site" className="flex flex-wrap gap-2">{Object.entries(dashboardCategories).map(([key, value]) => <Link key={key} href={`/dashboard/sites?category=${key}`} aria-current={key === category ? 'page' : undefined} className={`border px-3 py-2 text-sm ${key === category ? 'bg-[#17364a] text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}>{value.label}</Link>)}</nav>
    {data.demoMode && <p className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Daftar kategori menggunakan data live. Data rincian kategori belum tersedia dalam snapshot demo.</p>}
    {!projects.length ? <p className="border border-slate-200 bg-white p-6 text-slate-700">Tidak ada site/proyek pada kategori {info.label}.</p> : <section className="min-w-0 overflow-x-auto border border-slate-200 bg-white">
      <table className="w-full min-w-[800px] text-left text-sm">
        <caption className="sr-only">Site kategori {info.label}</caption>
        <thead className="bg-slate-100 text-slate-700"><tr>{['Kode proyek', 'Site / pekerjaan', 'Lokasi', 'Progress', 'Material', 'Fase', 'Target selesai', 'Health'].map(label => <th scope="col" key={label} className="p-4">{label}</th>)}</tr></thead>
        <tbody>{projects.map(p => <tr key={p.id} className="border-t border-slate-200 hover:bg-slate-50"><td className="p-4 font-semibold">{p.id}</td><td className="min-w-60 max-w-md break-words p-4">{p.name}</td><td className="p-4">{p.city}</td><td className="p-4">{p.progress}%</td><td className="p-4">{p.material}%</td><td className="p-4">{p.phase}</td><td className="whitespace-nowrap p-4">{p.finish}</td><td className="p-4">{p.health}</td></tr>)}</tbody>
      </table>
    </section>}
    <Link href="/projects" className="inline-block text-sm text-teal-800 underline">Buka register seluruh proyek</Link>
  </main>;
}
