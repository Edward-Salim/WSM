import fs from 'fs';

const data = fs.readFileSync('output.html', 'utf8');
const match = data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:function\(\)\{return (\[.*?\])\}, sideChannel: \{.*?\}\}\);/s) || 
              data.match(/AF_initDataCallback\(\{key: 'ds:1', .*?data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s) ||
              data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s);

if (match) {
  const parsedData = JSON.parse(match[1]);
  const mediaItems = parsedData[1];
  console.log(`Found ${mediaItems.length} items`);
  for (let i = 0; i < mediaItems.length; i++) {
    const item = mediaItems[i];
    const str = JSON.stringify(item);
    // Find the first video
    if (str.includes('video') || str.includes('mp4')) {
      console.log(`\nItem ${i} looks like a video! ID: ${item[0]}`);
      
      // Print out the parts of item[1] to find where the video URL or flag is
      console.log("item[1][0] (URL):", item[1]?.[0]);
      console.log(`item[1][8]?.[2] is:`, item[1]?.[8]?.[2]);
      
      // Let's find any object inside item[1] that contains 'video' or 'mp4'
      for (let j = 0; j < item[1].length; j++) {
         const substr = JSON.stringify(item[1][j]);
         if (substr && (substr.includes('video') || substr.includes('mp4'))) {
             console.log(`Found video info at index ${j}:`, substr);
         }
      }
      break; // Just need the first one
    }
  }
} else {
  console.log("Regex still failed.");
}
