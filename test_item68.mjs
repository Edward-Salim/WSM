import https from 'https';

// item 68 base URL:
const baseUrl = "https://lh3.googleusercontent.com/pw/AP1GczPGYA6ztXRNydtRQaeSK3RNNrNofY3Z7OXwmpzYQI48Ua5y65Vv8vJHkrwMav7a5qiaWO2tWR8pd5HqE9E-kEzksiSMyUJ_VYBBfOgtEKdBToBX0voF";

https.get(`${baseUrl}=m22`, (res) => {
    console.log(`=m22: HTTP ${res.statusCode} Content-Type: ${res.headers['content-type']}`);
});

https.get(`${baseUrl}=dv`, (res) => {
    console.log(`=dv: HTTP ${res.statusCode} Content-Type: ${res.headers['content-type']}`);
});
