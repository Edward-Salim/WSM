import fs from 'fs';

const data = fs.readFileSync('output.html', 'utf8');
const match = data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:function\(\)\{return (\[.*?\])\}, sideChannel: \{.*?\}\}\);/s) || 
              data.match(/AF_initDataCallback\(\{key: 'ds:1', .*?data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s) ||
              data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s);

if (match) {
  const parsedData = JSON.parse(match[1]);
  const mediaItems = parsedData[1];
  
  let foundVideo = false;
  for (let i = 0; i < mediaItems.length; i++) {
     const item = mediaItems[i];
     // Look for things typical in videos: duration (milliseconds), etc.
     // Is there any array in item that has length exactly for video metadata?
     // Let's print out the full structure of ALL items and look for anomalies.
     // In particular, look at item[something] that might be video specific.
     const str = JSON.stringify(item);
     
     // Videos often have an extra array or a duration in milliseconds (e.g. 5000 for 5s)
     // Let's check item lengths
  }
  
  // Actually, I can just do a regex search on the raw JSON for anything resembling a video mime type
  if (data.includes('video/mp4') || data.includes('video')) {
      console.log("Raw HTML contains video keyword!");
      // Let's find context
      const idx = data.indexOf('video');
      console.log(data.substring(idx - 100, idx + 200));
  } else {
      console.log("Raw HTML does NOT contain 'video' keyword!");
  }
}
