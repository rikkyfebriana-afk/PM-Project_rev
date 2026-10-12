export const viewerScopes = ['PROJECT','PO','FINANCE','BOQ','DOCUMENTS','TIME_PLAN','TEAM_TARGETS','OPERATIONS'] as const;
export type ViewerScope = typeof viewerScopes[number];
export const viewerScopeLabels:Record<ViewerScope,string>={PROJECT:'Proyek di dashboard',PO:'Nomor, status & nilai PO Customer',FINANCE:'Budget, actual, forecast & margin',BOQ:'BoQ & harga satuan',DOCUMENTS:'Dokumen & unduhan (termasuk komersial)',TIME_PLAN:'Time Plan',TEAM_TARGETS:'Target Tim',OPERATIONS:'Material, produksi, FAT, delivery & site work'};
export const defaultViewerScopes:ViewerScope[]=['PROJECT','PO'];
export function validateViewerScopes(values:string[]) {
  if(values.some(v=>!viewerScopes.includes(v as ViewerScope))) throw new Error('Jenis izin tidak valid.');
  const result=[...new Set(values)] as ViewerScope[];
  if(result.length&&!result.includes('PROJECT')) throw new Error('Aktifkan izin proyek sebelum memberi izin modul.');
  if(result.includes('FINANCE')&&!result.includes('PO')) throw new Error('Izin Finance juga memerlukan izin PO.');
  return result;
}
