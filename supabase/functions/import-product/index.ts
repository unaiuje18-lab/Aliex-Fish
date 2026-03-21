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
    // Auth check - require authenticated admin user
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

    const { scrapeUrl, productId, originalInputUrl } = await resolveAliExpressUrl(url);
    console.log('Resolved URL:', scrapeUrl, '| Product ID:', productId);

    if (!productId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo detectar el ID del producto en el link.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let productData: ReturnType<typeof buildProductData> | null = null;

    // Strategy 1: Firecrawl (best results - renders JS)
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (apiKey) {
      const mobileUrl = `https://m.aliexpress.com/item/${productId}.html`;
      console.log('Strategy 1: Firecrawl on mobile:', mobileUrl);
      productData = await tryFirecrawl(mobileUrl, apiKey, originalInputUrl);
      
      if (!productData?.title) {
        console.log('Firecrawl mobile failed, trying desktop');
        productData = await tryFirecrawl(scrapeUrl, apiKey, originalInputUrl);
      }
    }

    // Strategy 2: Direct fetch (fallback - only works if server returns meta tags)
    if (!productData?.title || productData.images.length === 0) {
      console.log('Strategy 2: Direct fetch desktop');
      productData = await tryDirectFetch(scrapeUrl, originalInputUrl) || productData;
    }

    if (!productData?.title || productData.images.length === 0) {
      console.log('Strategy 2b: Direct fetch mobile');
      const mobileUrl = `https://m.aliexpress.com/item/${productId}.html`;
      productData = await tryDirectFetch(mobileUrl, originalInputUrl) || productData;
    }

    if (!productData?.title || productData.images.length === 0) {
      console.log('All strategies failed. productData:', JSON.stringify({
        title: productData?.title || '',
        imageCount: productData?.images?.length || 0,
      }));
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No se pudo extraer datos. AliExpress puede estar bloqueando. Inténtalo de nuevo en unos minutos.',
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

// ===== Firecrawl (primary strategy) =====
async function tryFirecrawl(
  targetUrl: string,
  apiKey: string,
  affiliateUrl: string
): ReturnType<typeof buildProductData> | null {
  try {
    console.log('Firecrawl request to:', targetUrl);
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
        waitFor: 5000,
        timeout: 25000,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Firecrawl API error:', response.status, JSON.stringify(data).substring(0, 500));
      return null;
    }

    const html = data.data?.html || data.data?.rawHtml || '';
    const markdown = data.data?.markdown || '';
    const metadata = data.data?.metadata || {};

    console.log('Firecrawl response - HTML length:', html.length, 'Markdown length:', markdown.length);
    console.log('Firecrawl metadata:', JSON.stringify({
      title: metadata.title || '',
      ogImage: metadata.ogImage || metadata['og:image'] || '',
      description: (metadata.description || '').substring(0, 80),
    }));

    // Build product data from all sources
    const title = extractTitle(html, markdown, metadata);
    const images = extractImages(html, markdown, metadata);
    const { price, originalPrice } = extractPrices(html, markdown);
    const description = extractDescription(html, metadata);

    console.log('Firecrawl parsed:', { title: title.substring(0, 50), imageCount: images.length, price });

    if (!title && images.length === 0) return null;

    return buildProductData(title, images, price, originalPrice, description, affiliateUrl, targetUrl);
  } catch (e) {
    console.error('Firecrawl failed:', e);
    return null;
  }
}

// ===== Direct fetch (fallback) =====
async function tryDirectFetch(targetUrl: string, affiliateUrl: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const html = await res.text();
    console.log('Direct fetch HTML length:', html.length);

    if (html.includes('captcha') && html.length < 5000) {
      console.log('Got captcha page, skipping');
      return null;
    }

    const title = extractTitle(html, '', {});
    const images = extractImages(html, '', {});
    const { price, originalPrice } = extractPrices(html, '');
    const description = extractDescription(html, {});

    if (!title && images.length === 0) return null;

    return buildProductData(title, images, price, originalPrice, description, affiliateUrl, targetUrl);
  } catch (e) {
    console.log('Direct fetch failed:', e);
    return null;
  }
}

// ===== Build product data =====
function buildProductData(
  title: string,
  images: string[],
  price: string,
  originalPrice: string,
  description: string,
  affiliateUrl: string,
  canonicalUrl: string
) {
  const slug = generateSlug(title);
  return {
    title,
    subtitle: description.substring(0, 100),
    description,
    price: price ? `€${price}` : '€0.00',
    originalPrice: originalPrice || '',
    priceRange: '',
    discount: originalPrice && price ? calculateDiscount(`€${price}`, originalPrice) : '',
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

// ===== URL resolution =====
async function resolveAliExpressUrl(url: string) {
  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;
  const originalInputUrl = formattedUrl;

  let productId = extractProductId(formattedUrl);
  if (productId) {
    return { scrapeUrl: `https://www.aliexpress.com/item/${productId}.html`, productId, originalInputUrl };
  }

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
      if (productId) {
        return { scrapeUrl: `https://www.aliexpress.com/item/${productId}.html`, productId, originalInputUrl };
      }

      const body = await res.text();
      productId = extractProductId(body);
      if (productId) {
        return { scrapeUrl: `https://www.aliexpress.com/item/${productId}.html`, productId, originalInputUrl };
      }

      const metaUrl = body.match(/url=["']?([^"'\s>]+)/i)?.[1];
      if (metaUrl) {
        productId = extractProductId(metaUrl);
        if (productId) {
          return { scrapeUrl: `https://www.aliexpress.com/item/${productId}.html`, productId, originalInputUrl };
        }
      }
    } catch (e) {
      console.log('Short link resolution failed:', e);
    }
  }

  return { scrapeUrl: formattedUrl, productId: null, originalInputUrl };
}

function extractProductId(text: string): string | null {
  if (!text) return null;
  const m = text.match(/(?:item\/|productId=|itemId=|\/i\/)(\d{8,})/i);
  return m ? m[1] : null;
}

// ===== Parsing helpers =====
function extractTitle(html: string, markdown: string, metadata: Record<string, any>): string {
  // 1. Firecrawl metadata (most reliable)
  let title = metadata?.title || metadata?.ogTitle || '';
  
  // 2. og:title from HTML
  if (!title) title = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  // Also try reversed attribute order
  if (!title) title = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1]?.trim() || '';
  
  // 3. twitter:title
  if (!title) title = html.match(/<meta[^>]+name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  
  // 4. <title> tag
  if (!title) title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
  
  // 5. JSON-LD
  if (!title) {
    const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdBlocks) {
      for (const script of jsonLdBlocks) {
        const content = script.replace(/<\/?script[^>]*>/gi, '');
        try {
          const parsed = JSON.parse(content);
          if (parsed.name) { title = parsed.name; break; }
        } catch { /* ignore */ }
      }
    }
  }
  
  // 6. Markdown heading
  if (!title && markdown) {
    title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || '';
  }

  // 7. Try window.runParams or data-title in HTML
  if (!title) {
    const dataTitle = html.match(/"subject"\s*:\s*"([^"]+)"/)?.[1] || '';
    if (dataTitle) title = dataTitle;
  }

  // Clean
  title = title.replace(/\s*[-|–]\s*(AliExpress|Aliexpress).*$/i, '').trim();
  title = title.replace(/^\d+(\.\d+)?%?\s*OFF\s*/i, '').trim();
  title = title.replace(/Comprar\s+/i, '').trim();
  if (/captcha|recaptcha|verify|robot/i.test(title)) return '';

  return title.substring(0, 200);
}

function extractDescription(html: string, metadata: Record<string, any>): string {
  const desc = metadata?.description || metadata?.ogDescription ||
    html.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  return desc.substring(0, 800);
}

function extractPrices(html: string, markdown: string) {
  const content = html + ' ' + markdown;

  // JSON-LD
  const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdBlocks) {
    for (const script of jsonLdBlocks) {
      const c = script.replace(/<\/?script[^>]*>/gi, '');
      try {
        const parsed = JSON.parse(c);
        const offer = parsed.offers || parsed;
        if (offer.price || offer.lowPrice) {
          const price = String(offer.price || offer.lowPrice);
          const highPrice = offer.highPrice ? `€${offer.highPrice}` : '';
          return { price, originalPrice: highPrice };
        }
      } catch { /* ignore */ }
    }
  }

  // Try runParams/window data (AliExpress JS data)
  const priceMatch = html.match(/"formattedActivityPrice"\s*:\s*"[^"]*?([\d.]+)"/);
  if (priceMatch) {
    const origMatch = html.match(/"formattedPrice"\s*:\s*"[^"]*?([\d.]+)"/);
    return {
      price: priceMatch[1],
      originalPrice: origMatch ? `€${origMatch[1]}` : '',
    };
  }

  // Alt price patterns from AliExpress data
  const minPrice = html.match(/"minPrice"\s*:\s*"?([\d.]+)"?/);
  if (minPrice) {
    const maxPrice = html.match(/"maxPrice"\s*:\s*"?([\d.]+)"?/);
    return {
      price: minPrice[1],
      originalPrice: maxPrice && maxPrice[1] !== minPrice[1] ? `€${maxPrice[1]}` : '',
    };
  }

  // Meta tag
  const metaPrice = html.match(/product:price:amount["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (metaPrice) return { price: metaPrice, originalPrice: '' };

  // Regex fallback
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

function extractImages(html: string, markdown: string, metadata: Record<string, any>): string[] {
  const images = new Set<string>();
  const content = html + ' ' + markdown;

  // 1. Firecrawl metadata og:image
  const ogFromMeta = metadata?.ogImage || metadata?.['og:image'];
  if (ogFromMeta && typeof ogFromMeta === 'string' && ogFromMeta.includes('alicdn')) {
    images.add(cleanImageUrl(ogFromMeta));
  }

  // 2. og:image from HTML
  const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (ogImg && ogImg.includes('alicdn')) images.add(cleanImageUrl(ogImg));
  // Reversed attribute order
  const ogImg2 = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1];
  if (ogImg2 && ogImg2.includes('alicdn')) images.add(cleanImageUrl(ogImg2));

  // 3. JSON-LD images
  const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdBlocks) {
    for (const script of jsonLdBlocks) {
      const c = script.replace(/<\/?script[^>]*>/gi, '');
      try {
        const parsed = JSON.parse(c);
        const imgs = parsed.image ? (Array.isArray(parsed.image) ? parsed.image : [parsed.image]) : [];
        for (const img of imgs) {
          const u = typeof img === 'string' ? img : img?.url;
          if (u && u.includes('alicdn')) images.add(cleanImageUrl(u));
        }
      } catch { /* ignore */ }
    }
  }

  // 4. AliExpress JS data (imagePathList)
  const imageListMatch = html.match(/"imagePathList"\s*:\s*\[([^\]]+)\]/);
  if (imageListMatch) {
    const urls = imageListMatch[1].match(/https?:\/\/[^"',\s]+/g);
    if (urls) {
      for (const u of urls) {
        if (u.includes('alicdn')) images.add(cleanImageUrl(u));
      }
    }
  }

  // 5. All alicdn URLs in content
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

  // 6. Markdown image syntax
  if (markdown) {
    const mdImgs = markdown.matchAll(/!\[.*?\]\((https?:\/\/[^\s)]+alicdn[^\s)]+)\)/gi);
    for (const match of mdImgs) {
      images.add(cleanImageUrl(match[1]));
    }
  }

  return [...images].slice(0, 20);
}

function cleanImageUrl(url: string): string {
  return url
    .replace(/_\d+x\d+\w*\./g, '.')
    .replace(/\.\d+x\d+\./g, '.')
    .replace(/\?.*$/, ''); // Remove query params for cleaner URLs
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
