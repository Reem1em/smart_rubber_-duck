import fs from 'fs';
import path from 'path';

/**
 * يحدد مسار هذا الملف في كلا البيئتين:
 * - ESM (tsx dev): عبر import.meta.url
 * - CJS (dist/server.cjs production): عبر __dirname
 */
function getDirname(): string {
  // CJS: __dirname متاح
  // @ts-ignore
  if (typeof __dirname !== 'undefined' && __dirname) {
    // @ts-ignore
    return __dirname;
  }

  // ESM: عبر import.meta.url
  try {
    // نستخدم eval لتجنب تحذير esbuild لأن import.meta غير مدعوم في CJS
    const metaUrl = (0, eval)('import.meta.url');
    if (metaUrl) {
      const { fileURLToPath } = require('url');
      return path.dirname(fileURLToPath(metaUrl));
    }
  } catch {
    // تجاهل
  }

  return process.cwd();
}

const __dirnameCompat = getDirname();

/**
 * يحدد مسار مجلد AGENT بشكل آمن في dev و production.
 */
function resolveAgentsDir(): string {
  const candidates = [
    path.join(process.cwd(), 'AGENT'),
    path.join(__dirnameCompat, '..', '..', 'AGENT'),
    path.join(__dirnameCompat, '..', 'AGENT'),
    path.join(__dirnameCompat, 'AGENT'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    '[loadAgent] Could not locate "AGENT/" directory. ' +
    `Tried: ${candidates.join(', ')}. ` +
    'Ensure "AGENT/" is copied to the production build (see build script).'
  );
}

const AGENT_DIR = resolveAgentsDir();
const agentCache = new Map<string, string>();

export function loadAgent(fileName: string): string {
  if (agentCache.has(fileName)) {
    return agentCache.get(fileName)!;
  }

  const filePath = path.join(AGENT_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `[loadAgent] Agent file not found: ${fileName}. Expected at: ${filePath}`
    );
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  if (!content.trim()) {
    throw new Error(`[loadAgent] Agent file is empty: ${fileName}`);
  }

  agentCache.set(fileName, content);
  return content;
}

export function buildSystemPrompt(...agentFiles: string[]): string {
  if (agentFiles.length === 0) {
    throw new Error('[buildSystemPrompt] At least one agent file is required');
  }

  const shared = loadAgent('00_SHARED_RULES.md');
  const agents = agentFiles.map((file) => loadAgent(file)).join('\n\n---\n\n');

  return `${shared}\n\n---\n\n${agents}`;
}

export function preloadAllAgents(): void {
  const requiredFiles = [
    '00_SHARED_RULES.md',
    '01_ANALYZER.md',
    '02_STRUCTURER.md',
    '03_GENERATOR.md',
    '04_TUTOR.md',
    '05_EVALUATOR.md',
    '06_ROADMAP.md',
  ];

  for (const file of requiredFiles) {
    loadAgent(file);
  }

  console.log(`[loadAgent] Preloaded ${requiredFiles.length} agent files from ${AGENT_DIR}`);
}