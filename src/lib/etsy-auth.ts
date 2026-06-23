import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";

const tokenCookie = "printz_etsy_oauth";
const verifierCookie = "printz_etsy_pkce";
const stateCookie = "printz_etsy_state";
const settingsCookie = "printz_etsy_settings";

export type EtsyOAuthToken = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
};

export type EtsyRuntimeSettings = {
  shopId: string;
  taxonomyId: string;
  shippingProfileId: string;
  readinessStateId: string;
};

export function etsyKeystring() {
  const apiKey = process.env.ETSY_API_KEY || "";
  return apiKey.split(":")[0] || apiKey;
}

export function etsyApiKeyHeader() {
  return process.env.ETSY_API_KEY || "";
}

export function etsyRedirectUri() {
  return `${process.env.NEXT_PUBLIC_SITE_URL || "https://printzcom.vercel.app"}/api/etsy/oauth/callback`;
}

export function etsyScopes() {
  return ["listings_r", "listings_w", "shops_r", "transactions_r"].join(" ");
}

export function makeCodeVerifier() {
  return base64Url(randomBytes(64)).slice(0, 128);
}

export function makeCodeChallenge(verifier: string) {
  return base64Url(createHash("sha256").update(verifier).digest());
}

export function makeState() {
  return base64Url(randomBytes(32));
}

export async function setEtsyOAuthStartCookies({ state, verifier }: { state: string; verifier: string }) {
  const cookieStore = await cookies();
  cookieStore.set(stateCookie, state, cookieOptions(10 * 60));
  cookieStore.set(verifierCookie, verifier, cookieOptions(10 * 60));
}

export async function getEtsyOAuthStartCookies() {
  const cookieStore = await cookies();
  return {
    state: cookieStore.get(stateCookie)?.value || "",
    verifier: cookieStore.get(verifierCookie)?.value || "",
  };
}

export async function clearEtsyOAuthStartCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(stateCookie);
  cookieStore.delete(verifierCookie);
}

export async function setEtsyOAuthToken(token: EtsyOAuthToken) {
  const cookieStore = await cookies();
  cookieStore.set(tokenCookie, Buffer.from(JSON.stringify(token), "utf8").toString("base64url"), cookieOptions(90 * 24 * 60 * 60));
}

export async function getEtsyOAuthToken() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(tokenCookie)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as EtsyOAuthToken;
  } catch {
    return null;
  }
}

export async function setEtsyRuntimeSettings(settings: Partial<EtsyRuntimeSettings>) {
  const cookieStore = await cookies();
  const clean = normalizeEtsyRuntimeSettings(settings);
  cookieStore.set(settingsCookie, Buffer.from(JSON.stringify(clean), "utf8").toString("base64url"), cookieOptions(365 * 24 * 60 * 60));
}

export async function getSavedEtsyRuntimeSettings() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(settingsCookie)?.value;
  if (!raw) return emptyEtsyRuntimeSettings();

  try {
    return normalizeEtsyRuntimeSettings(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<EtsyRuntimeSettings>);
  } catch {
    return emptyEtsyRuntimeSettings();
  }
}

export async function getEffectiveEtsyRuntimeSettings() {
  const saved = await getSavedEtsyRuntimeSettings();
  return normalizeEtsyRuntimeSettings({
    shopId: process.env.ETSY_SHOP_ID || saved.shopId,
    taxonomyId: process.env.ETSY_DEFAULT_TAXONOMY_ID || saved.taxonomyId,
    shippingProfileId: process.env.ETSY_SHIPPING_PROFILE_ID || saved.shippingProfileId,
    readinessStateId: process.env.ETSY_READINESS_STATE_ID || saved.readinessStateId,
  });
}

function normalizeEtsyRuntimeSettings(settings: Partial<EtsyRuntimeSettings>) {
  return {
    shopId: cleanId(settings.shopId),
    taxonomyId: cleanId(settings.taxonomyId),
    shippingProfileId: cleanId(settings.shippingProfileId),
    readinessStateId: cleanId(settings.readinessStateId),
  };
}

function emptyEtsyRuntimeSettings(): EtsyRuntimeSettings {
  return {
    shopId: "",
    taxonomyId: "",
    shippingProfileId: "",
    readinessStateId: "",
  };
}

function cleanId(value?: string) {
  return String(value || "").trim();
}

function base64Url(value: Buffer) {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
