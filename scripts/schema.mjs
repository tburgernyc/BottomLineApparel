// scripts/schema.mjs
// JSON-LD schema generators for prerendered routes. Each helper returns a
// JSON.stringify'd string so callers can drop it straight into the
// `schemaJsonLd` array consumed by emitRoute() — which wraps each entry in
// <script type="application/ld+json">…</script>.
//
// Keep the shapes minimal and aligned with schema.org's recommended fields
// for the corresponding type. We deliberately do NOT emit LocalBusiness
// here — no real NAP (name/address/phone) has been supplied, and shipping
// fake address data to Google's structured-data parser would be worse than
// emitting nothing.

const SITE_URL = 'https://bottomlineapparel.com';

/**
 * Organization schema describing Bottom Line Apparel as the publisher.
 * Returned as a JSON string ready to drop into a JSON-LD <script>.
 */
export function organizationSchema() {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Bottom Line Apparel',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: 'Queer-owned NYC apparel brand making statement tees for gay men.',
    sameAs: ['https://www.tiktok.com/@bottomlineapparel'],
  });
}

/**
 * BreadcrumbList schema. Positions are 1-indexed per schema.org spec.
 *
 * @param {{name: string, url: string}[]} crumbs
 *   e.g. [{name:'Home', url:'https://bottomlineapparel.com/'},
 *         {name:'About', url:'https://bottomlineapparel.com/about/'}]
 */
export function breadcrumbSchema(crumbs) {
  if (!Array.isArray(crumbs) || crumbs.length === 0) {
    throw new Error('breadcrumbSchema: crumbs must be a non-empty array');
  }
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  });
}

/**
 * FAQPage schema. Each FAQ becomes a Question/Answer pair under
 * mainEntity. Source `a` strings are used verbatim — they'll be HTML-text
 * inside JSON, which is fine because the surrounding <script type="json-ld">
 * is not parsed as HTML.
 *
 * @param {{q: string, a: string}[]} faqs
 */
export function faqSchema(faqs) {
  if (!Array.isArray(faqs) || faqs.length === 0) {
    throw new Error('faqSchema: faqs must be a non-empty array');
  }
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.a,
      },
    })),
  });
}

/**
 * Product schema with Offer or AggregateOffer depending on variants.
 */
export function productSchema(product) {
  const offers = product.min_price === product.max_price
    ? {
        '@type': 'Offer',
        url: `${SITE_URL}/products/${product.slug}/`,
        priceCurrency: 'USD',
        price: product.min_price.toFixed(2),
        availability: 'https://schema.org/InStock',
        itemCondition: 'https://schema.org/NewCondition',
      }
    : {
        '@type': 'AggregateOffer',
        url: `${SITE_URL}/products/${product.slug}/`,
        priceCurrency: 'USD',
        lowPrice: product.min_price.toFixed(2),
        highPrice: product.max_price.toFixed(2),
        offerCount: product.variants.length,
        availability: 'https://schema.org/InStock',
      };
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description_text || product.short_description,
    image: product.image,
    sku: String(product.id),
    brand: { '@type': 'Brand', name: 'Bottom Line Apparel' },
    offers,
  });
}
