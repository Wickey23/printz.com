const productionSiteUrl = "https://printzcom.vercel.app";

export function getConfiguredSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.SITE_URL?.trim();
  if (!configuredUrl || isLocalUrl(configuredUrl)) return productionSiteUrl;
  return trimTrailingSlash(configuredUrl);
}

export function isLocalUrl(value: string) {
  return value.includes("localhost") || value.includes("127.0.0.1") || value.includes("0.0.0.0");
}

export function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}
