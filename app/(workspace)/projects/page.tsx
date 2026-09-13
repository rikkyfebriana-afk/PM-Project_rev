import { ModuleOverview } from '@/components/modules/module-overview';
export default function ProjectsPage() {
  return (
    <ModuleOverview
      eyebrow="Portfolio register"
      title="Projects"
      description="Kelola identitas proyek, client, PIC, nilai kontrak, koordinat, fase, health, dan target penyelesaian dari satu register."
      metrics={[
        {
          label: 'Active projects',
          value: '18',
          note: 'Across 7 operational regions',
        },
        {
          label: 'Needs attention',
          value: '6',
          note: '3 attention · 3 critical',
        },
        {
          label: 'PO value',
          value: 'Rp12.5B',
          note: 'Current active portfolio',
        },
      ]}
      workflow={[
        'Create or update the project master record',
        'Assign project manager and team access',
        'Track phase, progress, health, and finish date',
      ]}
    />
  );
}
