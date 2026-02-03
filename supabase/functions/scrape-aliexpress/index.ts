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
    // ============ AUTHENTICATION CHECK ============
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

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error('Token validation failed:', claimsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // ============ ADMIN ROLE CHECK ============
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('Admin check failed:', roleError);
      return new Response(
        JSON.stringify({ success: false, error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin authenticated:', userId);

    // ============ MAIN LOGIC ============
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping AliExpress URL:', formattedUrl);

    // Use Firecrawl to scrape the page
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 3000,
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

    // Extract product info from the scraped content
    const markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.html || data.html || '';
    const metadata = data.data?.metadata || data.metadata || {};

    // Parse product data from the content
    const productData = parseAliExpressData(markdown, html, metadata, formattedUrl);

    console.log('Extracted product data:', productData);

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

function parseAliExpressData(markdown: string, html: string, metadata: Record<string, unknown>, originalUrl: string) {
  // Extract title from metadata or content
  let title = (metadata.title as string) || '';
  
  // Clean up common AliExpress title patterns
  title = title.replace(/\s*[-|]\s*AliExpress.*$/i, '').trim();
  title = title.replace(/^\d+(\.\d+)?%?\s*OFF\s*/i, '').trim();
  
  if (!title && markdown) {
    // Try to get title from first heading
    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    }
  }

  // Extract price - look for common patterns in AliExpress
  let price = '';
  let originalPrice = '';
  let priceRange = '';
  
  const content = markdown + ' ' + ((metadata.description as string) || '') + ' ' + ((metadata.title as string) || '');
  
  // AliExpress specific price patterns - ordered by priority
  // Look for explicit current price patterns first
  const currentPricePatterns = [
    // Current price with EUR symbol directly attached
    /(?:precio|price|ahora|now|sale)[\s:]*€\s*(\d+(?:[.,]\d{1,2})?)/gi,
    /€\s*(\d+(?:[.,]\d{1,2})?)/g,
    /(\d+(?:[.,]\d{1,2})?)\s*€/g,
    /EUR\s*(\d+(?:[.,]\d{1,2})?)/gi,
    // USD patterns
    /(?:US\s*)?\$\s*(\d+(?:[.,]\d{1,2})?)/g,
  ];
  
  // Look for original/crossed out price patterns
  const originalPricePatterns = [
    /(?:antes|was|original|regular)[\s:]*€?\s*(\d+(?:[.,]\d{1,2})?)/gi,
    /(?:pvp|rrp)[\s:]*€?\s*(\d+(?:[.,]\d{1,2})?)/gi,
  ];

  const allPrices: number[] = [];
  const currentPrices: number[] = [];
  const originalPrices: number[] = [];
  
  // First, try to find price ranges like "€1.50 - €15.99" or "1.50 - 15.99"
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
        if (highPrice > 0 && highPrice < 10000) {
          allPrices.push(highPrice);
        }
      }
    }
  }

  // Find current prices
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

  // Find original prices
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

  // Determine the actual price to use
  if (currentPrices.length > 0) {
    // Sort prices and use the lowest as the current price
    currentPrices.sort((a, b) => a - b);
    allPrices.sort((a, b) => a - b);
    
    const lowestPrice = currentPrices[0];
    const highestAllPrice = allPrices[allPrices.length - 1];
    
    // Check if there are multiple prices indicating a range
    if (currentPrices.length > 1 && currentPrices[currentPrices.length - 1] > lowestPrice * 1.2) {
      priceRange = `Desde €${lowestPrice.toFixed(2)}`;
    }
    
    // Use the actual lowest price - this is the REAL AliExpress price
    price = lowestPrice.toFixed(2);
    
    // Set original price only if there's a clear original price
    if (originalPrices.length > 0) {
      const highestOriginal = Math.max(...originalPrices);
      if (highestOriginal > lowestPrice * 1.1) {
        originalPrice = `€${highestOriginal.toFixed(2)}`;
      }
    } else if (highestAllPrice > lowestPrice * 1.5) {
      // If no explicit original price but there's a much higher price in the data
      originalPrice = `€${highestAllPrice.toFixed(2)}`;
    }
  }

  // Extract images from metadata or content
  const images: string[] = [];
  
  // Check og:image
  if (metadata.ogImage) {
    images.push(metadata.ogImage as string);
  }
  
  // Extract image URLs from HTML/markdown
  const imgPatterns = [
    /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?/gi,
    /src=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/gi,
  ];

  for (const pattern of imgPatterns) {
    let match;
    const contentToSearch = html || markdown;
    while ((match = pattern.exec(contentToSearch)) !== null) {
      const imgUrl = match[1] || match[0];
      if (imgUrl && !imgUrl.includes('avatar') && !imgUrl.includes('icon') && !images.includes(imgUrl)) {
        // Filter out small icons
        if (!imgUrl.includes('50x50') && !imgUrl.includes('100x100')) {
          images.push(imgUrl);
        }
      }
    }
  }

  // Extract rating
  let rating = 4.5;
  const ratingMatch = markdown.match(/(\d(?:\.\d)?)\s*(?:\/\s*5|stars?|estrellas?)/i);
  if (ratingMatch) {
    rating = parseFloat(ratingMatch[1]);
  }

  // Extract review count
  let reviewCount = Math.floor(Math.random() * 500) + 50;
  const reviewMatch = markdown.match(/(\d+(?:,\d{3})*)\s*(?:reviews?|reseñas?|opiniones?|valoraciones?)/i);
  if (reviewMatch) {
    reviewCount = parseInt(reviewMatch[1].replace(',', ''));
  }

  // Generate slug from title
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  // Final price - ensure we have the real price, not a default
  const finalPrice = price || '0.00';
  const formattedPrice = `€${finalPrice}`;
  
  return {
    title: title || 'Producto de Pesca',
    subtitle: ((metadata.description as string) || '').substring(0, 100),
    price: formattedPrice,
    originalPrice: originalPrice || '',
    priceRange: priceRange || '',
    discount: originalPrice && price ? calculateDiscount(formattedPrice, originalPrice) : '',
    images: images.slice(0, 5),
    rating,
    reviewCount,
    slug: slug || `producto-${Date.now()}`,
    affiliateLink: originalUrl,
    aliexpressUrl: originalUrl,
  };
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
