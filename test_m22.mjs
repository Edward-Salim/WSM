import https from 'https';
import fs from 'fs';

const data = fs.readFileSync('output.html', 'utf8');
const match = data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:function\(\)\{return (\[.*?\])\}, sideChannel: \{.*?\}\}\);/s) || 
              data.match(/AF_initDataCallback\(\{key: 'ds:1', .*?data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s) ||
              data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s);

if (match) {
  const parsedData = JSON.parse(match[1]);
  const mediaItems = parsedData[1];
  
  console.log(`Checking ${mediaItems.length} items for =m22 video support...`);
  
  let i = 0;
  function checkNext() {
      if (i >= Math.min(mediaItems.length, 10)) return; // Check first 10
      const item = mediaItems[i];
      const baseUrl = item[1][0];
      const testUrl = `${baseUrl}=m22`;
      
      https.get(testUrl, (res) => {
          console.log(`Item ${i} [${item[0]}]: HTTP ${res.statusCode} | Content-Type: ${res.headers['content-type']}`);
          // Look at headers
          i++;
          checkNext();
      }).on('error', err => {
          console.log(`Item ${i} error:`, err.message);
          i++;
          checkNext();
      });
  }
  checkNext();

}
