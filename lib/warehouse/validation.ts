import {z} from 'zod';
import {Prisma} from '../../generated/prisma/client.ts';

export const warehouseMaxQuantity=new Prisma.Decimal('99999999999999.9999');
export const normalizeWarehouseToken=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/gu,' ').toUpperCase();
const quantity=(positive:boolean)=>z.string().trim().regex(/^\d{1,14}(?:\.\d{1,4})?$/,'Quantity harus angka biasa, maksimal empat desimal.')
 .refine(v=>{if(!/^\d{1,14}(?:\.\d{1,4})?$/.test(v))return false;const n=new Prisma.Decimal(v);return n.lte(warehouseMaxQuantity)&&(positive?n.gt(0):n.gte(0));},'Quantity tidak valid atau di luar batas.')
 .transform(v=>new Prisma.Decimal(v).toFixed(4));
const id=z.string().trim().min(1).max(128);
const token=(max:number)=>z.string().transform(normalizeWarehouseToken).pipe(z.string().min(1).max(max));
export const warehouseItemSchema=z.object({code:token(80),description:z.string().trim().min(2).max(300),unit:token(32),location:z.string().trim().max(120).default(''),minQty:quantity(false).default('0')});
const movementFields={requestId:z.string().uuid(),quantity:quantity(true),referenceNo:z.string().trim().min(1).max(100),recipient:z.string().trim().min(1).max(120),notes:z.string().trim().max(1000).default('')};
export const warehouseReceiptSchema=z.object({...movementFields,warehouseItemId:id});
export const warehouseIssueSchema=z.object({...movementFields,warehouseItemId:id,materialId:id});
export const warehouseReturnSchema=z.object({...movementFields,issueId:id});
export class WarehouseError extends Error {}
