import {createHash} from 'node:crypto';

export function permissionSnapshot(rows: {id:string;viewerPermissions:{version:number}[]}[]) {
 return createHash('sha256').update(JSON.stringify(rows.map(p=>[p.id,p.viewerPermissions[0]?.version??0]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))).digest('hex');
}
