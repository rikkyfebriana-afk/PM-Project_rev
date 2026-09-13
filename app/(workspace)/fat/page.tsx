import { ModuleOverview } from '@/components/modules/module-overview';
export default function FatPage() {
  return (
    <ModuleOverview
      eyebrow="Quality gate"
      title="Factory Acceptance Test"
      description="Kelola jadwal FAT, hasil inspeksi, punch list, evidence, dan approval client sebelum delivery."
      metrics={[
        { label: 'Upcoming FAT', value: '4', note: 'Within the next 30 days' },
        {
          label: 'Open punch items',
          value: '18',
          note: '3 lists still active',
        },
        { label: 'Pass rate', value: '92%', note: 'Current quarter' },
      ]}
      workflow={[
        'Prepare FAT schedule and checklist',
        'Capture result, evidence, and punch list',
        'Close findings and release for delivery',
      ]}
    />
  );
}
