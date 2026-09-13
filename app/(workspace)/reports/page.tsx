import { ModuleOverview } from '@/components/modules/module-overview';
export default function ReportsPage() {
  return (
    <ModuleOverview
      eyebrow="Management reporting"
      title="Reports"
      description="Siapkan laporan portfolio dan project untuk ekspor PDF atau Excel dari data yang telah tervalidasi."
      metrics={[
        {
          label: 'Portfolio reports',
          value: '6',
          note: 'Standard management views',
        },
        { label: 'Scheduled', value: '3', note: 'Weekly and monthly cadence' },
        {
          label: 'Data freshness',
          value: '98%',
          note: 'Records updated this week',
        },
      ]}
      workflow={[
        'Choose portfolio, project, and reporting period',
        'Validate source data and report preview',
        'Generate controlled PDF or Excel output',
      ]}
    />
  );
}
