/**
 * Qwen Credentials Management
 *
 * Handles saving credentials to ~/.qwen/oauth_creds.json
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';

import type { QwenCredentials } from '../types.js';

/**
 * Get the path to the credentials file
 */
export function getCredentialsPath(): string {
  const homeDir = homedir();
  return join(homeDir, '.qwen', 'oauth_creds.json');
}

/**
 * Save credentials to file in qwen-code compatible format
 */
export function saveCredentials(credentials: QwenCredentials): void {
  const credPath = getCredentialsPath();
  const dir = join(homedir(), '.qwen');

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Save in qwen-code format for compatibility
  const data = {
    access_token: credentials.accessToken,
    token_type: credentials.tokenType || 'Bearer',
    refresh_token: credentials.refreshToken,
    resource_url: credentials.resourceUrl,
    expiry_date: credentials.expiryDate,
    scope: credentials.scope,
  };

  writeFileSync(credPath, JSON.stringify(data, null, 2));
}

interface StoredCredentialsFile {
  access_token?: string;
  token_type?: string;
  refresh_token?: string;
  resource_url?: string;
  expiry_date?: number;
  scope?: string;
}

/**
 * Load credentials from file in qwen-code compatible format
 */
export function loadCredentials(): QwenCredentials | null {
  const credPath = getCredentialsPath();

  if (!existsSync(credPath)) {
    return null;
  }

  try {
    const raw = readFileSync(credPath, 'utf-8');
    const parsed = JSON.parse(raw) as StoredCredentialsFile;

    if (!parsed.access_token && !parsed.refresh_token) {
      return null;
    }

    return {
      accessToken: parsed.access_token || '',
      tokenType: parsed.token_type || 'Bearer',
      refreshToken: parsed.refresh_token,
      resourceUrl: parsed.resource_url,
      expiryDate: parsed.expiry_date,
      scope: parsed.scope,
    };
  } catch {
    return null;
  }
}
