// api/products-debug.js
// Token-gated diagnostic endpoint. Returns the same data as /api/products
// plus a `dropped` array describing every Printful sync product that was
// silently filtered out, with the reason. Use this to audit "why isn't this
// item showing up?" without grepping through Vercel logs.
//
// Usage:
//   GET /api/products-debug?token=<DEBUG_TOKEN>
// Set DEBUG_TOKEN in Vercel env vars (any random string). Without the token
// this endpoint returns 404 so it isn't discoverable.

import { getProductsData } from './products.js';

export default async function handler(req, res) {
  const token = req.query?.token || '';
  const expected = process.env.DEBUG_TOKEN;

  if (!expected || token !== expected) {
    return res.status(404).json({ error: 'not_found' });
  }

  try {
    const { grouped, dropped, totalFromList } = await getProductsData({ collectDrops: true });
    const counts = Object.fromEntries(
      Object.entries(grouped).map(([k, v]) => [k, v.length])
    );
    const totalShown = Object.values(counts).reduce((a, b) => a + b, 0);
    const droppedByReason = dropped.reduce((acc, d) => {
      acc[d.reason] = (acc[d.reason] || 0) + 1;
      return acc;
    }, {});

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      summary: {
        totalFromList,
        totalShown,
        totalDropped: dropped.length,
        droppedByReason,
      },
      counts,
      dropped,
    });
  } catch (err) {
    console.error('[api/products-debug] handler error:', err.message);
    return res.status(502).json({ error: 'upstream_error', message: err.message });
  }
}
