import test from 'node:test';
import assert from 'node:assert/strict';
import {validateViewerScopes,defaultViewerScopes,portfolioViewerScopes,addPortfolioScopes} from '../lib/viewer-permissions/model.ts';
test('viewer defaults expose basic project and customer PO only',()=>assert.deepEqual(defaultViewerScopes,['PROJECT','PO']));
test('permissions deny unknown scopes and incomplete dependencies',()=>{
 assert.throws(()=>validateViewerScopes(['ADMIN']));
 assert.throws(()=>validateViewerScopes(['BOQ']));
 assert.throws(()=>validateViewerScopes(['PROJECT','FINANCE']));
 assert.deepEqual(validateViewerScopes([]),[]);
 assert.deepEqual(validateViewerScopes(['PROJECT','PO','FINANCE','PO']),['PROJECT','PO','FINANCE']);
});
test('bulk grant adds only requested modules and preserves existing permissions',()=>{
 assert.deepEqual(addPortfolioScopes([]),portfolioViewerScopes);
 assert.ok(addPortfolioScopes(['PROJECT','PO','DOCUMENTS']).includes('DOCUMENTS'));
 assert.ok(!addPortfolioScopes().includes('FINANCE'));
 assert.ok(!addPortfolioScopes().includes('OPERATIONS'));
 assert.deepEqual(validateViewerScopes(['PROJECT','MATERIALS']),['PROJECT','MATERIALS']);
});
