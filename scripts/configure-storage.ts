import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'project-documents';
const configuredLimit = Number.parseInt(process.env.MAX_UPLOAD_BYTES ?? '', 10);
const fileSizeLimit =
  Number.isFinite(configuredLimit) && configuredLimit > 0
    ? Math.min(configuredLimit, 100 * 1024 * 1024)
    : 25 * 1024 * 1024;

if (!url || !serviceRoleKey)
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const bucketOptions = {
  public: false,
  fileSizeLimit,
  allowedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
  ],
};

const { data: buckets, error: listError } =
  await supabase.storage.listBuckets();
if (listError) throw listError;

const result = buckets.some((item) => item.name === bucket)
  ? await supabase.storage.updateBucket(bucket, bucketOptions)
  : await supabase.storage.createBucket(bucket, bucketOptions);

if (result.error) throw result.error;
console.log(`Private storage bucket '${bucket}' is configured.`);
