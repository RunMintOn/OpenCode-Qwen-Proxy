# AGENTS.md - OpenCode Qwen Proxy

## Project Overview

OpenCode Qwen Proxy is an OAuth authentication plugin for OpenCode that enables users to access Qwen AI models (coder-model, vision-model) via their qwen.ai account. It implements RFC 8628 Device Flow authentication.

## Build & Development Commands

```bash
# Build the plugin
npm run build

# Development mode with watch
npm run dev

# TypeScript type checking
npm run typecheck
```

- **Runtime**: Bun (ESM modules)
- **TypeScript**: Strict mode enabled
- **Node**: >=20.0.0

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

## Code Style Guidelines

### General Rules

- **Module System**: ESM (ECMAScript Modules) - use `import ... from './module.js'` with `.js` extension
- **Language**: TypeScript with strict mode enabled
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
import type { QwenCredentials } from './types.js';
```

### TypeScript Rules

- **Never suppress type errors** (`as any`, `@ts-ignore`, `@ts-expect-error`)
- Use explicit return types for exported functions
- Prefer interfaces over types for object shapes
- Use `import type` for type-only imports

```typescript
// ✅ Good
import type { SomeType } from './types.js';
interface UserConfig {
  apiKey: string;
}

// ❌ Bad
const something = anyValue;
```

### Error Handling

- All errors should extend `Error` class
- Provide user-friendly messages in Portuguese (original project language)
- Use technical detail logging with `logTechnicalDetail()` for debugging
- Conditional debug logging via `OPENCODE_QWEN_DEBUG=1`

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

```typescript
// ✅ Good
export async function fetchData(url: string): Promise<Data> {
  if (!url) {
    throw new Error('URL is required');
  }
  const response = await fetch(url);
  return response.json();
}

// ❌ Bad
export async function fetchData(url: string) {
  if (!url) throw new Error('URL required');
  return (await fetch(url)).json();
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

## Git Workflow

- Create feature branches for new features
- Commit messages should be clear and descriptive
- Run `npm run typecheck` before committing
