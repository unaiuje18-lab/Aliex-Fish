const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve URL
    const { scrapeUrl, mobileUrl, originalInputUrl } = await resolveAliExpressUrl(url);
    console.log('Scraping:', scrapeUrl);

    // Try desktop first, then mobile as fallback
    let result = await scrapeWithFirecrawl(scrapeUrl, apiKey);
    let productData = result.ok ? parseAliExpressData(result, originalInputUrl, scrapeUrl) : null;

    // If desktop failed or got no data, try mobile URL (lighter page)
    if ((!productData?.title || productData.images.length === 0) && mobileUrl) {
      console.log('Trying mobile URL:', mobileUrl);
      const mobileResult = await scrapeWithFirecrawl(mobileUrl, apiKey);
      if (mobileResult.ok) {
        const mobileData = parseAliExpressData(mobileResult, originalInputUrl, mobileUrl);
        if (mobileData.title && mobileData.images.length > 0) {
          productData = mobileData;
        }
      }
    }

    if (!productData?.title || productData.images.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo extraer datos del producto. Verifica que el link sea correcto.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracted: "${productData.title}", ${productData.images.length} images`);

    return new Response(
      JSON.stringify({ success: true, data: productData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to import';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ===== Firecrawl scrape - LIGHTWEIGHT, no actions =====
async function scrapeWithFirecrawl(targetUrl: string, apiKey: string) {
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: targetUrl,
      formats: ['markdown', 'html', 'links'],
      onlyMainContent: false,
      waitFor: 3000,
      timeout: 30000,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Firecrawl error:', data);
    return { ok: false as const, error: data.error || 'Scrape failed' };
  }

  return {
    ok: true as const,
    markdown: data.data?.markdown || data.markdown || '',
    html: data.data?.html || data.data?.rawHtml || data.html || '',
    links: data.data?.links || data.links || [],
    metadata: data.data?.metadata || data.metadata || {},
  };
}

// ===== URL resolution =====
async function resolveAliExpressUrl(url: string) {
  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;
  const originalInputUrl = formattedUrl;

  // Resolve short/affiliate links
  const isShortLink = /s\.click\.aliexpress|a\.aliexpress|aliexpress\.ru\/\w+/i.test(formattedUrl);
  if (isShortLink) {
    try {
      const res = await fetch(formattedUrl, { method: 'HEAD', redirect: 'follow' });
      if (res.url && res.url !== formattedUrl) formattedUrl = res.url;
    } catch {
      try {
        const res = await fetch(formattedUrl, { redirect: 'follow' });
        const body = await res.text();
        const productId = extractProductId(body) || extractProductId(res.url);
        if (productId) formattedUrl = `https://www.aliexpress.com/item/${productId}.html`;
        else if (res.url !== formattedUrl) formattedUrl = res.url;
      } catch { /* keep original */ }
    }
  }

  // Strip query params
  try { formattedUrl = new URL(formattedUrl).origin + new URL(formattedUrl).pathname; } catch {}

  const productId = extractProductId(formattedUrl);
  const scrapeUrl = productId ? `https://www.aliexpress.com/item/${productId}.html` : formattedUrl;
  const mobileUrl = productId ? `https://m.aliexpress.com/item/${productId}.html` : '';

  return { scrapeUrl, mobileUrl, originalInputUrl };
}

function extractProductId(text: string): string | null {
  if (!text) return null;
  const m = text.match(/(?:item\/|productId=|itemId=|\/i\/)(\d{8,})/i);
  return m ? m[1] : null;
}

// ===== Parsing =====
type ScrapeResult = { ok: true; markdown: string; html: string; links: string[]; metadata: Record<string, unknown> };

function parseAliExpressData(source: ScrapeResult, affiliateUrl: string, canonicalUrl: string) {
  const { markdown, html, metadata } = source;
  const title = extractTitle(markdown, html, metadata);
  const { price, originalPrice, priceRange } = extractPrices(markdown, metadata);
  const images = extractImages(html, markdown);
  const description = extractDescription(markdown, metadata);
  const slug = generateSlug(title);

  const finalPrice = price || '0.00';

  return {
    title: title || '',
    subtitle: ((metadata.description as string) || '').substring(0, 100),
    description,
    price: `€${finalPrice}`,
    originalPrice: originalPrice || '',
    priceRange: priceRange || '',
    discount: originalPrice && price ? calculateDiscount(`€${finalPrice}`, originalPrice) : '',
    images,
    rating: 4.5,
    reviewCount: 0,
    ordersCount: 0,
    shippingCost: '',
    deliveryTime: '',
    sku: '',
    variants: [] as { group: string; options: { label: string; imageUrl?: string }[] }[],
    slug: slug || `producto-${Date.now()}`,
    affiliateLink: affiliateUrl,
    aliexpressUrl: canonicalUrl,
  };
}

function extractTitle(markdown: string, html: string, metadata: Record<string, unknown>): string {
  let title = (metadata.title as string) || '';
  if (!title && html) {
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (og?.[1]) title = og[1].trim();
  }
  if (!title && html) {
    const t = html.match(/<title>([^<]+)<\/title>/i);
    if (t?.[1]) title = t[1].trim();
  }
  title = title.replace(/\s*[-|–]\s*(AliExpress|Aliexpress).*$/i, '').trim();
  title = title.replace(/^\d+(\.\d+)?%?\s*OFF\s*/i, '').trim();
  title = title.replace(/Comprar\s+/i, '').trim();
  if (!title && markdown) {
    const h = markdown.match(/^#\s+(.+)$/m);
    if (h) title = h[1].trim();
  }
  return title.substring(0, 120);
}

function extractDescription(markdown: string, metadata: Record<string, unknown>): string {
  const meta = (metadata.description as string) || '';
  if (meta) return meta.substring(0, 800);
  if (!markdown) return '';
  const line = markdown.split('\n').map(l => l.trim()).filter(Boolean).find(l => l.length > 40 && !l.startsWith('#'));
  return (line || '').substring(0, 800);
}

function extractPrices(markdown: string, metadata: Record<string, unknown>) {
  const content = markdown + ' ' + ((metadata.description as string) || '') + ' ' + ((metadata.title as string) || '');
  const patterns = [/€\s*(\d+(?:[.,]\d{1,2})?)/g, /(\d+(?:[.,]\d{1,2})?)\s*€/g, /US\s*\$\s*(\d+(?:[.,]\d{1,2})?)/gi, /\$\s*(\d+(?:[.,]\d{1,2})?)/g];
  const prices: number[] = [];

  for (const p of patterns) {
    p.lastIndex = 0;
    let m;
    while ((m = p.exec(content)) !== null) {
      const v = parseFloat(m[1].replace(',', '.'));
      if (v > 0 && v < 10000) prices.push(v);
    }
    if (prices.length > 0) break; // Use first currency found
  }

  if (prices.length === 0) return { price: '', originalPrice: '', priceRange: '' };
  prices.sort((a, b) => a - b);
  const lo = prices[0], hi = prices[prices.length - 1];
  return {
    price: lo.toFixed(2),
    originalPrice: hi > lo * 1.5 ? `€${hi.toFixed(2)}` : '',
    priceRange: prices.length > 1 && hi > lo * 1.2 ? `Desde €${lo.toFixed(2)}` : '',
  };
}

function extractImages(html: string, markdown: string): string[] {
  const images = new Set<string>();
  const content = html + ' ' + markdown;

  // alicdn URLs
  const pattern = /(?:https?:)?\/\/[a-z0-9.-]*alicdn\.com\/[^\s"'<>)]+/gi;
  let m;
  while ((m = pattern.exec(content)) !== null) {
    let url = m[0].replace(/[,;}\]]+$/, '');
    if (!url.startsWith('http')) url = 'https:' + url;
    if (url.includes('/kf/') || url.includes('/imgextra/') || /\.(jpg|jpeg|png|webp)/i.test(url)) {
      if (!url.includes('icon') && !url.includes('logo') && !url.includes('flag') && !url.includes('avatar')) {
        // Max resolution
        url = url.replace(/_\d+x\d+\w*\./g, '.').replace(/\.\d+x\d+\./g, '.');
        images.add(url);
      }
    }
  }

  // og:image
  if (html) {
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (og?.[1] && og[1].includes('alicdn')) images.add(og[1]);
  }

  return [...images].slice(0, 20);
}

function generateSlug(title: string): string {
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 80) || `producto-${Date.now()}`;
}

function calculateDiscount(currentPrice: string, originalPrice: string): string {
  const current = parseFloat(currentPrice.replace(/[^0-9.,]/g, '').replace(',', '.'));
  const original = parseFloat(originalPrice.replace(/[^0-9.,]/g, '').replace(',', '.'));
  if (!current || !original || original <= current) return '';
  return `-${Math.round(((original - current) / original) * 100)}%`;
}

function containsProductId(url: string): boolean {
  return /(?:item\/|productId=|itemId=|\/i\/)\d{8,}/i.test(url);
}
