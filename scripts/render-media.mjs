#!/usr/bin/env node
// Renders the marketing videos and images from media-src/*.html with a
// headless browser, frame by frame, then encodes with ffmpeg.
//   node scripts/render-media.mjs [videos|cards|frames T...] [--only skillsmith-vertical,...]
// Needs: Playwright with Chromium, ffmpeg.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site', 'media');
const FPS = 30;

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const global = spawnSync('npm', ['root', '-g'], {encoding: 'utf8'}).stdout.trim();
    return import(pathToFileURL(path.join(global, 'playwright', 'index.mjs')).href);
  }
}

const {chromium} = await loadPlaywright();
const proxy = process.env.HTTPS_PROXY ? {server: process.env.HTTPS_PROXY} : undefined;
const browser = await chromium.launch({proxy, args: proxy ? ['--ignore-certificate-errors'] : []});
fs.mkdirSync(OUT, {recursive: true});

const [mode = 'all', ...rest] = process.argv.slice(2);
const onlyArg = rest.includes('--only') ? rest[rest.indexOf('--only') + 1].split(',') : null;

const VIDEOS = [
  {name: 'skillsmith-vertical', format: 'vertical', w: 1080, h: 1920},
  {name: 'skillsmith-horizontal', format: 'horizontal', w: 1920, h: 1080},
];

async function openReel(v) {
  const page = await browser.newPage({viewport: {width: v.w, height: v.h}});
  const url = `${pathToFileURL(path.join(ROOT, 'media-src', 'reel.html')).href}?mode=render&format=${v.format}`;
  await page.goto(url, {waitUntil: 'networkidle'});
  await page.evaluate(() => window.ready);
  return page;
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], {stdio: 'inherit'});
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
}

async function renderVideo(v) {
  const page = await openReel(v);
  const duration = await page.evaluate(() => window.DURATION);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `reel-${v.name}-`));
  const frames = Math.round(duration * FPS);
  for (let i = 0; i < frames; i += 1) {
    await page.evaluate(t => window.seek(t), i / FPS);
    await page.screenshot({
      path: path.join(dir, `f${String(i).padStart(5, '0')}.jpg`),
      type: 'jpeg',
      quality: 92,
    });
    if (i % 150 === 0) process.stdout.write(`${v.name}: ${i}/${frames}\n`);
  }
  await page.close();
  const out = path.join(OUT, `${v.name}.mp4`);
  ffmpeg([
    '-framerate',
    String(FPS),
    '-i',
    path.join(dir, 'f%05d.jpg'),
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '22',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    out,
  ]);
  if (v.name === 'skillsmith-horizontal') {
    // README preview: the arena, 12 fps, 960 px wide.
    const gif = path.join(OUT, 'arena.gif');
    ffmpeg([
      '-ss',
      '14.4',
      '-t',
      '23.4',
      '-framerate',
      String(FPS),
      '-i',
      path.join(dir, 'f%05d.jpg'),
      '-vf',
      'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
      gif,
    ]);
    // Poster frame for the site player.
    fs.copyFileSync(
      path.join(dir, `f${String(Math.round(36.9 * FPS)).padStart(5, '0')}.jpg`),
      path.join(OUT, 'poster.jpg'),
    );
  }
  fs.rmSync(dir, {recursive: true, force: true});
  console.log('wrote', path.relative(ROOT, out));
}

async function renderFrames(times) {
  for (const v of VIDEOS.filter(x => !onlyArg || onlyArg.includes(x.name))) {
    const page = await openReel(v);
    for (const t of times) {
      await page.evaluate(x => window.seek(x), Number(t));
      const file = path.join(os.tmpdir(), `${v.name}-t${t}.png`);
      await page.screenshot({path: file});
      console.log(file);
    }
    await page.close();
  }
}

const CARDS = [
  {name: 'og', w: 1200, h: 630},
  {name: 'youtube-thumb', w: 1280, h: 720},
  {name: 'tiktok-cover', w: 1080, h: 1920},
  {name: 'square', w: 1080, h: 1080},
];

async function renderCards() {
  for (const card of CARDS.filter(x => !onlyArg || onlyArg.includes(x.name))) {
    const page = await browser.newPage({viewport: {width: card.w, height: card.h}});
    await page.goto(
      `${pathToFileURL(path.join(ROOT, 'media-src', 'cards.html')).href}?card=${card.name}`,
      {waitUntil: 'networkidle'},
    );
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(OUT, `${card.name}.png`);
    await page.screenshot({path: out});
    await page.close();
    console.log('wrote', path.relative(ROOT, out));
  }
}

try {
  if (mode === 'frames') await renderFrames(rest.filter(x => /^[\d.]+$/.test(x)));
  if (mode === 'cards' || mode === 'all') await renderCards();
  if (mode === 'videos' || mode === 'all')
    for (const v of VIDEOS.filter(x => !onlyArg || onlyArg.includes(x.name))) await renderVideo(v);
} finally {
  await browser.close();
}
