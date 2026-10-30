import 'server-only';
import {createHash} from 'node:crypto';
import {Prisma} from '@/generated/prisma/client';
import type {CurrentUser} from '@/lib/auth/session';
import {hasFullAccess} from '@/lib/auth/roles';
import {prisma} from '@/lib/prisma';
import {reconcileMaterialStatus} from '@/lib/materials/validation';
import {WarehouseError,normalizeWarehouseToken,warehouseMaxQuantity} from './validation';
import type {z} from 'zod';
import type {warehouseReceiptSchema,warehouseIssueSchema,warehouseReturnSchema} from './validation';

type MovementKind='RECEIPT'|'ISSUE'|'RETURN';
type MovementInput=z.infer<typeof warehouseReceiptSchema>|z.infer<typeof warehouseIssueSchema>|z.infer<typeof warehouseReturnSchema>;

async function lockProject(tx:Prisma.TransactionClient,id:string,allowArchived:boolean) {
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`;
 await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id"=${id} FOR UPDATE`;
 const p=await tx.project.findUnique({where:{id},select:{id:true,status:true,deletedAt:true}});
 if(!p||(!allowArchived&&(p.deletedAt||!['ACTIVE','ON_HOLD'].includes(p.status)))) throw new WarehouseError('Pengambilan hanya untuk proyek aktif / on hold yang belum diarsipkan.');
}

function checkReplay(previous:{payloadHash:string}|null,hash:string) {
 if(!previous)return false;
 if(previous.payloadHash!==hash)throw new WarehouseError('Nomor permintaan sudah digunakan untuk transaksi berbeda. Muat ulang form.');
 return true;
}

export async function recordWarehouseMovement(actor:CurrentUser,type:MovementKind,input:MovementInput) {
 if(!hasFullAccess(actor.role))throw new WarehouseError('Hanya Admin atau Project Manager yang dapat mengelola stok gudang.');
 const hash=createHash('sha256').update(JSON.stringify({type,actorId:actor.id,input})).digest('hex');
 try {
  return await prisma.$transaction(async tx=>{
   if(checkReplay(await tx.warehouseMovement.findUnique({where:{requestId:input.requestId},select:{payloadHash:true}}),hash))return {duplicate:true};
   const original=type==='RETURN'&&'issueId' in input?await tx.warehouseMovement.findUnique({where:{id:input.issueId}}):null;
   if(type==='RETURN'&&(!original||original.type!=='ISSUE'||!original.projectId||!original.materialId||!original.boqItemId))throw new WarehouseError('Transaksi pengambilan asal tidak ditemukan.');
   const locator=type==='ISSUE'&&'materialId' in input?await tx.material.findUnique({where:{id:input.materialId},select:{projectId:true}}):null;
   if(type==='ISSUE'&&!locator)throw new WarehouseError('Pilih item material dari BoQ approved.');
   const projectId=type==='ISSUE'?locator!.projectId:type==='RETURN'?original!.projectId:null;
   if(projectId)await lockProject(tx,projectId,type==='RETURN');
   const warehouseItemId=type==='RETURN'?original!.warehouseItemId:'warehouseItemId' in input?input.warehouseItemId:'';
   await tx.$queryRaw`SELECT "id" FROM "WarehouseItem" WHERE "id"=${warehouseItemId} FOR UPDATE`;
   const stock=await tx.warehouseItem.findUnique({where:{id:warehouseItemId}});
   if(!stock)throw new WarehouseError('Material gudang tidak ditemukan.');
   if(checkReplay(await tx.warehouseMovement.findUnique({where:{requestId:input.requestId},select:{payloadHash:true}}),hash))return {duplicate:true};
   const qty=new Prisma.Decimal(input.quantity);
   let balance=stock.quantity,materialId:string|null=null,boqItemId:string|null=null;
   let receivedBefore:string|null=null,receivedAfter:string|null=null;
   if(type==='RECEIPT') {
    balance=balance.plus(qty);
   } else {
    materialId=type==='ISSUE'&&'materialId' in input?input.materialId:original!.materialId!;
    const material=await tx.material.findUnique({where:{id:materialId},include:{boqItem:{include:{boq:true}}}});
    if(!material||material.projectId!==projectId)throw new WarehouseError('Material proyek tidak ditemukan.');
    receivedBefore=material.receivedQty.toString();
    let received=material.receivedQty,issued=material.warehouseIssuedQty;
    if(type==='ISSUE') {
     if(!material.isActive||material.boqItem?.itemType!=='MATERIAL'||material.boqItem.boq.status!=='APPROVED')throw new WarehouseError('Pengambilan harus memakai material aktif dari BoQ approved.');
     if(material.normalizedCode!==stock.normalizedCode||normalizeWarehouseToken(material.unit)!==stock.unit)throw new WarehouseError('Kode material dan satuan gudang harus sama dengan item BoQ.');
     if(qty.gt(stock.quantity))throw new WarehouseError('Stok gudang tidak mencukupi.');
     if(qty.gt(material.requiredQty.minus(received)))throw new WarehouseError('Quantity melebihi sisa kebutuhan BoQ proyek.');
     received=received.plus(qty);issued=issued.plus(qty);balance=balance.minus(qty);boqItemId=material.boqItemId;
    } else {
     const returns=await tx.warehouseMovement.aggregate({where:{returnOfId:original!.id,type:'RETURN'},_sum:{quantity:true}});
     const remaining=original!.quantity.minus(returns._sum.quantity??0);
     if(qty.gt(remaining))throw new WarehouseError('Quantity retur melebihi sisa pengambilan asal.');
     if(qty.gt(issued)||qty.gt(received.minus(material.installedQty)))throw new WarehouseError('Hanya material gudang yang belum terpasang / terpakai yang dapat diretur.');
     received=received.minus(qty);issued=issued.minus(qty);balance=balance.plus(qty);boqItemId=original!.boqItemId;
    }
    const status=reconcileMaterialStatus(material.status,{requiredQty:material.requiredQty,orderedQty:material.orderedQty,receivedQty:received,installedQty:material.installedQty});
    await tx.material.update({where:{id:material.id},data:{receivedQty:received,warehouseIssuedQty:issued,status}});
    receivedAfter=received.toString();
   }
   if(balance.gt(warehouseMaxQuantity))throw new WarehouseError('Saldo stok melampaui batas quantity.');
   await tx.warehouseItem.update({where:{id:stock.id},data:{quantity:balance}});
   const movement=await tx.warehouseMovement.create({data:{requestId:input.requestId,payloadHash:hash,actorId:actor.id,type,quantity:qty,balanceAfter:balance,warehouseItemId:stock.id,projectId,materialId,boqItemId,returnOfId:original?.id??null,referenceNo:input.referenceNo,recipient:input.recipient,notes:input.notes}});
   await tx.auditLog.create({data:{userId:actor.id,projectId,entityType:'WarehouseMovement',entityId:movement.id,action:`WAREHOUSE_${type}`,metadata:{warehouseItemId:stock.id,quantity:qty.toString(),balanceBefore:stock.quantity.toString(),balanceAfter:balance.toString(),receivedBefore,receivedAfter}}});
   return {duplicate:false};
  },{timeout:15000,maxWait:10000});
 }catch(error){
  // A request racing on another stock row can reach the unique key at commit.
  if(typeof error==='object'&&error!==null&&'code' in error&&error.code==='P2002') {
   const previous=await prisma.warehouseMovement.findUnique({where:{requestId:input.requestId},select:{payloadHash:true}});
   if(checkReplay(previous,hash))return {duplicate:true};
  }
  throw error;
 }
}
