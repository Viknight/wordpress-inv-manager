// src/app/api/products/batch/route.ts
import { woo } from '@/lib/woo';

type Update = {
  id: number;
  regular_price?: string;
  manage_stock?: boolean;
  stock_quantity?: number;
};
type Body = { update?: Update[] };

export async function POST(req: Request) {
  const raw = (await req.json()) as unknown;

  const payload: Body = {};
  // Narrow unknown → { update: unknown[] }
  if (raw && typeof raw === 'object' && 'update' in (raw as Record<string, unknown>)) {
    const arr = (raw as { update: unknown }).update;
    if (Array.isArray(arr)) {
      payload.update = arr.map((u0) => {
        const u = u0 as Record<string, unknown>;
        const out: Update = { id: Number(u['id'] as string | number) };
        if (u['regular_price'] !== undefined) out.regular_price = String(u['regular_price']);
        if (u['manage_stock']  !== undefined) out.manage_stock  = Boolean(u['manage_stock']);
        if (u['stock_quantity']!== undefined) out.stock_quantity= Number(u['stock_quantity']);
        return out;
      });
    }
  }

  const data = await woo(`/products/batch`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return Response.json(data);
}
