#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function usage() {
  console.log('Usage: node tools/split_large.js <input-file> <max-size-MB>');
  process.exit(1);
}

if (process.argv.length < 4) usage();

const input = process.argv[2];
const maxSizeMB = parseInt(process.argv[3], 10);
if (!fs.existsSync(input)) {
  console.error('Input file not found:', input);
  process.exit(2);
}
if (!Number.isFinite(maxSizeMB) || maxSizeMB <= 0) {
  console.error('Invalid max size (MB):', process.argv[3]);
  process.exit(2);
}

const ext = path.extname(input) || '.mp3';
const base = path.basename(input, ext);
const outDir = path.join(process.cwd(), `${base}_split`);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

// Use ffprobe to get file size and duration if available
function runFFmpegSplit() {
  // Calculate target bytes and use ffmpeg segment muxer with approximate duration
  // This script uses ffmpeg's segment muxer to split by duration; we estimate duration
  // per segment from file size and overall duration. Native ffmpeg is required.

  const ffprobe = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', input]);
  let probeOut = '';
  ffprobe.stdout.on('data', (d) => probeOut += d.toString());
  ffprobe.on('close', (code) => {
    const duration = parseFloat(probeOut) || 0;
    const stats = fs.statSync(input);
    const fileBytes = stats.size;
    const maxBytes = maxSizeMB * 1024 * 1024;
    const numParts = Math.max(1, Math.ceil(fileBytes / maxBytes));
    const partDuration = duration > 0 ? duration / numParts : undefined;

    console.log(`File size: ${Math.round(fileBytes / (1024*1024))} MB, estimated duration: ${duration.toFixed(1)}s`);
    if (!partDuration) console.log('Duration unknown — ffmpeg will attempt approximate splits by size.');

    // Build ffmpeg args
    // When duration known, use -ss and -t in a loop to create parts
    if (partDuration) {
      (async () => {
        for (let i = 0; i < numParts; i++) {
          const start = (i * partDuration);
          const t = (i === numParts - 1) ? undefined : partDuration;
          const outFile = path.join(outDir, `${i+1}_${base}${ext}`);
          const args = ['-y', '-i', input, '-ss', start.toString()];
          if (t) args.push('-t', t.toString());
          args.push('-c', 'copy', outFile);
          console.log('Running ffmpeg', args.join(' '));
          await new Promise((resolve, reject) => {
            const p = spawn('ffmpeg', args, { stdio: 'inherit' });
            p.on('close', (c) => c === 0 ? resolve() : reject(new Error('ffmpeg failed with code ' + c)));
          });
        }
        console.log('Split complete. Output directory:', outDir);
      })().catch(e => { console.error(e); process.exit(3); });
    } else {
      // Fallback: use segment muxer with target size via approximate time (not exact)
      const outPattern = path.join(outDir, `%03d_${base}${ext}`);
      const args = ['-y', '-i', input, '-c', 'copy', '-f', 'segment', '-segment_size', (maxBytes).toString(), outPattern];
      console.log('Running ffmpeg', args.join(' '));
      const p = spawn('ffmpeg', args, { stdio: 'inherit' });
      p.on('close', (c) => { if (c === 0) console.log('Split complete. Output directory:', outDir); else process.exit(4); });
    }
  });
}

runFFmpegSplit();
