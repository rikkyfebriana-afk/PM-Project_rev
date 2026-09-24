import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  outputFileTracingIncludes: { '/*': ['./certs/supabase-ca.crt'] },
};

export default nextConfig;
