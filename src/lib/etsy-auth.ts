import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

const tokenCookie = "printz_etsy_oauth";
const verifierCookie = "printz_etsy_pkce";
const stateCookie = "printz_etsy_state";
const settingsCookie = "printz_etsy_settings";
const settingsTable = "private_app_settings";
const tokenSettingKey = "etsy_oauth_token";
const runtimeSettingsKey = "etsy_runtime_settings";

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
  returnPolicyId: string;
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
  return ["listings_r", "listings_w", "shops_r", "shops_w", "transactions_r"].join(" ");
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
  const cookieStore = await requestCookies();
  cookieStore?.set(tokenCookie, Buffer.from(JSON.stringify(token), "utf8").toString("base64url"), cookieOptions(90 * 24 * 60 * 60));
  await setPrivateSetting(tokenSettingKey, token);
}

export async function getEtsyOAuthToken() {
  const cookieStore = await requestCookies();
  const raw = cookieStore?.get(tokenCookie)?.value;
  if (!raw) return getPrivateSetting<EtsyOAuthToken>(tokenSettingKey);

  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as EtsyOAuthToken;
  } catch {
    return getPrivateSetting<EtsyOAuthToken>(tokenSettingKey);
  }
}

export async function getValidEtsyOAuthToken() {
  const token = await getEtsyOAuthToken();
  if (!token?.access_token) return null;

  const expiresSoon = token.expires_at ? token.expires_at <= Date.now() + 5 * 60 * 1000 : false;
  if (!expiresSoon) {
    return token;
  }

  if (!token.refresh_token || !process.env.ETSY_API_KEY) {
    return null;
  }

  const refreshed = await refreshEtsyOAuthToken(token.refresh_token).catch(() => null);
  return refreshed;
}

export async function setEtsyRuntimeSettings(settings: Partial<EtsyRuntimeSettings>) {
  const clean = normalizeEtsyRuntimeSettings(settings);
  const cookieStore = await requestCookies();
  cookieStore?.set(settingsCookie, Buffer.from(JSON.stringify(clean), "utf8").toString("base64url"), cookieOptions(365 * 24 * 60 * 60));
  await setPrivateSetting(runtimeSettingsKey, clean);
}

export async function getSavedEtsyRuntimeSettings() {
  const cookieStore = await requestCookies();
  const raw = cookieStore?.get(settingsCookie)?.value;
  if (!raw) {
    return normalizeEtsyRuntimeSettings((await getPrivateSetting<Partial<EtsyRuntimeSettings>>(runtimeSettingsKey)) || {});
  }

  try {
    return normalizeEtsyRuntimeSettings(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<EtsyRuntimeSettings>);
  } catch {
    return normalizeEtsyRuntimeSettings((await getPrivateSetting<Partial<EtsyRuntimeSettings>>(runtimeSettingsKey)) || {});
  }
}

export async function getEffectiveEtsyRuntimeSettings() {
  const saved = await getSavedEtsyRuntimeSettings();
  return normalizeEtsyRuntimeSettings({
    shopId: process.env.ETSY_SHOP_ID || saved.shopId,
    taxonomyId: process.env.ETSY_DEFAULT_TAXONOMY_ID || saved.taxonomyId,
    shippingProfileId: process.env.ETSY_SHIPPING_PROFILE_ID || saved.shippingProfileId,
    readinessStateId: process.env.ETSY_READINESS_STATE_ID || saved.readinessStateId,
    returnPolicyId: process.env.ETSY_RETURN_POLICY_ID || saved.returnPolicyId,
  });
}

function normalizeEtsyRuntimeSettings(settings: Partial<EtsyRuntimeSettings>) {
  return {
    shopId: cleanId(settings.shopId),
    taxonomyId: cleanId(settings.taxonomyId),
    shippingProfileId: cleanId(settings.shippingProfileId),
    readinessStateId: cleanId(settings.readinessStateId),
    returnPolicyId: cleanId(settings.returnPolicyId),
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

async function requestCookies() {
  try {
    return await cookies();
  } catch {
    return null;
  }
}

async function refreshEtsyOAuthToken(refreshToken: string) {
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", etsyKeystring());
  body.set("refresh_token", refreshToken);

  const response = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error("Could not refresh Etsy OAuth token.");
  }

  const token = {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || refreshToken,
    expires_at: Date.now() + (payload.expires_in || 3600) * 1000,
  };

  await setEtsyOAuthToken(token);
  return token;
}

async function getPrivateSetting<T>(key: string): Promise<T | null> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from(settingsTable).select("value").eq("key", key).maybeSingle();
  if (error) return null;
  return (data?.value as T | undefined) || null;
}

async function setPrivateSetting(key: string, value: unknown) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  await supabase.from(settingsTable).upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
}
