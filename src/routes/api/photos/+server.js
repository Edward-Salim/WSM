import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { yearList } from '$lib/data';
import fs from 'node:fs';
import path from 'node:path';

export async function GET() {
	// Try serving from local synced file first (allows 300+ items and extremely fast load times)
	try {
		const localFilePath = path.resolve('src/lib/gphotos.json');
		if (fs.existsSync(localFilePath)) {
			const data = fs.readFileSync(localFilePath, 'utf-8');
			const parsed = JSON.parse(data);
			return json({ authenticated: true, photos: parsed.photos, source: 'local-sync' });
		}
	} catch (err) {
		console.warn('Failed to load local gphotos.json, falling back to live scraping:', err.message);
	}

	const albumUrls = env.GOOGLE_PHOTOS_ALBUM_URL
		? env.GOOGLE_PHOTOS_ALBUM_URL.split(',').map((url) => url.trim()).filter(Boolean)
		: [];

	if (albumUrls.length === 0) {
		return json({ authenticated: false, photos: [], message: 'No album URL configured' });
	}

	try {
		const allPhotos = [];
		let globalIndex = 0;

		// Fetch and parse all albums in parallel
		const fetchPromises = albumUrls.map(async (albumUrl) => {
			try {
				const response = await fetch(albumUrl, {
					headers: {
						'User-Agent':
							'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
					}
				});

				if (!response.ok) {
					console.error(`Failed to fetch album ${albumUrl}: ${response.statusText}`);
					return [];
				}

				const html = await response.text();

				// Match the AF_initDataCallback block for key ds:1 which encodes all media items in a JSON array
				const pattern =
					/AF_initDataCallback\(\{key:\s*'ds:1'[^]*?data:\s*(\[[^]*?\])\s*,\s*sideChannel/g;
				const match = pattern.exec(html);

				if (!match) {
					console.error(`Could not find media payload in album page: ${albumUrl}`);
					return [];
				}

				const data = JSON.parse(match[1]);
				const mediaItems = data[1]; // Google Photos media list

				if (!Array.isArray(mediaItems)) {
					console.error(`Parsed payload does not contain media list for album: ${albumUrl}`);
					return [];
				}

				const albumPhotos = [];

				for (const item of mediaItems) {
					// Direct high-res image URL is inside item[1][0]
					const baseUrl = item[1]?.[0];
					if (!baseUrl || !baseUrl.startsWith('https://lh3.googleusercontent.com/')) continue;

					// Google Photos uses item[1][8][2] === 2 or an object at item[9] with a video metadata key "76647426"
					const isVideo = item[1]?.[8]?.[2] === 2 || (item[9] && item[9]['76647426'] !== undefined);
					const optimizedUrl = isVideo ? `${baseUrl}=dv` : `${baseUrl}=w800`;
					const id = item[0] || `gphoto-${globalIndex++}`;

					// 1. Calculate Exact Aspect Ratio dynamically!
					const width = item[1]?.[1];
					const height = item[1]?.[2];
					let ratio = '2/3'; // fallback
					if (width && height) {
						const ar = width / height;
						if (ar > 1.4) ratio = '3/2';
						else if (ar > 1.1) ratio = '4/3';
						else if (ar > 0.9) ratio = '1/1';
						else if (ar > 0.7) ratio = '3/4';
						else ratio = '2/3';
					}

					// 2. Extract Taken Timestamp & Auto-Tag Year
					const timestamp = item[2]; // Taken timestamp in milliseconds
					let yearTag = '2022'; // default fallback for FASILKOM UI 2022
					if (timestamp && timestamp > 1000000000000 && timestamp < 2000000000000) {
						const takenYear = new Date(timestamp).getFullYear().toString();
						// If it falls within class years 2022-2026, use it!
						if (yearList.includes(takenYear)) {
							yearTag = takenYear;
						}
					}

					// Combine year tag only (remove all naming tags)
					const tags = [yearTag];

					albumPhotos.push({
						id,
						title: `Memory`,
						description: 'Synced automatically from collaborative shared album',
						url: isVideo ? `/api/video?src=${encodeURIComponent(optimizedUrl)}` : optimizedUrl,
						tags,
						ratio
					});
				}

				return albumPhotos;
			} catch (err) {
				console.error(`Error scraping Google Photos shared album (${albumUrl}):`, err);
				return [];
			}
		});

		const results = await Promise.all(fetchPromises);

		// Flatten results and remove duplicate items by ID
		const seenIds = new Set();
		for (const albumPhotos of results) {
			for (const photo of albumPhotos) {
				if (!seenIds.has(photo.id)) {
					seenIds.add(photo.id);
					allPhotos.push(photo);
				}
			}
		}

		// Assign incremental memory indices globally
		allPhotos.forEach((photo, index) => {
			photo.title = `Memory #${index + 1}`;
		});

		return json({ authenticated: true, photos: allPhotos, source: 'scraper' });
	} catch (error) {
		console.error('Error scraping Google Photos shared album:', error);
		return json({ authenticated: false, photos: [], error: error.message });
	}
}
