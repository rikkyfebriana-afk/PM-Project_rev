import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMetadataUrl } from '../lib/metadata-url.ts';

test('metadata accepts an explicit application URL and normalizes its origin', () => {
  assert.equal(
    resolveMetadataUrl({ APP_URL: ' https://example.com/path ' }).href,
    'https://example.com/',
  );
});

test('empty, whitespace and missing APP_URL do not crash the build', () => {
  for (const APP_URL of [undefined, '', '   ']) {
    assert.equal(
      resolveMetadataUrl({ APP_URL }).href,
      'http://localhost:3000/',
    );
  }
});

test('metadata falls back to the stable Vercel production domain then deployment domain', () => {
  assert.equal(
    resolveMetadataUrl({
      APP_URL: '',
      VERCEL_PROJECT_PRODUCTION_URL: 'project.vercel.app',
      VERCEL_URL: 'preview.vercel.app',
    }).href,
    'https://project.vercel.app/',
  );
  assert.equal(
    resolveMetadataUrl({ APP_URL: 'invalid', VERCEL_URL: 'preview.vercel.app' })
      .href,
    'https://preview.vercel.app/',
  );
});

test('metadata rejects invalid schemes and credentials without exposing them', () => {
  for (const APP_URL of [
    'javascript:alert(1)',
    'ftp://example.com',
    'https://user:password@example.com',
    'https://',
  ]) {
    assert.equal(
      resolveMetadataUrl({ APP_URL, VERCEL_PROJECT_PRODUCTION_URL: 'bad host' })
        .href,
      'http://localhost:3000/',
    );
  }
});
