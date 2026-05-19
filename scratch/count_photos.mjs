const albumUrl = "https://photos.app.goo.gl/VRVCm4KjvZXZybJa8";

async function run() {
	try {
		console.log('Fetching', albumUrl);
		const response = await fetch(albumUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
			}
		});
		const html = await response.text();
		
		const pattern = /AF_initDataCallback\(\{key:\s*'ds:1'[^]*?data:\s*(\[[^]*?\])\s*,\s*sideChannel/g;
		const match = pattern.exec(html);

		if (!match) {
			console.log('Could not find media payload');
			return;
		}

		const data = JSON.parse(match[1]);
		console.log('Array length:', data.length);
		
		// Print basic types and structures of each index in data
		for (let i = 0; i < data.length; i++) {
			const val = data[i];
			if (val === null) {
				console.log(`index ${i}: null`);
			} else if (Array.isArray(val)) {
				console.log(`index ${i}: Array of length ${val.length}`);
				if (i !== 1) { // We know index 1 is the 300 media items
					// Print a preview of the array
					console.log(`  Preview:`, JSON.stringify(val).substring(0, 300));
				}
			} else {
				console.log(`index ${i}: ${typeof val} = ${val}`);
			}
		}
	} catch (e) {
		console.error('Error:', e);
	}
}

run();
