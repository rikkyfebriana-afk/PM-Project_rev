import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  warehouseItemSchema,
  warehouseReceiptSchema,
  warehouseIssueSchema,
  warehouseReturnSchema,
} from '../lib/warehouse/validation.ts';

const receipt=()=>({requestId:randomUUID(),warehouseItemId:'warehouse-1',quantity:'1.2500',referenceNo:'WH-IN-001',recipient:'Petugas Gudang',notes:'Saldo awal'});

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
});

test('issues require a project material and returns require the original issue',()=>{
  const base=receipt();
  assert.equal(warehouseIssueSchema.safeParse({...base,materialId:'material-1'}).success,true);
  assert.equal(warehouseIssueSchema.safeParse(base).success,false);
  assert.equal(warehouseReturnSchema.safeParse({...base,issueId:'issue-1'}).success,true);
  assert.equal(warehouseReturnSchema.safeParse(base).success,false);
});
