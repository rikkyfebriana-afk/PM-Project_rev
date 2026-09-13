import { ModuleOverview } from '@/components/modules/module-overview';
export default function DeliveryPage() {
  return (
    <ModuleOverview
      eyebrow="Logistics control"
      title="Delivery"
      description="Pantau readiness, DO, jadwal pengiriman, status transit, penerimaan site, dan dokumen serah terima."
      metrics={[
        { label: 'Ready to ship', value: '3', note: 'FAT approval completed' },
        { label: 'In transit', value: '2', note: 'Expected this week' },
        { label: 'Delivered', value: '11', note: 'Current quarter' },
      ]}
      workflow={[
        'Confirm release and delivery readiness',
        'Attach DO and dispatch details',
        'Record site receipt with evidence',
      ]}
    />
  );
}
