import fs from 'fs';

const data = fs.readFileSync('output.html', 'utf8');
const match = data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:function\(\)\{return (\[.*?\])\}, sideChannel: \{.*?\}\}\);/s) || 
              data.match(/AF_initDataCallback\(\{key: 'ds:1', .*?data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s) ||
              data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s);

if (match) {
  const parsedData = JSON.parse(match[1]);
  const mediaItems = parsedData[1];
  
  const imgItem = mediaItems.find(item => !JSON.stringify(item).includes('video') && !JSON.stringify(item).includes('mp4'));
  const vidItem = mediaItems.find(item => JSON.stringify(item).includes('video') || JSON.stringify(item).includes('mp4') || item[1][8]?.[2] === 2);
  
  if (imgItem) console.log("IMG:", JSON.stringify(imgItem));
  if (vidItem) console.log("\nVID:", JSON.stringify(vidItem));
  
  // Actually, if we use the old scraper data test: Let's see if ANY item has item[1][8][2] == 2
  const vidItem2 = mediaItems.find(item => item[1]?.[8]?.[2] === 2);
  if (vidItem2) {
      console.log("\nFound item with item[1][8][2] === 2! ID:", vidItem2[0]);
  } else {
      console.log("\nNO ITEM HAS item[1][8][2] === 2 !");
  }

}
