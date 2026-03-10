const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    console.log('Starting puppeteer...');
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.setViewport({ width: 1280, height: 800 });

    page.on('console', msg => {
        if (msg.type() === 'error') console.log('BROWSER ERR:', msg.text());
        else console.log('BROWSER LOG:', msg.text());
    });

    try {
        console.log('Navigating to login...');
        await page.goto('http://localhost:3000/login');
        await page.waitForSelector('input[type="email"]');
        await page.type('input[type="email"]', 'neotechbih@gmail.com');
        await page.type('input[type="password"]', 'test1234');
        await page.click('button[type="submit"]');

        console.log('Wait for dashboard...');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 8000 }).catch(() => {});
        console.log('Navigating to annual injuries...');
        await page.goto('http://localhost:3000/dashboard/annual-injuries');
        await page.waitForSelector('.btn-ghost', { timeout: 10000 });

        // Let's create a report first
        console.log('Clicking Generiši novi izvještaj');
        const buttons = await page.$$('button');
        let genBtn = null;
        for (const btn of buttons) {
            const txt = await page.evaluate(el => el.textContent, btn);
            if (txt.includes('Generiši novi izvještaj')) {
                genBtn = btn; break;
            }
        }
        if (genBtn) {
            await genBtn.click();
            await page.waitForTimeout(1000);
            
            console.log('Looking for Preuzmi button in editor...');
            const editorBtns = await page.$$('button');
            let preuzmiBtn = null;
            for (const btn of editorBtns) {
                const txt = await page.evaluate(el => el.textContent, btn);
                if (txt.includes('Preuzmi')) {
                    preuzmiBtn = btn; break;
                }
            }
            if (preuzmiBtn) {
                await preuzmiBtn.click();
                await page.waitForTimeout(500);
                const dropdowns = await page.$$('.dropdown-menu');
                console.log('Found dropdown menus:', dropdowns.length);
                if (dropdowns.length > 0) {
                    const box = await dropdowns[0].boundingBox();
                    const isVisible = await dropdowns[0].isIntersectingViewport();
                    console.log('Dropdown box:', box, 'Visible:', isVisible);
                } else {
                    console.log('Dropdown menu not found in DOM!');
                }
            } else {
                console.log('Preuzmi button not found!');
            }
        }
    } catch (e) {
        console.error('Test error:', e);
    }
    
    await browser.close();
})();
