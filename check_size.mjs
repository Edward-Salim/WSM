import fs from 'fs';

const data = fs.readFileSync('output.html', 'utf8');
const match = data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:function\(\)\{return (\[.*?\])\}, sideChannel: \{.*?\}\}\);/s) || 
              data.match(/AF_initDataCallback\(\{key: 'ds:1', .*?data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s) ||
              data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s);

if (match) {
  const parsedData = JSON.parse(match[1]);
  const mediaItems = parsedData[1];
  
  // Sort by size
  mediaItems.sort((a, b) => (b[1]?.[9]?.[0] || 0) - (a[1]?.[9]?.[0] || 0));
  
  console.log("Top 5 largest items:");
  for (let i = 0; i < 5; i++) {
     const item = mediaItems[i];
     console.log(`Size: ${(item[1]?.[9]?.[0] / 1024 / 1024).toFixed(2)} MB, ID: ${item[0]}`);
     console.log(`URL: ${item[1][0]}`);
  }
}
