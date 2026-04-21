const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, 'public', 'icons3d');

async function processIcons() {
    const files = fs.readdirSync(iconsDir).filter(f => f.match(/\.(png|jpe?g)$/i));
    
    for (const file of files) {
        const filePath = path.join(iconsDir, file);
        const ext = path.extname(file);
        const baseName = path.basename(file, ext);
        const finalPngName = `${baseName}.png`;
        const tempPath = path.join(iconsDir, `temp_${finalPngName}`);
        
        console.log(`Processing ${file}...`);
        
        try {
            await sharp(filePath)
                .resize({ width: 512, height: 512, fit: 'inside' })
                .png({ quality: 80, compressionLevel: 9 })
                .toFile(tempPath);
            
            // Delete original file if it's different (e.g. jpeg)
            if (file !== finalPngName) {
                fs.unlinkSync(filePath);
            } else {
                fs.unlinkSync(filePath);
            }
            
            // Rename temp to target .png
            fs.renameSync(tempPath, path.join(iconsDir, finalPngName));
            
            const stats = fs.statSync(path.join(iconsDir, finalPngName));
            console.log(`Finished ${file}. New size: ${(stats.size / 1024).toFixed(2)} KB -> Saved as ${finalPngName}`);
        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    }
}

processIcons();
