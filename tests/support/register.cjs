/* eslint-env node */
/* global __dirname */
/**
 * Soporte para pruebas con el runner nativo de Node (node:test), sin
 * dependencias extra: transpila TS/TSX con el compilador de TypeScript del
 * proyecto, resuelve el alias "@/", usa react-native-web en lugar de
 * react-native y reemplaza módulos nativos de Expo por versiones vacías.
 *
 * Uso: node --require ./tests/support/register.cjs --test "tests/**\/*.test.cjs"
 */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');
globalThis.__DEV__ = false;

const EXTENSIONS = ['.ts', '.tsx', '.web.ts', '.web.tsx', '.js', '/index.ts', '/index.tsx', '/index.js'];
const mocks = new Map();

const noopComponent = () => null;
const STUBS = {
  'expo-speech': { speak() {}, stop() {} },
  'expo-router': { useRouter: () => ({ replace() {}, push() {}, back() {} }), Stack: noopComponent },
  'expo-secure-store': { getItemAsync: async () => null, setItemAsync: async () => {}, deleteItemAsync: async () => {} },
  'expo-constants': { default: { expoConfig: {} }, expoConfig: {} },
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
};

/**
 * Devuelve la ruta normalizada del archivo. normalize() unifica los
 * separadores (en Windows "data/index.ts" pasa a "data\\index.ts"), para que
 * coincida con las rutas registradas en mockModule.
 */
function resolveLocal(base) {
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return path.normalize(base);
  for (const ext of EXTENSIONS) {
    const candidate = path.normalize(base + ext);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, parent, ...rest) {
  if (request === 'react-native') request = 'react-native-web';
  if (request.startsWith('@expo/vector-icons')) return '\0stub:vector-icons';
  if (STUBS[request]) return `\0stub:${request}`;

  if (request.startsWith('@/')) {
    const found = resolveLocal(path.join(root, request.slice(2)));
    if (found) return found;
  } else if (request.startsWith('.') && parent?.filename && !parent.filename.includes('node_modules')) {
    const found = resolveLocal(path.resolve(path.dirname(parent.filename), request));
    if (found) return found;
  }
  return originalResolve.call(this, request, parent, ...rest);
};

const originalLoad = Module._load;
Module._load = function load(request, parent, ...rest) {
  const resolved = Module._resolveFilename(request, parent);
  if (resolved === '\0stub:vector-icons') return { __esModule: true, default: noopComponent };
  if (resolved.startsWith('\0stub:')) return STUBS[resolved.slice(6)];
  if (mocks.has(resolved)) return mocks.get(resolved);
  return originalLoad.call(this, request, parent, ...rest);
};

function compile(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  module._compile(outputText, filename);
}
require.extensions['.ts'] = compile;
require.extensions['.tsx'] = compile;

/**
 * Reemplaza un módulo del proyecto antes de requerirlo.
 * mockModule('services/api.ts', { apiClient: ... })
 */
globalThis.mockModule = (relativePath, exports) => {
  const resolved = resolveLocal(path.join(root, relativePath));
  if (!resolved) throw new Error(`mockModule: no existe ${relativePath}`);
  mocks.set(resolved, exports);
};
globalThis.projectRequire = (relativePath) => require(path.join(root, relativePath));
