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
    let variants: any[] = [];

    // Strategy 1: Mobile AliExpress (lighter, faster)
    const mobileUrl = `https://m.aliexpress.com/item/${productId}.html`;
    const productUrl = `https://www.aliexpress.com/item/${productId}.html`;
    console.log('Trying mobile URL:', mobileUrl);

    const fcResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: mobileUrl,
        formats: ['markdown', 'links'],
        waitFor: 5000,
        timeout: 30000,
      }),
    });

    const fcData = await fcResponse.json();
    console.log('Firecrawl status:', fcResponse.status);

    if (fcResponse.ok && fcData.success !== false) {
      const markdown = fcData.data?.markdown || fcData.markdown || '';
      const metadata = fcData.data?.metadata || fcData.metadata || {};
      const linksArr = fcData.data?.links || fcData.links || [];

      console.log('Metadata:', JSON.stringify(metadata)?.substring(0, 500));
      console.log('Markdown preview:', markdown.substring(0, 600));

      // Title from metadata
      title = metadata?.title || metadata?.ogTitle || '';
      description = metadata?.description || metadata?.ogDescription || '';

      // OG image
      const ogImg = metadata?.ogImage;
      if (ogImg && typeof ogImg === 'string' && ogImg.includes('http')) {
        images.push(ogImg);
      }

      // Extract prices from markdown
      // Pattern: €X.XX - €Y.XX (range) or just €X.XX (fixed)
      const priceRangeMatch = markdown.match(/[€$]\s*(\d+[.,]\d{1,2})\s*[-–—]\s*[€$]?\s*(\d+[.,]\d{1,2})/);
      if (priceRangeMatch) {
        priceMin = priceRangeMatch[1].replace(',', '.');
        priceMax = priceRangeMatch[2].replace(',', '.');
        currency = markdown.match(/[€$]/)?.[0] || '€';
        price = `${currency}${priceMin} - ${currency}${priceMax}`;
      } else {
        // Try single price patterns
        const salePriceMatch = markdown.match(/(?:sale|precio|price)[:\s]*[€$]\s*(\d+[.,]\d{1,2})/i)
          || markdown.match(/[€$]\s*(\d+[.,]\d{1,2})/);
        if (salePriceMatch) {
          currency = markdown.match(/[€$]/)?.[0] || '€';
          price = `${currency}${salePriceMatch[1].replace(',', '.')}`;
        }
      }

      // Original/strikethrough price
      const origMatch = markdown.match(/~~[€$]?\s*(\d+[.,]\d{1,2})~~/)
        || markdown.match(/(?:original|antes|was)[:\s]*[€$]\s*(\d+[.,]\d{1,2})/i);
      if (origMatch) {
        originalPrice = `${currency}${origMatch[1].replace(',', '.')}`;
      }

      // Extract ALL alicdn images from markdown and links
      const allContent = markdown;
      const alicdnPattern = /(?:https?:)?\/\/[a-z0-9.-]*alicdn\.com\/[^\s"'<>)\]]+/gi;
      let m;
      while ((m = alicdnPattern.exec(allContent)) !== null) {
        let imgUrl = m[0].replace(/[,;}\]]+$/, '');
        if (!imgUrl.startsWith('http')) imgUrl = 'https:' + imgUrl;
        if (/\.(jpg|jpeg|png|webp)/i.test(imgUrl)
          && !imgUrl.includes('icon') && !imgUrl.includes('logo')
          && !imgUrl.includes('avatar') && imgUrl.length > 30) {
          images.push(imgUrl);
        }
      }

      // From markdown image syntax ![](url)
      const mdImgs = allContent.matchAll(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/gi);
      for (const match of mdImgs) {
        if (match[1].includes('alicdn') || match[1].includes('ae0')) images.push(match[1]);
      }

      // From links array
      if (Array.isArray(linksArr)) {
        for (const link of linksArr) {
          const l = typeof link === 'string' ? link : link?.url || '';
          if (l && /alicdn\.com.*\.(jpg|jpeg|png|webp)/i.test(l)
            && !l.includes('icon') && !l.includes('logo') && !l.includes('avatar')) {
            images.push(l);
          }
        }
      }
    } else {
      console.log('Mobile scrape failed:', fcResponse.status, JSON.stringify(fcData)?.substring(0, 500));
    }

    // Strategy 2: Search fallback if scrape failed
    if (!title && images.length === 0) {
      console.log('Strategy 2: Search fallback');
      const searchResp = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `aliexpress ${productId}`,
          limit: 5,
          lang: 'es',
          scrapeOptions: { formats: ['markdown'] },
        }),
      });

      if (searchResp.ok) {
        const searchData = await searchResp.json();
        const results = searchData.data || [];
        console.log('Search results:', results.length);

        for (const r of results) {
          if (!title && r.title && (r.url?.includes(productId) || r.url?.includes('aliexpress'))) {
            title = r.title;
          }
          if (!description && r.description) description = r.description;

          // Extract images from search result markdown
          const rMd = r.markdown || '';
          const searchImgs = rMd.matchAll(/(?:https?:)?\/\/[a-z0-9.-]*alicdn\.com\/[^\s"'<>)\]]+\.(jpg|jpeg|png|webp)[^\s"'<>)\]]*/gi);
          for (const sm of searchImgs) {
            images.push(sm[0]);
          }
        }
      }
    }

    // Clean title
    title = title
      .replace(/\s*[-|–]\s*(AliExpress|Aliexpress).*$/i, '')
      .replace(/Comprar\s+/i, '')
      .replace(/^\d+\.\d+US\s*\$\s*/i, '')
      .trim();
    if (/captcha|recaptcha|verify|robot|security/i.test(title)) title = '';

    // Deduplicate and clean images - full resolution
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
        error: 'No se pudo extraer datos. AliExpress puede estar bloqueando la extracción. Prueba con otro link.',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 80) || `producto-${Date.now()}`;

    // Compute discount
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
      variants,
      slug,
      affiliateLink: originalInputUrl,
      aliexpressUrl: `https://www.aliexpress.com/item/${productId}.html`,
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
