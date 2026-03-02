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

    const { scrapeUrl, productId, originalInputUrl } = await resolveAliExpressUrl(url);
    console.log('Resolved URL:', scrapeUrl, '| Product ID:', productId);

    if (!productId) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo detectar el ID del producto en el link.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strategy 1: Direct HTML fetch (fast, no Firecrawl needed)
    let productData = await tryDirectFetch(scrapeUrl, originalInputUrl);

    // Strategy 2: Try mobile URL
    if (!productData?.title || productData.images.length === 0) {
      const mobileUrl = `https://m.aliexpress.com/item/${productId}.html`;
      console.log('Trying mobile URL:', mobileUrl);
      productData = await tryDirectFetch(mobileUrl, originalInputUrl) || productData;
    }

    // Strategy 3: Firecrawl as last resort (only mobile, lighter page)
    if (!productData?.title || productData.images.length === 0) {
      const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
      if (apiKey) {
        const mobileUrl = `https://m.aliexpress.com/item/${productId}.html`;
        console.log('Trying Firecrawl on mobile:', mobileUrl);
        const fcData = await tryFirecrawl(mobileUrl, apiKey);
        if (fcData) {
          productData = parseFromHtml(fcData.html, fcData.markdown, originalInputUrl, mobileUrl);
        }
      }
    }

    if (!productData?.title || productData.images.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No se pudo extraer datos. AliExpress puede estar bloqueando el acceso. Inténtalo de nuevo en unos minutos.' }),
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

// ===== Strategy 1: Direct fetch (fastest) =====
async function tryDirectFetch(targetUrl: string, affiliateUrl: string) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

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
      console.log('Got captcha page, skipping direct fetch');
      return null;
    }

    return parseFromHtml(html, '', affiliateUrl, targetUrl);
  } catch (e) {
    console.log('Direct fetch failed:', e);
    return null;
  }
}

// ===== Strategy 3: Firecrawl (fallback) =====
async function tryFirecrawl(targetUrl: string, apiKey: string) {
  try {
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
        waitFor: 2000,
        timeout: 20000,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Firecrawl error:', data);
      return null;
    }

    return {
      html: data.data?.html || data.data?.rawHtml || data.html || '',
      markdown: data.data?.markdown || data.markdown || '',
      metadata: data.data?.metadata || data.metadata || {},
    };
  } catch (e) {
    console.error('Firecrawl failed:', e);
    return null;
  }
}

// ===== URL resolution =====
async function resolveAliExpressUrl(url: string) {
  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;
  const originalInputUrl = formattedUrl;

  // Check if it's already a product URL
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

      // Check final URL
      productId = extractProductId(res.url);
      if (productId) {
        return { scrapeUrl: `https://www.aliexpress.com/item/${productId}.html`, productId, originalInputUrl };
      }

      // Check body for product ID or redirect
      const body = await res.text();
      productId = extractProductId(body);
      if (productId) {
        return { scrapeUrl: `https://www.aliexpress.com/item/${productId}.html`, productId, originalInputUrl };
      }

      // Try meta refresh
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

// ===== Parsing =====
function parseFromHtml(html: string, markdown: string, affiliateUrl: string, canonicalUrl: string) {
  const title = extractTitle(html, markdown);
  const images = extractImages(html, markdown);
  const { price, originalPrice } = extractPrices(html, markdown);
  const description = extractDescription(html);
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

function extractTitle(html: string, markdown: string): string {
  // og:title
  let title = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  // twitter:title
  if (!title) title = html.match(/<meta[^>]+name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  // <title>
  if (!title) title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() || '';
  // JSON-LD
  if (!title) {
    const jsonLd = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLd) {
      for (const script of jsonLd) {
        const content = script.replace(/<\/?script[^>]*>/gi, '');
        try {
          const parsed = JSON.parse(content);
          if (parsed.name) { title = parsed.name; break; }
        } catch {}
      }
    }
  }
  // Markdown heading
  if (!title && markdown) {
    title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || '';
  }

  // Clean AliExpress suffixes
  title = title.replace(/\s*[-|–]\s*(AliExpress|Aliexpress).*$/i, '').trim();
  title = title.replace(/^\d+(\.\d+)?%?\s*OFF\s*/i, '').trim();
  title = title.replace(/Comprar\s+/i, '').trim();

  // Skip if it's a captcha/error page
  if (/captcha|recaptcha|verify|robot/i.test(title)) return '';

  return title.substring(0, 120);
}

function extractDescription(html: string): string {
  const desc = html.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]*content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  return desc.substring(0, 800);
}

function extractPrices(html: string, markdown: string) {
  const content = html + ' ' + markdown;

  // Try JSON-LD price first (most reliable)
  const jsonLd = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLd) {
    for (const script of jsonLd) {
      const c = script.replace(/<\/?script[^>]*>/gi, '');
      try {
        const parsed = JSON.parse(c);
        const offer = parsed.offers || parsed;
        if (offer.price || offer.lowPrice) {
          const price = String(offer.price || offer.lowPrice);
          const highPrice = offer.highPrice ? `€${offer.highPrice}` : '';
          return { price, originalPrice: highPrice };
        }
      } catch {}
    }
  }

  // Try meta tags
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

function extractImages(html: string, markdown: string): string[] {
  const images = new Set<string>();
  const content = html + ' ' + markdown;

  // og:image first
  const ogImg = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (ogImg && ogImg.includes('alicdn')) images.add(cleanImageUrl(ogImg));

  // JSON-LD images
  const jsonLd = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLd) {
    for (const script of jsonLd) {
      const c = script.replace(/<\/?script[^>]*>/gi, '');
      try {
        const parsed = JSON.parse(c);
        const imgs = parsed.image ? (Array.isArray(parsed.image) ? parsed.image : [parsed.image]) : [];
        for (const img of imgs) {
          const u = typeof img === 'string' ? img : img?.url;
          if (u && u.includes('alicdn')) images.add(cleanImageUrl(u));
        }
      } catch {}
    }
  }

  // All alicdn URLs in content
  const pattern = /(?:https?:)?\/\/[a-z0-9.-]*alicdn\.com\/[^\s"'<>)]+/gi;
  let m;
  while ((m = pattern.exec(content)) !== null) {
    let url = m[0].replace(/[,;}\]]+$/, '');
    if (!url.startsWith('http')) url = 'https:' + url;
    if ((url.includes('/kf/') || url.includes('/imgextra/') || /\.(jpg|jpeg|png|webp)/i.test(url))
      && !url.includes('icon') && !url.includes('logo') && !url.includes('flag') && !url.includes('avatar')
      && !url.includes('placeholder')) {
      images.add(cleanImageUrl(url));
    }
  }

  return [...images].slice(0, 20);
}

function cleanImageUrl(url: string): string {
  return url.replace(/_\d+x\d+\w*\./g, '.').replace(/\.\d+x\d+\./g, '.');
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
