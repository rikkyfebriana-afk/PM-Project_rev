import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  warehouseItemSchema,
  warehouseItemUpdateSchema,
  warehouseReceiptSchema,
  warehouseIssueSchema,
  warehouseReturnSchema,
} from '../lib/warehouse/validation.ts';

const receipt=()=>({requestId:randomUUID(),warehouseItemId:'warehouse-1',expectedUnit:'M',quantity:'1.2500',referenceNo:'WH-IN-001',recipient:'Petugas Gudang',notes:'Saldo awal'});

test('warehouse master identifies a SKU and validates stock thresholds',()=>{
  assert.equal(warehouseItemSchema.safeParse({code:'WH-CABLE',description:'Kabel gudang',unit:'M',location:'Rak A1',minQty:'2.5'}).success,true);
  const normalized=warehouseItemSchema.parse({code:'  wh-cable  ',description:'Kabel gudang',unit:' m ',location:'Rak A1',minQty:'0'});
  assert.equal(normalized.code,'WH-CABLE');
  assert.equal(normalized.unit,'M');
  assert.equal(warehouseItemSchema.safeParse({code:'',description:'Kabel gudang',unit:'M',location:'Rak A1',minQty:'0'}).success,false);
  assert.equal(warehouseItemSchema.safeParse({code:'WH-CABLE',description:'Kabel gudang',unit:'M',location:'Rak A1',minQty:'-1'}).success,false);
});

test('warehouse movements accept exact fractional quantities and reject invalid or excessive precision',()=>{
  assert.equal(warehouseReceiptSchema.safeParse(receipt()).success,true);
  for(const quantity of ['0','-1','NaN','1,5','1.12345','100000000000000']) {
    assert.equal(warehouseReceiptSchema.safeParse({...receipt(),quantity}).success,false,quantity);
  }
  assert.equal(warehouseReceiptSchema.safeParse({...receipt(),requestId:'not-a-uuid'}).success,false);
  assert.equal(warehouseReceiptSchema.parse({...receipt(),expectedUnit:'  m  '}).expectedUnit,'M');
  const withoutUnit:Record<string,string>={...receipt()};
  delete withoutUnit.expectedUnit;
  assert.equal(warehouseReceiptSchema.safeParse(withoutUnit).success,false);
  assert.equal(warehouseReceiptSchema.safeParse({...receipt(),expectedUnit:' '}).success,false);
});

test('warehouse edits normalize identity and units, require a version and minimum, and cannot carry stock changes',()=>{
  const input={id:'warehouse-1',updatedAt:'2026-11-25T03:00:00.000Z',code:'  ｗｈ－ｃａｂｌｅ  ',description:'  Kabel gudang baru  ',unit:'  m  ',minQty:'2.5'};
  const parsed=warehouseItemUpdateSchema.parse({...input,quantity:'999',location:'Changed rack'});
  assert.deepEqual(parsed,{id:input.id,updatedAt:input.updatedAt,code:'WH-CABLE',description:'Kabel gudang baru',unit:'M',minQty:'2.5000'});
  assert.equal(warehouseItemUpdateSchema.parse({...input,minQty:'0'}).minQty,'0.0000');
  for(const change of [
    {id:''},{updatedAt:''},{updatedAt:'yesterday'},{updatedAt:'2026-11-25'},
    {code:'   '},{code:'X'.repeat(81)},{description:' '},{description:'X'.repeat(301)},
    {unit:' '},{unit:'X'.repeat(33)},{minQty:''},{minQty:'-1'},{minQty:'1e3'},{minQty:'1.12345'},{minQty:'100000000000000'},
  ]) assert.equal(warehouseItemUpdateSchema.safeParse({...input,...change}).success,false);
  for(const field of ['updatedAt','unit','minQty']) {
    const missing:Record<string,string>={...input};delete missing[field];
    assert.equal(warehouseItemUpdateSchema.safeParse(missing).success,false,`Missing ${field} must not silently reset an existing item`);
  }
});

test('issues require a project material and returns require the original issue',()=>{
  const base=receipt();
  assert.equal(warehouseIssueSchema.safeParse({...base,materialId:'material-1'}).success,true);
  assert.equal(warehouseIssueSchema.safeParse(base).success,false);
  assert.equal(warehouseReturnSchema.safeParse({...base,issueId:'issue-1'}).success,true);
  assert.equal(warehouseReturnSchema.safeParse(base).success,false);
});
