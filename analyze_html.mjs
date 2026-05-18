import fs from 'fs';

const data = fs.readFileSync('output.html', 'utf8');
const match = data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:function\(\)\{return (\[.*?\])\}, sideChannel: \{.*?\}\}\);/s) || 
              data.match(/AF_initDataCallback\(\{key: 'ds:1', .*?data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s) ||
              data.match(/AF_initDataCallback\(\{key: 'ds:1', hash: '[^']+', data:(\[.*?\]), sideChannel: \{.*?\}\}\);/s);

if (match) {
  const parsedData = JSON.parse(match[1]);
  const mediaItems = parsedData[1];
  
  const types = {};
  for (let item of mediaItems) {
      const typeFlag = item[1]?.[8]?.[2] || 'unknown';
      types[typeFlag] = (types[typeFlag] || 0) + 1;
  }
  console.log("Distribution of item[1][8][2]:", types);

  // Let's also check if there's any other indicator, like length of item array
  const lengths = {};
  for (let item of mediaItems) {
      lengths[item.length] = (lengths[item.length] || 0) + 1;
  }
  console.log("Distribution of item lengths:", lengths);
  
  // Find ANY item where the array at index 1 is different
  for (let item of mediaItems) {
      if (item[1]?.[8]?.[2] !== 1) {
          console.log("\nFound anomalous item!", item[1]?.[8]?.[2]);
          console.log(JSON.stringify(item));
      }
  }

}
