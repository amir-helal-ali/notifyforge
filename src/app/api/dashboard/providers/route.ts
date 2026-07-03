import { getProviderHealthSnapshot } from '@/lib/provider-health';
import { ok } from '@/lib/infra/api';

export async function GET() {
  return ok(getProviderHealthSnapshot());
}

export const dynamic = 'force-dynamic';
