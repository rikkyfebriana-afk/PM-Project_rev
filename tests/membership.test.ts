import test from 'node:test';
import assert from 'node:assert/strict';
import {membershipSchema} from '../lib/settings/membership.ts';

test('membership selections are deduplicated and sorted for consistent locking',()=>{
 const value=membershipSchema.parse({projectIds:['b','a','b'],userId:'user',operation:'add'});
 assert.deepEqual(value.projectIds,['a','b']);
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
