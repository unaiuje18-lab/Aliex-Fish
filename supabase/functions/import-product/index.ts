import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - No token provided' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.user.id;
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Permission check failed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isAdmin = !!roleData;

    if (!isAdmin) {
      const { data: permData, error: permError } = await supabase
        .from('user_permissions')
        .select('can_products_create')
        .eq('user_id', userId)
        .maybeSingle();

      if (permError || !permData?.can_products_create) {
        return new Response(
          JSON.stringify({ success: false, error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const importer = getImporter(url);
    if (!importer) {
      return new Response(
        JSON.stringify({ success: false, error: 'Proveedor no soportado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawData = await importer.importProduct(url, apiKey);
    if (!rawData.title || rawData.images.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo extraer datos del producto' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uploadedImages = await uploadImagesToStorage(supabase, rawData.images);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...rawData,
          images: uploadedImages.length > 0 ? uploadedImages : rawData.images,
        },
      }),
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

// ===== Importer registry =====
function getImporter(url: string) {
  const normalized = url.toLowerCase();
  if (normalized.includes('aliexpress.')) return AliExpressImporter;
  return null;
}

// ===== Base types =====
type ImportedProduct = {
  title: string;
  description: string;
  price: string;
  originalPrice: string;
  priceRange: string;
  discount: string;
  images: string[];
  rating: number;
  reviewCount: number;
  ordersCount: number;
  shippingCost: string;
  deliveryTime: string;
  sku: string;
  variants: { group: string; options: { label: string; imageUrl?: string }[] }[];
  slug: string;
  affiliateLink: string;
  aliexpressUrl: string;
};

// ===== AliExpress importer =====
const AliExpressImporter = {
  async importProduct(inputUrl: string, apiKey: string): Promise<ImportedProduct> {
    const { originalInputUrl, formattedUrl, scrapeUrl, mobileUrl, resolvedUrl } = await resolveAliExpressUrl(inputUrl);
    const firecrawl = (targetUrl: string) => scrapeWithFirecrawl(targetUrl, apiKey);

    let first = await firecrawl(scrapeUrl);
    if (!first.ok) throw new Error(first.error || 'Failed to scrape');

    let data = parseAliExpressData(first, originalInputUrl, scrapeUrl);

    if ((!data.title || data.images.length === 0) && first.links.length > 0) {
      const canonicalUrl = extractCanonicalProductUrl(first.html, first.links)
        || extractCanonicalFromHtml(first.html)
        || extractCanonicalFromMetadata(first.metadata);
      if (canonicalUrl && canonicalUrl !== scrapeUrl) {
        const second = await firecrawl(canonicalUrl);
        if (second.ok) {
          data = parseAliExpressData(second, originalInputUrl, canonicalUrl);
        }
      }
    }

    if ((!data.title || data.images.length === 0) && resolvedUrl && resolvedUrl !== scrapeUrl) {
      const third = await firecrawl(resolvedUrl);
      if (third.ok) {
        const canonicalFromThird = extractCanonicalProductUrl(third.html, third.links)
          || extractCanonicalFromHtml(third.html)
          || extractCanonicalFromMetadata(third.metadata);
        if (canonicalFromThird && canonicalFromThird !== resolvedUrl) {
          const fourth = await firecrawl(canonicalFromThird);
          if (fourth.ok) {
            data = parseAliExpressData(fourth, originalInputUrl, canonicalFromThird);
          }
        } else {
          data = parseAliExpressData(third, originalInputUrl, resolvedUrl);
        }
      }
    }

    if ((!data.title || data.images.length === 0) && mobileUrl) {
      const mobile = await firecrawl(mobileUrl);
      if (mobile.ok) {
        data = parseAliExpressData(mobile, originalInputUrl, mobileUrl);
      }
    }

    return data;
  },
};

// ===== Firecrawl =====
async function scrapeWithFirecrawl(targetUrl: string, apiKey: string) {
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: targetUrl,
      formats: ['markdown', 'rawHtml', 'links'],
      onlyMainContent: false,
      waitFor: 10000,
      timeout: 90000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
      actions: [
        { type: 'wait', milliseconds: 5000 },
        { type: 'click', selector: 'body' },
        { type: 'wait', milliseconds: 1000 },
        { type: 'scroll', direction: 'down', amount: 2000 },
        { type: 'wait', milliseconds: 3000 },
        { type: 'scroll', direction: 'up', amount: 2000 },
        { type: 'wait', milliseconds: 2000 },
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Firecrawl API error:', data);
    return { ok: false, error: data.error || 'Failed to scrape', status: response.status };
  }

  return {
    ok: true,
    markdown: data.data?.markdown || data.markdown || '',
    html: data.data?.rawHtml || data.data?.html || data.rawHtml || data.html || '',
    links: data.data?.links || data.links || [],
    metadata: data.data?.metadata || data.metadata || {},
  };
}

// ===== AliExpress URL resolution =====
async function resolveAliExpressUrl(url: string) {
  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }
  const originalInputUrl = formattedUrl;

  const isShortLink = /s\.click\.aliexpress\.com|a\.aliexpress\.com|aliexpress\.ru\/\w+/i.test(formattedUrl);
  let resolvedUrl = '';
  if (isShortLink) {
    try {
      const redirectRes = await fetch(formattedUrl, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      const resolvedCandidate = redirectRes.url;
      if (resolvedCandidate && resolvedCandidate !== formattedUrl) {
        if (containsProductId(resolvedCandidate)) {
          formattedUrl = resolvedCandidate;
        } else {
          resolvedUrl = resolvedCandidate;
        }
      }
    } catch (_) {
      try {
        const redirectRes2 = await fetch(formattedUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        const finalUrl = redirectRes2.url;
        const body = await redirectRes2.text();
        const metaRefresh = body.match(/url=["']?([^"'\s>]+)/i);
        const resolvedCandidate = metaRefresh ? metaRefresh[1] : finalUrl;

        const bodyProductId = extractProductIdFromText(body);
        if (bodyProductId) {
          formattedUrl = `https://www.aliexpress.com/item/${bodyProductId}.html`;
          return buildResolved(formattedUrl, originalInputUrl);
        }

        if (resolvedCandidate && resolvedCandidate !== formattedUrl) {
          if (containsProductId(resolvedCandidate)) {
            formattedUrl = resolvedCandidate;
          } else {
            resolvedUrl = resolvedCandidate;
          }
        }
      } catch (_) {}
    }
  }

  try {
    const urlObj = new URL(formattedUrl);
    formattedUrl = `${urlObj.origin}${urlObj.pathname}`;
  } catch (_) {}

  const productId = extractProductIdFromText(formattedUrl);

  let scrapeUrl = formattedUrl;
  if (productId) {
    scrapeUrl = `https://www.aliexpress.com/item/${productId}.html`;
  }
  const mobileUrl = productId ? `https://m.aliexpress.com/item/${productId}.html` : '';

  return { originalInputUrl, formattedUrl, scrapeUrl, mobileUrl, resolvedUrl };
}

function buildResolved(formattedUrl: string, originalInputUrl: string) {
  const productId = extractProductIdFromText(formattedUrl);
  let scrapeUrl = formattedUrl;
  if (productId) {
    scrapeUrl = `https://www.aliexpress.com/item/${productId}.html`;
  }
  const mobileUrl = productId ? `https://m.aliexpress.com/item/${productId}.html` : '';
  return { originalInputUrl, formattedUrl, scrapeUrl, mobileUrl, resolvedUrl: '' };
}

function extractProductIdFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(?:item\/|productId=|itemId=|\/i\/)(\d{8,})/i);
  return match ? match[1] : null;
}

// ===== Parsing =====
function parseAliExpressData(source: { markdown: string; html: string; links: string[]; metadata: Record<string, unknown> }, affiliateUrl: string, canonicalUrl: string): ImportedProduct {
  const { markdown, html, links, metadata } = source;
  const title = extractTitle(markdown, html, metadata);
  const { price, originalPrice, priceRange } = extractPrices(markdown, metadata);
  const images = extractAllImages(html, markdown, links, metadata);
  const { rating, reviewCount, ordersCount } = extractRatingReviewsOrders(markdown);
  const description = extractDescription(markdown, metadata);
  const { shippingCost, deliveryTime } = extractShipping(markdown);
  const sku = extractSku(html);
  const variants = extractVariants(html);
  const slug = generateSlug(title);

  const finalPrice = price || '0.00';
  const formattedPrice = `€${finalPrice}`;

  return {
    title: title || 'Producto',
    description,
    price: formattedPrice,
    originalPrice: originalPrice || '',
    priceRange: priceRange || '',
    discount: originalPrice && price ? calculateDiscount(formattedPrice, originalPrice) : '',
    images,
    rating,
    reviewCount,
    ordersCount,
    shippingCost,
    deliveryTime,
    sku,
    variants,
    slug: slug || `producto-${Date.now()}`,
    affiliateLink: affiliateUrl,
    aliexpressUrl: canonicalUrl,
  };
}

function extractTitle(markdown: string, html: string, metadata: Record<string, unknown>): string {
  let title = (metadata.title as string) || '';
  if (!title && html) {
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogTitle?.[1]) title = ogTitle[1].trim();
  }
  if (!title && html) {
    const twitterTitle = html.match(/<meta[^>]+name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i);
    if (twitterTitle?.[1]) title = twitterTitle[1].trim();
  }
  if (!title && html) {
    const titleTag = html.match(/<title>([^<]+)<\/title>/i);
    if (titleTag?.[1]) title = titleTag[1].trim();
  }
  title = title.replace(/\s*[-|–]\s*(AliExpress|Aliexpress).*$/i, '').trim();
  title = title.replace(/^\d+(\.\d+)?%?\s*OFF\s*/i, '').trim();
  title = title.replace(/Comprar\s+/i, '').trim();
  if (!title && markdown) {
    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    if (headingMatch) title = headingMatch[1].trim();
  }
  if (title.length > 120) title = title.substring(0, 120).trim();
  return title;
}

function extractDescription(markdown: string, metadata: Record<string, unknown>): string {
  const metaDesc = (metadata.description as string) || '';
  if (metaDesc) return metaDesc.substring(0, 800);
  if (!markdown) return '';
  const lines = markdown.split('\n').map(l => l.trim()).filter(Boolean);
  const paragraph = lines.find(l => l.length > 40 && !l.startsWith('#')) || '';
  return paragraph.substring(0, 800);
}

function extractPrices(markdown: string, metadata: Record<string, unknown>) {
  let price = '';
  let originalPrice = '';
  let priceRange = '';

  const content = markdown + ' ' + ((metadata.description as string) || '') + ' ' + ((metadata.title as string) || '');
  const pricePatterns = [
    /€\s*(\d+(?:[.,]\d{1,2})?)/g,
    /(\d+(?:[.,]\d{1,2})?)\s*€/g,
    /EUR\s*(\d+(?:[.,]\d{1,2})?)/gi,
    /(\d+(?:[.,]\d{1,2})?)\s*EUR/gi,
  ];
  const usdPatterns = [
    /US\s*\$\s*(\d+(?:[.,]\d{1,2})?)/gi,
    /\$\s*(\d+(?:[.,]\d{1,2})?)/g,
  ];

  const allPrices: number[] = [];
  for (const pattern of pricePatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const priceValue = parseFloat(match[1].replace(',', '.'));
      if (priceValue > 0 && priceValue < 10000) allPrices.push(priceValue);
    }
  }
  if (allPrices.length === 0) {
    for (const pattern of usdPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(content)) !== null) {
        const priceValue = parseFloat(match[1].replace(',', '.'));
        if (priceValue > 0 && priceValue < 10000) allPrices.push(priceValue);
      }
    }
  }

  if (allPrices.length > 0) {
    allPrices.sort((a, b) => a - b);
    const lowestPrice = allPrices[0];
    const highestPrice = allPrices[allPrices.length - 1];
    price = lowestPrice.toFixed(2);
    if (allPrices.length > 1 && highestPrice > lowestPrice * 1.2) {
      priceRange = `Desde €${lowestPrice.toFixed(2)}`;
      if (highestPrice > lowestPrice * 1.5) {
        originalPrice = `€${highestPrice.toFixed(2)}`;
      }
    }
  }

  return { price, originalPrice, priceRange };
}

function extractAllImages(html: string, markdown: string, links: string[], metadata: Record<string, unknown>): string[] {
  const images = new Set<string>();
  const contentToSearch = html + ' ' + markdown;

  const alicdnPattern = /https?:\/\/[a-z0-9.-]*alicdn\.com\/[^\s"'<>\\)]+/gi;
  const alicdnProtocolRelativePattern = /\/\/[a-z0-9.-]*alicdn\.com\/[^\s"'<>\\)]+/gi;

  let match;
  alicdnPattern.lastIndex = 0;
  while ((match = alicdnPattern.exec(contentToSearch)) !== null) {
    let url = match[0].replace(/[,;}\]]+$/, '');
    if (url.includes('/kf/') || url.includes('/imgextra/') || /\.(jpg|jpeg|png|webp)/i.test(url)) {
      if (isValidProductImage(url)) images.add(upgradeToMaxResolution(normalizeAlicdnUrl(url)));
    }
  }
  alicdnProtocolRelativePattern.lastIndex = 0;
  while ((match = alicdnProtocolRelativePattern.exec(contentToSearch)) !== null) {
    let url = match[0].replace(/[,;}\]]+$/, '');
    if (url.includes('/kf/') || url.includes('/imgextra/') || /\.(jpg|jpeg|png|webp)/i.test(url)) {
      if (isValidProductImage(url)) images.add(upgradeToMaxResolution(normalizeAlicdnUrl(url)));
    }
  }

  const srcPatterns = [
    /src=["']([^"']+)["']/gi,
    /data-src=["']([^"']+)["']/gi,
    /data-lazy-src=["']([^"']+)["']/gi,
    /data-magnifier-src=["']([^"']+)["']/gi,
    /data-zoom-src=["']([^"']+)["']/gi,
  ];
  for (const pattern of srcPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(contentToSearch)) !== null) {
      const url = match[1];
      if (url.includes('alicdn.com') && isValidProductImage(url)) {
        images.add(upgradeToMaxResolution(normalizeAlicdnUrl(url)));
      }
    }
  }

  const unescapedContent = contentToSearch.replace(/\\u002F/gi, '/').replace(/\\u003A/gi, ':').replace(/\\\//g, '/');
  alicdnPattern.lastIndex = 0;
  while ((match = alicdnPattern.exec(unescapedContent)) !== null) {
    let url = match[0].replace(/[,;}\]]+$/, '');
    if (url.includes('/kf/') || url.includes('/imgextra/') || /\.(jpg|jpeg|png|webp)/i.test(url)) {
      if (isValidProductImage(url)) images.add(upgradeToMaxResolution(normalizeAlicdnUrl(url)));
    }
  }
  alicdnProtocolRelativePattern.lastIndex = 0;
  while ((match = alicdnProtocolRelativePattern.exec(unescapedContent)) !== null) {
    let url = match[0].replace(/[,;}\]]+$/, '');
    if (url.includes('/kf/') || url.includes('/imgextra/') || /\.(jpg|jpeg|png|webp)/i.test(url)) {
      if (isValidProductImage(url)) images.add(upgradeToMaxResolution(normalizeAlicdnUrl(url)));
    }
  }

  for (const link of links) {
    if (link.includes('alicdn.com') && isValidProductImage(link)) {
      images.add(upgradeToMaxResolution(normalizeAlicdnUrl(link)));
    }
  }

  if (metadata.ogImage) {
    const ogImage = metadata.ogImage as string;
    if (isValidProductImage(ogImage)) images.add(upgradeToMaxResolution(normalizeAlicdnUrl(ogImage)));
  }

  const metaStr = JSON.stringify(metadata);
  alicdnPattern.lastIndex = 0;
  while ((match = alicdnPattern.exec(metaStr)) !== null) {
    let url = match[0].replace(/[,;}\]"]+$/, '');
    if (isValidProductImage(url)) images.add(upgradeToMaxResolution(normalizeAlicdnUrl(url)));
  }
  alicdnProtocolRelativePattern.lastIndex = 0;
  while ((match = alicdnProtocolRelativePattern.exec(metaStr)) !== null) {
    let url = match[0].replace(/[,;}\]"]+$/, '');
    if (isValidProductImage(url)) images.add(upgradeToMaxResolution(normalizeAlicdnUrl(url)));
  }

  const jsonPatterns = [
    /"imageUrl"\s*:\s*"([^"]+)"/gi,
    /"image"\s*:\s*"([^"]+)"/gi,
    /"imagePathList"\s*:\s*\[([^\]]+)\]/gi,
    /"images"\s*:\s*\[([^\]]+)\]/gi,
    /imageUrl['"]\s*:\s*['"]([^'"]+)['"]/gi,
  ];
  for (const pattern of jsonPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(contentToSearch)) !== null) {
      const urls = match[1].match(/(https?:\/\/|\/\/)[^\s"',\\]+/gi);
      if (urls) {
        for (let url of urls) {
          url = url.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
          if (url.includes('alicdn.com') && isValidProductImage(url)) {
            images.add(upgradeToMaxResolution(normalizeAlicdnUrl(url)));
          }
        }
      }
    }
  }

  const markdownImagePattern = /!\[[^\]]*\]\(([^)]+)\)/g;
  while ((match = markdownImagePattern.exec(markdown)) !== null) {
    const url = match[1];
    if (url.includes('alicdn.com') && isValidProductImage(url)) {
      images.add(upgradeToMaxResolution(normalizeAlicdnUrl(url)));
    }
  }

  return Array.from(images);
}

function extractRatingReviewsOrders(markdown: string) {
  let rating = 4.5;
  const ratingMatch = markdown.match(/(\d(?:[.,]\d)?)\s*(?:\/\s*5|stars?|estrellas?)/i);
  if (ratingMatch) {
    rating = parseFloat(ratingMatch[1].replace(',', '.'));
    if (rating > 5) rating = 5;
    if (rating < 1) rating = 4.5;
  }

  let reviewCount = Math.floor(Math.random() * 500) + 100;
  const reviewMatch = markdown.match(/(\d+(?:[.,]\d{3})*)\s*(?:reviews?|reseñas?|opiniones?|valoraciones?)/i);
  if (reviewMatch) {
    reviewCount = parseInt(reviewMatch[1].replace(/[.,]/g, ''));
  }

  let ordersCount = Math.floor(Math.random() * 500) + 100;
  const ordersMatch = markdown.match(/(\d+(?:[.,]\d{3})*)\s*(?:ventas?|pedidos?|orders?)/i);
  if (ordersMatch) {
    ordersCount = parseInt(ordersMatch[1].replace(/[.,]/g, ''));
  }

  return { rating, reviewCount, ordersCount };
}

function extractShipping(markdown: string) {
  let shippingCost = '';
  let deliveryTime = '';

  const shipMatch = markdown.match(/(?:env[ií]o|shipping)[^\n]*?(\d+(?:[.,]\d{1,2})?)\s*(€|EUR|\$|US)/i);
  if (shipMatch) {
    shippingCost = `${shipMatch[2] === 'US' ? '$' : shipMatch[2]}${shipMatch[1]}`;
  }

  const deliveryMatch = markdown.match(/(?:entrega|delivery)[^\n]*?(\d+\s*(?:-|a)?\s*\d*\s*d[ií]as?)/i);
  if (deliveryMatch) {
    deliveryTime = deliveryMatch[1];
  }

  return { shippingCost, deliveryTime };
}

function extractSku(html: string): string {
  const skuMatch = html.match(/"sku"\s*:\s*"([^"]+)"/i);
  if (skuMatch?.[1]) return skuMatch[1];
  const skuAlt = html.match(/SKU[:\s]*([A-Z0-9-]+)/i);
  if (skuAlt?.[1]) return skuAlt[1];
  return '';
}

function extractVariants(html: string): { group: string; options: { label: string; imageUrl?: string }[] }[] {
  const variants: { group: string; options: { label: string; imageUrl?: string }[] }[] = [];
  const match = html.match(/"skuProperties"\s*:\s*(\[[\s\S]*?\])\s*,\s*"skuPrice"/i);
  if (!match?.[1]) return variants;

  try {
    const json = JSON.parse(match[1]);
    if (Array.isArray(json)) {
      for (const prop of json) {
        const group = String(prop?.skuPropertyName || prop?.name || '').trim();
        const values = prop?.values || prop?.skuPropertyValues || [];
        if (!group || !Array.isArray(values)) continue;
        const options = values.map((v: any) => ({
          label: String(v?.propertyValueDisplayName || v?.name || v?.value || '').trim(),
          imageUrl: v?.skuPropertyImagePath || v?.imageUrl || v?.skuPropertyImage,
        })).filter((o: any) => o.label);
        if (options.length > 0) variants.push({ group, options });
      }
    }
  } catch (_) {}

  return variants;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function calculateDiscount(currentPrice: string, originalPrice: string): string {
  const current = parseFloat(currentPrice.replace(/[€$]/g, '').replace(',', '.'));
  const original = parseFloat(originalPrice.replace(/[€$]/g, '').replace(',', '.'));
  if (original > current && current > 0) {
    const discount = Math.round(((original - current) / original) * 100);
    if (discount > 0 && discount < 100) return `-${discount}%`;
  }
  return '';
}

// ===== Helpers =====
function containsProductId(url: string): boolean {
  return /(?:item\/|productId=|itemId=|\/i\/)(\d{8,})/i.test(url);
}

function normalizeAlicdnUrl(url: string): string {
  if (!url) return url;
  let out = url.trim();
  if (out.startsWith('//')) out = `https:${out}`;
  if (out.startsWith('http://')) out = out.replace('http://', 'https://');
  return out;
}

function isValidProductImage(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.length < 20) return false;
  const isImage = /\.(jpg|jpeg|png|webp)(\?|$|_|\.)/i.test(url) || url.includes('/kf/') || url.includes('/imgextra/');
  if (!isImage) return false;

  const excludePatterns = [
    /avatar/i, /icon/i, /logo(?!.*product)/i, /sprite/i, /placeholder/i,
    /loading/i, /blank/i, /transparent/i, /pixel/i, /spacer/i,
    /flag/i, /badge/i, /button/i, /banner(?!.*product)/i,
    /bg[-_]/i, /background/i,
    /assets\/img/i, /static\/images/i,
    /s\.alicdn\.com/i,
    /g\.alicdn\.com/i,
    /gw\.alicdn\.com/i,
    /laz-img-cdn/i,
    /facebook/i, /twitter/i, /google/i, /pinterest/i,
    /_16x16/i, /_20x20/i, /_24x24/i, /_32x32/i, /_40x40/i,
    /_48x48/i, /_50x50/i, /_60x60/i, /_64x64/i,
  ];
  for (const pattern of excludePatterns) {
    if (pattern.test(url)) return false;
  }
  return true;
}

function upgradeToMaxResolution(url: string): string {
  let upgraded = url;
  upgraded = upgraded.replace(/_\d+x\d+(\.(jpg|jpeg|png|webp))/gi, '$1');
  upgraded = upgraded.replace(/_Q\d+/gi, '');
  upgraded = upgraded.replace(/\.(jpg|jpeg|png|webp)_[^\s"'<>]*/gi, '.$1');
  upgraded = upgraded.replace(/\.(jpg|jpeg|png)\.webp/gi, '.$1');
  upgraded = upgraded.replace(/_(\d+x\d+)/gi, '');
  upgraded = upgraded.replace(/\.(jpg|jpeg|png|webp)\.(jpg|jpeg|png|webp)/gi, '.$1');
  return upgraded;
}

function extractCanonicalProductUrl(html: string, links: string[]): string | null {
  const candidates: string[] = [];
  for (const link of links) {
    if (/aliexpress\.com\/item\/\d+\.html/i.test(link)) candidates.push(link);
  }
  const htmlMatch = html.match(/https?:\/\/[a-z0-9.-]*aliexpress\.com\/item\/\d+\.html/gi);
  if (htmlMatch) candidates.push(...htmlMatch);
  if (candidates.length === 0) return null;
  const unique = Array.from(new Set(candidates));
  return unique.find(u => u.includes('www.aliexpress.com')) || unique[0];
}

function extractCanonicalFromHtml(html: string): string | null {
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (canonicalMatch?.[1]) return canonicalMatch[1];
  const ogUrlMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
  if (ogUrlMatch?.[1]) return ogUrlMatch[1];
  return null;
}

function extractCanonicalFromMetadata(metadata: Record<string, unknown>): string | null {
  const ogUrl = metadata.ogUrl as string | undefined;
  if (ogUrl) return ogUrl;
  const canonical = (metadata.canonical as string) || (metadata['canonical_url'] as string);
  if (canonical) return canonical;
  return null;
}

// ===== Storage upload =====
async function uploadImagesToStorage(supabase: ReturnType<typeof createClient>, urls: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const arrayBuffer = await res.arrayBuffer();
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, arrayBuffer, { contentType, upsert: false });

      if (uploadError) continue;

      const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
      if (data?.publicUrl) results.push(data.publicUrl);
    } catch (_) {}
  }
  return results;
}
