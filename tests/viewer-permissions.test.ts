import test from 'node:test';
import assert from 'node:assert/strict';
import {validateViewerScopes,defaultViewerScopes} from '../lib/viewer-permissions/model.ts';
test('viewer defaults expose basic project and customer PO only',()=>assert.deepEqual(defaultViewerScopes,['PROJECT','PO']));
test('permissions deny unknown scopes and incomplete dependencies',()=>{
 assert.throws(()=>validateViewerScopes(['ADMIN']));
 assert.throws(()=>validateViewerScopes(['BOQ']));
 assert.throws(()=>validateViewerScopes(['PROJECT','FINANCE']));
 assert.deepEqual(validateViewerScopes([]),[]);
 assert.deepEqual(validateViewerScopes(['PROJECT','PO','FINANCE','PO']),['PROJECT','PO','FINANCE']);
});
