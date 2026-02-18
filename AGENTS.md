# AGENTS.md - OpenCode Qwen Proxy

## Project Overview

OpenCode Qwen Proxy is an OAuth authentication plugin for OpenCode that enables users to access Qwen AI models (coder-model, vision-model) via their qwen.ai account. It implements RFC 8628 Device Flow authentication.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Build the plugin (produces dist/ directory)
npm run build

# Development mode with watch (auto-rebuild on file changes)
npm run dev

# TypeScript type checking (run before committing)
npm run typecheck
```

- **Runtime**: Bun (ESM modules)
- **TypeScript**: Strict mode enabled
- **Node**: >=20.0.0
- **Testing**: No test framework currently configured (manual testing via OpenCode CLI)

## Project Structure

```
src/
├── index.ts              # Main plugin entry (loader + fetch + methods)
├── constants.ts          # OAuth endpoints, model configuration
├── types.ts             # TypeScript type definitions
├── errors.ts            # Custom error classes
├── qwen/
│   └── oauth.ts         # OAuth Device Flow + PKCE implementation
└── plugin/
    ├── request-queue.ts # Request throttling queue
    └── auth.ts          # Credentials management
```

## TypeScript Configuration

- **Target**: ES2022
- **Module**: ESNext with bundler resolution
- **Strict Mode**: Enabled (no `any`, explicit types required)
- **Key Settings** (`tsconfig.json`):
  - `strict: true` - Full type checking
  - `noEmit: true` - Type checking only, no output
  - `isolatedModules: true` - Ensures cross-file type safety
  - `resolveJsonModule: true` - Allows importing JSON

## Code Style Guidelines

### General Rules

- **Module System**: ESM (ECMAScript Modules) - use `import ... from './module.js'` with `.js` extension
- **Language**: TypeScript with strict mode (never use `any`)
- **Comments**: JSDoc style for functions and classes
- **Line endings**: LF (Unix)

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `request-queue.ts` |
| Interfaces/Types | PascalCase | `QwenCredentials` |
| Classes | PascalCase | `QwenAuthError` |
| Functions | camelCase | `generatePKCE()` |
| Constants | UPPER_SNAKE_CASE | `TOKEN_CACHE_DURATION` |
| Enums | PascalCase | `AuthErrorKind` |
| Enum Values | snake_case | `'token_expired'` |

### Import Rules

```typescript
// Relative imports MUST include .js extension (ESM)
import { Something } from './module.js';
import { Something } from '../utils/helper.js';

// External packages
import { spawn } from 'node:child_process';

// Type-only imports
import type { QwenCredentials } from './types.js';
```

### TypeScript Rules

- **NEVER suppress type errors** (`as any`, `@ts-ignore`, `@ts-expect-error`)
- Use explicit return types for exported functions
- Prefer interfaces over types for object shapes
- Use `import type` for type-only imports

```typescript
// ✅ Good
import type { SomeType } from './types.js';
interface UserConfig {
  apiKey: string;
}

// ❌ Bad - never use any
const something: any = someValue;
```

### Error Handling

- All errors should extend `Error` class with custom error codes
- Provide user-friendly messages (Portuguese for user-facing errors)
- Use technical detail logging with `logTechnicalDetail()` for debugging
- Conditional debug logging via `OPENCODE_QWEN_DEBUG=1` environment variable

```typescript
export class CustomError extends Error {
  public readonly code: string;
  
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CustomError';
    this.code = code;
  }
}
```

### Function Guidelines

- Use async/await instead of raw promises
- Prefer explicit return types for exported functions
- Keep functions small and focused
- Use guard clauses for early returns
- Add JSDoc comments for public APIs

```typescript
/**
 * Fetches data from the specified URL.
 * @param url - The URL to fetch from
 * @returns The parsed JSON response
 * @throws Error if URL is invalid
 */
export async function fetchData(url: string): Promise<Data> {
  if (!url) {
    throw new Error('URL is required');
  }
  const response = await fetch(url);
  return response.json();
}
```

### Logging & Debugging

- Use `console.log` for general output
- Use `OPENCODE_QWEN_DEBUG=1` environment variable to enable debug logging
- Structure debug logs with clear prefixes: `[QwenAuth] Action: details`

```typescript
const isDebug = process.env.OPENCODE_QWEN_DEBUG === '1';

function debugLog(message: string): void {
  if (isDebug) {
    console.log(`[QwenAuth] ${message}`);
  }
}
```

## Development Notes

### Working with Development Docs

- Development documentation is stored in `开发用到的文档/` folder
- This folder is gitignored (do NOT commit to GitHub)
- Check this folder for current tasks and project notes

### Testing

- No test framework currently configured
- Manual testing via OpenCode CLI

### Credentials

- Credentials are stored at `~/.qwen/oauth_creds.json`
- Shared with official Qwen Code CLI
- File format: JSON with access_token, refresh_token, expires_at

## Git Workflow

- Create feature branches for new features: `git checkout -b feature/your-feature`
- Commit messages should be clear and descriptive
- Run `npm run typecheck` before committing
- Do NOT commit built files in `dist/` (they're generated)

## Cursor & Copilot Rules

- No `.cursor/rules/` directory found
- No `.cursorrules` file found
- No `.github/copilot-instructions.md` file found

## Additional Guidelines

### OpenCode Plugin Structure

The plugin exposes three main functions:
1. **loader**: Returns configuration (apiKey, baseURL, fetch function)
2. **fetch**: Intercepts all requests, adds auth headers and handles throttling
3. **methods**: Provides OAuth methods (login, logout, refresh)

### Request Throttling

- Requests are throttled to 1 request per second minimum
- Random jitter of 0.5-1.5s added to prevent rate limit detection
- 429 (rate limit) errors are automatically retried after waiting

### Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENCODE_QWEN_DEBUG` | Set to `1` to enable debug logging |
