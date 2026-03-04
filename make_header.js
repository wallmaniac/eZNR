const sharp = require('sharp');
const path = require('path');

const width = 600, height = 220;

const svg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3b22c8"/>
      <stop offset="100%" stop-color="#6b35e8"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
</svg>`);

sharp(path.join('..', 'extracted_Logo_0.png'))
    .resize({ height: 196, withoutEnlargement: false })
    .toBuffer()
    .then(logoBuffer => {
        return sharp(svg)
            .composite([{ input: logoBuffer, gravity: 'center' }])
            .png()
            .toFile('public/email-header.png');
    })
    .then(() => console.log('Done! email-header.png created'))
    .catch(e => console.error(e));
