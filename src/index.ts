/**
 * OpenCode Qwen Auth Plugin
 *
 * Plugin de autenticacao OAuth para Qwen, baseado no qwen-code.
 * Implementa Device Flow (RFC 8628) para autenticacao.
 *
 * Provider: qwen-code -> portal.qwen.ai/v1
 * Modelos: coder-model, vision-model (与 qwen-code CLI 对齐)
 */

import { spawn } from 'node:child_process';

import { QWEN_PROVIDER_ID, QWEN_API_CONFIG, QWEN_MODELS } from './constants.js';
import type { QwenCredentials } from './types.js';
import { loadCredentials, saveCredentials } from './plugin/auth.js';
import {
  generatePKCE,
  requestDeviceAuthorization,
  pollDeviceToken,
  tokenResponseToCredentials,
  refreshAccessToken,
  SlowDownError,
} from './qwen/oauth.js';
import { logTechnicalDetail } from './errors.js';
import { requestQueue } from './plugin/request-queue.js';

const QWEN_CODE_VERSION = '0.10.3';

const TOKEN_CACHE_DURATION = 5 * 60 * 1000;
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;
let cachedToken: string | null = null;
let cachedTokenExpiry = 0;
let lastRefreshTime = 0;

interface RuntimeAuthState {
  type: string;
  access?: string;
  refresh?: string;
  expires?: number;
}

// ============================================
// Helpers
// ============================================

function openBrowser(url: string): void {
  try {
    const platform = process.platform;
    const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'rundll32' : 'xdg-open';
    const args = platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
    const child = spawn(command, args, { stdio: 'ignore', detached: true });
    child.unref?.();
  } catch {
    // Ignore errors
  }
}

function resetTokenCache(): void {
  cachedToken = null;
  cachedTokenExpiry = 0;
  lastRefreshTime = 0;
}

function runtimeAuthToCredentials(auth: RuntimeAuthState | null): QwenCredentials | null {
  if (!auth || auth.type !== 'oauth') {
    return null;
  }

  if (!auth.access && !auth.refresh) {
    return null;
  }

  return {
    accessToken: auth.access || '',
    refreshToken: auth.refresh,
    expiryDate: auth.expires,
    tokenType: 'Bearer',
  };
}

function getExpiryScore(credentials: QwenCredentials | null): number {
  return credentials?.expiryDate ?? 0;
}

function mergeCredentialSources(
  runtimeCredentials: QwenCredentials | null,
  fileCredentials: QwenCredentials | null,
): { accessToken: string | null; expiryDate?: number; refreshCandidates: string[] } {
  const credentialsByFreshness = [runtimeCredentials, fileCredentials]
    .filter((item): item is QwenCredentials => Boolean(item))
    .sort((a, b) => getExpiryScore(b) - getExpiryScore(a));

  const freshest = credentialsByFreshness[0];
  const accessToken = freshest?.accessToken || runtimeCredentials?.accessToken || fileCredentials?.accessToken || null;
  const expiryDate = freshest?.expiryDate || runtimeCredentials?.expiryDate || fileCredentials?.expiryDate;
  const refreshCandidates = [
    freshest?.refreshToken,
    fileCredentials?.refreshToken,
    runtimeCredentials?.refreshToken,
  ].filter((token, index, arr): token is string => Boolean(token) && arr.indexOf(token) === index);

  return { accessToken, expiryDate, refreshCandidates };
}

/** Obtem um access token valido (com refresh se necessario) */
async function getValidAccessToken(
  getAuth: () => Promise<RuntimeAuthState>,
): Promise<string | null> {
  const auth = await getAuth();
  const runtimeCredentials = runtimeAuthToCredentials(auth);
  const fileCredentials = loadCredentials();
  const merged = mergeCredentialSources(runtimeCredentials, fileCredentials);

  const now = Date.now();

  if (cachedToken && now < cachedTokenExpiry && now - lastRefreshTime < TOKEN_CACHE_DURATION) {
    return cachedToken;
  }

  let accessToken = merged.accessToken;
  let tokenExpiry = merged.expiryDate;

  const shouldRefresh =
    merged.refreshCandidates.length > 0 &&
    (!accessToken || !tokenExpiry || now > tokenExpiry - REFRESH_BEFORE_EXPIRY_MS);

  if (shouldRefresh) {
    for (const refreshToken of merged.refreshCandidates) {
      try {
        const refreshed = await refreshAccessToken(refreshToken);
        accessToken = refreshed.accessToken;
        tokenExpiry = refreshed.expiryDate || Date.now() + 3600000;
        saveCredentials(refreshed);
        lastRefreshTime = Date.now();
        cachedToken = accessToken;
        cachedTokenExpiry = tokenExpiry;
        logTechnicalDetail(`Token refreshed proactively, new expiry: ${cachedTokenExpiry}`);
        return accessToken;
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        logTechnicalDetail(`Token refresh failed: ${detail}`);
      }
    }
  }

  if (accessToken && tokenExpiry && now > tokenExpiry) {
    resetTokenCache();
    return null;
  }

  if (accessToken) {
    cachedToken = accessToken;
    cachedTokenExpiry = tokenExpiry || Date.now() + 3600000;
    lastRefreshTime = now;
  }

  return accessToken ?? null;
}

// ============================================
// Plugin Principal
// ============================================

export const QwenAuthPlugin = async (_input: unknown) => {
  return {
    auth: {
      provider: QWEN_PROVIDER_ID,

      loader: async (
        getAuth: () => Promise<RuntimeAuthState>,
        provider: { models?: Record<string, { cost?: { input: number; output: number } }> },
      ) => {
        // Zerar custo dos modelos (gratuito via OAuth)
        if (provider?.models) {
          for (const model of Object.values(provider.models)) {
            if (model) model.cost = { input: 0, output: 0 };
          }
        }

        const accessToken = await getValidAccessToken(getAuth);
        if (!accessToken) return null;

        return {
          apiKey: '',
          baseURL: QWEN_API_CONFIG.baseUrl,
          async fetch(input: RequestInfo, init?: RequestInit) {
            const accessToken = await getValidAccessToken(getAuth);
            if (!accessToken) {
              throw new Error('[Qwen] No valid access token. Please run "opencode auth login".');
            }

            const userAgent = `QwenCode/${QWEN_CODE_VERSION} (${process.platform}; ${process.arch})`;
            const headers = new Headers(init?.headers);
            headers.set('Authorization', `Bearer ${accessToken}`);
            headers.set('User-Agent', userAgent);
            headers.set('X-DashScope-CacheControl', 'enable');
            headers.set('X-DashScope-UserAgent', userAgent);
            headers.set('X-DashScope-AuthType', 'qwen-oauth');

            return requestQueue.enqueue(async () => {
              const response = await fetch(input, {
                ...init,
                headers,
              });

              if (response.status === 401 || response.status === 403) {
                resetTokenCache();
                const retriedToken = await getValidAccessToken(getAuth);
                if (retriedToken && retriedToken !== accessToken) {
                  headers.set('Authorization', `Bearer ${retriedToken}`);
                  return fetch(input, { ...init, headers });
                }
              }

              if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || '60';
                await new Promise(resolve => setTimeout(resolve, Number.parseInt(retryAfter, 10) * 1000));
                return fetch(input, { ...init, headers });
              }

              return response;
            });
          },
        };
      },

      methods: [
        {
          type: 'oauth' as const,
          label: 'Qwen Code (qwen.ai OAuth)',
          authorize: async () => {
            const { verifier, challenge } = generatePKCE();

            try {
              const deviceAuth = await requestDeviceAuthorization(challenge);
              openBrowser(deviceAuth.verification_uri_complete);

              const POLLING_MARGIN_MS = 3000;

              return {
                url: deviceAuth.verification_uri_complete,
                instructions: `Codigo: ${deviceAuth.user_code}`,
                method: 'auto' as const,
                callback: async () => {
                  const startTime = Date.now();
                  const timeoutMs = deviceAuth.expires_in * 1000;
                  let interval = 5000;

                  while (Date.now() - startTime < timeoutMs) {
                    await new Promise(resolve => setTimeout(resolve, interval + POLLING_MARGIN_MS));

                    try {
                      const tokenResponse = await pollDeviceToken(deviceAuth.device_code, verifier);

                      if (tokenResponse) {
                        const credentials = tokenResponseToCredentials(tokenResponse);
                        saveCredentials(credentials);

                        return {
                          type: 'success' as const,
                          access: credentials.accessToken,
                          refresh: credentials.refreshToken ?? '',
                          expires: credentials.expiryDate || Date.now() + 3600000,
                        };
                      }
                    } catch (e) {
                      if (e instanceof SlowDownError) {
                        interval = Math.min(interval + 5000, 15000);
                      } else if (!(e instanceof Error) || !e.message.includes('authorization_pending')) {
                        return { type: 'failed' as const };
                      }
                    }
                  }

                  return { type: 'failed' as const };
                },
              };
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Erro desconhecido';
              return {
                url: '',
                instructions: `Erro: ${msg}`,
                method: 'auto' as const,
                callback: async () => ({ type: 'failed' as const }),
              };
            }
          },
        },
      ],
    },

    config: async (config: Record<string, unknown>) => {
      const providers = (config.provider as Record<string, unknown>) || {};

      providers[QWEN_PROVIDER_ID] = {
        npm: '@ai-sdk/openai-compatible',
        name: 'Qwen Code',
        options: { baseURL: QWEN_API_CONFIG.baseUrl },
        models: Object.fromEntries(
          Object.entries(QWEN_MODELS).map(([id, m]) => [
            id,
            {
              id: m.id,
              name: m.name,
              reasoning: m.reasoning,
              limit: { context: m.contextWindow, output: m.maxOutput },
              cost: m.cost,
              modalities: id === 'vision-model' 
                ? { input: ['text', 'image'], output: ['text'] }
                : { input: ['text'], output: ['text'] },
              ...(id === 'vision-model' ? { attachment: true } : {}),
            },
          ])
        ),
      };

      config.provider = providers;
    },
  };
};

export default QwenAuthPlugin;
