import https from 'https';
import fs from 'fs';

const data = fs.readFileSync('output.html', 'utf8');
const match = data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:function\(\)\{return (\[.*?\])\}, sideChannel: \{.*?\}\}\);/s) || 
              data.match(/AF_initDataCallback\(\{key: 'ds:1', .*?data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s) ||
              data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s);

if (match) {
  const parsedData = JSON.parse(match[1]);
  const mediaItems = parsedData[1];
  
  console.log(`Testing all ${mediaItems.length} items for =m22...`);
  
  let i = 0;
  function checkNext() {
      if (i >= mediaItems.length) return;
      const item = mediaItems[i];
      const baseUrl = item[1][0];
      const testUrl = `${baseUrl}=m22`;
      
      https.get(testUrl, (res) => {
          if (res.statusCode === 200 || res.statusCode === 302) {
              console.log(`\nBINGO! Item ${i} [${item[0]}] returned ${res.statusCode}! It is a video!`);
              console.log(JSON.stringify(item));
          }
          i++;
          checkNext();
      }).on('error', err => {
          i++;
          checkNext();
      });
  }
  checkNext();
}
