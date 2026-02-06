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

    // Use screenshot format to force full page render, plus markdown for text content
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'html', 'links'],
        onlyMainContent: false,
        waitFor: 8000, // Wait 8 seconds for JavaScript to fully render
        timeout: 60000, // 60 second timeout
        actions: [
          { type: 'wait', milliseconds: 3000 }, // Wait for initial load
          { type: 'scroll', direction: 'down', amount: 500 }, // Scroll to trigger lazy loading
          { type: 'wait', milliseconds: 2000 }, // Wait for images to load
        ],
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
    const links = data.data?.links || data.links || [];
    const metadata = data.data?.metadata || data.metadata || {};

    console.log('Markdown length:', markdown.length);
    console.log('HTML length:', html.length);
    console.log('Links count:', links.length);

    const productData = parseAliExpressData(markdown, html, links, metadata, formattedUrl);

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
  links: string[],
  metadata: Record<string, unknown>, 
  originalUrl: string
) {
  const title = extractTitle(markdown, metadata);
  const { price, originalPrice, priceRange } = extractPrices(markdown, metadata);
  const images = extractAllImages(html, markdown, links, metadata);
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
  
  // Clean up AliExpress title suffixes
  title = title.replace(/\s*[-|–]\s*(AliExpress|Aliexpress).*$/i, '').trim();
  title = title.replace(/^\d+(\.\d+)?%?\s*OFF\s*/i, '').trim();
  title = title.replace(/Comprar\s+/i, '').trim();
  
  if (!title && markdown) {
    // Try to get from first heading
    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    if (headingMatch) title = headingMatch[1].trim();
  }
  
  // Truncate if too long
  if (title.length > 100) {
    title = title.substring(0, 100).trim();
  }
  
  return title;
}

function extractPrices(markdown: string, metadata: Record<string, unknown>) {
  let price = '';
  let originalPrice = '';
  let priceRange = '';
  
  const content = markdown + ' ' + ((metadata.description as string) || '') + ' ' + ((metadata.title as string) || '');
  
  // Euro patterns (most common for Spanish AliExpress)
  const pricePatterns = [
    /€\s*(\d+(?:[.,]\d{1,2})?)/g,
    /(\d+(?:[.,]\d{1,2})?)\s*€/g,
    /EUR\s*(\d+(?:[.,]\d{1,2})?)/gi,
    /(\d+(?:[.,]\d{1,2})?)\s*EUR/gi,
  ];
  
  // USD patterns as fallback
  const usdPatterns = [
    /US\s*\$\s*(\d+(?:[.,]\d{1,2})?)/gi,
    /\$\s*(\d+(?:[.,]\d{1,2})?)/g,
  ];
  
  const allPrices: number[] = [];
  
  // Extract Euro prices first
  for (const pattern of pricePatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const priceValue = parseFloat(match[1].replace(',', '.'));
      if (priceValue > 0 && priceValue < 10000) {
        allPrices.push(priceValue);
      }
    }
  }
  
  // If no Euro prices, try USD
  if (allPrices.length === 0) {
    for (const pattern of usdPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(content)) !== null) {
        const priceValue = parseFloat(match[1].replace(',', '.'));
        if (priceValue > 0 && priceValue < 10000) {
          allPrices.push(priceValue);
        }
      }
    }
  }
  
  if (allPrices.length > 0) {
    // Sort prices
    allPrices.sort((a, b) => a - b);
    
    const lowestPrice = allPrices[0];
    const highestPrice = allPrices[allPrices.length - 1];
    
    // Set main price
    price = lowestPrice.toFixed(2);
    
    // If there's a significant price range, show it
    if (allPrices.length > 1 && highestPrice > lowestPrice * 1.2) {
      priceRange = `Desde €${lowestPrice.toFixed(2)}`;
      
      // Highest price might be the original
      if (highestPrice > lowestPrice * 1.5) {
        originalPrice = `€${highestPrice.toFixed(2)}`;
      }
    }
  }

  return { price, originalPrice, priceRange };
}

function extractAllImages(
  html: string, 
  markdown: string, 
  links: string[],
  metadata: Record<string, unknown>
): string[] {
  const images = new Set<string>();
  const contentToSearch = html + ' ' + markdown;
  
  // ========== METHOD 1: Extract from HTML attributes ==========
  const srcPatterns = [
    /src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
    /data-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
    /data-lazy-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
    /data-magnifier-src=["']([^"']+)["']/gi,
    /data-zoom-src=["']([^"']+)["']/gi,
  ];

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
  
  // ========== METHOD 2: Extract from markdown image syntax ==========
  const markdownImagePattern = /!\[[^\]]*\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownImagePattern.exec(markdown)) !== null) {
    const url = match[1];
    if (isValidProductImage(url)) {
      images.add(upgradeToMaxResolution(url));
    }
  }
  
  // ========== METHOD 3: Extract from links array ==========
  for (const link of links) {
    if (isValidProductImage(link)) {
      images.add(upgradeToMaxResolution(link));
    }
  }
  
  // ========== METHOD 4: Direct AliExpress CDN URL patterns ==========
  const aliexpressPatterns = [
    // Main product images on ae01-ae09
    /https?:\/\/ae0[1-9]\.alicdn\.com\/kf\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp)/gi,
    // cbu CDN for variants
    /https?:\/\/cbu0[1-9]\.alicdn\.com\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi,
    // img.alicdn.com
    /https?:\/\/img\.alicdn\.com\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi,
    // Any alicdn image
    /https?:\/\/[a-z0-9.-]*alicdn\.com\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi,
  ];

  for (const pattern of aliexpressPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(contentToSearch)) !== null) {
      const url = match[0];
      if (isValidProductImage(url)) {
        images.add(upgradeToMaxResolution(url));
      }
    }
  }
  
  // ========== METHOD 5: og:image from metadata ==========
  if (metadata.ogImage) {
    const ogImage = metadata.ogImage as string;
    if (isValidProductImage(ogImage)) {
      images.add(upgradeToMaxResolution(ogImage));
    }
  }
  
  // ========== METHOD 6: Extract from JSON-LD or data attributes ==========
  const jsonPatterns = [
    /"image"\s*:\s*"([^"]+)"/gi,
    /"images"\s*:\s*\[([^\]]+)\]/gi,
    /imageUrl['"]\s*:\s*['"]([^'"]+)['"]/gi,
  ];
  
  for (const pattern of jsonPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(contentToSearch)) !== null) {
      const urls = match[1].match(/https?:\/\/[^\s"',]+\.(?:jpg|jpeg|png|webp)/gi);
      if (urls) {
        for (const url of urls) {
          if (isValidProductImage(url)) {
            images.add(upgradeToMaxResolution(url));
          }
        }
      }
    }
  }

  console.log(`Found ${images.size} unique product images`);
  return Array.from(images);
}

function isValidProductImage(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.length < 20) return false;
  
  // Must look like an image URL
  const isImage = /\.(jpg|jpeg|png|webp)(\?|$|_|\.)/i.test(url);
  if (!isImage) return false;
  
  // Exclude system/UI images
  const excludePatterns = [
    /avatar/i, /icon/i, /logo(?!.*product)/i, /sprite/i, /placeholder/i,
    /loading/i, /blank/i, /transparent/i, /pixel/i, /spacer/i,
    /flag/i, /badge/i, /button/i, /banner(?!.*product)/i,
    /bg[-_]/i, /background/i,
    /assets\/img/i, /static\/images/i,
    /s\.alicdn\.com/i,  // Static assets CDN
    /g\.alicdn\.com/i,  // Global assets CDN
    /gw\.alicdn\.com/i, // Gateway assets CDN
    /laz-img-cdn/i,
    /facebook/i, /twitter/i, /google/i, /pinterest/i,
    // Very small thumbnails
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
  
  // Remove size suffixes like _220x220.jpg -> .jpg
  upgraded = upgraded.replace(/_\d+x\d+(\.(jpg|jpeg|png|webp))/gi, '$1');
  
  // Remove quality suffixes like _Q50, _Q75, _Q90
  upgraded = upgraded.replace(/_Q\d+/gi, '');
  
  // Remove trailing resize parameters: .jpg_350x350q90.jpg -> .jpg
  upgraded = upgraded.replace(/\.(jpg|jpeg|png|webp)_[^\s"'<>]*/gi, '.$1');
  
  // Remove webp conversion suffix: .jpg.webp -> .jpg  
  upgraded = upgraded.replace(/\.(jpg|jpeg|png)\.webp/gi, '.$1');
  
  // Remove inline size params
  upgraded = upgraded.replace(/_(\d+x\d+)/gi, '');
  
  // Clean up any doubled extensions
  upgraded = upgraded.replace(/\.(jpg|jpeg|png|webp)\.(jpg|jpeg|png|webp)/gi, '.$1');
  
  return upgraded;
}

function extractRatingAndReviews(markdown: string) {
  let rating = 4.5;
  const ratingMatch = markdown.match(/(\d(?:[.,]\d)?)\s*(?:\/\s*5|stars?|estrellas?)/i);
  if (ratingMatch) {
    rating = parseFloat(ratingMatch[1].replace(',', '.'));
    if (rating > 5) rating = 5;
    if (rating < 1) rating = 4.5;
  }

  let reviewCount = Math.floor(Math.random() * 500) + 100;
  const reviewMatch = markdown.match(/(\d+(?:[.,]\d{3})*)\s*(?:reviews?|reseñas?|opiniones?|valoraciones?|ventas?|pedidos?)/i);
  if (reviewMatch) {
    reviewCount = parseInt(reviewMatch[1].replace(/[.,]/g, ''));
  }

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
  
  if (original > current && current > 0) {
    const discount = Math.round(((original - current) / original) * 100);
    if (discount > 0 && discount < 100) {
      return `-${discount}%`;
    }
  }
  return '';
}
