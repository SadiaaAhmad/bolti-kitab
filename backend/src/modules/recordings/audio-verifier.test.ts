import '../../test/setup-env.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { inspectAudioFile, parseAudioBuffer } from './audio-verifier.js';

describe('Server-Side Audio Verifier', () => {
  it('correctly inspects the real downloaded Art of War MP3', async () => {
    const audioPath = path.resolve(process.cwd(), '..', '.content_cache', 'artofwar_01_suntzu_64kb.mp3');
    if (!fs.existsSync(audioPath)) {
      console.log('Skipping local MP3 test (file not downloaded in this path)');
      return;
    }

    const metadata = await inspectAudioFile(audioPath);
    console.log('[verifier] Inspected metadata:', metadata);

    assert.equal(metadata.format, 'mp3');
    assert.ok(metadata.sample_rate_hz === 22050 || metadata.sample_rate_hz === 44100, 'sample rate must be 22050 or 44100');
    assert.ok(metadata.channels === 1 || metadata.channels === 2, 'channels must be 1 or 2');
    assert.ok(metadata.file_size_bytes > 10_000_000, 'file size must match ~17MB');
    assert.ok(metadata.duration_ms > 1000 * 60 * 20, 'duration must be > 20 minutes');
  });

  it('correctly parses synthetic WAV audio buffer', () => {
    // Generate minimal valid 44-byte WAV header (44.1kHz, 16-bit, stereo, 1 sec)
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(44 + 176400 - 8, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    header.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
    header.writeUInt16LE(2, 22);  // NumChannels (2)
    header.writeUInt32LE(44100, 24); // SampleRate
    header.writeUInt32LE(176400, 28); // ByteRate (44100 * 2 * 2)
    header.writeUInt16LE(4, 32);  // BlockAlign
    header.writeUInt16LE(16, 34); // BitsPerSample
    header.write('data', 36);
    header.writeUInt32LE(176400, 40); // 1 sec of data

    const fullBuf = Buffer.concat([header, Buffer.alloc(176400)]);
    const res = parseAudioBuffer(fullBuf);

    assert.equal(res.format, 'wav');
    assert.equal(res.sample_rate_hz, 44100);
    assert.equal(res.channels, 2);
    assert.equal(res.duration_ms, 1000);
  });
});
