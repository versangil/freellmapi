import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getDb, getUnifiedApiKey } from '../db/index.js';

export const playgroundRouter = Router();

const execAsync = promisify(exec);
const TEXT_LIMIT = 160_000;
const SEARCH_LIMIT = 80;
const COMMAND_TIMEOUT_MS = 30_000;
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.cache', 'coverage']);

const openProjectSchema = z.object({
  path: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
});

const createSessionSchema = z.object({
  projectId: z.number().int().nonnegative().optional(),
  title: z.string().trim().min(1).optional(),
  selectedModel: z.string().trim().min(1).optional(),
  thinking: z.enum(['off', 'low', 'medium', 'high']).optional(),
});

const updateSessionSchema = z.object({
  title: z.string().trim().min(1).optional(),
  selectedModel: z.string().trim().min(1).optional(),
  fullAccess: z.boolean().optional(),
  autoApproval: z.boolean().optional(),
  thinking: z.enum(['off', 'low', 'medium', 'high']).optional(),
}).refine(v => Object.keys(v).length > 0, { message: 'At least one field is required' });

const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const executeToolSchema = z.object({
  name: z.enum(['list_files', 'read_file', 'search_files', 'write_file', 'apply_patch', 'run_command']),
  arguments: z.record(z.string(), z.unknown()).default({}),
});

const importSkillSchema = z.object({
  path: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
});

function error(res: Response, status: number, message: string, type: string) {
  res.status(status).json({ error: { message, type } });
}

function mapProject(row: any) {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    createdAt: row.created_at,
    lastOpenedAt: row.last_opened_at,
  };
}

function mapSession(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    selectedModel: row.selected_model,
    fullAccess: row.full_access === 1,
    autoApproval: row.auto_approval === 1,
    thinking: row.thinking ?? 'medium',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: any) {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    meta: row.meta_json ? JSON.parse(row.meta_json) : undefined,
    createdAt: row.created_at,
  };
}

function realFolder(rawPath: string) {
  const resolved = fs.realpathSync(path.resolve(rawPath));
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) throw new Error('not_directory');
  return resolved;
}

function projectForSession(sessionId: number) {
  const row = getDb().prepare(`
    SELECT s.*, p.path AS project_path, p.name AS project_name
    FROM playground_sessions s
    LEFT JOIN playground_projects p ON p.id = s.project_id
    WHERE s.id = ?
  `).get(sessionId) as any | undefined;
  return row;
}

function resolveInside(root: string, requested: unknown) {
  if (typeof requested !== 'string' || !requested.trim()) throw new Error('path_required');
  const target = path.resolve(root, requested);
  const parent = fs.existsSync(target) ? target : path.dirname(target);
  const realParent = fs.realpathSync(parent);
  const realRoot = fs.realpathSync(root);
  const relParent = path.relative(realRoot, realParent);
  if (relParent.startsWith('..') || path.isAbsolute(relParent)) throw new Error('path_escape');
  if (fs.existsSync(target)) {
    const realTarget = fs.realpathSync(target);
    const relTarget = path.relative(realRoot, realTarget);
    if (relTarget.startsWith('..') || path.isAbsolute(relTarget)) throw new Error('path_escape');
    return realTarget;
  }
  return target;
}

function toProjectPath(root: string, absolutePath: string) {
  return path.relative(root, absolutePath).replace(/\\/g, '/') || '.';
}

function isProbablyBinary(filePath: string) {
  const buf = Buffer.alloc(512);
  const fd = fs.openSync(filePath, 'r');
  try {
    const bytes = fs.readSync(fd, buf, 0, buf.length, 0);
    return buf.subarray(0, bytes).includes(0);
  } finally {
    fs.closeSync(fd);
  }
}

function readTextFile(filePath: string) {
  if (isProbablyBinary(filePath)) throw new Error('binary_file');
  const content = fs.readFileSync(filePath, 'utf8');
  return {
    content: content.length > TEXT_LIMIT ? content.slice(0, TEXT_LIMIT) : content,
    truncated: content.length > TEXT_LIMIT,
    bytes: Buffer.byteLength(content),
  };
}

function walk(root: string, current: string, files: string[] = []) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example' && entry.name !== '.github') {
      if (entry.name !== '.github') continue;
    }
    if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) walk(root, full, files);
    else if (entry.isFile()) files.push(toProjectPath(root, full));
    if (files.length >= 1000) break;
  }
  return files;
}

function logTool(sessionId: number, name: string, args: object, status: 'success' | 'error', result?: unknown) {
  getDb().prepare(`
    INSERT INTO playground_tool_events (session_id, tool_name, arguments_json, result_json, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, name, JSON.stringify(args), result === undefined ? null : JSON.stringify(result), status);
}

function dangerousCommand(command: string) {
  const lowered = command.toLowerCase();
  return /\brm\s+-rf\b/.test(lowered)
    || /\bdel\s+\/[fsq]\b/.test(lowered)
    || /\brmdir\s+\/s\b/.test(lowered)
    || /\bremove-item\b/.test(lowered)
    || /\bgit\s+reset\b/.test(lowered)
    || /\bgit\s+clean\b/.test(lowered);
}

function parseSkillName(content: string, fallback: string) {
  const match = content.match(/^name:\s*["']?([^"'\r\n]+)["']?/m);
  return match?.[1]?.trim() || fallback;
}

async function autoRenameSession(sessionId: number, userMessage: string) {
  const db = getDb();
  const session = db.prepare('SELECT title FROM playground_sessions WHERE id = ?').get(sessionId) as { title: string } | undefined;
  if (!session) return;

  const isDefaultTitle = session.title === 'New session' ||
    session.title === 'New Conversation' ||
    session.title.startsWith('Session in ');

  if (!isDefaultTitle) return;

  try {
    const unifiedKey = getUnifiedApiKey();
    const port = process.env.PORT ?? 3001;

    const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${unifiedKey}`
      },
      body: JSON.stringify({
        model: 'auto',
        messages: [
          {
            role: 'system',
            content: 'You are a professional coding assistant. Generate a concise, action-oriented title for a coding chat session based on the user\'s first message. Follow the Google/CODEX standard for agent coding titles: format as "<Action Verb> <Component/Feature>" (e.g. "Implement path explorer" or "Fix key deletion"). Keep it strictly under 5 words, do not include any quotes, markdown, or extra words.'
          },
          { role: 'user', content: userMessage }
        ]
      })
    });

    if (response.ok) {
      const data = await response.json() as any;
      const suggestedTitle = data.choices?.[0]?.message?.content?.trim();
      if (suggestedTitle && suggestedTitle.length > 0 && suggestedTitle.length < 50) {
        db.prepare('UPDATE playground_sessions SET title = ? WHERE id = ?').run(suggestedTitle, sessionId);
        console.log(`[Playground] Auto-renamed session ${sessionId} to "${suggestedTitle}"`);
      }
    }
  } catch (err: any) {
    console.error('[Playground] Failed to auto-rename session:', err.message);
  }
}

playgroundRouter.get('/projects', (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM playground_projects ORDER BY last_opened_at DESC').all() as any[];
  res.json(rows.map(mapProject));
});

playgroundRouter.post('/projects', (req, res) => {
  const parsed = openProjectSchema.safeParse(req.body);
  if (!parsed.success) return error(res, 400, parsed.error.errors.map(e => e.message).join(', '), 'invalid_request');
  try {
    const openedPath = realFolder(parsed.data.path);
    const name = parsed.data.name ?? path.basename(openedPath);
    const db = getDb();
    db.prepare(`
      INSERT INTO playground_projects (name, path, last_opened_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(path) DO UPDATE SET name = excluded.name, last_opened_at = datetime('now')
    `).run(name, openedPath);
    const row = db.prepare('SELECT * FROM playground_projects WHERE path = ?').get(openedPath) as any;
    res.status(201).json(mapProject(row));
  } catch {
    error(res, 400, 'Project path must be an existing folder.', 'invalid_project_path');
  }
});

playgroundRouter.get('/sessions', (req, res) => {
  const projectId = Number(req.query.projectId);
  const rows = Number.isFinite(projectId) && projectId > 0
    ? getDb().prepare('SELECT * FROM playground_sessions WHERE project_id = ? ORDER BY updated_at DESC').all(projectId)
    : getDb().prepare('SELECT * FROM playground_sessions ORDER BY updated_at DESC').all();
  res.json((rows as any[]).map(mapSession));
});

playgroundRouter.post('/sessions', (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) return error(res, 400, parsed.error.errors.map(e => e.message).join(', '), 'invalid_request');
  const projectId = parsed.data.projectId != null && Number.isFinite(parsed.data.projectId) && parsed.data.projectId > 0 ? parsed.data.projectId : null;
  if (projectId) {
    const project = getDb().prepare('SELECT * FROM playground_projects WHERE id = ?').get(projectId);
    if (!project) return error(res, 404, 'Project not found.', 'not_found');
  }
  const result = getDb().prepare(`
    INSERT INTO playground_sessions (project_id, title, selected_model, thinking)
    VALUES (?, ?, ?, ?)
  `).run(projectId, parsed.data.title ?? 'New session', parsed.data.selectedModel ?? 'auto', parsed.data.thinking ?? 'medium');
  const row = getDb().prepare('SELECT * FROM playground_sessions WHERE id = ?').get(result.lastInsertRowid) as any;
  res.status(201).json(mapSession(row));
});

playgroundRouter.get('/sessions/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = projectForSession(id);
  if (!row) return error(res, 404, 'Session not found.', 'not_found');
  const messages = getDb().prepare('SELECT * FROM playground_messages WHERE session_id = ? ORDER BY id ASC').all(id) as any[];
  
  const fileSnapshots = getDb().prepare(
    'SELECT id, file_path, before_content, after_content, created_at FROM playground_file_snapshots WHERE session_id = ? ORDER BY id ASC'
  ).all(id) as any[];

  const toolEvents = getDb().prepare(
    'SELECT id, tool_name, arguments_json, result_json, status, created_at FROM playground_tool_events WHERE session_id = ? ORDER BY id ASC'
  ).all(id) as any[];

  let claudeMd: string | null = null;
  if (row.project_path) {
    const claudePath = path.join(row.project_path, 'CLAUDE.md');
    if (fs.existsSync(claudePath)) {
      try {
        claudeMd = fs.readFileSync(claudePath, 'utf8');
      } catch {}
    }
  }

  res.json({
    ...mapSession(row),
    project: row.project_id ? { id: row.project_id, name: row.project_name, path: row.project_path } : null,
    messages: messages.map(mapMessage),
    fileSnapshots,
    toolEvents,
    claudeMd
  });
});

playgroundRouter.patch('/sessions/:id', (req, res) => {
  const id = Number(req.params.id);
  const parsed = updateSessionSchema.safeParse(req.body);
  if (!parsed.success) return error(res, 400, parsed.error.errors.map(e => e.message).join(', '), 'invalid_request');
  const existing = projectForSession(id);
  if (!existing) return error(res, 404, 'Session not found.', 'not_found');
  const next = { ...existing };
  if (parsed.data.title !== undefined) next.title = parsed.data.title;
  if (parsed.data.selectedModel !== undefined) next.selected_model = parsed.data.selectedModel;
  if (parsed.data.fullAccess !== undefined) next.full_access = parsed.data.fullAccess ? 1 : 0;
  if (parsed.data.autoApproval !== undefined) next.auto_approval = parsed.data.autoApproval ? 1 : 0;
  if (parsed.data.thinking !== undefined) next.thinking = parsed.data.thinking;
  getDb().prepare(`
    UPDATE playground_sessions
       SET title = ?, selected_model = ?, full_access = ?, auto_approval = ?, thinking = ?, updated_at = datetime('now')
     WHERE id = ?
  `).run(next.title, next.selected_model, next.full_access, next.auto_approval, next.thinking, id);
  const row = getDb().prepare('SELECT * FROM playground_sessions WHERE id = ?').get(id) as any;
  res.json(mapSession(row));
});

playgroundRouter.post('/sessions/:id/messages', (req, res) => {
  const id = Number(req.params.id);
  if (!projectForSession(id)) return error(res, 404, 'Session not found.', 'not_found');
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return error(res, 400, parsed.error.errors.map(e => e.message).join(', '), 'invalid_request');
  const result = getDb().prepare(`
    INSERT INTO playground_messages (session_id, role, content, meta_json)
    VALUES (?, ?, ?, ?)
  `).run(id, parsed.data.role, parsed.data.content, parsed.data.meta ? JSON.stringify(parsed.data.meta) : null);
  getDb().prepare('UPDATE playground_sessions SET updated_at = datetime(\'now\') WHERE id = ?').run(id);
  if (parsed.data.role === 'user') {
    autoRenameSession(id, parsed.data.content);
  }
  const row = getDb().prepare('SELECT * FROM playground_messages WHERE id = ?').get(result.lastInsertRowid) as any;
  res.status(201).json(mapMessage(row));
});

playgroundRouter.post('/sessions/:id/tools/execute', async (req: Request, res: Response) => {
  const sessionId = Number(req.params.id);
  const session = projectForSession(sessionId);
  if (!session) return error(res, 404, 'Session not found.', 'not_found');
  const parsed = executeToolSchema.safeParse(req.body);
  if (!parsed.success) return error(res, 400, parsed.error.errors.map(e => e.message).join(', '), 'invalid_request');

  const args = parsed.data.arguments;
  try {
    let result: unknown;
    if (parsed.data.name === 'list_files') {
      result = { files: walk(session.project_path, session.project_path) };
    } else if (parsed.data.name === 'read_file') {
      const filePath = resolveInside(session.project_path, args.path);
      result = { path: toProjectPath(session.project_path, filePath), ...readTextFile(filePath) };
    } else if (parsed.data.name === 'search_files') {
      const query = String(args.query ?? '').toLowerCase();
      if (!query) throw new Error('query_required');
      const matches: { path: string; line: number; text: string }[] = [];
      for (const rel of walk(session.project_path, session.project_path)) {
        if (matches.length >= SEARCH_LIMIT) break;
        const full = path.join(session.project_path, rel);
        try {
          const lines = readTextFile(full).content.split(/\r?\n/);
          lines.forEach((text, i) => {
            if (matches.length < SEARCH_LIMIT && text.toLowerCase().includes(query)) matches.push({ path: rel, line: i + 1, text });
          });
        } catch { /* skip binary/unreadable */ }
      }
      result = { matches };
    } else if (parsed.data.name === 'write_file') {
      const filePath = resolveInside(session.project_path, args.path);
      const content = String(args.content ?? '');
      const before = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
      const rel = toProjectPath(session.project_path, filePath);
      getDb().prepare(`
        INSERT INTO playground_file_snapshots (session_id, file_path, before_content, after_content)
        VALUES (?, ?, ?, ?)
      `).run(sessionId, rel, before, content);
      result = { path: rel, bytes: Buffer.byteLength(content) };
    } else if (parsed.data.name === 'apply_patch') {
      const filePath = resolveInside(session.project_path, args.path);
      const find = String(args.find ?? '');
      const replace = String(args.replace ?? '');
      const before = fs.readFileSync(filePath, 'utf8');
      if (!find || !before.includes(find)) throw new Error('patch_target_not_found');
      const after = before.replace(find, replace);
      fs.writeFileSync(filePath, after, 'utf8');
      const rel = toProjectPath(session.project_path, filePath);
      getDb().prepare(`
        INSERT INTO playground_file_snapshots (session_id, file_path, before_content, after_content)
        VALUES (?, ?, ?, ?)
      `).run(sessionId, rel, before, after);
      result = { path: rel, changed: true };
    } else {
      const command = String(args.command ?? '');
      if (!command) throw new Error('command_required');
      if (session.full_access !== 1 && dangerousCommand(command)) throw new Error('command_blocked');
      const output = await execAsync(command, {
        cwd: session.project_path,
        timeout: COMMAND_TIMEOUT_MS,
        windowsHide: true,
        maxBuffer: 512_000,
      }).then(
        r => ({ exitCode: 0, stdout: r.stdout.slice(0, TEXT_LIMIT), stderr: r.stderr.slice(0, TEXT_LIMIT) }),
        e => ({ exitCode: typeof e.code === 'number' ? e.code : 1, stdout: String(e.stdout ?? '').slice(0, TEXT_LIMIT), stderr: String(e.stderr ?? e.message ?? '').slice(0, TEXT_LIMIT) }),
      );
      result = output;
    }
    logTool(sessionId, parsed.data.name, args, 'success', result);
    res.json({ result });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Tool failed.';
    const type = ['path_escape', 'command_blocked'].includes(message) ? message : 'tool_error';
    logTool(sessionId, parsed.data.name, args, 'error', { message });
    error(res, 400, message, type);
  }
});

playgroundRouter.delete('/projects/:id', (req, res) => {
  const id = Number(req.params.id);
  const project = getDb().prepare('SELECT * FROM playground_projects WHERE id = ?').get(id) as any | undefined;
  if (!project) return error(res, 404, 'Project not found.', 'not_found');
  getDb().prepare('DELETE FROM playground_projects WHERE id = ?').run(id);
  res.status(204).end();
});

playgroundRouter.delete('/sessions/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = projectForSession(id);
  if (!existing) return error(res, 404, 'Session not found.', 'not_found');
  getDb().prepare('DELETE FROM playground_sessions WHERE id = ?').run(id);
  res.status(204).end();
});

playgroundRouter.post('/sessions/:id/compact', (req, res) => {
  const id = Number(req.params.id);
  const parsed = z.object({
    summary: z.string(),
    keepCount: z.number().default(4)
  }).safeParse(req.body);

  if (!parsed.success) return error(res, 400, 'Invalid request body', 'invalid_request');
  const db = getDb();
  
  const messages = db.prepare('SELECT * FROM playground_messages WHERE session_id = ? ORDER BY id ASC').all(id) as any[];
  if (messages.length <= parsed.data.keepCount) {
    return res.json({ success: false, reason: 'too_few_messages' });
  }

  const keepList = messages.slice(messages.length - parsed.data.keepCount);
  
  db.transaction(() => {
    db.prepare('DELETE FROM playground_messages WHERE session_id = ?').run(id);
    db.prepare(`
      INSERT INTO playground_messages (session_id, role, content, meta_json)
      VALUES (?, 'system', ?, ?)
    `).run(id, `Conversation Summary (Context Compacted):\n\n${parsed.data.summary}`, JSON.stringify({ isSummary: true }));

    const insert = db.prepare(`
      INSERT INTO playground_messages (session_id, role, content, meta_json)
      VALUES (?, ?, ?, ?)
    `);
    for (const m of keepList) {
      insert.run(id, m.role, m.content, m.meta_json);
    }
  })();

  res.json({ success: true });
});

playgroundRouter.get('/browse', (req, res) => {
  const queryPath = typeof req.query.path === 'string' ? req.query.path.trim() : '';
  try {
    let targetPath = queryPath;
    if (!targetPath) {
      targetPath = process.cwd();
    }
    const resolvedPath = path.resolve(targetPath);
    if (!fs.existsSync(resolvedPath)) {
      return error(res, 400, 'Folder does not exist.', 'invalid_path');
    }
    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return error(res, 400, 'Path is not a directory.', 'invalid_path');
    }

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });
    const directories = entries
      .filter(e => e.isDirectory())
      .map(e => ({ name: e.name, path: path.join(resolvedPath, e.name) }));
    const files = entries
      .filter(e => e.isFile())
      .map(e => ({ name: e.name, path: path.join(resolvedPath, e.name) }));

    const parent = path.dirname(resolvedPath);
    res.json({
      currentPath: resolvedPath,
      parentPath: parent === resolvedPath ? null : parent,
      directories,
      files,
    });
  } catch (err: any) {
    error(res, 400, err?.message || 'Invalid folder path.', 'invalid_path');
  }
});

playgroundRouter.get('/skills/imports', (_req, res) => {
  const rows = getDb().prepare('SELECT * FROM playground_imported_skills ORDER BY created_at DESC').all() as any[];
  res.json(rows.map(r => ({ id: r.id, name: r.name, path: r.path, content: r.content, createdAt: r.created_at })));
});

playgroundRouter.post('/skills/imports', (req, res) => {
  const parsed = importSkillSchema.safeParse(req.body);
  if (!parsed.success) return error(res, 400, parsed.error.errors.map(e => e.message).join(', '), 'invalid_request');
  try {
    const stat = fs.statSync(parsed.data.path);
    const filePath = stat.isDirectory() ? path.join(parsed.data.path, 'SKILL.md') : parsed.data.path;
    const realPath = fs.realpathSync(filePath);
    const content = fs.readFileSync(realPath, 'utf8');
    const name = parsed.data.name ?? parseSkillName(content, path.basename(path.dirname(realPath)));
    getDb().prepare(`
      INSERT INTO playground_imported_skills (name, path, content)
      VALUES (?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET name = excluded.name, content = excluded.content
    `).run(name, realPath, content);
    const row = getDb().prepare('SELECT * FROM playground_imported_skills WHERE path = ?').get(realPath) as any;
    res.status(201).json({ id: row.id, name: row.name, path: row.path, content: row.content, createdAt: row.created_at });
  } catch {
    error(res, 400, 'Skill path must be a readable file or folder containing SKILL.md.', 'invalid_skill_path');
  }
});
