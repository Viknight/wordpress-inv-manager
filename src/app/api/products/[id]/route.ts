// src/app/api/products/[id]/route.ts
import { woo } from '@/lib/woo';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const data = await woo(`/products/${id}`);
  return Response.json(data);
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (body.regular_price !== undefined) body.regular_price = String(body.regular_price);
  const data = await woo(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  return Response.json(data);
}
