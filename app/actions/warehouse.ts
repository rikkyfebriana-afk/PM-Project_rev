'use server';
import {revalidatePath} from 'next/cache';
import {getCurrentUser,isLocalDemoMode} from '@/lib/auth/session';
import {hasFullAccess} from '@/lib/auth/roles';
import {prisma} from '@/lib/prisma';
import type {MutationState} from '@/lib/operations/validation';
import {recordWarehouseMovement} from '@/lib/warehouse/transactions';
import {WarehouseError,warehouseItemSchema,warehouseReceiptSchema,warehouseIssueSchema,warehouseReturnSchema} from '@/lib/warehouse/validation';

const denied:MutationState={status:'error',message:'Stok gudang hanya dapat dikelola Admin atau Project Manager.'};
function refresh(){for(const path of ['/warehouse','/materials','/boq','/dashboard','/actions','/reports'])revalidatePath(path);}
function failure(error:unknown):MutationState {
 if(error instanceof WarehouseError)return {status:'error',message:error.message};
 const code=typeof error==='object'&&error!==null&&'code' in error?String(error.code):'UNKNOWN';
 console.error('Warehouse transaction failed',{code});
 if(code==='P2002')return {status:'error',message:'Kode material atau nomor permintaan sudah digunakan. Muat ulang daftar.'};
 if(code==='P2028'||code==='P2034'||code==='P2024')return {status:'error',message:'Transaksi belum tersimpan karena antrean / perubahan bersamaan. Coba simpan kembali dengan form yang sama.'};
 return {status:'error',message:'Transaksi gudang belum dapat disimpan. Coba kembali dengan form yang sama.'};
}
export async function createWarehouseItem(_:MutationState,form:FormData):Promise<MutationState> {
 const user=await getCurrentUser();if(!user||!hasFullAccess(user.role)||isLocalDemoMode())return denied;
 const parsed=warehouseItemSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success)return {status:'error',message:parsed.error.issues[0]?.message??'Periksa data material.'};
 try {
  await prisma.$transaction(async tx=>{
   const item=await tx.warehouseItem.create({data:{...parsed.data,normalizedCode:parsed.data.code}});
   await tx.auditLog.create({data:{userId:user.id,entityType:'WarehouseItem',entityId:item.id,action:'WAREHOUSE_ITEM_CREATED',metadata:{code:item.code,unit:item.unit}}});
  });
  refresh();return {status:'success',message:'Material gudang dibuat. Catat saldo awal melalui Barang masuk.'};
 }catch(error){return failure(error);}
}
export async function receiveWarehouseStock(_:MutationState,form:FormData):Promise<MutationState> {
 const user=await getCurrentUser();if(!user||!hasFullAccess(user.role)||isLocalDemoMode())return denied;
 const parsed=warehouseReceiptSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success)return {status:'error',message:parsed.error.issues[0]?.message??'Periksa transaksi.'};
 try {const result=await recordWarehouseMovement(user,'RECEIPT',parsed.data);refresh();return {status:'success',message:result.duplicate?'Transaksi sudah tercatat; stok tidak ditambahkan dua kali.':'Barang masuk tercatat dan stok gudang bertambah.'};}catch(error){return failure(error);}
}
export async function issueWarehouseStock(_:MutationState,form:FormData):Promise<MutationState> {
 const user=await getCurrentUser();if(!user||!hasFullAccess(user.role)||isLocalDemoMode())return denied;
 const parsed=warehouseIssueSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success)return {status:'error',message:parsed.error.issues[0]?.message??'Periksa transaksi.'};
 try {const result=await recordWarehouseMovement(user,'ISSUE',parsed.data);refresh();return {status:'success',message:result.duplicate?'Pengambilan sudah tercatat; stok tidak dikurangi dua kali.':'Pengambilan dikonfirmasi. Stok gudang berkurang dan material diterima proyek bertambah.'};}catch(error){return failure(error);}
}
export async function returnWarehouseStock(_:MutationState,form:FormData):Promise<MutationState> {
 const user=await getCurrentUser();if(!user||!hasFullAccess(user.role)||isLocalDemoMode())return denied;
 const parsed=warehouseReturnSchema.safeParse(Object.fromEntries(form));
 if(!parsed.success)return {status:'error',message:parsed.error.issues[0]?.message??'Periksa transaksi.'};
 try {const result=await recordWarehouseMovement(user,'RETURN',parsed.data);refresh();return {status:'success',message:result.duplicate?'Retur sudah tercatat; stok tidak ditambahkan dua kali.':'Retur tercatat. Stok gudang bertambah dan saldo material proyek disesuaikan.'};}catch(error){return failure(error);}
}
