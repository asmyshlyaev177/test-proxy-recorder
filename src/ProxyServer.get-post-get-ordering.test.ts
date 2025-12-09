import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProxyServer } from './ProxyServer.js';
import { loadRecordingSession } from './utils/fileUtils.js';

describe('ProxyServer - GET before POST then GET with updated data', () => {
  const recordingsDir = path.join(
    process.cwd(),
    'test-recordings-get-post-get',
  );
  const backendPort = 8321;
  const proxyPort = 8322;
  const backendUrl = `http://localhost:${backendPort}`;
  let proxyServer: ProxyServer;
  let proxyHttpServer: http.Server | null = null;
  let backendServer: http.Server | null = null;

  beforeEach(async () => {
    await fs.rm(recordingsDir, { recursive: true, force: true });
    await fs.mkdir(recordingsDir, { recursive: true });
  });

  afterEach(async () => {
    if (proxyHttpServer) {
      proxyHttpServer.close();
      proxyHttpServer = null;
    }
    if (backendServer) {
      backendServer.close();
      backendServer = null;
    }
    await fs.rm(recordingsDir, { recursive: true, force: true });
  });

  const startBackend = async (): Promise<void> => {
    // Mutable backend state to verify that POST changes subsequent GET responses
    let posts: Array<{ id: string; title: string }> = [
      { id: 'old-1', title: 'Old Post 1' },
      { id: 'old-2', title: 'Old Post 2' },
    ];

    backendServer = http.createServer(async (req, res) => {
      if (req.url?.startsWith('/api/posts?limit=2') && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(posts));
      } else if (req.url === '/api/posts' && req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        await new Promise<void>((resolve) => req.on('end', () => resolve()));

        const body = Buffer.concat(chunks).toString('utf8');
        const payload = JSON.parse(body) as { title: string };
        const newPost = { id: 'new-1', title: payload.title };
        posts = [newPost, ...posts];

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(newPost));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) =>
      backendServer!.listen(backendPort, resolve),
    );
  };

  const setMode = async (mode: string, id?: string): Promise<Response> => {
    return fetch(`http://localhost:${proxyPort}/__control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, ...(id && { id }) }),
    });
  };

  const makeRequest = async (
    url: string,
    init?: RequestInit,
  ): Promise<Response> => {
    return fetch(`http://localhost:${proxyPort}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      ...init,
    });
  };

  it('records GET (old), POST, then GET (new) and replays in the same order with updated responses', async () => {
    const sessionId = 'ordering-get-post-get';

    await startBackend();

    proxyServer = new ProxyServer([backendUrl], recordingsDir);
    await proxyServer.init();
    proxyHttpServer = proxyServer.listen(proxyPort);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Record phase
    await setMode('record', sessionId);

    // First GET should return old posts
    const get1 = await makeRequest('/api/posts?limit=2');
    const get1Data = (await get1.json()) as Array<{
      id: string;
      title: string;
    }>;
    expect(get1Data.map((p) => p.id)).toEqual(['old-1', 'old-2']);

    // POST adds a new post
    const post = await makeRequest('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Post' }),
    });
    const postData = (await post.json()) as { id: string; title: string };
    expect(postData.id).toBe('new-1');

    // Second GET should include the new post at the top
    const get2 = await makeRequest('/api/posts?limit=2');
    const get2Data = (await get2.json()) as Array<{
      id: string;
      title: string;
    }>;
    expect(get2Data.map((p) => p.id)).toEqual(['new-1', 'old-1', 'old-2']);

    // Third GET to same endpoint should still include the new post
    const get3 = await makeRequest('/api/posts?limit=2');
    const get3Data = (await get3.json()) as Array<{
      id: string;
      title: string;
    }>;
    expect(get3Data.map((p) => p.id)).toEqual(['new-1', 'old-1', 'old-2']);

    // Save and close recording
    await setMode('transparent');

    // Verify recording contents
    const recording = await loadRecordingSession(
      path.join(recordingsDir, `${sessionId}.mock.json`),
    );

    const getRecordings = recording.recordings.filter(
      (r) =>
        r.request.method === 'GET' && r.request.url === '/api/posts?limit=2',
    );
    const postRecordings = recording.recordings.filter(
      (r) => r.request.method === 'POST' && r.request.url === '/api/posts',
    );

    expect(getRecordings).toHaveLength(3);
    expect(postRecordings).toHaveLength(1);

    // Sequence should be 0,1,2 for the GETs
    expect(getRecordings.map((r) => r.sequence)).toEqual([0, 1, 2]);

    // First GET responses should be old data, later GETs include new data
    const firstGetBody = JSON.parse(
      getRecordings[0].response?.body || '[]',
    ) as Array<{
      id: string;
      title: string;
    }>;
    const secondGetBody = JSON.parse(
      getRecordings[1].response?.body || '[]',
    ) as Array<{
      id: string;
      title: string;
    }>;
    const thirdGetBody = JSON.parse(
      getRecordings[2].response?.body || '[]',
    ) as Array<{
      id: string;
      title: string;
    }>;

    expect(firstGetBody.map((p) => p.id)).toEqual(['old-1', 'old-2']);
    expect(secondGetBody.map((p) => p.id)).toEqual(['new-1', 'old-1', 'old-2']);
    expect(thirdGetBody.map((p) => p.id)).toEqual(['new-1', 'old-1', 'old-2']);

    // Restart proxy for replay
    proxyHttpServer.close();
    proxyHttpServer = null;

    proxyServer = new ProxyServer([backendUrl], recordingsDir);
    await proxyServer.init();
    proxyHttpServer = proxyServer.listen(proxyPort);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Replay phase
    await setMode('replay', sessionId);

    const replayGet1 = await makeRequest('/api/posts?limit=2');
    const replayGet1Data = (await replayGet1.json()) as Array<{
      id: string;
      title: string;
    }>;
    expect(replayGet1Data.map((p) => p.id)).toEqual(['old-1', 'old-2']);

    const replayPost = await makeRequest('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Post' }),
    });
    const replayPostData = (await replayPost.json()) as {
      id: string;
      title: string;
    };
    expect(replayPostData.id).toBe('new-1');

    const replayGet2 = await makeRequest('/api/posts?limit=2');
    const replayGet2Data = (await replayGet2.json()) as Array<{
      id: string;
      title: string;
    }>;
    expect(replayGet2Data.map((p) => p.id)).toEqual([
      'new-1',
      'old-1',
      'old-2',
    ]);

    const replayGet3 = await makeRequest('/api/posts?limit=2');
    const replayGet3Data = (await replayGet3.json()) as Array<{
      id: string;
      title: string;
    }>;
    expect(replayGet3Data.map((p) => p.id)).toEqual([
      'new-1',
      'old-1',
      'old-2',
    ]);
  });
});
