import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const logoPath = path.resolve(process.cwd(), 'public/logo.png');
const backupPath = path.resolve(process.cwd(), 'public/logo-original.png');

async function addWhiteBackground() {
  try {
    // Backup original
    fs.copyFileSync(logoPath, backupPath);
    console.log('Backup created at public/logo-original.png');

    // Get metadata
    const metadata = await sharp(logoPath).metadata();
    const width = metadata.width || 512;
    const height = metadata.height || 512;

    // Create white background and composite logo on top
    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([{ input: logoPath }])
      .png()
      .toFile(logoPath + '.tmp');

    // Replace original with new version
    fs.renameSync(logoPath + '.tmp', logoPath);

    const newStats = fs.statSync(logoPath);
    console.log(`White background added successfully!`);
    console.log(`New file size: ${newStats.size} bytes (${width}x${height})`);
  } catch (error) {
    console.error('Error processing logo:', error);
    process.exit(1);
  }
}

addWhiteBackground();

