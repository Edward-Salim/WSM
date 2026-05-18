import https from 'https';

const url_dv = "https://lh3.googleusercontent.com/pw/AP1GczOwe6JoaZWefmvdht2PsRTrLq3gndkWpSAuLcK-MPzo6NjgaLPVam0aKeBWMYtPm5csEaJMg8wfm-B9JIbGXL1xkOvYbLL0i6_2_3gxNTHCjGdrQls3=dv";

https.get(url_dv, (res) => {
   console.log(`=dv HTTP ${res.statusCode}`);
   console.log(`Location: ${res.headers.location}`);
   
   if (res.statusCode === 302 && res.headers.location) {
       https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
           console.log(`\nRedirect HTTP ${res2.statusCode}`);
           console.log(`Content-Type: ${res2.headers['content-type']}`);
       });
   }
});
