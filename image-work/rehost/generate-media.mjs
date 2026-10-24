// Generate self-hosted web renditions from local media backups and emit the
// old→new URL map used by the DB rewrite. Run: node image-work/rehost/generate-media.mjs
import { createRequire } from 'node:module';
import { mkdirSync, copyFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const require = createRequire(resolve(root, 'backend/package.json'));
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const { execFileSync } = await import('node:child_process');

const SRC = resolve(root, 'products_to_upload');
const AUD = resolve(root, 'image-work/color-audit');
const OUT = resolve(root, 'frontend/public/media');
const IMG_OUT = join(OUT, 'products');
const LS_OUT = join(IMG_OUT, 'lifestyle');
const HERO_OUT = join(OUT, 'hero');
const PH_OUT = join(OUT, 'placeholders');
for (const d of [IMG_OUT, LS_OUT, HERO_OUT, PH_OUT]) mkdirSync(d, { recursive: true });

const videoExt = (f) => /\.(mp4|webm|mov)$/i.test(f);

// old cloud path (after …/stylesence/) → new media path (no origin)
const MAP = {
  // ── catalog images (local originals) ──
  'products/IMG_2416_mfhure.jpg': '/media/products/camille-trouser-1.webp',
  'products/IMG_9738_lnw9tk.jpg': '/media/products/camille-trouser-2.webp',
  'products/camille-duo-cafe.jpg': '/media/products/camille-trouser-duo.webp',
  'products/aqzzlaowvm4jtfhtfjqm.png': '/media/products/camille-trouser-studio.webp',
  'products/fyfaep8aqjwyounguvu3.png': '/media/products/camille-trouser-alt.webp',
  'products/IMG_2418_bxyfvx.jpg': '/media/products/camille-skirt-1.webp',
  'products/hhif06xgc1xmfiw2sdyu.png': '/media/products/camille-skirt-studio.webp',
  'products/IMG_2426_hkgkfv.jpg': '/media/products/ariella-long-1.webp',
  'products/IMG_2432_ltticl.jpg': '/media/products/ariella-long-2.webp',
  'products/sygvfoqdincxbb36uksp.png': '/media/products/ariella-long-studio.webp',
  'products/m0frufetagfzmr8jpyhz.png': '/media/products/ariella-short-studio.webp',
  'products/WhatsApp_Image_2026-09-29_at_11.18.10_AM_ogfbs7.jpg': '/media/products/ariella-short-1.webp',
  // ── catalog videos (local originals) ──
  'products/IMG_6843_b7eomt.mp4': '/media/products/camille-trouser-video.mp4',
  'products/IMG_6842_wlfho7.mp4': '/media/products/ariella-short-video.mp4',
  // ── hero ──
  'products/IMG_7612_yc1iae.mp4': '/media/hero/video.mp4',
  'products/IMG_7612_yc1iae.jpg': '/media/hero/poster.jpg',
// lifestyle set (already web-optimized sources under lifestyle-2026-09-30/web/)
...LIFESTYLE.reduce((acc, name) => {
  acc[`products/lifestyle-2026-09-30/${name}.webp`] = `/media/products/lifestyle/${name}.webp`;
  return acc;
}, {} as Record<string, string>),
  // ── substitutes (assets unrecoverable while Cloudinary is 401) ──
  'products/we9gtrkgh8evvszvuivc.mp4': '/media/products/arewa-video.mp4',
  'products/arnwq92fneczpy5pbisj.jpg': '/media/products/arewa-frame.webp',
  'products/l4zqyfttwc8bxsfwosat.png': '/media/products/arewa-angle.webp',
  'products/nfxrglkneioqydpnehsd.png': '/media/products/arewa-studio.webp',
  'products/xfpgs9yjfc4bq6retxau.mp4': '/media/products/camille-skirt-poster.webp',
  'products/camille-duo-seated.jpg': '/media/products/camille-trouser-duo.webp',
  'products/camille-skirt-slate.jpg': '/media/products/camille-skirt-studio.webp',
  'products/ariella-gown-blue.jpg': '/media/products/ariella-long-1.webp',
  'editorial/camille-crop-set-blue.jpg': '/media/products/camille-trouser-duo.webp',
  'editorial/camille-bomber-shorts.jpg': '/media/products/camille-trouser-1.webp',
  'editorial/camille-duo-cream.jpg': '/media/products/camille-trouser-duo.webp',
  'editorial/polka-shirt-dress.jpg': '/media/products/camille-skirt-1.webp',
};

// catalog image sources: new name → local source file
const IMAGES = {
  'camille-trouser-1': join(SRC, 'product_02/media/images/IMG_2416.jpg'),
  'camille-trouser-2': join(SRC, 'product_02/media/images/IMG_9738.jpeg'),
  'camille-trouser-duo': join(AUD, 'the-camille-trouser-set__2__camille-duo-cafe.jpg'),
  'camille-trouser-studio': join(AUD, 'the-camille-trouser-set__4__aqzzlaowvm4jtfhtfjqm.png'),
  'camille-trouser-alt': join(AUD, 'the-camille-trouser-set__5__fyfaep8aqjwyounguvu3.png'),
  'camille-skirt-1': join(SRC, 'product_01/media/images/IMG_2418.jpg'),
  'camille-skirt-studio': join(AUD, 'the-camille-skirt-set__2__hhif06xgc1xmfiw2sdyu.png'),
  'camille-skirt-poster': join(AUD, 'the-camille-skirt-set__1__xfpgs9yjfc4bq6retxau.jpg'),
  'ariella-long-1': join(SRC, 'product_04/media/images/IMG_2426.png'),
  'ariella-long-2': join(SRC, 'product_04/media/images/IMG_2432.jpg'),
  'ariella-long-studio': join(AUD, 'the-ariella-dress-long__2__sygvfoqdincxbb36uksp.png'),
  'ariella-short-1': join(AUD, 'the-ariella-dress-short__2__WhatsApp_Image_2026-09-29_at_11.18.10_AM_ogfbs7.jpg'),
  'ariella-short-studio': join(AUD, 'the-ariella-dress-short__1__m0frufetagfzmr8jpyhz.png'),
  'arewa-angle': join(SRC, 'generated-2026-09-29/arewa-angle-v2.png'),
  'arewa-studio': join(SRC, 'generated-2026-09-29/arewa-studio-v1.png'),
};
const LIFESTYLE = [
  'ariella-long-blush-lifestyle', 'ariella-long-butter-yellow-lifestyle', 'ariella-long-off-white-lifestyle',
  'ariella-long-powder-blue-detail', 'ariella-long-red-lifestyle', 'ariella-short-blush-detail',
  'ariella-short-butter-yellow-lifestyle', 'ariella-short-off-white-lifestyle', 'ariella-short-powder-blue-lifestyle',
  'ariella-short-red-lifestyle', 'camille-skirt-black-white-lifestyle', 'camille-skirt-blue-cream-detail',
  'camille-trouser-black-white-detail', 'camille-trouser-blue-cream-lifestyle',
];
const VIDEOS = [
  ['camille-trouser-video', join(SRC, 'product_02/media/videos/IMG_6843.mp4'), 1],
  ['ariella-short-video', join(SRC, 'product_03/media/videos/IMG_6842.mp4'), 1],
  ['arewa-video', join(SRC, 'product_01/media/videos/IMG_6845.mp4'), 1.5],
  ['../hero/video', join(SRC, 'product_05/media/videos/IMG_7612.mp4'), 1],
];

const kb = (f) => Math.round(statSync(f).size / 1024);
const log = (m) => console.log(m);

function frame(video, ss, outPng) {
  execFileSync(ffmpegPath, ['-y', '-ss', String(ss), '-i', video, '-frames:v', '1', outPng], { stdio: 'pipe' });
}

async function imageSet(basePathNoExt, source) {
  // fullPath without extension → write fullPath.webp (1280), fullPath-640.webp, fullPath-og.jpg
  const img = sharp(source).rotate();
  const meta = await img.metadata();
  await img.clone().resize({ width: Math.min(1280, meta.width ?? 1280), withoutEnlargement: true })
    .webp({ quality: 80 }).toFile(`${basePathNoExt}.webp`);
  await img.clone().resize({ width: Math.min(640, meta.width ?? 640), withoutEnlargement: true })
    .webp({ quality: 78 }).toFile(`${basePathNoExt}-640.webp`);
  await img.clone().resize(1200, 630, { fit: 'cover', position: 'attention' })
    .jpeg({ quality: 78 }).toFile(`${basePathNoExt}-og.jpg`);
  log(`  ✓ ${basename(basePathNoExt)}  (${kb(`${basePathNoExt}.webp`)} KB)`);
}

async function videoSet(basePathNoExt, source, posterAt, crf = 27) {
  const tmp = join(here, `.tmp-frame-${Date.now()}.png`);
  frame(source, posterAt, tmp);
  await sharp(tmp).resize({ width: 1280, withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(`${basePathNoExt}-poster.jpg`);
  await sharp(tmp).resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 78 }).toFile(`${basePathNoExt}-og.jpg`);
  const { unlinkSync } = await import('node:fs');
  unlinkSync(tmp);
  const out = `${basePathNoExt}.mp4`;
  execFileSync(ffmpegPath, ['-y', '-i', source,
    '-vf', "scale='min(1280,iw)':-2,fps=24", '-c:v', 'libx264', '-crf', String(crf), '-preset', 'medium',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', out], { stdio: 'pipe' });
  log(`  ✓ ${basename(out)}  (${kb(out)} KB)`);
}

log('— catalog images —');
for (const [name, src] of Object.entries(IMAGES)) {
  if (!existsSync(src)) throw new Error(`missing source: ${src}`);
  await imageSet(join(IMG_OUT, name), src);
}
log('— lifestyle images —');
for (const name of LIFESTYLE) {
  const src = join(SRC, `lifestyle-2026-09-30/web/${name}.webp`);
  if (!existsSync(src)) throw new Error(`missing source: ${src}`);
  await imageSet(join(LS_OUT, name), src);
}
log('— videos + posters —');
for (const [name, src, at] of VIDEOS) {
  if (!existsSync(src)) throw new Error(`missing source: ${src}`);
  await videoSet(join(IMG_OUT, name), src, at);
}
log('— og for video poster substitutes —');
// camille-skirt-poster.webp is an image; og already generated above.

log('— placeholder card —');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">
  <rect width="600" height="800" fill="#f0eee6"/>
  <rect x="14" y="14" width="572" height="772" fill="none" stroke="#d8d4c8" stroke-width="1"/>
  <text x="300" y="392" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="34" fill="#8a8574">Style Sence</text>
  <text x="300" y="428" text-anchor="middle" font-family="Georgia, serif" font-size="15" letter-spacing="4" fill="#a8a292">IMAGE COMING SOON</text>
</svg>`;
await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(join(PH_OUT, 'card.webp'));
log('  ✓ placeholders/card.webp');

writeFileSync(join(here, 'url-map.json'), JSON.stringify(MAP, null, 2));
log(`\nwrote url-map.json (${Object.keys(MAP).length} mappings)`);
