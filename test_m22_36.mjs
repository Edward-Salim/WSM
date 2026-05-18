import https from 'https';
import fs from 'fs';

const data = fs.readFileSync('output.html', 'utf8');
const match = data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:function\(\)\{return (\[.*?\])\}, sideChannel: \{.*?\}\}\);/s) || 
              data.match(/AF_initDataCallback\(\{key: 'ds:1', .*?data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s) ||
              data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s);

if (match) {
  const parsedData = JSON.parse(match[1]);
  const mediaItems = parsedData[1];
  
  const item = mediaItems[36]; // The one that matched 'video'/'mp4'
  const baseUrl = item[1][0];
  const testUrl = `${baseUrl}=m22`;
  
  https.get(testUrl, (res) => {
      console.log(`Item 36 [${item[0]}]: HTTP ${res.statusCode} | Content-Type: ${res.headers['content-type']}`);
  });
}
