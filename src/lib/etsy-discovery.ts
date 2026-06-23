import { etsyApiKeyHeader } from "@/lib/etsy-auth";

type EtsyShop = {
  shop_id?: number;
  shop_name?: string;
};

type EtsyMe = {
  shop_id?: number;
  user_id?: number;
};

type EtsyShippingProfile = {
  shipping_profile_id?: number;
  title?: string;
};

type EtsyReadinessState = {
  readiness_state_id?: number;
  readiness_state?: string;
  name?: string;
};

type EtsyTaxonomyNode = {
  id?: number;
  name?: string;
  children?: EtsyTaxonomyNode[];
};

export type EtsyDiscoveryResult = {
  shopId: string;
  taxonomyId: string;
  shippingProfileId: string;
  readinessStateId: string;
  notes: string[];
};

export async function discoverEtsyRuntimeIds({ accessToken, shopName = "printzbykhan" }: { accessToken: string; shopName?: string }) {
  const apiKey = etsyApiKeyHeader();
  if (!apiKey) throw new Error("ETSY_API_KEY is missing.");
  if (!accessToken) throw new Error("Connected Etsy OAuth token is missing.");

  const notes: string[] = [];
  const shopId = await resolveShopId({ apiKey, accessToken, shopName });
  const [shippingProfileId, readinessStateId, taxonomyId] = await Promise.all([
    resolveShippingProfileId({ apiKey, accessToken, shopId }).catch((error) => {
      notes.push(error instanceof Error ? error.message : "Could not load shipping profiles.");
      return "";
    }),
    resolveReadinessStateId({ apiKey, accessToken, shopId }).catch((error) => {
      notes.push(error instanceof Error ? error.message : "Could not load readiness states.");
      return "";
    }),
    resolveTaxonomyId({ apiKey }).catch((error) => {
      notes.push(error instanceof Error ? error.message : "Could not load seller taxonomy.");
      return "";
    }),
  ]);

  return {
    shopId,
    taxonomyId,
    shippingProfileId,
    readinessStateId,
    notes,
  } satisfies EtsyDiscoveryResult;
}

async function resolveShopId({ apiKey, accessToken, shopName }: { apiKey: string; accessToken: string; shopName: string }) {
  const me = await etsyJson<EtsyMe>(new URL("https://api.etsy.com/v3/application/users/me"), { apiKey, accessToken }).catch(() => null);
  if (me?.shop_id) return String(me.shop_id);

  if (me?.user_id) {
    const byAuthenticatedUser = new URL(`https://api.etsy.com/v3/application/users/${me.user_id}/shops`);
    const authenticatedUserShops = await etsyJson<{ results?: EtsyShop[] }>(byAuthenticatedUser, { apiKey, accessToken }).catch(() => null);
    const authenticatedUserShopId = authenticatedUserShops?.results?.[0]?.shop_id;
    if (authenticatedUserShopId) return String(authenticatedUserShopId);
  }

  const byName = new URL("https://api.etsy.com/v3/application/shops");
  byName.searchParams.set("shop_name", shopName);

  const shop = await etsyJson<{ results?: EtsyShop[]; shop_id?: number; shop_name?: string }>(byName, { apiKey });
  const exactMatch = shop.results?.find((item) => item.shop_name?.toLowerCase() === shopName.toLowerCase());
  const shopId = exactMatch?.shop_id || shop.results?.[0]?.shop_id || shop.shop_id;
  if (shopId) return String(shopId);

  const userId = accessToken.split(".")[0];
  if (userId) {
    const byUser = new URL(`https://api.etsy.com/v3/application/users/${userId}/shops`);
    const userShops = await etsyJson<{ results?: EtsyShop[] }>(byUser, { apiKey, accessToken });
    const userShopId = userShops.results?.[0]?.shop_id;
    if (userShopId) return String(userShopId);
  }

  throw new Error(`Could not find shop ID for ${shopName}.`);
}

async function resolveShippingProfileId({ apiKey, accessToken, shopId }: { apiKey: string; accessToken: string; shopId: string }) {
  const url = new URL(`https://api.etsy.com/v3/application/shops/${shopId}/shipping-profiles`);
  const payload = await etsyJson<{ results?: EtsyShippingProfile[] }>(url, { apiKey, accessToken });
  const profile = payload.results?.[0];
  if (!profile?.shipping_profile_id) throw new Error("No Etsy shipping profiles found. Create one in Etsy first.");
  return String(profile.shipping_profile_id);
}

async function resolveReadinessStateId({ apiKey, accessToken, shopId }: { apiKey: string; accessToken: string; shopId: string }) {
  const url = new URL(`https://api.etsy.com/v3/application/shops/${shopId}/readiness-state-definitions`);
  const payload = await etsyJson<{ results?: EtsyReadinessState[] }>(url, { apiKey, accessToken });
  const madeToOrder =
    payload.results?.find((state) => [state.readiness_state, state.name].join(" ").toLowerCase().includes("made")) ||
    payload.results?.[0];
  if (!madeToOrder?.readiness_state_id) throw new Error("No Etsy processing/readiness profiles found. Create one in Etsy first.");
  return String(madeToOrder.readiness_state_id);
}

async function resolveTaxonomyId({ apiKey }: { apiKey: string }) {
  const url = new URL("https://api.etsy.com/v3/application/seller-taxonomy/nodes");
  const payload = await etsyJson<{ results?: EtsyTaxonomyNode[] }>(url, { apiKey });
  const nodes = flattenTaxonomy(payload.results || []);
  const preferred =
    findTaxonomy(nodes, ["desk", "organizer"]) ||
    findTaxonomy(nodes, ["office", "organization"]) ||
    findTaxonomy(nodes, ["home", "living", "office"]) ||
    findTaxonomy(nodes, ["3d", "printed"]) ||
    nodes.find((node) => node.name?.toLowerCase().includes("home"));

  if (!preferred?.id) throw new Error("Could not pick a default Etsy taxonomy ID.");
  return String(preferred.id);
}

async function etsyJson<T>(url: URL, { apiKey, accessToken }: { apiKey: string; accessToken?: string }) {
  const response = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    next: { revalidate: 0 },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Etsy API ${url.pathname} failed with ${response.status}: ${text.slice(0, 220)}`);
  }
  return JSON.parse(text) as T;
}

function flattenTaxonomy(nodes: EtsyTaxonomyNode[]) {
  const flattened: EtsyTaxonomyNode[] = [];
  const visit = (node: EtsyTaxonomyNode) => {
    flattened.push(node);
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return flattened;
}

function findTaxonomy(nodes: EtsyTaxonomyNode[], terms: string[]) {
  return nodes.find((node) => {
    const name = node.name?.toLowerCase() || "";
    return terms.every((term) => name.includes(term));
  });
}
