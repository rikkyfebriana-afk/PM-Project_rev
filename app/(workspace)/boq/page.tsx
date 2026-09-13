import { ModuleOverview } from '@/components/modules/module-overview';
export default function BoqPage() {
  return (
    <ModuleOverview
      eyebrow="Cost baseline"
      title="Bill of Quantities"
      description="Import BoQ tervalidasi, simpan revision history, dan lindungi baseline approved dari perubahan tanpa jejak."
      metrics={[
        {
          label: 'Approved BoQ',
          value: '14',
          note: 'Latest controlled revisions',
        },
        { label: 'Draft revisions', value: '4', note: 'Waiting for approval' },
        {
          label: 'Total items',
          value: '1,284',
          note: 'Across active projects',
        },
      ]}
      workflow={[
        'Upload and validate the Excel template',
        'Review totals, duplicates, and invalid units',
        'Approve a new immutable BoQ revision',
      ]}
    />
  );
}
