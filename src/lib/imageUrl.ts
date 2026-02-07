export function normalizeImageUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;

  let url = rawUrl.trim();
  if (!url) return url;

  if (url.startsWith('//')) {
    url = `https:${url}`;
  }

  let normalized = url;

  normalized = normalized.replace(/_\d+x\d+(\.(jpg|jpeg|png|webp))/gi, '$1');
  normalized = normalized.replace(/_Q\d+/gi, '');
  normalized = normalized.replace(/\.(jpg|jpeg|png|webp)_[^\s"'<>]*/gi, '.$1');
  normalized = normalized.replace(/\.(jpg|jpeg|png)\.webp/gi, '.$1');
  normalized = normalized.replace(/_(\d+x\d+)/gi, '');
  normalized = normalized.replace(/\.(jpg|jpeg|png|webp)\.(jpg|jpeg|png|webp)/gi, '.$1');

  return normalized;
}
