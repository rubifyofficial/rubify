const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PATCH_PATH = path.join(PROJECT_ROOT, 'backup-before-cleaning-utf8.patch');
const OUTPUT_ROOT = path.join(PROJECT_ROOT, 'recovered-from-patch');

const TARGET_FILES = new Set([
  'app/(tabs)/index.tsx',
  'app/(tabs)/profile.tsx',
  'app/(tabs)/ubicacion.tsx',
  'app/ver-juntos.tsx',
  'tsconfig.json',
]);

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function safeReadUtf8(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_err) {
    return null;
  }
}

function safeGitShowHeadText(relPath) {
  try {
    const out = execFileSync(
      'git',
      ['-C', PROJECT_ROOT, 'show', `HEAD:${relPath.replace(/\\/g, '/')}`],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 25 * 1024 * 1024,
      }
    );
    return typeof out === 'string' ? out : null;
  } catch (_err) {
    return null;
  }
}

function splitLines(text) {
  return text.replace(/\r\n/g, '\n').split('\n');
}

function joinLines(lines, hadTrailingNewline) {
  const out = lines.join('\n');
  return hadTrailingNewline ? `${out}\n` : out;
}

function parseUnifiedDiff(patchText) {
  const lines = splitLines(patchText);
  const files = [];
  let currentFile = null;
  let currentHunk = null;

  const flushHunk = () => {
    if (currentFile && currentHunk) {
      currentFile.hunks.push(currentHunk);
      currentHunk = null;
    }
  };

  const flushFile = () => {
    flushHunk();
    if (currentFile) {
      files.push(currentFile);
      currentFile = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const diffMatch = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (diffMatch) {
      flushFile();
      currentFile = {
        oldPath: diffMatch[1],
        newPath: diffMatch[2],
        hunks: [],
      };
      continue;
    }

    if (!currentFile) continue;

    const hunkMatch = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(line);
    if (hunkMatch) {
      flushHunk();
      currentHunk = {
        oldStart: Number(hunkMatch[1]),
        oldLen: Number(hunkMatch[2] || '1'),
        newStart: Number(hunkMatch[3]),
        newLen: Number(hunkMatch[4] || '1'),
        lines: [],
      };
      continue;
    }

    if (currentHunk) {
      const prefix = line[0];
      if (prefix === ' ' || prefix === '+' || prefix === '-' || prefix === '\\') {
        currentHunk.lines.push(line);
      }
    }
  }

  flushFile();
  return files;
}

function arraysEqualAt(source, startIndex, needle) {
  if (startIndex < 0) return false;
  if (startIndex + needle.length > source.length) return false;
  for (let i = 0; i < needle.length; i++) {
    if (source[startIndex + i] !== needle[i]) return false;
  }
  return true;
}

function findBestMatch(sourceLines, expectedIndex, oldChunk) {
  if (oldChunk.length === 0) {
    return { kind: 'exact', index: Math.max(0, Math.min(sourceLines.length, expectedIndex)) };
  }

  const maxStart = sourceLines.length - oldChunk.length;
  const safeExpected = Math.max(0, Math.min(maxStart, expectedIndex));
  if (arraysEqualAt(sourceLines, safeExpected, oldChunk)) {
    return { kind: 'exact', index: safeExpected };
  }

  const window = 1500;
  const from = Math.max(0, safeExpected - window);
  const to = Math.min(maxStart, safeExpected + window);

  for (let i = from; i <= to; i++) {
    if (arraysEqualAt(sourceLines, i, oldChunk)) return { kind: 'nearby', index: i };
  }

  let bestIndex = -1;
  let bestScore = -1;
  const minRequiredMatches = Math.min(6, oldChunk.length);

  for (let i = 0; i <= maxStart; i++) {
    let matches = 0;
    for (let j = 0; j < oldChunk.length; j++) {
      if (sourceLines[i + j] === oldChunk[j]) matches++;
    }
    if (matches > bestScore) {
      bestScore = matches;
      bestIndex = i;
      if (bestScore === oldChunk.length) break;
    }
  }

  const ratio = oldChunk.length === 0 ? 1 : bestScore / oldChunk.length;
  if (bestIndex >= 0 && (bestScore >= minRequiredMatches || ratio >= 0.62)) {
    return { kind: 'fuzzy', index: bestIndex, score: bestScore, ratio };
  }

  return { kind: 'none', index: -1, score: bestScore, ratio };
}

function applyFilePatch(baseText, filePatch) {
  const hadTrailingNewline = /\n$/.test(baseText);
  let lines = splitLines(baseText);
  let offset = 0;
  const hunkResults = [];

  for (const hunk of filePatch.hunks) {
    const oldChunk = [];
    const newChunk = [];

    for (const rawLine of hunk.lines) {
      if (!rawLine) continue;
      const prefix = rawLine[0];
      if (prefix === '\\') continue;
      const content = rawLine.slice(1);
      if (prefix === ' ' || prefix === '-') oldChunk.push(content);
      if (prefix === ' ' || prefix === '+') newChunk.push(content);
    }

    const expectedIndex = Math.max(0, (hunk.oldStart || 1) - 1 + offset);
    const match = findBestMatch(lines, expectedIndex, oldChunk);
    if (match.kind === 'none') {
      return {
        ok: false,
        reason: `Failed to locate hunk (oldStart=${hunk.oldStart}, oldLen=${hunk.oldLen}) in current file`,
        hunkResults,
      };
    }

    lines = [...lines.slice(0, match.index), ...newChunk, ...lines.slice(match.index + oldChunk.length)];
    offset += newChunk.length - oldChunk.length;
    hunkResults.push(match);
  }

  return { ok: true, text: joinLines(lines, hadTrailingNewline), hunkResults };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeRecoveredFile(relPath, contents) {
  const outPath = path.join(OUTPUT_ROOT, relPath);
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, contents, 'utf8');
  return outPath;
}

function main() {
  if (!fs.existsSync(PATCH_PATH)) {
    console.error(`[recover-from-patch] Patch not found: ${PATCH_PATH}`);
    process.exitCode = 1;
    return;
  }

  const patchText = readUtf8(PATCH_PATH);
  const filePatches = parseUnifiedDiff(patchText);

  ensureDir(OUTPUT_ROOT);

  const recovered = [];
  const skipped = [];
  const failed = [];

  for (const fp of filePatches) {
    const rel = fp.newPath;
    if (!TARGET_FILES.has(rel)) continue;

    const absoluteTarget = path.join(PROJECT_ROOT, rel);
    const baseCandidates = [
      { label: 'working-tree', text: safeReadUtf8(absoluteTarget) },
      { label: 'git-head', text: safeGitShowHeadText(rel) },
      { label: 'empty', text: '' },
    ].filter((c) => c.text !== null);

    let result = null;
    let usedBase = null;
    for (const candidate of baseCandidates) {
      const attempt = applyFilePatch(candidate.text, fp);
      if (attempt.ok) {
        result = attempt;
        usedBase = candidate.label;
        break;
      }
    }

    if (!result || !result.ok) {
      failed.push({ file: rel, reason: (result && result.reason) || 'Failed to apply patch' });
      continue;
    }

    const outPath = writeRecoveredFile(rel, result.text);
    recovered.push({
      file: rel,
      outPath,
      hunks: fp.hunks.length,
      fuzzy: (result.hunkResults || []).some((r) => r.kind === 'fuzzy'),
      base: usedBase,
    });
  }

  for (const rel of TARGET_FILES) {
    const hadPatch = filePatches.some((p) => p.newPath === rel);
    if (!hadPatch) skipped.push(rel);
  }

  console.log('[recover-from-patch] Output folder:', OUTPUT_ROOT);
  console.log('[recover-from-patch] Recovered files:', recovered.length);
  for (const item of recovered) {
    console.log(`- ${item.file} -> ${item.outPath} (base=${item.base}${item.fuzzy ? ', fuzzy' : ''})`);
  }

  if (failed.length) {
    console.log('[recover-from-patch] Failed files:', failed.length);
    for (const f of failed) console.log(`- ${f.file}: ${f.reason}`);
  }

  if (skipped.length) {
    console.log('[recover-from-patch] No patch entries for:', skipped.length);
    for (const f of skipped) console.log(`- ${f}`);
  }
}

main();
