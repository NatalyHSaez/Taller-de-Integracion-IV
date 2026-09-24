const rawApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_BASE_URL = rawApiUrl ? rawApiUrl.replace(/\/+$/, "") : null;

export const API_V1_URL = API_BASE_URL ? `${API_BASE_URL}/api/v1` : null;

export const IS_API_CONFIGURED = Boolean(API_BASE_URL);

if (__DEV__) {
  console.log("[config] API Gateway:", API_BASE_URL ?? "no configurado");
}
