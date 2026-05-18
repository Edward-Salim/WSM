import fs from 'fs';

const data = fs.readFileSync('output.html', 'utf8');
const match = data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:function\(\)\{return (\[.*?\])\}, sideChannel: \{.*?\}\}\);/s) || 
              data.match(/AF_initDataCallback\(\{key: 'ds:1', .*?data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s) ||
              data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s);

if (match) {
  const parsedData = JSON.parse(match[1]);
  const mediaItems = parsedData[1];
  
  console.log(`Total items: ${mediaItems.length}`);
  // Check the last 5 items
  for (let i = Math.max(0, mediaItems.length - 5); i < mediaItems.length; i++) {
     const item = mediaItems[i];
     console.log(`\nLast Item ${i} [${item[0]}]:`);
     console.log(JSON.stringify(item[1], null, 2));
  }
}
