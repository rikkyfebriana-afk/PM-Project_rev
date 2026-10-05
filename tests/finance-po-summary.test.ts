import test from 'node:test';
import assert from 'node:assert/strict';
import {
  financePoGroup,
  summarizeFinancePo,
  exactPoMoney,
} from '../lib/finance/po-summary.ts';
test('finance groups exclusively by customer PO status, not project lifecycle', () => {
  const rows = [
    'RECEIVED',
    'IN_PROGRESS',
    'COMPLETED',
    'DRAFT',
    'CANCELLED',
  ].map((customerPoStatus, i) => ({
    customerPoStatus,
    customerPoNumber: `PO-${i}`,
    poValue: '10.10',
    status: 'CLOSED',
  }));
  const result = summarizeFinancePo(rows);
  for (const group of result.slice(0, 5)) {
    assert.equal(group.count, 1);
    assert.equal(group.value, '10.10');
  }
  assert.equal(
    result.reduce((n, g) => n + g.count, 0),
    5,
  );
});
test('unrecorded and unknown PO statuses do not inflate Open totals', () => {
  assert.equal(
    financePoGroup({ poValue: '1', customerPoStatus: 'RECEIVED' }),
    'UNRECORDED',
  );
  assert.equal(
    financePoGroup({
      poValue: '1',
      customerPoNumber: 'PO',
      customerPoStatus: 'UNKNOWN',
    }),
    'UNRECORDED',
  );
  assert.equal(
    summarizeFinancePo([]).every((g) => g.value === '0.00' && g.count === 0),
    true,
  );
});
test('PO totals retain precision and cents beyond JavaScript safe integer range', () => {
  const p = {
    customerPoNumber: 'PO',
    customerPoStatus: 'COMPLETED',
    poValue: '9999999999999999.99',
  };
  assert.equal(
    summarizeFinancePo([p, { ...p, poValue: '0.01' }])[2].value,
    '10000000000000000.00',
  );
  assert.equal(exactPoMoney('1234567.50'), 'Rp 1.234.567,50');
});
