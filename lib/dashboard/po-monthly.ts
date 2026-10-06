export type MonthlyPoSource = {
  customerPoNumber: string | null;
  customerPoStatus: string;
  customerPoDate: string | null;
  customerPoCompletedDate: string | null;
  poValue: string;
};
export function buildMonthlyPo(rows: MonthlyPoSource[], currentYear: number) {
  const years = new Map<
    number,
    {
      month: number;
      incomingCount: number;
      completedCount: number;
      incomingValue: bigint;
      completedValue: bigint;
    }[]
  >();
  const ensure = (year: number) => {
    if (!years.has(year))
      years.set(
        year,
        Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          incomingCount: 0,
          completedCount: 0,
          incomingValue: 0n,
          completedValue: 0n,
        })),
      );
    return years.get(year)!;
  };
  ensure(currentYear);
  let missingIncoming = 0,
    missingCompleted = 0,
    excluded = 0;
  for (const p of rows) {
    if (
      !p.customerPoNumber?.trim() ||
      !['RECEIVED', 'IN_PROGRESS', 'COMPLETED'].includes(p.customerPoStatus)
    ) {
      excluded++;
      continue;
    }
    const [whole, fraction = ''] = p.poValue.split('.');
    const value = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    const add = (date: string | null, kind: 'incoming' | 'completed') => {
      if (!date) {
        if (kind === 'incoming') missingIncoming++;
        else missingCompleted++;
        return;
      }
      const year = Number(date.slice(0, 4)),
        month = Number(date.slice(5, 7));
      const bucket = ensure(year)[month - 1];
      bucket[`${kind}Count`]++;
      bucket[`${kind}Value`] += value;
    };
    add(p.customerPoDate, 'incoming');
    if (p.customerPoStatus === 'COMPLETED')
      add(p.customerPoCompletedDate, 'completed');
  }
  const amount = (v: bigint) =>
    `${v / 100n}.${String(v % 100n).padStart(2, '0')}`;
  return {
    currentYear,
    missingIncoming,
    missingCompleted,
    excluded,
    years: [...years]
      .sort((a, b) => b[0] - a[0])
      .map(([year, months]) => ({
        year,
        months: months.map((m) => ({
          ...m,
          incomingValue: amount(m.incomingValue),
          completedValue: amount(m.completedValue),
        })),
      })),
  };
}
export type MonthlyPoData = ReturnType<typeof buildMonthlyPo>;
