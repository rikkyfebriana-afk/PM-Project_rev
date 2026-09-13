import { ModuleOverview } from '@/components/modules/module-overview';
export default function MaterialsPage() {
  return (
    <ModuleOverview
      eyebrow="Supply readiness"
      title="Materials"
      description="Pantau requirement, purchase order, supplier, ETA, penerimaan, instalasi, dan shortage terhadap BoQ proyek."
      metrics={[
        {
          label: 'Material readiness',
          value: '84%',
          note: 'Weighted received vs required',
        },
        { label: 'Shortages', value: '12', note: 'Across 4 impacted projects' },
        { label: 'Late ETA', value: '7', note: 'Past required-on-site date' },
      ]}
      workflow={[
        'Map material requirements from approved BoQ',
        'Update ordered, received, and installed quantities',
        'Escalate shortages and delayed ETA',
      ]}
    />
  );
}
