import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError } from '@/lib/infra/api';

export async function GET() {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  return ok(ctx);
}

export const dynamic = 'force-dynamic';
