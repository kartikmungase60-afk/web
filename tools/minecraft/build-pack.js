const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');

const outputDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const zipPath = path.join(outputDir, 'mineorange_pack.zip');
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', {
  zlib: { level: 9 }
});

output.on('close', () => {
  const sizeBytes = archive.pointer();
  console.log(`✓ Created ${zipPath} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB, ${sizeBytes} bytes)`);

  // Calculate SHA1
  const fileBuffer = fs.readFileSync(zipPath);
  const hash = crypto.createHash('sha1').update(fileBuffer).digest('hex');
  console.log(`✓ SHA1 Hash: ${hash}`);

  fs.writeFileSync(path.join(__dirname, 'pack-info.json'), JSON.stringify({
    file: 'mineorange_pack.zip',
    sizeBytes,
    sha1: hash,
    url: 'https://mineorange.fun/packs/mineorange_pack.zip',
    createdAt: new Date().toISOString()
  }, null, 2));
  console.log('✓ Saved pack-info.json');
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add everything from scratch_pack into the root of the zip
const sourceDir = path.join(__dirname, '../../scratch_pack');
console.log('Archiving contents from:', sourceDir);

archive.directory(sourceDir, false);

archive.finalize();
