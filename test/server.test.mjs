import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createStaticServer } from '../server.mjs';

test('video streaming supports full files, byte ranges, seeking and HEAD', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dota-spy-video-'));
  const data = Buffer.from(Array.from({ length: 1024 }, (_, index) => index % 256));
  await writeFile(path.join(directory, 'video.mp4'), data);
  await writeFile(path.join(directory, 'sound.mp3'), data);
  const server = createStaticServer(directory);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/video.mp4`;
  try {
    const full = await fetch(url);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get('content-type'), 'video/mp4');
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), data);
    for (const [range, start, end] of [['bytes=100-199', 100, 199], ['bytes=900-', 900, 1023], ['bytes=-24', 1000, 1023], ['bytes=1000-9999', 1000, 1023], ['bytes=0-0', 0, 0]]) {
      const part = await fetch(url, { headers: { Range: range } });
      assert.equal(part.status, 206);
      assert.equal(part.headers.get('content-range'), `bytes ${start}-${end}/1024`);
      assert.equal(Number(part.headers.get('content-length')), end - start + 1);
      assert.deepEqual(Buffer.from(await part.arrayBuffer()), data.subarray(start, end + 1));
    }
    for (const range of ['bytes=1024-', 'bytes=2-1', 'bytes=-0', 'bytes=-', 'bytes=0-1,3-4']) {
      const invalid = await fetch(url, { headers: { Range: range } });
      assert.equal(invalid.status, 416);
      assert.equal(invalid.headers.get('content-range'), 'bytes */1024');
      await invalid.arrayBuffer();
    }
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.headers.get('content-length'), '1024');
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    const sound = await fetch(new URL('sound.mp3', url), { headers: { Range: 'bytes=0-99' } });
    assert.equal(sound.status, 206);
    assert.equal(sound.headers.get('content-type'), 'audio/mpeg');
    assert.deepEqual(Buffer.from(await sound.arrayBuffer()), data.subarray(0, 100));
  } finally {
    await new Promise(resolve => server.close(resolve));
    await unlink(path.join(directory, 'video.mp4'));
    await unlink(path.join(directory, 'sound.mp3'));
    await rmdir(directory);
  }
});
