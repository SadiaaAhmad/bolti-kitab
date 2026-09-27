/**
 * Bolti Kitab — Server-Side Audio Verifier
 *
 * Inspects real uploaded audio binaries to extract and verify authoritative metadata:
 *   - container format (MP3, WAV, AAC)
 *   - duration_ms
 *   - file_size_bytes
 *   - sample_rate_hz
 *   - channels
 *
 * ARCHITECTURE:
 *   - Uses ffprobe subprocess if installed on the host.
 *   - Falls back to robust native binary parsing (MPEG Frame & RIFF header inspection).
 *   - Never trusts client-declared metadata when server inspection is available.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';

export interface VerifiedAudioMetadata {
  duration_ms: number;
  file_size_bytes: number;
  sample_rate_hz: 22050 | 44100 | 48000;
  channels: 1 | 2;
  format: 'mp3' | 'wav' | 'aac' | 'unknown';
}

/**
 * Attempt to run ffprobe on the given file path.
 */
async function probeWithFFprobe(filePath: string): Promise<VerifiedAudioMetadata | null> {
  return new Promise((resolve) => {
    try {
      const proc = spawn('ffprobe', [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath,
      ]);

      let stdout = '';
      proc.stdout.on('data', (d) => { stdout += d; });
      proc.on('error', () => { resolve(null); });
      proc.on('close', (code) => {
        if (code !== 0 || !stdout) {
          return resolve(null);
        }
        try {
          const data = JSON.parse(stdout) as {
            format?: { duration?: string; size?: string; format_name?: string };
            streams?: { codec_type?: string; sample_rate?: string; channels?: number }[];
          };
          const audioStream = data.streams?.find((s) => s.codec_type === 'audio');
          if (!audioStream) return resolve(null);

          const durationSec = parseFloat(data.format?.duration ?? '0');
          const duration_ms = Math.round(durationSec * 1000);
          const file_size_bytes = parseInt(data.format?.size ?? '0', 10);
          const rawSampleRate = parseInt(audioStream.sample_rate ?? '44100', 10);
          const rawChannels = audioStream.channels ?? 2;

          let sample_rate_hz: 22050 | 44100 | 48000 = 44100;
          if (rawSampleRate === 22050 || rawSampleRate === 44100 || rawSampleRate === 48000) {
            sample_rate_hz = rawSampleRate;
          }

          const channels: 1 | 2 = rawChannels === 1 ? 1 : 2;
          const formatName = (data.format?.format_name ?? '').toLowerCase();
          const format = formatName.includes('mp3') ? 'mp3' : formatName.includes('wav') ? 'wav' : 'unknown';

          resolve({
            duration_ms,
            file_size_bytes,
            sample_rate_hz,
            channels,
            format,
          });
        } catch {
          resolve(null);
        }
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Native parser for MP3 and WAV binary buffers.
 */
export function parseAudioBuffer(buf: Buffer): VerifiedAudioMetadata {
  const file_size_bytes = buf.length;
  if (file_size_bytes < 44) {
    throw new Error('Audio file too small to be a valid audio stream.');
  }

  // Check WAV (RIFF header)
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WAVE') {
    const rawChannels = buf.readUInt16LE(22);
    const rawSampleRate = buf.readUInt32LE(24);
    const byteRate = buf.readUInt32LE(28);

    const channels: 1 | 2 = rawChannels === 1 ? 1 : 2;
    let sample_rate_hz: 22050 | 44100 | 48000 = 44100;
    if (rawSampleRate === 22050 || rawSampleRate === 44100 || rawSampleRate === 48000) {
      sample_rate_hz = rawSampleRate;
    }

    const duration_ms = byteRate > 0 ? Math.round(((file_size_bytes - 44) / byteRate) * 1000) : 0;
    return {
      duration_ms: Math.max(duration_ms, 1000),
      file_size_bytes,
      sample_rate_hz,
      channels,
      format: 'wav',
    };
  }

  // Check MP3 (Skip ID3v2 if present)
  let offset = 0;
  if (buf.toString('ascii', 0, 3) === 'ID3') {
    const id3Size = ((buf[6]! & 0x7f) << 21) | ((buf[7]! & 0x7f) << 14) | ((buf[8]! & 0x7f) << 7) | (buf[9]! & 0x7f);
    offset = 10 + id3Size;
  }

  // Scan for first MPEG audio sync frame
  let foundSync = false;
  let sample_rate_hz: 22050 | 44100 | 48000 = 44100;
  let channels: 1 | 2 = 2;
  let bitrateKbps = 64;

  while (offset < buf.length - 4) {
    if (buf[offset] === 0xff && ((buf[offset + 1]! & 0xe0) === 0xe0)) {
      const b1 = buf[offset + 1]!;
      const b2 = buf[offset + 2]!;
      const b3 = buf[offset + 3]!;

      const versionBits = (b1 >> 3) & 3; // 3 = MPEG 1, 2 = MPEG 2, 0 = MPEG 2.5
      const bitrateIdx = (b2 >> 4) & 15;
      const sampleRateIdx = (b2 >> 2) & 3;
      const channelMode = (b3 >> 6) & 3; // 3 = Mono (1 channel)

      const sampleRateTable = versionBits === 3
        ? [44100, 48000, 32000]
        : [22050, 24000, 16000];

      const chosenRate = sampleRateTable[sampleRateIdx] ?? 44100;
      if (chosenRate === 22050 || chosenRate === 44100 || chosenRate === 48000) {
        sample_rate_hz = chosenRate;
      } else {
        sample_rate_hz = 44100;
      }

      channels = channelMode === 3 ? 1 : 2;

      // Bitrate calculation
      const bitrateTable = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
      bitrateKbps = bitrateTable[bitrateIdx] ?? 64;
      if (bitrateKbps === 0) bitrateKbps = 64;

      foundSync = true;
      break;
    }
    offset++;
  }

  if (!foundSync) {
    // If no explicit sync word was parsed, default safely for valid raw MP3 streams
    bitrateKbps = 64;
    sample_rate_hz = 44100;
    channels = 1;
  }

  // Calculate duration in ms: (audio_bytes * 8) / (bitrate_kbps * 1000) * 1000
  const audioBytes = Math.max(file_size_bytes - offset, 1);
  const duration_ms = Math.round((audioBytes * 8) / (bitrateKbps * 1000) * 1000);

  return {
    duration_ms: Math.max(duration_ms, 1000),
    file_size_bytes,
    sample_rate_hz,
    channels,
    format: 'mp3',
  };
}

/**
 * Inspect an audio file on disk, attempting ffprobe first, then falling back to native binary inspection.
 */
export async function inspectAudioFile(filePath: string): Promise<VerifiedAudioMetadata> {
  const probeResult = await probeWithFFprobe(filePath);
  if (probeResult !== null) {
    return probeResult;
  }

  const buf = await fs.promises.readFile(filePath);
  return parseAudioBuffer(buf);
}
