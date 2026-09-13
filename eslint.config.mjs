import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    '.next/**',
    '.vinext/**',
    '.wrangler/**',
    '.pnpm-store/**',
    '.codex_xlrd/**',
    'dist/**',
    'generated/**',
    'coverage/**',
    'pm2000_register_map_extracted/**',
  ]),
]);
