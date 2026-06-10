import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getDb, getUnifiedApiKey } from '../db/index.js';

// Simple command-line argument parser
const args = process.argv.slice(2);
let errorMessage = '';
let platform = '';
let model = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--error') errorMessage = args[++i];
  if (args[i] === '--platform') platform = args[++i];
  if (args[i] === '--model') model = args[++i];
}

if (!errorMessage) {
  console.error('[AutoHeal Agent] No error message provided. Exiting.');
  process.exit(1);
}

const PORT = process.env.PORT ?? 3001;
const unifiedKey = getUnifiedApiKey();
const codebaseRoot = path.resolve(__dirname, '../../../'); // Points to D:/AiTools/freellmapi
const tempSandboxDir = path.join(codebaseRoot, 'temp_sandbox_heal');

console.log(`[AutoHeal Agent] Starting diagnosis for error: "${errorMessage}"`);

async function runHealer() {
  try {
    // 1. Setup Sandbox Directory
    if (fs.existsSync(tempSandboxDir)) {
      fs.rmSync(tempSandboxDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempSandboxDir, { recursive: true });

    // 2. Copy relevant codebase files into sandbox (excluding node_modules, temp, .git)
    copyFolderSync(codebaseRoot, tempSandboxDir);
    console.log(`[AutoHeal Agent] Sandboxed workspace set up at: ${tempSandboxDir}`);

    // 3. Construct prompt for loopback AI call
    const filesList = getCodebaseSnapshot(tempSandboxDir);
    const systemPrompt = `You are a self-healing codebase agent.
We encountered a runtime error in our proxy:
Platform: ${platform}
Model: ${model}
Error: "${errorMessage}"

Your goal is to propose a code patch/fix that resolves this error without affecting the production connection.
Analyze the error and find the bug in the code.
Return a valid diff patch (starting with "diff --git ...") OR return the exact replacement block for the file you want to edit.
Explain the fix briefly.`;

    const userPrompt = `Here is the list of files and their contents:
${filesList}

Propose the fix.`;

    // 4. Call LLM via our loopback proxy
    console.log('[AutoHeal Agent] Consulting LLM for diagnosis and patch...');
    const response = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unifiedKey}`
      },
      body: JSON.stringify({
        model: 'auto',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`LLM loopback request failed with status ${response.status}`);
    }

    const data = (await response.json()) as any;
    const patchSuggestion = data.choices?.[0]?.message?.content;
    if (!patchSuggestion) {
      throw new Error('LLM returned an empty response');
    }

    console.log('[AutoHeal Agent] LLM suggested fix:\n', patchSuggestion);

    // 5. Try to apply suggested fix in Sandbox
    const patchApplied = applyPatchOrReplacement(tempSandboxDir, patchSuggestion);
    if (!patchApplied) {
      throw new Error('Failed to parse or apply LLM suggested patch');
    }

    // 6. Run verification tests in Sandbox
    console.log('[AutoHeal Agent] Running test suite in sandbox...');
    try {
      execSync('npm run test', { cwd: tempSandboxDir, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } });
      console.log('[AutoHeal Agent] Sandbox tests passed! Safe to apply patch to production.');

      // 7. Apply patch/files to actual production codebase
      applyPatchOrReplacement(codebaseRoot, patchSuggestion);
      console.log('[AutoHeal Agent] Patch applied successfully to production codebase. Healing complete!');
    } catch (testErr: any) {
      console.error('[AutoHeal Agent] Sandbox verification failed:', testErr.message);
    }
  } catch (err: any) {
    console.error('[AutoHeal Agent] Healing process failed:', err.message);
  } finally {
    // Clean up sandbox
    if (fs.existsSync(tempSandboxDir)) {
      fs.rmSync(tempSandboxDir, { recursive: true, force: true });
    }
  }
}

function copyFolderSync(from: string, to: string) {
  const entries = fs.readdirSync(from, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);

    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'temp_sandbox_heal' || entry.name === '.kilo') {
      continue;
    }

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getCodebaseSnapshot(dir: string): string {
  // Focus on files under server/src
  const serverSrc = path.join(dir, 'server', 'src');
  if (!fs.existsSync(serverSrc)) return '';
  
  let result = '';
  const walk = (current: string) => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.name.endsWith('.d.ts') || entry.name.includes('__tests__')) continue;
      
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.json'))) {
        const relative = path.relative(dir, full).replace(/\\/g, '/');
        const content = fs.readFileSync(full, 'utf8');
        result += `\n--- FILE: ${relative} ---\n${content}\n`;
      }
    }
  };
  walk(serverSrc);
  return result;
}

function applyPatchOrReplacement(workspace: string, suggestion: string): boolean {
  // Regex to extract code block
  const codeBlockMatch = suggestion.match(/```(?:typescript|ts|javascript|js|diff)?\n([\s\S]*?)```/);
  const code = codeBlockMatch ? codeBlockMatch[1] : suggestion;

  // Case 1: Suggestion contains a diff format
  if (code.includes('diff --git') || code.includes('--- ') || code.includes('+++ ')) {
    const patchFile = path.join(workspace, 'temp_patch.patch');
    fs.writeFileSync(patchFile, code, 'utf8');
    try {
      execSync(`git apply --whitespace=fix "${patchFile}"`, { cwd: workspace });
      fs.unlinkSync(patchFile);
      return true;
    } catch {
      try {
        fs.unlinkSync(patchFile);
      } catch {}
    }
  }

  // Case 2: Suggestion describes exact file changes via search-replace or direct file rewrite instructions
  // Let's check if there is a file path and matching target contents
  const fileBlocks = suggestion.split(/--- FILE:\s*(\S+)\s*---/i);
  if (fileBlocks.length > 2) {
    for (let i = 1; i < fileBlocks.length; i += 2) {
      const fileRelPath = fileBlocks[i].trim();
      const content = fileBlocks[i + 1].trim();
      const targetPath = path.join(workspace, fileRelPath);
      
      const cleanContentMatch = content.match(/```(?:typescript|ts|javascript|js)?\n([\s\S]*?)```/);
      const cleanContent = cleanContentMatch ? cleanContentMatch[1] : content;
      
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, cleanContent, 'utf8');
    }
    return true;
  }

  return false;
}

runHealer().catch(console.error);
