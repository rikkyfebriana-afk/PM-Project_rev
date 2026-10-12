'use client';
import {useActionState} from 'react';
import {saveViewerPermission} from '@/app/actions/viewer-permissions';
import {viewerScopes,viewerScopeLabels,defaultViewerScopes} from '@/lib/viewer-permissions/model';
import {idleState} from '@/lib/operations/validation';
import {buttonClass,MutationFeedback} from './workspace-ui';
export function ViewerPermissionForm({userId,projectId,scopes,version}:{userId:string;projectId:string;scopes?:string[];version:number}) {
 const [state,action,pending]=useActionState(saveViewerPermission,idleState);
 return <form action={action} className="space-y-3"><input type="hidden" name="userId" value={userId}/><input type="hidden" name="projectId" value={projectId}/><input type="hidden" name="version" value={version}/><fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">{viewerScopes.map(scope=><label key={scope} className="flex items-start gap-2 text-sm"><input type="checkbox" name="scopes" value={scope} defaultChecked={(scopes??defaultViewerScopes).includes(scope)}/>{viewerScopeLabels[scope]}</label>)}<button className={buttonClass}>Simpan izin Viewer</button></fieldset><MutationFeedback state={state}/></form>;
}
