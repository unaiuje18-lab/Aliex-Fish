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

    // Strategy 1: Firecrawl search (bypasses AliExpress anti-bot)
    console.log('Strategy 1: Search for product', productId);
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
        const rContent = JSON.stringify(r);
        console.log('Result:', r.title?.substring(0, 80), '|', r.url?.substring(0, 80));

        if (!title && r.title) title = r.title;
        if (!description && r.description) description = r.description;

        // Parse prices from title + description + any available content
        const textToParse = `${r.title || ''} ${r.description || ''} ${r.markdown || ''}`;
        if (!price) {
          // Range: €1.23 - €4.56 or $1.23-$4.56
          const rangeMatch = textToParse.match(/[€$]\s*(\d+[.,]\d{1,2})\s*[-–—]\s*[€$]?\s*(\d+[.,]\d{1,2})/);
          if (rangeMatch) {
            currency = textToParse.match(/[€$]/)?.[0] || '€';
            priceMin = rangeMatch[1].replace(',', '.');
            priceMax = rangeMatch[2].replace(',', '.');
            price = `${currency}${priceMin} - ${currency}${priceMax}`;
          } else {
            // US$ pattern: US $1.23 or US$ 1.23
            const usMatch = textToParse.match(/US\s*\$\s*(\d+[.,]\d{1,2})/i);
            const euroMatch = textToParse.match(/[€]\s*(\d+[.,]\d{1,2})/);
            const dollarMatch = textToParse.match(/\$\s*(\d+[.,]\d{1,2})/);
            const m = euroMatch || usMatch || dollarMatch;
            if (m) {
              currency = euroMatch ? '€' : '$';
              price = `${currency}${m[1].replace(',', '.')}`;
            }
          }
        }

        // Images from any URL in the result
        const imgMatches = rContent.matchAll(/(?:https?:)?\/\/[a-z0-9.-]*(?:alicdn|ae01|ae04)\.com\/[^\s"'<>)\],\\]+/gi);
        for (const im of imgMatches) {
          let imgUrl = im[0].replace(/[,;}\]\\]+$/, '');
          if (!imgUrl.startsWith('http')) imgUrl = 'https:' + imgUrl;
          if (/\.(jpg|jpeg|png|webp)/i.test(imgUrl)
            && !imgUrl.includes('icon') && !imgUrl.includes('logo')
            && !imgUrl.includes('avatar') && !imgUrl.includes('_50x50')
            && imgUrl.length > 30) {
            images.push(imgUrl);
          }
        }
      }
    } else {
      console.log('Search failed:', searchResp.status);
    }

    // Strategy 2: Search WITH scrape on 1 result (gets images/price from cached page)
    if (images.length === 0 || !price) {
      console.log('Strategy 2: Search with scrape for images/price');
      try {
        const searchResp2 = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `site:es.aliexpress.com item ${productId}`,
            limit: 1,
            lang: 'es',
            scrapeOptions: { formats: ['markdown'] },
          }),
        });
        if (searchResp2.ok) {
          const sd2 = await searchResp2.json();
          for (const r of (sd2.data || [])) {
            const md = r.markdown || '';
            console.log('Scrape result markdown length:', md.length);
            // Images
            const imgM = md.matchAll(/(?:https?:)?\/\/[a-z0-9.-]*(?:alicdn|ae01|ae04)\.com\/[^\s"'<>)\],\\]+/gi);
            for (const im of imgM) {
              let u = im[0].replace(/[,;}\]\\]+$/, '');
              if (!u.startsWith('http')) u = 'https:' + u;
              if (/\.(jpg|jpeg|png|webp)/i.test(u) && !u.includes('icon') && !u.includes('logo') && !u.includes('avatar') && u.length > 30) images.push(u);
            }
            // Price
            if (!price) {
              const rm = md.match(/[€$]\s*(\d+[.,]\d{1,2})\s*[-–—]\s*[€$]?\s*(\d+[.,]\d{1,2})/);
              if (rm) { priceMin = rm[1].replace(',','.'); priceMax = rm[2].replace(',','.'); price = `${currency}${priceMin} - ${currency}${priceMax}`; }
              else { const sm = md.match(/[€$]\s*(\d+[.,]\d{1,2})/); if (sm) price = `${currency}${sm[1].replace(',','.')}`; }
            }
          }
        }
      } catch (e) { console.log('Strategy 2 error:', e); }
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
        error: 'No se pudo extraer datos. AliExpress bloquea la extracción directa. Prueba con otro link.',
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

// ===== URL resolution =====
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
