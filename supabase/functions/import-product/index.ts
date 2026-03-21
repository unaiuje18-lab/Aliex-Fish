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
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
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

    const { productId, originalInputUrl } = await resolveAliExpressUrl(url);
    console.log('Resolved Product ID:', productId);

    if (!productId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo detectar el ID del producto en el link.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl no está configurado. Configura el conector en ajustes.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let productData: ProductData | null = null;

    // Strategy 1: Firecrawl SEARCH (fastest, bypasses anti-bot)
    console.log('Strategy 1: Firecrawl Search for product', productId);
    productData = await tryFirecrawlSearch(productId, apiKey, originalInputUrl);

    // Strategy 2: Firecrawl SCRAPE on a less-protected page
    if (!productData?.title) {
      console.log('Strategy 2: Firecrawl Scrape on mobile');
      productData = await tryFirecrawlScrape(
        `https://m.aliexpress.com/item/${productId}.html`,
        apiKey,
        originalInputUrl
      );
    }

    if (!productData?.title || productData.images.length === 0) {
      console.log('All strategies failed');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se pudo extraer datos. AliExpress puede estar bloqueando. Inténtalo de nuevo.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`SUCCESS: "${productData.title}", ${productData.images.length} images`);

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

// ===== Types =====
interface ProductData {
  title: string;
  subtitle: string;
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
}

// ===== Strategy 1: Firecrawl Search =====
// Searches the web for the product, gets data from search results + scraped page
async function tryFirecrawlSearch(
  productId: string,
  apiKey: string,
  affiliateUrl: string
): Promise<ProductData | null> {
  try {
    const query = `aliexpress ${productId}`;
    console.log('Firecrawl Search query:', query);

    const response = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 3,
        lang: 'es',
        scrapeOptions: {
          formats: ['markdown', 'html'],
        },
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Firecrawl Search error:', response.status, JSON.stringify(result).substring(0, 500));
      return null;
    }

    console.log('Firecrawl Search results:', result.data?.length || 0);

    // Find the best result (the actual product page)
    const results = result.data || [];
    let bestTitle = '';
    let bestDescription = '';
    let bestImages: string[] = [];
    let bestPrice = '';
    let bestOriginalPrice = '';
    let bestHtml = '';
    let bestMarkdown = '';

    for (const item of results) {
      console.log('Search result:', item.url, '| Title:', (item.title || '').substring(0, 60));

      // Get title from search result metadata
      if (!bestTitle && item.title) {
        bestTitle = cleanTitle(item.title);
      }
      if (!bestDescription && item.description) {
        bestDescription = item.description;
      }

      // Parse the scraped content for images and prices
      const html = item.html || '';
      const markdown = item.markdown || '';
      
      if (html) bestHtml += ' ' + html;
      if (markdown) bestMarkdown += ' ' + markdown;

      // Extract images from this result
      const imgs = extractImagesFromContent(html + ' ' + markdown);
      if (imgs.length > bestImages.length) bestImages = imgs;

      // Extract price
      const prices = extractPricesFromContent(html + ' ' + markdown);
      if (prices.price && !bestPrice) {
        bestPrice = prices.price;
        bestOriginalPrice = prices.originalPrice;
      }

      // Also check og:image from metadata
      const ogImage = item.metadata?.ogImage || item.metadata?.['og:image'];
      if (ogImage && typeof ogImage === 'string' && ogImage.includes('alicdn')) {
        bestImages.unshift(cleanImageUrl(ogImage));
      }
    }

    // Deduplicate images
    bestImages = [...new Set(bestImages)];

    if (!bestTitle && !bestImages.length) return null;

    // If we still need more images, try extracting from combined HTML
    if (bestImages.length < 2 && bestHtml) {
      const moreImages = extractImagesFromContent(bestHtml);
      bestImages = [...new Set([...bestImages, ...moreImages])];
    }

    return buildProductData(
      bestTitle, bestImages, bestPrice, bestOriginalPrice,
      bestDescription, affiliateUrl, `https://www.aliexpress.com/item/${productId}.html`
    );
  } catch (e) {
    console.error('Firecrawl Search failed:', e);
    return null;
  }
}

// ===== Strategy 2: Firecrawl Scrape =====
async function tryFirecrawlScrape(
  targetUrl: string,
  apiKey: string,
  affiliateUrl: string
): Promise<ProductData | null> {
  try {
    console.log('Firecrawl Scrape:', targetUrl);
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ['html', 'markdown'],
        onlyMainContent: false,
        waitFor: 8000,
        timeout: 30000,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Firecrawl Scrape error:', response.status);
      return null;
    }

    const html = data.data?.html || '';
    const markdown = data.data?.markdown || '';
    const metadata = data.data?.metadata || {};

    console.log('Firecrawl Scrape - HTML:', html.length, 'MD:', markdown.length);

    const title = metadata?.title || metadata?.ogTitle || extractTitleFromContent(html, markdown);
    const images = extractImagesFromContent(html + ' ' + markdown);
    const ogImage = metadata?.ogImage;
    if (ogImage && typeof ogImage === 'string' && ogImage.includes('alicdn')) {
      images.unshift(cleanImageUrl(ogImage));
    }
    const { price, originalPrice } = extractPricesFromContent(html + ' ' + markdown);
    const description = metadata?.description || metadata?.ogDescription || '';

    const cleanedTitle = cleanTitle(title);
    if (!cleanedTitle && images.length === 0) return null;

    return buildProductData(
      cleanedTitle, [...new Set(images)], price, originalPrice,
      description, affiliateUrl, targetUrl
    );
  } catch (e) {
    console.error('Firecrawl Scrape failed:', e);
    return null;
  }
}

// ===== Build product data =====
function buildProductData(
  title: string, images: string[], price: string, originalPrice: string,
  description: string, affiliateUrl: string, canonicalUrl: string
): ProductData {
  const slug = generateSlug(title);
  return {
    title,
    subtitle: description.substring(0, 100),
    description: description.substring(0, 800),
    price: price ? `€${price}` : '€0.00',
    originalPrice: originalPrice || '',
    priceRange: '',
    discount: originalPrice && price ? calculateDiscount(`€${price}`, originalPrice) : '',
    images: images.slice(0, 20),
    rating: 4.5,
    reviewCount: 0,
    ordersCount: 0,
    shippingCost: '',
    deliveryTime: '',
    sku: '',
    variants: [],
    slug: slug || `producto-${Date.now()}`,
    affiliateLink: affiliateUrl,
    aliexpressUrl: canonicalUrl,
  };
}

// ===== URL resolution =====
async function resolveAliExpressUrl(url: string) {
  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;
  const originalInputUrl = formattedUrl;

  let productId = extractProductId(formattedUrl);
  if (productId) return { productId, originalInputUrl };

  // Resolve short/affiliate links
  const isShortLink = /s\.click\.aliexpress|a\.aliexpress|aliexpress\.ru\/\w+|aliexpress\.com\/e\//i.test(formattedUrl);
  if (isShortLink) {
    console.log('Resolving short link:', formattedUrl);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(formattedUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      productId = extractProductId(res.url);
      if (productId) return { productId, originalInputUrl };

      const body = await res.text();
      productId = extractProductId(body);
      if (productId) return { productId, originalInputUrl };

      const metaUrl = body.match(/url=["']?([^"'\s>]+)/i)?.[1];
      if (metaUrl) {
        productId = extractProductId(metaUrl);
        if (productId) return { productId, originalInputUrl };
      }
    } catch (e) {
      console.log('Short link resolution failed:', e);
    }
  }

  return { productId: null, originalInputUrl };
}

function extractProductId(text: string): string | null {
  if (!text) return null;
  const m = text.match(/(?:item\/|productId=|itemId=|\/i\/)(\d{8,})/i);
  return m ? m[1] : null;
}

// ===== Parsing helpers =====
function cleanTitle(raw: string): string {
  if (!raw) return '';
  let title = raw
    .replace(/\s*[-|–]\s*(AliExpress|Aliexpress).*$/i, '')
    .replace(/^\d+(\.\d+)?%?\s*OFF\s*/i, '')
    .replace(/Comprar\s+/i, '')
    .replace(/Buy\s+/i, '')
    .trim();
  if (/captcha|recaptcha|verify|robot|security/i.test(title)) return '';
  return title.substring(0, 200);
}

function extractTitleFromContent(html: string, markdown: string): string {
  let title = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  if (!title) title = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1]?.trim() || '';
  if (!title) title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
  
  // JSON-LD
  if (!title) {
    const jsonLd = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLd) {
      for (const script of jsonLd) {
        try {
          const parsed = JSON.parse(script.replace(/<\/?script[^>]*>/gi, ''));
          if (parsed.name) { title = parsed.name; break; }
        } catch { /* */ }
      }
    }
  }

  // AliExpress embedded data
  if (!title) {
    title = html.match(/"subject"\s*:\s*"([^"]+)"/)?.[1] || '';
  }

  // Markdown heading
  if (!title && markdown) {
    title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || '';
  }

  return title;
}

function extractImagesFromContent(content: string): string[] {
  const images = new Set<string>();

  // og:image
  const ogImg = content.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (ogImg && ogImg.includes('alicdn')) images.add(cleanImageUrl(ogImg));

  // JSON-LD
  const jsonLd = content.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLd) {
    for (const script of jsonLd) {
      try {
        const parsed = JSON.parse(script.replace(/<\/?script[^>]*>/gi, ''));
        const imgs = parsed.image ? (Array.isArray(parsed.image) ? parsed.image : [parsed.image]) : [];
        for (const img of imgs) {
          const u = typeof img === 'string' ? img : img?.url;
          if (u && u.includes('alicdn')) images.add(cleanImageUrl(u));
        }
      } catch { /* */ }
    }
  }

  // imagePathList (AliExpress JS)
  const listMatch = content.match(/"imagePathList"\s*:\s*\[([^\]]+)\]/);
  if (listMatch) {
    const urls = listMatch[1].match(/https?:\/\/[^"',\s]+/g);
    if (urls) {
      for (const u of urls) {
        if (u.includes('alicdn')) images.add(cleanImageUrl(u));
      }
    }
  }

  // All alicdn URLs
  const pattern = /(?:https?:)?\/\/[a-z0-9.-]*alicdn\.com\/[^\s"'<>)]+/gi;
  let m;
  while ((m = pattern.exec(content)) !== null) {
    let url = m[0].replace(/[,;}\]]+$/, '');
    if (!url.startsWith('http')) url = 'https:' + url;
    if (
      (url.includes('/kf/') || url.includes('/imgextra/') || /\.(jpg|jpeg|png|webp)/i.test(url)) &&
      !url.includes('icon') && !url.includes('logo') && !url.includes('flag') &&
      !url.includes('avatar') && !url.includes('placeholder') &&
      url.length > 30
    ) {
      images.add(cleanImageUrl(url));
    }
  }

  // Markdown images
  const mdImgs = content.matchAll(/!\[.*?\]\((https?:\/\/[^\s)]+alicdn[^\s)]+)\)/gi);
  for (const match of mdImgs) {
    images.add(cleanImageUrl(match[1]));
  }

  return [...images];
}

function extractPricesFromContent(content: string): { price: string; originalPrice: string } {
  // JSON-LD
  const jsonLd = content.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLd) {
    for (const script of jsonLd) {
      try {
        const parsed = JSON.parse(script.replace(/<\/?script[^>]*>/gi, ''));
        const offer = parsed.offers || parsed;
        if (offer.price || offer.lowPrice) {
          return {
            price: String(offer.price || offer.lowPrice),
            originalPrice: offer.highPrice ? `€${offer.highPrice}` : '',
          };
        }
      } catch { /* */ }
    }
  }

  // AliExpress JS data
  const activityPrice = content.match(/"formattedActivityPrice"\s*:\s*"[^"]*?([\d.]+)"/);
  if (activityPrice) {
    const origMatch = content.match(/"formattedPrice"\s*:\s*"[^"]*?([\d.]+)"/);
    return { price: activityPrice[1], originalPrice: origMatch ? `€${origMatch[1]}` : '' };
  }
  const minPrice = content.match(/"minPrice"\s*:\s*"?([\d.]+)"?/);
  if (minPrice) {
    const maxPrice = content.match(/"maxPrice"\s*:\s*"?([\d.]+)"?/);
    return { price: minPrice[1], originalPrice: maxPrice && maxPrice[1] !== minPrice[1] ? `€${maxPrice[1]}` : '' };
  }

  // Regex
  const patterns = [/€\s*(\d+(?:[.,]\d{1,2})?)/g, /(\d+(?:[.,]\d{1,2})?)\s*€/g, /US\s*\$\s*(\d+(?:[.,]\d{1,2})?)/gi];
  const prices: number[] = [];
  for (const p of patterns) {
    p.lastIndex = 0;
    let m;
    while ((m = p.exec(content)) !== null) {
      const v = parseFloat(m[1].replace(',', '.'));
      if (v > 0 && v < 10000) prices.push(v);
    }
    if (prices.length > 0) break;
  }

  if (prices.length === 0) return { price: '', originalPrice: '' };
  prices.sort((a, b) => a - b);
  const lo = prices[0], hi = prices[prices.length - 1];
  return {
    price: lo.toFixed(2),
    originalPrice: hi > lo * 1.5 ? `€${hi.toFixed(2)}` : '',
  };
}

function cleanImageUrl(url: string): string {
  return url
    .replace(/_\d+x\d+\w*\./g, '.')
    .replace(/\.\d+x\d+\./g, '.')
    .replace(/\?.*$/, '');
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
