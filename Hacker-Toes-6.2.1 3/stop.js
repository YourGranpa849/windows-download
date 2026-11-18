import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
try {
  const control=JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR||path.join(root,'data'),'host-control.json'),'utf8'));
  const response=await fetch(`http://127.0.0.1:${control.port}/api/host/stop`,{method:'POST',headers:{Authorization:'Bearer '+control.token},signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw Error('The host did not accept the stop request. Use Ctrl+C in its terminal.');
  console.log('Hacker Toes has stopped. Your conversations are saved.');
}catch(e){if(e.code==='ENOENT'||e.cause?.code==='ECONNREFUSED')console.log('Hacker Toes is not running from this folder.');else{console.error(e.message);process.exitCode=1;}}
