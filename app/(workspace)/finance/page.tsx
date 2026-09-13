import { ModuleOverview } from '@/components/modules/module-overview';
export default function FinancePage() {
  return (
    <ModuleOverview
      eyebrow="Commercial control"
      title="Finance"
      description="Bandingkan PO value, budget, actual, forecast, dan gross margin menggunakan nilai decimal yang aman untuk data finansial."
      metrics={[
        {
          label: 'Actual cost',
          value: 'Rp6.1B',
          note: '70.1% of approved budget',
        },
        {
          label: 'Forecast cost',
          value: 'Rp8.4B',
          note: 'Rp300M below budget',
        },
        {
          label: 'Forecast GM',
          value: '32.8%',
          note: '+1.4 points vs baseline',
        },
      ]}
      workflow={[
        'Maintain controlled budget and cost entries',
        'Update estimate-at-completion forecast',
        'Review margin risk and approve adjustments',
      ]}
    />
  );
}
