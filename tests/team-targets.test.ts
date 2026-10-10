import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyTargetSchema,dailyAchievement,dailyShareText,weekStart,addDays,type DailyTargetRow} from '../lib/team-targets/model.ts';
const valid={id:'',requestId:'fe8ba945-d934-4aa0-8f23-a5d186076efd',version:0,projectId:'p1',title:'Assembly panel',pic:'Budi tanpa akun',scheduledDate:'2026-10-05',targetQty:'17',actualQty:'12',unit:'unit',priority:'HIGH',status:'IN_PROGRESS',notes:''};

test('manual WhatsApp summary includes selected day only and excludes cancelled activities',()=>{
  const row:DailyTargetRow={...valid,id:'t1',projectLabel:'Site A',originalDate:valid.scheduledDate,canEdit:true,history:[]};
  const result=dailyShareText(valid.scheduledDate,[row,{...row,status:'CANCELLED',title:'Hidden cancelled'},{...row,scheduledDate:'2026-10-06',title:'Hidden tomorrow'}]);
  assert.match(result,/Budi tanpa akun/);
  assert.match(result,/Target: 17 unit/);
  assert.match(result,/09.00 WIB/);
  assert.doesNotMatch(result,/Hidden/);
  assert.match(dailyShareText(valid.scheduledDate,[]),/Belum ada target aktif/);
});
test('free text PIC and fractional quantities are accepted',()=>{
  assert.equal(dailyTargetSchema.parse(valid).pic,'Budi tanpa akun');
  assert.equal(dailyTargetSchema.safeParse({...valid,targetQty:'0.0001',actualQty:'0'}).success,true);
});
test('target validation rejects invalid dates, quantities and inconsistent statuses',()=>{
  for(const bad of [{pic:''},{scheduledDate:'2026-02-30'},{targetQty:'0'},{actualQty:'-1'},{actualQty:'NaN'},{actualQty:'1.00001'},{status:'DONE'},{status:'NOT_STARTED'},{status:'BLOCKED'},{status:'CANCELLED'}]) assert.equal(dailyTargetSchema.safeParse({...valid,...bad}).success,false,JSON.stringify(bad));
  assert.equal(dailyTargetSchema.safeParse({...valid,status:'DONE',actualQty:'17'}).success,true);
});
test('weeks start on Monday across month and year boundaries',()=>{
  assert.equal(weekStart('2026-10-04'),'2026-09-28');
  assert.equal(weekStart('2027-01-01'),'2026-12-28');
  assert.equal(addDays('2026-09-28',6),'2026-10-04');
});
test('achievement averages individual ratios, caps excess, excludes cancellation',()=>{
  const result=dailyAchievement([{targetQty:'10',actualQty:'5',status:'IN_PROGRESS'},{targetQty:'1',actualQty:'2',status:'DONE'},{targetQty:'100',actualQty:'0',status:'CANCELLED'}]);
  assert.deepEqual(result,{count:2,done:1,remaining:1,percent:75});
  assert.equal(dailyAchievement([]).percent,0);
  assert.equal(dailyAchievement([{targetQty:'17',actualQty:'12',status:'IN_PROGRESS'}]).percent,70.58);
});
