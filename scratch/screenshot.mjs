import puppeteer from 'puppeteer';

const albumUrl = "https://photos.app.goo.gl/VRVCm4KjvZXZybJa8";

async function run() {
	try {
		console.log('Launching browser...');
		const browser = await puppeteer.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox']
		});
		
		const page = await browser.newPage();
		await page.setViewport({ width: 1280, height: 800 });
		
		// Set a real browser User-Agent
		await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
		
		console.log('Navigating to', albumUrl);
		await page.goto(albumUrl, { waitUntil: 'networkidle2', timeout: 60000 });
		
		console.log('Waiting 8 seconds for photos to load...');
		await new Promise(resolve => setTimeout(resolve, 8000));
		
		// Capture screenshot
		console.log('Taking screenshot...');
		await page.screenshot({ path: 'scratch/screenshot.png' });
		
		const title = await page.title();
		console.log(`Page Title: ${title}`);
		
		// Check how many divs have background-images or contain images
		const imagesCount = await page.evaluate(() => {
			return document.querySelectorAll('img').length;
		});
		console.log(`Number of <img> tags: ${imagesCount}`);
		
		const allImgsSrc = await page.evaluate(() => {
			return Array.from(document.querySelectorAll('img')).map(i => i.src.substring(0, 100));
		});
		console.log('First 10 image sources:', allImgsSrc.slice(0, 10));
		
		await browser.close();
	} catch (e) {
		console.error('Error:', e);
	}
}

run();
