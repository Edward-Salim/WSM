import { json } from '@sveltejs/kit';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a']);

function parseTrackMetadata(filename) {
	const baseName = filename.replace(/\.[^/.]+$/, '').trim();
	const parts = baseName.split(/\s+-\s+/);

	if (parts.length >= 2) {
		const artist = parts[0].trim();
		const title = parts.slice(1).join(' - ').trim();
		return { artist, title };
	}

	return {
		artist: 'WSM Archive',
		title: baseName.replace(/[_-]+/g, ' ').trim()
	};
}

export async function GET() {
	try {
		const musicDir = path.resolve('static/music');
		const entries = await readdir(musicDir, { withFileTypes: true });

		const tracks = entries
			.filter((entry) => entry.isFile())
			.filter((entry) => SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((entry) => {
				const { artist, title } = parseTrackMetadata(entry.name);

				return {
					id: entry.name,
					title,
					artist,
					src: `/music/${encodeURIComponent(entry.name)}`
				};
			});

		return json({ tracks });
	} catch (error) {
		console.error('Failed to read static/music directory:', error);
		return json({ tracks: [], error: 'Failed to load music library' }, { status: 500 });
	}
}
