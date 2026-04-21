const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, 'public', 'icons3d');

async function processIcons() {
    const files = fs.readdirSync(iconsDir).filter(f => f.endsWith('.png'));
    
    for (const file of files) {
        const filePath = path.join(iconsDir, file);
        const tempPath = path.join(iconsDir, `temp_${file}`);
        
        console.log(`Processing ${file}...`);
        
        try {
            await sharp(filePath)
                .resize({ width: 512, height: 512, fit: 'inside' })
                .png({ quality: 80, compressionLevel: 9 })
                .toFile(tempPath);
            
            // Replace old file with the optimized one
            fs.unlinkSync(filePath);
            fs.renameSync(tempPath, filePath);
            
            const stats = fs.statSync(filePath);
            console.log(`Finished ${file}. New size: ${(stats.size / 1024).toFixed(2)} KB`);
        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    }
}

processIcons();
