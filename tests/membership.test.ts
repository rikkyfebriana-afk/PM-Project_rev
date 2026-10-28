import test from 'node:test';
import assert from 'node:assert/strict';
import {membershipSchema,membershipErrorMessage,membershipErrorCode,MembershipInputError} from '../lib/settings/membership.ts';

test('membership selections are deduplicated and sorted for consistent locking',()=>{
 const value=membershipSchema.parse({projectIds:['b','a','b'],userId:'user',operation:'add'});
 assert.deepEqual(value.projectIds,['a','b']);
});
test('membership error messages are actionable without exposing database details',()=>{
 assert.match(membershipErrorMessage({code:'P2028'}),/batas waktu/);
 assert.match(membershipErrorMessage({code:'P2024'}),/batas waktu/);
 assert.match(membershipErrorMessage({code:'P1001'}),/Koneksi database/);
 assert.match(membershipErrorMessage({code:'P2034'}),/bersamaan/);
 assert.equal(membershipErrorMessage(new MembershipInputError('Proyek diarsipkan.')),'Proyek diarsipkan.');
 assert.ok(!membershipErrorMessage(new Error('database password secret')).includes('secret'));
 assert.equal(membershipErrorCode({code:'secret'}),'UNKNOWN');
});
test('membership validates empty selections, operations and bulk removal confirmation',()=>{
 const input={projectIds:['a','b'],userId:'user',operation:'remove'};
 assert.equal(membershipSchema.safeParse(input).success,false);
 assert.equal(membershipSchema.safeParse({...input,confirmBulkRemove:true}).success,true);
 assert.equal(membershipSchema.safeParse({...input,projectIds:['a']}).success,true);
 assert.equal(membershipSchema.safeParse({...input,projectIds:[]}).success,false);
 assert.equal(membershipSchema.safeParse({...input,operation:'admin'}).success,false);
 assert.equal(membershipSchema.safeParse({...input,userId:''}).success,false);
});
