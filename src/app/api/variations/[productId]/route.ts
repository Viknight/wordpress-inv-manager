// src/app/api/variations/[productId]/route.ts
import { woo } from '@/lib/woo';

export async function GET(_req: Request, ctx: { params: Promise<{ productId: string }> }) {
  const { productId } = await ctx.params;
  const fields = '_fields=id,sku,regular_price,manage_stock,stock_quantity,stock_status,attributes';
  const data = await woo(`/products/${productId}/variations?per_page=100&${fields}`);
  return Response.json(data);
}
