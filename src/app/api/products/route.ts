import { wooJsonWithTotals } from '@/lib/woo';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = searchParams.get('page') ?? '1';
  const perPage = searchParams.get('per_page') ?? '50';
  const search = searchParams.get('search') ?? '';
  const fields = '_fields=id,name,sku,type,manage_stock,stock_quantity,stock_status,regular_price,price';

  const qs = `?page=${page}&per_page=${perPage}&${search ? `search=${encodeURIComponent(search)}&` : ''}${fields}`;
  const { data, total, totalPages } = await wooJsonWithTotals(`/products${qs}`);

  return Response.json({
    items: data,
    total,
    totalPages,
    page: Number(page),
    perPage: Number(perPage),
  });
}
