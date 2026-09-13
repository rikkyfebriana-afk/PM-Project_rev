import { ModuleOverview } from '@/components/modules/module-overview';
export default function SiteWorkPage() {
  return (
    <ModuleOverview
      eyebrow="Field execution"
      title="Site Work"
      description="Kelola installation progress, isu lapangan, foto evidence, testing, commissioning, dan readiness BAST."
      metrics={[
        {
          label: 'Active sites',
          value: '7',
          note: 'Installation or commissioning',
        },
        { label: 'Field actions', value: '9', note: '3 high-priority items' },
        { label: 'BAST ready', value: '2', note: 'Awaiting final sign-off' },
      ]}
      workflow={[
        'Plan installation and commissioning scope',
        'Capture verified site progress and issues',
        'Complete handover requirements for BAST',
      ]}
    />
  );
}
