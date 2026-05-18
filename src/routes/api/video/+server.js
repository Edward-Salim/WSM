const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36';

const ALLOWED_HOSTS = new Set(['lh3.googleusercontent.com', 'video-downloads.googleusercontent.com']);

function buildProxyHeaders(upstream) {
	const headers = new Headers();
	const passthroughHeaders = [
		'content-type',
		'content-range',
		'cache-control',
		'etag',
		'last-modified',
		'content-encoding'
	];

	for (const name of passthroughHeaders) {
		const value = upstream.headers.get(name);
		if (value) headers.set(name, value);
	}

	headers.set('accept-ranges', upstream.headers.get('accept-ranges') || 'bytes');

	return headers;
}

async function handleVideoRequest({ request, url, headOnly = false }) {
	const src = url.searchParams.get('src');

	if (!src) {
		return new Response('Missing src parameter', { status: 400 });
	}

	let parsed;
	try {
		parsed = new URL(src);
	} catch {
		return new Response('Invalid src parameter', { status: 400 });
	}

	if (!ALLOWED_HOSTS.has(parsed.hostname)) {
		return new Response('Unsupported video host', { status: 400 });
	}

	const headers = {
		'User-Agent': USER_AGENT
	};

	const range = request.headers.get('range');
	if (range) headers.Range = range;

	try {
		const upstream = await fetch(parsed.toString(), {
			headers,
			redirect: 'follow'
		});

		if (!upstream.ok && upstream.status !== 206) {
			return new Response('Failed to load upstream video', { status: 502 });
		}

		const contentType = upstream.headers.get('content-type') ?? '';
		if (!contentType.startsWith('video/')) {
			upstream.body?.cancel?.();
			return new Response('Resolved content is not a video', { status: 502 });
		}

		return new Response(headOnly ? null : upstream.body, {
			status: upstream.status,
			headers: buildProxyHeaders(upstream)
		});
	} catch (error) {
		console.error('Video proxy failed:', error);
		return new Response('Video proxy failed', { status: 500 });
	}
}

export async function GET(event) {
	return handleVideoRequest(event);
}

export async function HEAD(event) {
	return handleVideoRequest({ ...event, headOnly: true });
}
