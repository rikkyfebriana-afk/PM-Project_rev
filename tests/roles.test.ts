import test from 'node:test';
import assert from 'node:assert/strict';
import {hasFullAccess} from '../lib/auth/roles.ts';

test('Admin and Project Manager share full workspace permissions',()=>{
 assert.equal(hasFullAccess('ADMIN'),true);
 assert.equal(hasFullAccess('PROJECT_MANAGER'),true);
});
test('Viewer and unknown roles never obtain full workspace permissions',()=>{
 for(const role of ['VIEWER','admin','project_manager','SYSTEM','',undefined,null]) assert.equal(hasFullAccess(role),false);
});
