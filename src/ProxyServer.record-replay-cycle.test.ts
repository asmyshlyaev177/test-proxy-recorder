import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProxyServer } from './ProxyServer.js';
import { getRecordingPath, loadRecordingSession } from './utils/fileUtils.js';

describe('ProxyServer - Record and Replay Cycle', () => {
  let tempDir: string;
  let proxyServer: ProxyServer;
  let proxyHttpServer: http.Server | null = null;
  let backendServer: http.Server | null = null;
  let backendPort: number;
  let proxyPort: number;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'test-recordings-cycle');
    await fs.mkdir(tempDir, { recursive: true });

    backendPort = 8301;
    proxyPort = 8302;
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
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should record POST with subsequent GET showing new data, then replay correctly', async () => {
    const sessionId = 'test-post-get-cycle';

    // Backend state
    let posts: Array<{ id: string; title: string }> = [
      { id: 'old-post-1', title: 'Old Post 1' },
      { id: 'old-post-2', title: 'Old Post 2' },
    ];

    // Step 1: Create a backend that handles GET and POST
    backendServer = http.createServer(async (req, res) => {
      if (req.url === '/api/v1/posts' && req.method === 'GET') {
        // Simulate some processing delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(posts));
      } else if (req.url === '/api/v1/posts' && req.method === 'POST') {
        // Read the body
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        await new Promise<void>((resolve) => {
          req.on('end', () => resolve());
        });

        const body = Buffer.concat(chunks).toString('utf8');
        const newPost = JSON.parse(body);
        const postWithId = {
          id: 'new-post-1',
          title: newPost.title,
        };

        // Add to posts
        posts = [postWithId, ...posts];

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(postWithId));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      backendServer!.listen(backendPort, () => resolve());
    });

    // Step 2: Start proxy in record mode
    proxyServer = new ProxyServer([`http://localhost:${backendPort}`], tempDir);
    await proxyServer.init();
    proxyHttpServer = proxyServer.listen(proxyPort);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Switch to record mode
    await fetch(
      `http://localhost:${proxyPort}/__control?mode=record&id=${sessionId}`,
    );

    // Step 3: Make requests in sequence (simulating a real test)
    // First: GET requests before POST (should return old data)
    const getRes1 = await fetch(`http://localhost:${proxyPort}/api/v1/posts`);
    const getData1 = await getRes1.json();
    expect(getData1).toHaveLength(2);
    expect(getData1[0].id).toBe('old-post-1');
    expect(getData1[0].title).toBe('Old Post 1');
    expect(getData1[1].id).toBe('old-post-2');
    expect(getData1[1].title).toBe('Old Post 2');

    const getRes2 = await fetch(`http://localhost:${proxyPort}/api/v1/posts`);
    const getData2 = await getRes2.json();
    expect(getData2).toHaveLength(2);
    expect(getData2[0].id).toBe('old-post-1');
    expect(getData2[0].title).toBe('Old Post 1');
    expect(getData2[1].id).toBe('old-post-2');
    expect(getData2[1].title).toBe('Old Post 2');

    // Second: POST request to create new data
    const postRes = await fetch(`http://localhost:${proxyPort}/api/v1/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Post' }),
    });
    const postData = await postRes.json();
    expect(postData.id).toBe('new-post-1');
    expect(postData.title).toBe('New Post');

    // Third: GET request after POST (should return new data at the top)
    const getRes3 = await fetch(`http://localhost:${proxyPort}/api/v1/posts`);
    const getData3 = await getRes3.json();
    expect(getData3).toHaveLength(3);
    expect(getData3[0].id).toBe('new-post-1');
    expect(getData3[0].title).toBe('New Post');
    expect(getData3[1].id).toBe('old-post-1');
    expect(getData3[1].title).toBe('Old Post 1');
    expect(getData3[2].id).toBe('old-post-2');
    expect(getData3[2].title).toBe('Old Post 2');

    // Fourth: One more GET to ensure we can replay multiple requests
    const getRes4 = await fetch(`http://localhost:${proxyPort}/api/v1/posts`);
    const getData4 = await getRes4.json();
    expect(getData4).toHaveLength(3);
    expect(getData4[0].id).toBe('new-post-1');
    expect(getData4[0].title).toBe('New Post');
    expect(getData4[1].id).toBe('old-post-1');
    expect(getData4[2].id).toBe('old-post-2');

    // Switch to transparent mode to save the recording
    await fetch(`http://localhost:${proxyPort}/__control?mode=transparent`);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Step 4: Verify the recording was saved correctly
    const recordingPath = getRecordingPath(tempDir, sessionId);
    const recording = await loadRecordingSession(recordingPath);

    // Should have 4 GET requests and 1 POST request
    const getRecordings = recording.recordings.filter(
      (r) => r.request.method === 'GET' && r.key === 'GET_api_v1_posts.json',
    );
    const postRecordings = recording.recordings.filter(
      (r) => r.request.method === 'POST' && r.key === 'POST_api_v1_posts.json',
    );

    expect(getRecordings.length).toBe(4);
    expect(postRecordings.length).toBe(1);

    // Verify sequence numbers are assigned
    const sequences = getRecordings
      .map((r) => r.sequence)
      .filter((s) => s !== undefined)
      .sort((a, b) => a - b);
    expect(sequences).toEqual([0, 1, 2, 3]);

    // First two GET requests should have old data
    const oldDataRecordings = getRecordings
      .filter((r) => r.sequence === 0 || r.sequence === 1)
      .map((r) => JSON.parse(r.response?.body || '[]'));

    expect(oldDataRecordings[0]).toHaveLength(2);
    expect(oldDataRecordings[0][0].id).toBe('old-post-1');
    expect(oldDataRecordings[0][0].title).toBe('Old Post 1');
    expect(oldDataRecordings[0][1].id).toBe('old-post-2');
    expect(oldDataRecordings[0][1].title).toBe('Old Post 2');
    expect(oldDataRecordings[1]).toHaveLength(2);
    expect(oldDataRecordings[1][0].id).toBe('old-post-1');
    expect(oldDataRecordings[1][1].id).toBe('old-post-2');

    // Last two GET requests should have new data
    const newDataRecordings = getRecordings
      .filter((r) => r.sequence === 2 || r.sequence === 3)
      .map((r) => JSON.parse(r.response?.body || '[]'));

    expect(newDataRecordings[0]).toHaveLength(3);
    expect(newDataRecordings[0][0].id).toBe('new-post-1');
    expect(newDataRecordings[0][0].title).toBe('New Post');
    expect(newDataRecordings[0][1].id).toBe('old-post-1');
    expect(newDataRecordings[0][2].id).toBe('old-post-2');
    expect(newDataRecordings[1]).toHaveLength(3);
    expect(newDataRecordings[1][0].id).toBe('new-post-1');
    expect(newDataRecordings[1][0].title).toBe('New Post');
    expect(newDataRecordings[1][1].id).toBe('old-post-1');
    expect(newDataRecordings[1][2].id).toBe('old-post-2');

    // Step 5: Restart proxy and replay
    proxyHttpServer.close();
    await new Promise((resolve) => setTimeout(resolve, 100));

    proxyServer = new ProxyServer([`http://localhost:${backendPort}`], tempDir);
    await proxyServer.init();
    proxyHttpServer = proxyServer.listen(proxyPort);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Switch to replay mode
    await fetch(
      `http://localhost:${proxyPort}/__control?mode=replay&id=${sessionId}`,
    );

    // Step 6: Replay the requests and verify they return the correct data
    // First GET - should return old data
    const replayRes1 = await fetch(
      `http://localhost:${proxyPort}/api/v1/posts`,
    );
    const replayData1 = await replayRes1.json();
    expect(replayData1).toHaveLength(2);
    expect(replayData1[0].id).toBe('old-post-1');
    expect(replayData1[0].title).toBe('Old Post 1');
    expect(replayData1[1].id).toBe('old-post-2');
    expect(replayData1[1].title).toBe('Old Post 2');

    // Second GET - should return old data
    const replayRes2 = await fetch(
      `http://localhost:${proxyPort}/api/v1/posts`,
    );
    const replayData2 = await replayRes2.json();
    expect(replayData2).toHaveLength(2);
    expect(replayData2[0].id).toBe('old-post-1');
    expect(replayData2[0].title).toBe('Old Post 1');
    expect(replayData2[1].id).toBe('old-post-2');
    expect(replayData2[1].title).toBe('Old Post 2');

    // POST - should return the created post
    const replayPostRes = await fetch(
      `http://localhost:${proxyPort}/api/v1/posts`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Post' }),
      },
    );
    const replayPostData = await replayPostRes.json();
    expect(replayPostData.id).toBe('new-post-1');
    expect(replayPostData.title).toBe('New Post');

    // Third GET - should return NEW data (this is the critical test!)
    const replayRes3 = await fetch(
      `http://localhost:${proxyPort}/api/v1/posts`,
    );
    const replayData3 = await replayRes3.json();
    expect(replayData3).toHaveLength(3);
    expect(replayData3[0].id).toBe('new-post-1');
    expect(replayData3[0].title).toBe('New Post');
    expect(replayData3[1].id).toBe('old-post-1');
    expect(replayData3[1].title).toBe('Old Post 1');
    expect(replayData3[2].id).toBe('old-post-2');
    expect(replayData3[2].title).toBe('Old Post 2');

    // Fourth GET - should also return new data
    const replayRes4 = await fetch(
      `http://localhost:${proxyPort}/api/v1/posts`,
    );
    const replayData4 = await replayRes4.json();
    expect(replayData4).toHaveLength(3);
    expect(replayData4[0].id).toBe('new-post-1');
    expect(replayData4[0].title).toBe('New Post');
    expect(replayData4[1].id).toBe('old-post-1');
    expect(replayData4[2].id).toBe('old-post-2');
  });
});
