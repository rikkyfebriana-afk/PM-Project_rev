import type {
  ProjectHealthValue,
  ProjectPhaseValue,
  ProjectStatusValue,
} from '@/lib/projects/types';

export const statusLabels: Record<ProjectStatusValue, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

export const healthLabels: Record<ProjectHealthValue, string> = {
  ON_TRACK: 'On track',
  ATTENTION: 'Attention',
  CRITICAL: 'Critical',
};

export const phaseLabels: Record<ProjectPhaseValue, string> = {
  PLANNING: 'Planning',
  ENGINEERING: 'Engineering',
  PROCUREMENT: 'Procurement',
  PRODUCTION: 'Production',
  FAT: 'FAT',
  DELIVERY: 'Delivery',
  INSTALLATION: 'Installation',
  BAST: 'BAST',
  CLOSED: 'Closed',
};

export function formatRupiah(value: string | number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatRupiahShort(value: string | number) {
  const amount = Number(value);
  if (amount >= 1_000_000_000_000)
    return `Rp${(amount / 1_000_000_000_000).toFixed(1)}T`;
  if (amount >= 1_000_000_000)
    return `Rp${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `Rp${(amount / 1_000_000).toFixed(1)}M`;
  return formatRupiah(amount);
}

export function formatProjectDate(value: string | null) {
  if (!value) return 'Not set';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function grossMargin(poValue: string, forecastCost: string) {
  const po = Number(poValue);
  if (!Number.isFinite(po) || po <= 0) return null;
  return ((po - Number(forecastCost)) / po) * 100;
}
