import { runIntegrationTests } from '@/lib/providers';
import { ok } from '@/lib/infra/api';

export async function GET() {
  return ok({
    results: runIntegrationTests(),
    generatedAt: new Date().toISOString(),
  });
}

export const dynamic = 'force-dynamic';
