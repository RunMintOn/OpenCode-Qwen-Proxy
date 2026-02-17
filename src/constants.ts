/**
 * Qwen OAuth and API Constants
 * Based on qwen-code implementation
 */

// Provider ID
export const QWEN_PROVIDER_ID = 'qwen-code';

// OAuth Device Flow Endpoints (descobertos do qwen-code)
export const QWEN_OAUTH_CONFIG = {
  baseUrl: 'https://chat.qwen.ai',
  deviceCodeEndpoint: 'https://chat.qwen.ai/api/v1/oauth2/device/code',
  tokenEndpoint: 'https://chat.qwen.ai/api/v1/oauth2/token',
  clientId: 'f0304373b74a44d2b584a3fb70ca9e56',
  scope: 'openid profile email model.completion',
  grantType: 'urn:ietf:params:oauth:grant-type:device_code',
} as const;

// Qwen API Configuration
// O resource_url das credenciais é usado para determinar a URL base
export const QWEN_API_CONFIG = {
  // Default base URL (pode ser sobrescrito pelo resource_url das credenciais)
  defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  // Portal URL (usado quando resource_url = "portal.qwen.ai")
  portalBaseUrl: 'https://portal.qwen.ai/v1',
  // Endpoint de chat completions
  chatEndpoint: '/chat/completions',
  // Endpoint de models
  modelsEndpoint: '/models',
  // Usado pelo OpenCode para configurar o provider
  baseUrl: 'https://portal.qwen.ai/v1',
} as const;

// OAuth callback port (para futuro Device Flow no plugin)
export const CALLBACK_PORT = 14561;

// Available Qwen models through OAuth (portal.qwen.ai)
// 与 qwen-code CLI 完全对齐，只支持 2 个模型
// 实际发送请求时，会自动映射到真正的模型
export const QWEN_MODELS = {
  // --- Coding Model (与 qwen-code 对齐) ---
  'coder-model': {
    id: 'coder-model',
    name: 'Qwen Coder',
    contextWindow: 1048576, // 1M tokens
    maxOutput: 65536, // 64K tokens
    description: 'Qwen 3.5 Plus - efficient hybrid model with leading coding performance',
    reasoning: false,
    cost: { input: 0, output: 0 },
  },
  // --- Vision Model (与 qwen-code 对齐) ---
  'vision-model': {
    id: 'vision-model',
    name: 'Qwen Vision',
    contextWindow: 131072, // 128K tokens
    maxOutput: 32768, // 32K tokens
    description: 'Latest Qwen Vision model, supports image input',
    reasoning: false,
    cost: { input: 0, output: 0 },
  },
} as const;
