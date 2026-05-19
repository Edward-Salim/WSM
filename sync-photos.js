import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Simple .env parser to get GOOGLE_PHOTOS_ALBUM_URL
function getAlbumUrls() {
	try {
		const envContent = fs.readFileSync('.env', 'utf-8');
		const match = envContent.match(/GOOGLE_PHOTOS_ALBUM_URL="([^"]+)"/) || envContent.match(/GOOGLE_PHOTOS_ALBUM_URL=([^\s]+)/);
		if (match && match[1]) {
			return match[1].split(',').map(url => url.trim()).filter(Boolean);
		}
	} catch (e) {
		console.error('Failed to read .env file:', e);
	}
	return [];
}

// Simple .env parser to get GOOGLE_PHOTOS_COOKIE
function getCookieString() {
	try {
		const envContent = fs.readFileSync('.env', 'utf-8');
		const match = envContent.match(/GOOGLE_PHOTOS_COOKIE="([^"]+)"/) || envContent.match(/GOOGLE_PHOTOS_COOKIE=([^\s]+)/);
		return match ? match[1] : null;
	} catch (e) {
		return null;
	}
}

// Parses raw request header Cookie string into Puppeteer cookie format
function parseCookieHeader(cookieString, domain = '.google.com') {
	return cookieString
		.split(';')
		.map((pair) => {
			const trimmed = pair.trim();
			if (!trimmed) return null;
			const eqIndex = trimmed.indexOf('=');
			if (eqIndex === -1) return null;
			
			const name = trimmed.substring(0, eqIndex).trim();
			const value = trimmed.substring(eqIndex + 1).trim();
			
			return {
				name,
				value,
				domain,
				path: '/',
				secure: true // Crucial flag for all Google secure context cookies!
			};
		})
		.filter((c) => c && c.name && c.value);
}

const albumUrls = getAlbumUrls();
if (albumUrls.length === 0) {
	console.error('Error: GOOGLE_PHOTOS_ALBUM_URL is not set in your .env file!');
	process.exit(1);
}

const yearList = ['2022', '2023', '2024', '2025', '2026'];

(async () => {
	console.log(`Starting Google Photos sync for ${albumUrls.length} album(s)...`);
	
	// Launch Puppeteer with safe sandboxing options
	const browser = await puppeteer.launch({
		headless: true,
		args: ['--no-sandbox', '--disable-setuid-sandbox']
	});

	const allPhotos = [];
	const seenIds = new Set();
	let globalIndex = 0;

	for (const albumUrl of albumUrls) {
		console.log(`\nProcessing album: ${albumUrl}`);
		const page = await browser.newPage();
		
		// Forward browser console.log to our terminal!
		page.on('console', msg => console.log(`[BROWSER]: ${msg.text()}`));
		
		// Set a desktop viewport to load more items at once
		await page.setViewport({ width: 1280, height: 1000 });
		
		// Set an authentic desktop User-Agent to bypass headless detection
		await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, report like Gecko) Chrome/120.0.0.0 Safari/537.36');

		// Inject authenticated session cookies if present
		const cookieString = getCookieString();
		if (cookieString) {
			console.log('Found GOOGLE_PHOTOS_COOKIE in .env. Injecting authenticated session cookies...');
			try {
				const cookies = parseCookieHeader(cookieString);
				await page.setCookie(...cookies);
				console.log(`Successfully injected ${cookies.length} session cookies.`);
			} catch (cookieErr) {
				console.warn('Failed to parse or inject cookies:', cookieErr.message);
			}
		}
		
		// Navigate to the album and wait for network to settle
		console.log('Navigating to album page...');
		await page.goto(albumUrl, { waitUntil: 'networkidle2', timeout: 60000 });
		
		// Step 1: Parse the initial 300 photos using the rich HTML metadata payload
		console.log('Parsing initial page metadata (ds:1 block)...');
		const html = await page.content();
		const pattern = /AF_initDataCallback\(\{key:\s*'ds:1'[^]*?data:\s*(\[[^]*?\])\s*,\s*sideChannel/g;
		const match = pattern.exec(html);
		
		const initialPhotosMap = new Map();
		
		if (match) {
			try {
				const data = JSON.parse(match[1]);
				const mediaItems = data[1] || [];
				console.log(`Found ${mediaItems.length} items in initial page metadata payload.`);
				
				for (const [index, item] of mediaItems.entries()) {
					const baseUrl = item[1]?.[0];
					if (typeof baseUrl !== 'string' || !baseUrl.includes('googleusercontent.com')) continue;
					
					const isVideo = item[1]?.[8]?.[2] === 2 || (item[9] && item[9]['76647426'] !== undefined);
					const optimizedUrl = isVideo ? `${baseUrl}=dv` : `${baseUrl}=w800`;
					const id = item[0] || `gphoto-${globalIndex++}`;
					
					// Calculate Aspect Ratio
					const width = item[1]?.[1];
					const height = item[1]?.[2];
					let ratio = '2/3';
					if (width && height) {
						const ar = width / height;
						if (ar > 1.4) ratio = '3/2';
						else if (ar > 1.1) ratio = '4/3';
						else if (ar > 0.9) ratio = '1/1';
						else if (ar > 0.7) ratio = '3/4';
						else ratio = '2/3';
					}
					
					// Extract Taken Timestamp & Auto-Tag Year
					const timestamp = item[2];
					let yearTag = '2022';
					if (timestamp && timestamp > 1000000000000 && timestamp < 2000000000000) {
						const takenYear = new Date(timestamp).getFullYear().toString();
						if (yearList.includes(takenYear)) {
							yearTag = takenYear;
						}
					}
					
					const photoData = {
						id,
						title: 'Memory',
						description: 'Synced automatically from collaborative shared album',
						url: isVideo ? `/api/video?src=${encodeURIComponent(optimizedUrl)}` : optimizedUrl,
						tags: [yearTag],
						ratio
					};
					
					// Map clean base URL to photoData
					const cleanBase = baseUrl.split('=')[0];
					initialPhotosMap.set(cleanBase, photoData);
				}
			} catch (e) {
				console.error('Failed to parse initial metadata block:', e.message);
			}
		} else {
			console.warn('Could not parse initial metadata block. Will rely entirely on DOM scraping.');
		}

		// Step 2: Dynamic scrolling to trigger lazy loading of remaining items
		console.log('Scrolling to load remaining photos...');
		
		const scrolledPhotosSet = new Map();
		
		// Expose a function to collect visible images continuously
		await page.exposeFunction('collectVisibleImages', (images) => {
			for (const img of images) {
				const { src, ratio, isVideo, yearTag } = img;
				if (!src || !src.includes('googleusercontent.com/pw/')) continue;
				
				const cleanBase = src.split('=')[0];
				
				// Only add if not already in the initialPhotosMap (which has richer metadata)
				if (!initialPhotosMap.has(cleanBase) && !scrolledPhotosSet.has(cleanBase)) {
					scrolledPhotosSet.set(cleanBase, {
						cleanBase,
						ratio,
						isVideo,
						yearTag
					});
				}
			}
		});
		
		// Run a high-frequency collection script in the page context (every 200ms)
		await page.evaluate(() => {
			setInterval(() => {
				const collected = [];
				const allElements = document.querySelectorAll('*');
				
				for (const el of allElements) {
					let src = '';
					
					if (el.tagName === 'IMG') {
						src = el.src;
					} else {
						const style = el.getAttribute('style') || '';
						// Extract background-image: url("...") (relaxed match any googleusercontent domain)
						const bgMatch = style.match(/url\((['"]?)(https:\/\/.*?googleusercontent\.com\/.*?)\1\)/);
						if (bgMatch) {
							src = bgMatch[2];
						}
					}
					
					if (!src || !src.includes('googleusercontent.com/pw/')) continue;
					
					// Exclude member list circular avatars
					if (src.includes('=s32-p-no')) continue;
					
					// Extract parent aria-label to get video status and true creation year
					const parent = el.closest('[aria-label]');
					const ariaLabel = parent ? parent.getAttribute('aria-label') : '';
					const isVideo = ariaLabel.toLowerCase().includes('video');
					
					// Parse the year (matches any 4-digit number between 2022 and 2026)
					const yearMatch = ariaLabel.match(/\b(202[2-6])\b/);
					const yearTag = yearMatch ? yearMatch[1] : '2025';
					
					// Calculate aspect ratio dynamically
					const width = el.naturalWidth || el.clientWidth || 0;
					const height = el.naturalHeight || el.clientHeight || 0;
					let ratio = '2/3';
					if (width && height) {
						const ar = width / height;
						if (ar > 1.4) ratio = '3/2';
						else if (ar > 1.1) ratio = '4/3';
						else if (ar > 0.9) ratio = '1/1';
						else if (ar > 0.7) ratio = '3/4';
						else ratio = '2/3';
					}
					
					collected.push({ src, ratio, isVideo: !!isVideo, yearTag });
				}
				
				window.collectVisibleImages(collected);
			}, 200);
		});

		// Scroll the scrollable container dynamically with a slower, network-tolerant check (480ms delay)
		await page.evaluate(async () => {
			// Find ALL scrollable containers and sort them by scrollHeight to get the largest one (the main grid!)
			const scrollableContainer = Array.from(document.querySelectorAll('*'))
				.filter(el => {
					const style = window.getComputedStyle(el);
					return el.scrollHeight > el.clientHeight && 
					       el.clientHeight > 0 && 
					       (style.overflowY === 'auto' || style.overflowY === 'scroll');
				})
				.sort((a, b) => b.scrollHeight - a.scrollHeight)[0];

			if (!scrollableContainer) {
				console.error('Could not find dynamic scroll container. Scrolling window instead.');
				window.scrollTo(0, document.body.scrollHeight);
				return;
			}

			console.log(`Matched main scroll container: ${scrollableContainer.tagName} class="${scrollableContainer.className}" initial scrollHeight=${scrollableContainer.scrollHeight}px`);

			await new Promise((resolve) => {
				let lastHeight = scrollableContainer.scrollHeight;
				let noChangeCount = 0;
				let scrolls = 0;
				
				const timer = setInterval(() => {
					scrollableContainer.scrollBy(0, 700); // Scroll 700px down for network tolerance
					scrolls++;
					
					const currentHeight = scrollableContainer.scrollHeight;
					const scrollTop = scrollableContainer.scrollTop;
					const clientHeight = scrollableContainer.clientHeight;
					
					if (currentHeight > lastHeight) {
						lastHeight = currentHeight;
						noChangeCount = 0; // Reset counter since height grew
					} else {
						noChangeCount++;
					}

					// Log scroll progress to node console
					if (scrolls % 10 === 0 || noChangeCount > 5) {
						console.log(`Scroll Step #${scrolls} | scrollTop: ${scrollTop}px | scrollHeight: ${currentHeight}px | noChangeCount: ${noChangeCount}/40`);
					}

					// We only stop if the height does not change for 40 consecutive steps (~19.2 seconds of absolute static state at bottom)
					// or we've scrolled an extremely high number of times (safety limit)
					if ((noChangeCount >= 40 && scrollTop + clientHeight >= currentHeight - 50) || scrolls > 2500) {
						console.log(`Finished scrolling scrollContainer! Total scrolls: ${scrolls}`);
						clearInterval(timer);
						resolve();
					}
				}, 480); // Slower steps give Google Photos APIs plenty of time to fetch next batch
			});
		});
		
		// Wait a final 10 seconds to let any pending collection items process
		await new Promise(resolve => setTimeout(resolve, 10000));
		
		// Merge initial photos (first 300) with extra lazy-loaded photos
		// First, add all initial photos
		for (const photo of initialPhotosMap.values()) {
			if (!seenIds.has(photo.id)) {
				seenIds.add(photo.id);
				allPhotos.push(photo);
			}
		}
		
		// Second, add the newly scrolled photos
		let scrolledCount = 0;
		for (const extra of scrolledPhotosSet.values()) {
			const { cleanBase, ratio, isVideo, yearTag } = extra;
			const id = `extra-${cleanBase.slice(-15)}`;
			
			if (!seenIds.has(id)) {
				seenIds.add(id);
				
				const optimizedUrl = isVideo ? `${cleanBase}=dv` : `${cleanBase}=w800`;
				
				allPhotos.push({
					id,
					title: 'Memory',
					description: 'Synced automatically from collaborative shared album',
					url: isVideo ? `/api/video?src=${encodeURIComponent(optimizedUrl)}` : optimizedUrl,
					tags: [yearTag || '2025'],
					ratio
				});
				scrolledCount++;
			}
		}
		
		console.log(`Album processed! Scraped ${initialPhotosMap.size} initial photos + ${scrolledCount} lazy-loaded photos.`);
		await page.close();
	}
	
	// Post-process all collected photos
	// Sort so initialPhotosMap remains first, and dynamically assign incremental memory index globally
	allPhotos.forEach((photo, index) => {
		photo.title = `Memory #${index + 1}`;
	});
	
	// Save to JSON file
	const outputDir = 'src/lib';
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}
	
	const outputPath = path.join(outputDir, 'gphotos.json');
	fs.writeFileSync(outputPath, JSON.stringify({ photos: allPhotos }, null, 2), 'utf-8');
	console.log(`\n🎉 Success! Synced a total of ${allPhotos.length} photos/videos and wrote them to ${outputPath}`);
	
	await browser.close();
})();
