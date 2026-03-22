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
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: roleData } = await supabaseClient.from('user_roles').select('role')
      .eq('user_id', claimsData.claims.sub).eq('role', 'admin').maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { productId, originalInputUrl } = await resolveAliExpressUrl(url);
    console.log('Product ID:', productId);

    if (!productId) {
      return new Response(JSON.stringify({ success: false, error: 'No se pudo detectar el ID del producto.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Firecrawl no configurado.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let title = '';
    let images: string[] = [];
    let price = '';
    let originalPrice = '';
    let priceMin = '';
    let priceMax = '';
    let currency = '€';
    let description = '';

    const productUrl = `https://www.aliexpress.com/item/${productId}.html`;

    // Strategy 1: Fast search (no scrapeOptions = instant results)
    console.log('Searching for product', productId);
    const searchResp = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `aliexpress.com item ${productId}`,
        limit: 5,
        lang: 'es',
      }),
    });

    if (searchResp.ok) {
      const searchData = await searchResp.json();
      const results = searchData.data || [];
      console.log('Search results:', results.length);

      for (const r of results) {
        console.log('Result:', r.title?.substring(0, 60), '|', r.description?.substring(0, 80));
        if (!title && r.title) title = r.title;
        if (!description && r.description) description = r.description;

        // Try to extract price from description/title
        const text = `${r.title || ''} ${r.description || ''}`;
        if (!price) {
          const rangeMatch = text.match(/[€$]\s*(\d+[.,]\d{1,2})\s*[-–—]\s*[€$]?\s*(\d+[.,]\d{1,2})/);
          if (rangeMatch) {
            currency = text.match(/[€$]/)?.[0] || '€';
            priceMin = rangeMatch[1].replace(',', '.');
            priceMax = rangeMatch[2].replace(',', '.');
            price = `${currency}${priceMin} - ${currency}${priceMax}`;
          } else {
            const usMatch = text.match(/US\s*\$\s*(\d+[.,]\d{1,2})/i);
            const euroMatch = text.match(/€\s*(\d+[.,]\d{1,2})/);
            const m = euroMatch || usMatch;
            if (m) { currency = euroMatch ? '€' : '$'; price = `${currency}${m[1].replace(',', '.')}`; }
          }
        }

        // Extract any alicdn image URLs from all fields
        const rStr = JSON.stringify(r);
        const imgM = rStr.matchAll(/https?:\/\/[a-z0-9.-]*(?:alicdn|ae01|ae04)\.com\/[^\s"'\\,]+?\.(jpg|jpeg|png|webp)/gi);
        for (const im of imgM) {
          const u = im[0];
          if (!u.includes('icon') && !u.includes('logo') && !u.includes('avatar') && !u.includes('_50x') && u.length > 30) images.push(u);
        }
      }
    }

    // Strategy 2: Try direct fetch of OG meta (no JS rendering needed, very fast)
    if (images.length === 0 || !price) {
      console.log('Strategy 2: Direct HTTP fetch for OG meta');
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const directResp = await fetch(`https://es.aliexpress.com/item/${productId}.html`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Accept': 'text/html',
            'Accept-Language': 'es-ES,es;q=0.9',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (directResp.ok) {
          const html = await directResp.text();
          console.log('Direct fetch HTML length:', html.length);

          // OG image
          const ogImgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
            || html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
          if (ogImgMatch) images.unshift(ogImgMatch[1]);

          // OG title
          if (!title) {
            const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
            if (ogTitle) title = ogTitle[1];
          }

          // OG description
          if (!description) {
            const ogDesc = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
            if (ogDesc) description = ogDesc[1];
          }

          // Extract images from page data/JSON
          const imgPattern = /https?:\/\/[a-z0-9.-]*(?:alicdn|ae01|ae04)\.com\/[^\s"'<>]+?\.(jpg|jpeg|png|webp)/gi;
          let im;
          while ((im = imgPattern.exec(html)) !== null) {
            const u = im[0];
            if ((u.includes('/kf/') || u.includes('/imgextra/'))
              && !u.includes('icon') && !u.includes('logo') && !u.includes('avatar')
              && !u.includes('_50x') && u.length > 30) {
              images.push(u);
            }
          }

          // Extract price from HTML data
          if (!price) {
            // JSON data in page often has prices
            const priceMatch = html.match(/"formattedActivityPrice":"([^"]+)"/);
            const minMatch = html.match(/"minActivityAmount":\{"value":(\d+\.?\d*)/);
            const maxMatch = html.match(/"maxActivityAmount":\{"value":(\d+\.?\d*)/);
            const minPrice2 = html.match(/"minAmount":\{"value":(\d+\.?\d*)/);
            const maxPrice2 = html.match(/"maxAmount":\{"value":(\d+\.?\d*)/);

            const pMin = parseFloat(minMatch?.[1] || minPrice2?.[1] || '0');
            const pMax = parseFloat(maxMatch?.[1] || maxPrice2?.[1] || '0');

            if (pMin > 0 && pMax > 0 && pMin !== pMax) {
              priceMin = pMin.toFixed(2);
              priceMax = pMax.toFixed(2);
              price = `${currency}${priceMin} - ${currency}${priceMax}`;
            } else if (priceMatch) {
              price = priceMatch[1];
            } else if (pMin > 0) {
              price = `${currency}${pMin.toFixed(2)}`;
            }

            // Original price
            const origMatch = html.match(/"formattedPrice":"([^"]+)"/)
              || html.match(/"originalPrice":\{"value":(\d+\.?\d*)/);
            if (origMatch && !originalPrice) {
              const v = origMatch[1].replace(/[^0-9.,]/g, '').replace(',', '.');
              if (v && parseFloat(v) > 0) originalPrice = `${currency}${v}`;
            }
          }
        }
      } catch (e) {
        console.log('Direct fetch error:', e);
      }
    }

    // Clean title
    title = title
      .replace(/\s*[-|–]\s*(AliExpress|Aliexpress).*$/i, '')
      .replace(/Comprar\s+/i, '')
      .replace(/^\d+\.\d+US\s*\$\s*/i, '')
      .trim();
    if (/captcha|recaptcha|verify|robot|security/i.test(title)) title = '';

    // Deduplicate and clean images
    images = [...new Set(
      images.map(u => {
        let clean = u.replace(/_\d+x\d+\w*\./g, '.').replace(/\?.*$/, '');
        if (!clean.startsWith('http')) clean = 'https:' + clean;
        return clean;
      })
    )].filter(u => u.length > 30 && /\.(jpg|jpeg|png|webp)$/i.test(u)).slice(0, 20);

    if (!title && images.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No se pudo extraer datos. Prueba con otro link.',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 80) || `producto-${Date.now()}`;

    let discount = '';
    const basePriceStr = priceMin || price.replace(/[^0-9.,]/g, '').replace(',', '.');
    const origPriceStr = originalPrice.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (basePriceStr && origPriceStr && parseFloat(origPriceStr) > parseFloat(basePriceStr)) {
      discount = `-${Math.round(((parseFloat(origPriceStr) - parseFloat(basePriceStr)) / parseFloat(origPriceStr)) * 100)}%`;
    }

    const productData = {
      title: title.substring(0, 200),
      subtitle: description.substring(0, 100),
      description: description.substring(0, 800),
      price: price || `${currency}0.00`,
      originalPrice,
      priceRange: (priceMin && priceMax) ? `${currency}${priceMin} - ${currency}${priceMax}` : '',
      discount,
      images,
      rating: 4.5, reviewCount: 0, ordersCount: 0,
      shippingCost: '', deliveryTime: '', sku: '',
      variants: [] as any[],
      slug,
      affiliateLink: originalInputUrl,
      aliexpressUrl: productUrl,
    };

    console.log(`SUCCESS: "${productData.title}", ${images.length} imgs, price: ${price}`);
    return new Response(JSON.stringify({ success: true, data: productData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function resolveAliExpressUrl(url: string) {
  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;
  const originalInputUrl = formattedUrl;

  let productId = extractProductId(formattedUrl);
  if (productId) return { productId, originalInputUrl };

  const isShortLink = /s\.click\.aliexpress|a\.aliexpress|aliexpress\.ru\/\w+|aliexpress\.com\/e\//i.test(formattedUrl);
  if (isShortLink) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(formattedUrl, { method: 'GET', redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: controller.signal });
      clearTimeout(timeout);
      productId = extractProductId(res.url);
      if (productId) return { productId, originalInputUrl };
      const body = await res.text();
      productId = extractProductId(body);
      if (productId) return { productId, originalInputUrl };
    } catch (e) { console.log('Short link failed:', e); }
  }
  return { productId: null, originalInputUrl };
}

function extractProductId(text: string): string | null {
  if (!text) return null;
  return text.match(/(?:item\/|productId=|itemId=|\/i\/)(\d{8,})/i)?.[1] || null;
}
