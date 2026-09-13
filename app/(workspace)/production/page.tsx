import { ModuleOverview } from '@/components/modules/module-overview';
export default function ProductionPage() {
  return (
    <ModuleOverview
      eyebrow="Workshop execution"
      title="Production"
      description="Monitor progress fabrikasi dan assembly terhadap rencana kerja serta milestone FAT."
      metrics={[
        { label: 'In production', value: '9', note: 'Active work orders' },
        {
          label: 'Avg. progress',
          value: '68%',
          note: 'Weighted by project value',
        },
        { label: 'At risk', value: '2', note: 'Behind production baseline' },
      ]}
      workflow={[
        'Set the production baseline and work packages',
        'Record verified physical progress',
        'Escalate variance before FAT readiness',
      ]}
    />
  );
}
