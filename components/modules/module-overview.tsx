import { ArrowUpRight, CheckCircle2, DatabaseZap } from 'lucide-react';

type ModuleOverviewProps = {
  eyebrow: string;
  title: string;
  description: string;
  metrics: Array<{ label: string; value: string; note: string }>;
  workflow: string[];
};

export function ModuleOverview({
  eyebrow,
  title,
  description,
  metrics,
  workflow,
}: ModuleOverviewProps) {
  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 pb-24 md:p-7 xl:p-9 lg:pb-9">
      <section className="border border-[#dce2e6] bg-white p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.17em] text-[#d85832]">
              {eyebrow}
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-[#172d3e] md:text-3xl">
              {title}
            </h2>
            <p className="mt-3 text-base leading-7 text-[#6e7e88]">
              {description}
            </p>
          </div>
          <div className="flex items-center gap-2 border border-[#dce5e7] bg-[#eff6f5] px-4 py-3 text-sm font-semibold text-[#287363]">
            <DatabaseZap className="size-4" /> PostgreSQL-ready
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="border border-[#dce2e6] bg-white p-6"
          >
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#81909a]">
              {metric.label}
            </p>
            <p className="mt-4 font-mono text-3xl font-semibold tracking-[-0.05em] text-[#17364a]">
              {metric.value}
            </p>
            <p className="mt-2 text-sm text-[#7b8992]">{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.55fr]">
        <article className="border border-[#dce2e6] bg-white">
          <div className="border-b border-[#e7ebed] px-6 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#85929b]">
              Primary workflow
            </p>
            <h3 className="mt-2 text-lg font-semibold text-[#233847]">
              Module workflow
            </h3>
          </div>
          <div className="divide-y divide-[#edf0f2]">
            {workflow.map((item, index) => (
              <div key={item} className="flex items-center gap-4 px-6 py-5">
                <span className="grid size-8 shrink-0 place-items-center bg-[#edf3f4] font-mono text-xs font-bold text-[#31566b]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 text-sm font-medium text-[#405562]">
                  {item}
                </span>
                <ArrowUpRight className="size-4 text-[#a1abb1]" />
              </div>
            ))}
          </div>
        </article>
        <aside className="border border-[#dce2e6] bg-[#153044] p-6 text-white">
          <CheckCircle2 className="size-6 text-[#63d0af]" />
          <h3 className="mt-5 text-lg font-semibold">Foundation secured</h3>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Route protection, role-ready data models, audit fields, and
            environment-based secrets are built into this module foundation.
          </p>
          <p className="mt-8 border-t border-white/10 pt-5 text-xs text-white/40">
            Live records appear after Supabase connection and the first
            controlled database migration.
          </p>
        </aside>
      </section>
    </main>
  );
}
