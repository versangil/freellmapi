import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { Express } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createApp } from '../../app.js';
import { initDb, getDb } from '../../db/index.js';
import { mintDashboardToken, isGatedApiPath } from '../helpers/auth.js';

let dashToken = '';

async function request(app: Express, method: string, route: string, body?: any) {
  const server = app.listen(0);
  const addr = server.address() as any;
  const res = await fetch(`http://127.0.0.1:${addr.port}${route}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(isGatedApiPath(route) ? { Authorization: `Bearer ${dashToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  server.close();
  let json: any = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, body: json, raw: text };
}

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'freellmapi-playground-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ scripts: { test: 'echo ok' } }, null, 2));
  fs.writeFileSync(path.join(root, 'src', 'app.ts'), 'export const answer = 41;\n');
  fs.writeFileSync(path.join(root, 'README.md'), '# Demo\n\nA small project.\n');
  return root;
}

describe('Playground project workspace API', () => {
  let app: Express;
  let projectRoot = '';

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64);
    initDb(':memory:');
    app = createApp();
    dashToken = mintDashboardToken();
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM playground_tool_events').run();
    db.prepare('DELETE FROM playground_file_snapshots').run();
    db.prepare('DELETE FROM playground_messages').run();
    db.prepare('DELETE FROM playground_sessions').run();
    db.prepare('DELETE FROM playground_imported_skills').run();
    db.prepare('DELETE FROM playground_projects').run();
    projectRoot = makeProject();
  });

  it('opens any existing local folder and lists remembered projects', async () => {
    const created = await request(app, 'POST', '/api/playground/projects', { path: projectRoot });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe(path.basename(projectRoot));
    expect(created.body.path).toBe(projectRoot);

    const listed = await request(app, 'GET', '/api/playground/projects');
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(created.body.id);
  });

  it('rejects missing project folders', async () => {
    const missing = path.join(projectRoot, 'missing');
    const res = await request(app, 'POST', '/api/playground/projects', { path: missing });
    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('invalid_project_path');
  });

  it('creates sessions and persists messages', async () => {
    const project = await request(app, 'POST', '/api/playground/projects', { path: projectRoot });
    const session = await request(app, 'POST', '/api/playground/sessions', {
      projectId: project.body.id,
      title: 'Investigate app',
    });

    expect(session.status).toBe(201);
    expect(session.body.title).toBe('Investigate app');
    expect(session.body.projectId).toBe(project.body.id);

    const message = await request(app, 'POST', `/api/playground/sessions/${session.body.id}/messages`, {
      role: 'user',
      content: 'Read src/app.ts',
    });
    expect(message.status).toBe(201);

    const loaded = await request(app, 'GET', `/api/playground/sessions/${session.body.id}`);
    expect(loaded.status).toBe(200);
    expect(loaded.body.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'Read src/app.ts' }),
    ]);
  });

  it('reads, searches, writes files, records snapshots, and blocks path escape', async () => {
    const project = await request(app, 'POST', '/api/playground/projects', { path: projectRoot });
    const session = await request(app, 'POST', '/api/playground/sessions', { projectId: project.body.id });

    const read = await request(app, 'POST', `/api/playground/sessions/${session.body.id}/tools/execute`, {
      name: 'read_file',
      arguments: { path: 'src/app.ts' },
    });
    expect(read.status).toBe(200);
    expect(read.body.result.content).toContain('answer = 41');

    const search = await request(app, 'POST', `/api/playground/sessions/${session.body.id}/tools/execute`, {
      name: 'search_files',
      arguments: { query: 'small project' },
    });
    expect(search.status).toBe(200);
    expect(search.body.result.matches[0].path).toBe('README.md');

    const write = await request(app, 'POST', `/api/playground/sessions/${session.body.id}/tools/execute`, {
      name: 'write_file',
      arguments: { path: 'src/app.ts', content: 'export const answer = 42;\n' },
    });
    expect(write.status).toBe(200);
    expect(fs.readFileSync(path.join(projectRoot, 'src', 'app.ts'), 'utf8')).toContain('42');

    const snapshots = getDb().prepare('SELECT before_content, after_content FROM playground_file_snapshots').all() as any[];
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].before_content).toContain('41');
    expect(snapshots[0].after_content).toContain('42');

    const escape = await request(app, 'POST', `/api/playground/sessions/${session.body.id}/tools/execute`, {
      name: 'read_file',
      arguments: { path: '../outside.txt' },
    });
    expect(escape.status).toBe(400);
    expect(escape.body.error.type).toBe('path_escape');
  });

  it('runs safe commands by default and requires full access for blocked commands', async () => {
    const project = await request(app, 'POST', '/api/playground/projects', { path: projectRoot });
    const session = await request(app, 'POST', '/api/playground/sessions', { projectId: project.body.id });

    const safe = await request(app, 'POST', `/api/playground/sessions/${session.body.id}/tools/execute`, {
      name: 'run_command',
      arguments: { command: 'node --version' },
    });
    expect(safe.status).toBe(200);
    expect(safe.body.result.exitCode).toBe(0);

    const blocked = await request(app, 'POST', `/api/playground/sessions/${session.body.id}/tools/execute`, {
      name: 'run_command',
      arguments: { command: 'rm -rf src' },
    });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.type).toBe('command_blocked');

    const full = await request(app, 'PATCH', `/api/playground/sessions/${session.body.id}`, {
      fullAccess: true,
      autoApproval: true,
    });
    expect(full.status).toBe(200);

    const allowed = await request(app, 'POST', `/api/playground/sessions/${session.body.id}/tools/execute`, {
      name: 'run_command',
      arguments: { command: 'node --version' },
    });
    expect(allowed.status).toBe(200);
    expect(allowed.body.result.exitCode).toBe(0);
  });

  it('imports local skill instructions', async () => {
    const skillDir = path.join(projectRoot, '.skills', 'web-dev');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: web-dev\n---\nUse web best practices.\n');

    const imported = await request(app, 'POST', '/api/playground/skills/imports', {
      path: skillDir,
    });
    expect(imported.status).toBe(201);
    expect(imported.body.name).toBe('web-dev');
    expect(imported.body.content).toContain('Use web best practices');

    const listed = await request(app, 'GET', '/api/playground/skills/imports');
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
  });
});
