import fs from 'fs';

const ALBUM_URL = 'https://photos.app.goo.gl/VRVCm4KjvZXZybJa8';

async function download() {
  try {
    const res = await fetch(ALBUM_URL);
    const html = await res.text();
    fs.writeFileSync('output.html', html);
    console.log('Saved to output.html, length:', html.length);
  } catch (err) {
    console.error(err);
  }
}
download();
