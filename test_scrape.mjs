import https from 'https';

const ALBUM_URL = 'https://photos.app.goo.gl/VRVCm4KjvZXZybJa8';

https.get(ALBUM_URL, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const match = data.match(/AF_initDataCallback\(\{key: 'ds:1', .*?data:(function\(\)\{return|)(\[.*?\])(?:\}|),/s);
    if (match && match[2]) {
      const parsedData = JSON.parse(match[2]);
      const mediaItems = parsedData[1];
      console.log(`Found ${mediaItems.length} items`);
      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        // Check if there is anything indicating a video
        // We look for arrays with 'video' or specific flags
        console.log(`Item ${i}: id=${item[0]}`);
        console.log(`Base URL: ${item[1][0].substring(0, 50)}...`);
        // Check for video markers
        let isVideo = false;
        try {
            // Log structure around index 8 where we thought the video flag was
            if(item[1][8]) {
                console.log(`item[1][8]:`, JSON.stringify(item[1][8]));
            }
            if(item[1][9]) {
                console.log(`item[1][9]:`, JSON.stringify(item[1][9]));
            }
             if(item[1][2] && item[1][2].length) {
                 // sometimes video metadata is somewhere else
             }
        } catch (e) {}

        // Simple deep search for 'video' or 'mp4'
        const itemStr = JSON.stringify(item);
        if (itemStr.toLowerCase().includes('video')) {
           console.log("Found 'video' keyword in item", i);
           console.log("Full structure:", JSON.stringify(item).substring(0, 200));
        }
      }
    } else {
      console.log('Regex did not match.');
    }
  });
}).on('error', err => {
  console.log('Error:', err.message);
});
