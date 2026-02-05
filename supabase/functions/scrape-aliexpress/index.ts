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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
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

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping AliExpress URL:', formattedUrl);

    // Request full HTML to extract ALL images
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'html', 'rawHtml'],
        onlyMainContent: false, // Get full page for all images
        waitFor: 5000, // Wait longer for images to load
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || 'Failed to scrape' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.html || data.html || '';
    const rawHtml = data.data?.rawHtml || data.rawHtml || '';
    const metadata = data.data?.metadata || data.metadata || {};

    const productData = parseAliExpressData(markdown, html, rawHtml, metadata, formattedUrl);

    console.log(`Extracted ${productData.images.length} images`);

    return new Response(
      JSON.stringify({ success: true, data: productData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error scraping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============ PARSING FUNCTIONS ============

function parseAliExpressData(
  markdown: string, 
  html: string, 
  rawHtml: string,
  metadata: Record<string, unknown>, 
  originalUrl: string
) {
  const title = extractTitle(markdown, metadata);
  const { price, originalPrice, priceRange } = extractPrices(markdown, metadata);
  const images = extractAllImages(html, rawHtml, markdown, metadata);
  const { rating, reviewCount } = extractRatingAndReviews(markdown);
  const slug = generateSlug(title);

  const finalPrice = price || '0.00';
  const formattedPrice = `€${finalPrice}`;

  return {
    title: title || 'Producto de Pesca',
    subtitle: ((metadata.description as string) || '').substring(0, 100),
    price: formattedPrice,
    originalPrice: originalPrice || '',
    priceRange: priceRange || '',
    discount: originalPrice && price ? calculateDiscount(formattedPrice, originalPrice) : '',
    images, // ALL images, no limit
    rating,
    reviewCount,
    slug: slug || `producto-${Date.now()}`,
    affiliateLink: originalUrl,
    aliexpressUrl: originalUrl,
  };
}

function extractTitle(markdown: string, metadata: Record<string, unknown>): string {
  let title = (metadata.title as string) || '';
  title = title.replace(/\s*[-|]\s*AliExpress.*$/i, '').trim();
  title = title.replace(/^\d+(\.\d+)?%?\s*OFF\s*/i, '').trim();
  
  if (!title && markdown) {
    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    if (headingMatch) title = headingMatch[1].trim();
  }
  return title;
}

function extractPrices(markdown: string, metadata: Record<string, unknown>) {
  let price = '';
  let originalPrice = '';
  let priceRange = '';
  
  const content = markdown + ' ' + ((metadata.description as string) || '') + ' ' + ((metadata.title as string) || '');
  
  const currentPricePatterns = [
    /(?:precio|price|ahora|now|sale)[\s:]*€\s*(\d+(?:[.,]\d{1,2})?)/gi,
    /€\s*(\d+(?:[.,]\d{1,2})?)/g,
    /(\d+(?:[.,]\d{1,2})?)\s*€/g,
    /EUR\s*(\d+(?:[.,]\d{1,2})?)/gi,
    /(?:US\s*)?\$\s*(\d+(?:[.,]\d{1,2})?)/g,
  ];
  
  const originalPricePatterns = [
    /(?:antes|was|original|regular)[\s:]*€?\s*(\d+(?:[.,]\d{1,2})?)/gi,
    /(?:pvp|rrp)[\s:]*€?\s*(\d+(?:[.,]\d{1,2})?)/gi,
  ];

  const allPrices: number[] = [];
  const currentPrices: number[] = [];
  const originalPrices: number[] = [];
  
  const rangePatterns = [
    /€?\s*(\d+(?:[.,]\d{1,2})?)\s*[-–]\s*€?\s*(\d+(?:[.,]\d{1,2})?)\s*€?/g,
    /desde\s*€?\s*(\d+(?:[.,]\d{1,2})?)/gi,
    /from\s*€?\s*(\d+(?:[.,]\d{1,2})?)/gi,
  ];
  
  for (const pattern of rangePatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const lowPrice = parseFloat(match[1].replace(',', '.'));
      if (lowPrice > 0 && lowPrice < 10000) {
        currentPrices.push(lowPrice);
        allPrices.push(lowPrice);
      }
      if (match[2]) {
        const highPrice = parseFloat(match[2].replace(',', '.'));
        if (highPrice > 0 && highPrice < 10000) allPrices.push(highPrice);
      }
    }
  }

  for (const pattern of currentPricePatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const priceValue = parseFloat(match[1].replace(',', '.'));
      if (priceValue > 0 && priceValue < 10000 && !currentPrices.includes(priceValue)) {
        currentPrices.push(priceValue);
        allPrices.push(priceValue);
      }
    }
  }

  for (const pattern of originalPricePatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const priceValue = parseFloat(match[1].replace(',', '.'));
      if (priceValue > 0 && priceValue < 10000 && !originalPrices.includes(priceValue)) {
        originalPrices.push(priceValue);
        allPrices.push(priceValue);
      }
    }
  }

  if (currentPrices.length > 0) {
    currentPrices.sort((a, b) => a - b);
    allPrices.sort((a, b) => a - b);
    
    const lowestPrice = currentPrices[0];
    const highestAllPrice = allPrices[allPrices.length - 1];
    
    if (currentPrices.length > 1 && currentPrices[currentPrices.length - 1] > lowestPrice * 1.2) {
      priceRange = `Desde €${lowestPrice.toFixed(2)}`;
    }
    
    price = lowestPrice.toFixed(2);
    
    if (originalPrices.length > 0) {
      const highestOriginal = Math.max(...originalPrices);
      if (highestOriginal > lowestPrice * 1.1) {
        originalPrice = `€${highestOriginal.toFixed(2)}`;
      }
    } else if (highestAllPrice > lowestPrice * 1.5) {
      originalPrice = `€${highestAllPrice.toFixed(2)}`;
    }
  }

  return { price, originalPrice, priceRange };
}

function extractAllImages(
  html: string, 
  rawHtml: string, 
  markdown: string, 
  metadata: Record<string, unknown>
): string[] {
  const images = new Set<string>();
  const contentToSearch = rawHtml || html || markdown;
  
  // AliExpress CDN patterns - product images
  const aliexpressPatterns = [
    // ae01-ae09 CDN (main product images)
    /https?:\/\/ae0[1-9]\.alicdn\.com\/kf\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)[^"'\s]*/gi,
    // Alternative kf patterns
    /https?:\/\/[a-z0-9.-]*\.alicdn\.com\/kf\/[^\s"'<>]+\.(jpg|jpeg|png|webp)/gi,
    // cbu01 CDN (variant images)  
    /https?:\/\/cbu0[1-9]\.alicdn\.com\/[^\s"'<>]+\.(jpg|jpeg|png|webp)/gi,
    // img.alicdn.com patterns
    /https?:\/\/img\.alicdn\.com\/[^\s"'<>]+\.(jpg|jpeg|png|webp)/gi,
    // General alicdn patterns
    /https?:\/\/[a-z0-9.-]*alicdn\.com\/[^\s"'<>]+\.(jpg|jpeg|png|webp)/gi,
  ];

  // Extract from src/data-src attributes (most reliable)
  const srcPatterns = [
    /src=["']([^"']+\.(jpg|jpeg|png|webp)[^"']*)["']/gi,
    /data-src=["']([^"']+\.(jpg|jpeg|png|webp)[^"']*)["']/gi,
    /data-lazy-src=["']([^"']+\.(jpg|jpeg|png|webp)[^"']*)["']/gi,
    /data-magnifier-src=["']([^"']+)["']/gi, // Zoom images
    /data-big-src=["']([^"']+)["']/gi, // Large images
  ];

  // First pass: extract from attributes
  for (const pattern of srcPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(contentToSearch)) !== null) {
      const url = match[1];
      if (isValidProductImage(url)) {
        images.add(upgradeToMaxResolution(url));
      }
    }
  }

  // Second pass: extract direct URLs
  for (const pattern of aliexpressPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(contentToSearch)) !== null) {
      const url = match[0];
      if (isValidProductImage(url)) {
        images.add(upgradeToMaxResolution(url));
      }
    }
  }
  
  // Add og:image if valid
  if (metadata.ogImage) {
    const ogImage = metadata.ogImage as string;
    if (isValidProductImage(ogImage)) {
      images.add(upgradeToMaxResolution(ogImage));
    }
  }

  console.log(`Found ${images.size} unique product images`);
  return Array.from(images);
}

function isValidProductImage(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.length < 20) return false;
  
  // Must be HTTPS and contain alicdn or be a valid image URL
  const isAlicdn = url.includes('alicdn.com');
  const isImage = /\.(jpg|jpeg|png|webp)(\?|$|_)/i.test(url);
  
  if (!isImage) return false;
  
  // Exclude non-product images
  const excludePatterns = [
    /avatar/i, /icon/i, /logo/i, /sprite/i, /placeholder/i,
    /loading/i, /blank/i, /transparent/i, /pixel/i, /spacer/i,
    /flag/i, /badge/i, /button/i, /banner/i,
    /bg[-_]/i, /background/i,
    /assets\/img/i, /static\/images/i,
    /s\.alicdn\.com/i,  // Static assets
    /g\.alicdn\.com/i,  // Global assets
    /gw\.alicdn\.com/i, // Gateway assets
    /laz-img-cdn/i,     // Lazada assets
    /_16x16/i, /_20x20/i, /_32x32/i, /_40x40/i, /_50x50/i,
    /_60x60/i, /_64x64/i, /_80x80/i, /_100x100/i, /_120x120/i,
  ];
  
  for (const pattern of excludePatterns) {
    if (pattern.test(url)) return false;
  }
  
  // For non-alicdn URLs, be more strict
  if (!isAlicdn) {
    if (url.includes('facebook') || url.includes('twitter') || url.includes('google')) {
      return false;
    }
  }
  
  return true;
}

function upgradeToMaxResolution(url: string): string {
  let upgraded = url;
  
  // Remove size suffixes: _220x220.jpg -> .jpg
  upgraded = upgraded.replace(/_\d+x\d+(\.(jpg|jpeg|png|webp))/gi, '$1');
  
  // Remove quality suffixes: _Q50, _Q75
  upgraded = upgraded.replace(/_Q\d+/gi, '');
  
  // Remove trailing resize parameters: .jpg_350x350q90.jpg -> .jpg
  upgraded = upgraded.replace(/\.(jpg|jpeg|png|webp)_[^"'\s]*/gi, '.$1');
  
  // Remove webp conversion: .jpg.webp -> .jpg  
  upgraded = upgraded.replace(/\.(jpg|jpeg|png)\.webp/gi, '.$1');
  
  // Remove inline size params
  upgraded = upgraded.replace(/_(50|100|120|200|220|240|300|350|400|500|640|800)x\d+/gi, '');
  
  // Clean up double extensions
  upgraded = upgraded.replace(/\.(jpg|jpeg|png|webp)\.(jpg|jpeg|png|webp)/gi, '.$1');
  
  return upgraded;
}

function extractRatingAndReviews(markdown: string) {
  let rating = 4.5;
  const ratingMatch = markdown.match(/(\d(?:\.\d)?)\s*(?:\/\s*5|stars?|estrellas?)/i);
  if (ratingMatch) rating = parseFloat(ratingMatch[1]);

  let reviewCount = Math.floor(Math.random() * 500) + 50;
  const reviewMatch = markdown.match(/(\d+(?:,\d{3})*)\s*(?:reviews?|reseñas?|opiniones?|valoraciones?)/i);
  if (reviewMatch) reviewCount = parseInt(reviewMatch[1].replace(',', ''));

  return { rating, reviewCount };
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
  
  if (original > current) {
    const discount = Math.round(((original - current) / original) * 100);
    return `-${discount}%`;
  }
  return '';
}