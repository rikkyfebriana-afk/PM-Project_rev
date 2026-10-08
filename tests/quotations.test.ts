import test from 'node:test';
import assert from 'node:assert/strict';
import { quotationSchema, quotationSummary, rupiah, type LinkedPo } from '../lib/quotations/model.ts';
const valid = { version: 0, number: 'sph/01', clientName: 'PT Customer', title: 'Panel supply', value: '1000.50', issuedDate: '2026-10-01', sentDate: '2026-10-02', validUntil: '', followUpDate: '', pic: 'Rikky', status: 'SENT', notes: '' };
const po = (id: string, value: string, status = 'RECEIVED'): LinkedPo => ({ id, code: id, customerPoNumber: id, customerPoStatus: status, poValue: value, deletedAt: null });
test('SPH validates money, status, dates, and normalizes number', () => {
  assert.equal(quotationSchema.parse(valid).number, 'SPH/01');
  for (const bad of [{value:'0'}, {value:'-1'}, {value:'1,000'}, {sentDate:''}, {issuedDate:'2026-02-30'}, {sentDate:'2026-09-30'}, {status:'DRAFT'}, {status:'PARTIAL'}])
    assert.equal(quotationSchema.safeParse({...valid,...bad}).success, false);
});
test('one SPH aggregates several POs exactly, excludes draft/cancelled/deleted', () => {
  const q = { status: 'SENT', value: '1000.50', projects: [po('a','500.25'), po('b','500.25'),po('c','999','CANCELLED'),po('d','999','DRAFT'),{...po('e','999'), deletedAt: '2026-10-01'}] };
  const s = quotationSummary(q);
  assert.equal(s.total, 100050n); assert.equal(s.count, 2); assert.equal(s.status, 'PARTIAL');
  assert.equal(s.difference, 0n);
  assert.equal(quotationSummary({...q,status:'WON'}).status,'WON');
  assert.equal(quotationSummary({...q,status:'WON',projects:[]}).status,'SENT');
});
test('quotation difference supports negotiated values above offer and large totals', () => {
  const s = quotationSummary({status:'SENT',value:'1',projects:[po('a','9999999999999999.99'),po('b','0.01')]});
  assert.equal(s.total,1000000000000000000n);
  assert.equal(rupiah(-1n),'-Rp 0,01');
  assert.ok(s.difference < 0n);
});
