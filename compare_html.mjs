import fs from 'fs';

const data = fs.readFileSync('output.html', 'utf8');
const match = data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:function\(\)\{return (\[.*?\])\}, sideChannel: \{.*?\}\}\);/s) || 
              data.match(/AF_initDataCallback\(\{key: 'ds:1', .*?data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s) ||
              data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s);

if (match) {
  const parsedData = JSON.parse(match[1]);
  const mediaItems = parsedData[1];
  
  // Find first image
  const imgItem = mediaItems.find(item => !JSON.stringify(item).includes('video') && !JSON.stringify(item).includes('mp4'));
  const vidItem = mediaItems.find(item => JSON.stringify(item).includes('video') || JSON.stringify(item).includes('mp4'));
  
  if (imgItem) {
     console.log("Image item lengths:", imgItem.length, imgItem[1].length);
     console.log("imgItem[1]:", JSON.stringify(imgItem[1], null, 2).substring(0, 500) + "...");
  }
  if (vidItem) {
     console.log("\nVideo item lengths:", vidItem.length, vidItem[1].length);
     console.log("vidItem[1]:", JSON.stringify(vidItem[1], null, 2).substring(0, 500) + "...");
     // Look for specific differences
     console.log("\nDeep check on vidItem:");
     for(let j=0; j<vidItem.length; j++) {
       const vStr = JSON.stringify(vidItem[j]);
       if (vStr && (vStr.includes('video') || vStr.includes('mp4') || vStr.includes('m22'))) {
           console.log(`Found video indicator in vidItem[${j}]:`, vStr);
       }
     }
  }
}
