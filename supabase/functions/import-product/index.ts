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

    // Strategy 1: Firecrawl scrape with JSON extraction (AI-powered)
    const productUrl = `https://www.aliexpress.com/item/${productId}.html`;
    console.log('Trying Firecrawl JSON extraction on:', productUrl);
    
    const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: productUrl,
        formats: ['markdown', 'links', 'extract'],
        extract: {
          prompt: 'Extract from this AliExpress product page: "title" (product name), "price" (current/sale price as number), "price_min" (lowest price if range), "price_max" (highest price if range), "original_price" (strikethrough price as number), "currency" (€ or $), "description" (product description), "images" (array of ALL product gallery image URLs, full resolution), "variants" (array of {group, options: [{label, imageUrl?}]}).',
        },
        waitFor: 8000,
        timeout: 45000,
        onlyMainContent: false,
      }),
    });

    const fcData = await fcResponse.json();
    console.log('Firecrawl status:', fcResponse.status);
    
    let title = '';
    let images: string[] = [];
    let price = '';
    let originalPrice = '';
    let priceMin = '';
    let priceMax = '';
    let currency = '€';
    let description = '';
    let variants: any[] = [];

    if (fcResponse.ok) {
      const json = fcData.data?.extract || fcData.data?.json || fcData.extract || fcData.json;
      const markdown = fcData.data?.markdown || '';
      const metadata = fcData.data?.metadata || {};
      const linksArr = fcData.data?.links || [];

      console.log('Firecrawl JSON:', JSON.stringify(json)?.substring(0, 800));

      // From AI JSON extraction
      if (json) {
        title = json.title || json.product_title || json.name || '';
        currency = (json.currency === '$') ? '$' : '€';
        description = json.description || '';

        // Parse prices - handle range vs fixed
        const pMin = parseFloat(String(json.price_min || ''));
        const pMax = parseFloat(String(json.price_max || ''));
        const pSingle = parseFloat(String(json.price || json.current_price || ''));

        if (pMin > 0 && pMax > 0 && pMin !== pMax) {
          priceMin = pMin.toFixed(2);
          priceMax = pMax.toFixed(2);
          price = `${currency}${priceMin} - ${currency}${priceMax}`;
        } else if (pSingle > 0) {
          price = `${currency}${pSingle.toFixed(2)}`;
        } else if (pMin > 0) {
          price = `${currency}${pMin.toFixed(2)}`;
        }

        const pOrig = parseFloat(String(json.original_price || ''));
        if (pOrig > 0) originalPrice = `${currency}${pOrig.toFixed(2)}`;

        // Images from JSON
        const jsonImages = json.images || json.image_urls || json.product_images || [];
        if (Array.isArray(jsonImages)) {
          for (const u of jsonImages) {
            if (typeof u === 'string' && u.includes('http')) images.push(u);
          }
        }

        // Variants from JSON
        if (Array.isArray(json.variants)) variants = json.variants;
      }

      // From metadata
      if (!title) title = metadata?.title || metadata?.ogTitle || '';
      if (!description) description = metadata?.description || '';
      const ogImg = metadata?.ogImage;
      if (ogImg && typeof ogImg === 'string') images.unshift(ogImg);

      // Extract alicdn images from markdown/HTML (always, to supplement)
      const allContent = markdown + ' ' + (fcData.data?.html || '');
      const alicdnPattern = /(?:https?:)?\/\/[a-z0-9.-]*alicdn\.com\/[^\s"'<>)]+/gi;
      let m;
      while ((m = alicdnPattern.exec(allContent)) !== null) {
        let imgUrl = m[0].replace(/[,;}\]]+$/, '');
        if (!imgUrl.startsWith('http')) imgUrl = 'https:' + imgUrl;
        if ((imgUrl.includes('/kf/') || imgUrl.includes('/imgextra/') || /\.(jpg|jpeg|png|webp)/i.test(imgUrl))
          && !imgUrl.includes('icon') && !imgUrl.includes('logo') && imgUrl.length > 30) {
          images.push(imgUrl);
        }
      }

      // Extract from markdown image syntax
      const mdImgs = allContent.matchAll(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/gi);
      for (const match of mdImgs) {
        if (match[1].includes('alicdn') || match[1].includes('aliexpress')) images.push(match[1]);
      }

      // Extract from links array
      if (Array.isArray(linksArr)) {
        for (const link of linksArr) {
          if (typeof link === 'string' && /alicdn\.com.*\.(jpg|jpeg|png|webp)/i.test(link)
            && (link.includes('/kf/') || link.includes('/imgextra/'))
            && !link.includes('icon') && !link.includes('logo')) {
            images.push(link);
          }
        }
      }

      // Try price from markdown if not found via JSON
      if (!price && markdown) {
        const priceRangeMatch = markdown.match(/[€$]\s*(\d+[.,]\d{2})\s*[-–]\s*[€$]?\s*(\d+[.,]\d{2})/);
        if (priceRangeMatch) {
          priceMin = priceRangeMatch[1].replace(',', '.');
          priceMax = priceRangeMatch[2].replace(',', '.');
          price = `${currency}${priceMin} - ${currency}${priceMax}`;
        } else {
          const singlePriceMatch = markdown.match(/[€$]\s*(\d+[.,]\d{2})/);
          if (singlePriceMatch) price = `${currency}${singlePriceMatch[1].replace(',', '.')}`;
        }
      }
    } else {
      console.log('Firecrawl failed:', fcResponse.status, JSON.stringify(fcData)?.substring(0, 300));
    }

    // Clean title
    title = title.replace(/\s*[-|–]\s*(AliExpress|Aliexpress).*$/i, '').replace(/Comprar\s+/i, '').trim();
    if (/captcha|recaptcha|verify|robot|security/i.test(title)) title = '';

    // Deduplicate and clean images - remove thumbnail suffixes for full resolution
    images = [...new Set(
      images.map(u => u.replace(/_\d+x\d+\w*\./g, '.').replace(/\?.*$/, ''))
    )].filter(u => u.length > 20).slice(0, 20);

    // Strategy 2: If Firecrawl failed completely, try search fallback
    if (!title && images.length === 0) {
      console.log('Strategy 2: Google cache search');
      const searchResp = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `aliexpress item ${productId}`,
          limit: 5,
          lang: 'es',
        }),
      });
      
      if (searchResp.ok) {
        const searchData = await searchResp.json();
        const results = searchData.data || [];
        for (const r of results) {
          if (!title && r.title && r.url?.includes(productId)) {
            title = r.title.replace(/\s*[-|–]\s*(AliExpress|Aliexpress).*$/i, '').trim();
          }
          if (!description && r.description) description = r.description;
        }
      }
    }

    if (!title && images.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No se pudo extraer datos de AliExpress. Prueba con otro link o añade el producto manualmente.',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 80) || `producto-${Date.now()}`;

    // Compute discount
    let discount = '';
    const basePrice = priceMin || price.replace(/[^0-9.,]/g, '').replace(',', '.');
    const origPriceNum = originalPrice.replace(/[^0-9.,]/g, '').replace(',', '.');
    if (basePrice && origPriceNum && parseFloat(origPriceNum) > parseFloat(basePrice)) {
      discount = `-${Math.round(((parseFloat(origPriceNum) - parseFloat(basePrice)) / parseFloat(origPriceNum)) * 100)}%`;
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
      variants,
      slug,
      affiliateLink: originalInputUrl,
      aliexpressUrl: productUrl,
    };

    console.log(`SUCCESS: "${productData.title}", ${images.length} images, price: ${price}`);
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
