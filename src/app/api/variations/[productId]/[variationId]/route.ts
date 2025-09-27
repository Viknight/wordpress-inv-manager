// src/app/api/variations/[productId]/[variationId]/route.ts
import { woo } from '@/lib/woo';

export async function PUT(req: Request, ctx: { params: Promise<{ productId: string; variationId: string }> }) {
  const { productId, variationId } = await ctx.params;
  const body = await req.json();
  if (body.regular_price !== undefined) body.regular_price = String(body.regular_price);
  const data = await woo(`/products/${productId}/variations/${variationId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return Response.json(data);
}
