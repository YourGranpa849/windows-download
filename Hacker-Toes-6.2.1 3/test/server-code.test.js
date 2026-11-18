import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';

test('host-set four digit code gates new guests, stays hashed, and does not block restored sessions',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'ht-code-test-'));
  let server,socket;
  try{
    server=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',DATA_DIR:dir,HOST:'127.0.0.1',REMOTE_MODE:'1'},stdio:['ignore','pipe','pipe']});
    const url=await new Promise((resolve,reject)=>{let out='';const timer=setTimeout(()=>reject(Error(out||'Server startup timeout')),10000);server.stdout.on('data',c=>{out+=c;const m=out.match(/http:\/\/localhost:(\d+)/);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});server.stderr.on('data',c=>out+=c);server.once('error',reject);});
    const hostResponse=await fetch(url+'/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Host'})});
    assert.equal(hostResponse.status,200);const host=await hostResponse.json();
    socket=io(url,{auth:{token:host.token},transports:['websocket'],reconnection:false,timeout:5000});
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
    const initialConfig=JSON.parse(await readFile(path.join(dir,'join-code.json'),'utf8'));assert.equal(initialConfig.enabled,false);assert.equal(initialConfig.hash,'');
    await new Promise((resolve,reject)=>socket.timeout(5000).emit('action',{type:'workspace:update',payload:{joinCode:'4826',joinCodeEnabled:true}},(e,r)=>e?reject(e):r?.ok?resolve():reject(Error(r?.error||'Settings failed'))));
    const info=await(await fetch(url+'/api/info')).json();assert.equal(info.requiresJoinCode,true);assert.equal(info.requiresInvite,false);assert.equal(info.joinCode,undefined);assert.equal(info.accessCode,undefined);
    const headers={'Content-Type':'application/json','x-forwarded-for':'203.0.113.77','x-forwarded-proto':'https'};
    const guestJoin=joinCode=>fetch(url+'/api/join',{method:'POST',headers,body:JSON.stringify({name:'Guest',joinCode})});
    const missing=await guestJoin('');assert.equal(missing.status,400);
    const wrong=await guestJoin('1111');assert.equal(wrong.status,400);assert.match((await wrong.clone().json()).error,/four-digit join code/i);
    const bruteHeaders={...headers,'x-forwarded-for':'203.0.113.88'};let lockedOut=false;for(let attempt=0;attempt<9;attempt++){const r=await fetch(url+'/api/join',{method:'POST',headers:bruteHeaders,body:JSON.stringify({name:'Guess',joinCode:'0000'})});if(attempt===8){assert.equal(r.status,400);assert.match((await r.json()).error,/too fast/i);lockedOut=true;}}assert.equal(lockedOut,true);
    const right=await guestJoin('4826');assert.equal(right.status,200);const guest=await right.json();
    const restored=await fetch(url+'/api/join',{method:'POST',headers,body:JSON.stringify({token:guest.token})});assert.equal(restored.status,200);
    const stored=await readFile(path.join(dir,'join-code.json'),'utf8');assert.ok(!stored.includes('4826'));assert.ok(JSON.parse(stored).hash);
    const settings=JSON.parse(await readFile(path.join(dir,'workspace.json'),'utf8'));assert.equal(JSON.stringify(settings).includes('4826'),false);
    await new Promise((resolve,reject)=>socket.timeout(5000).emit('action',{type:'workspace:update',payload:{joinCodeEnabled:false}},(e,r)=>e?reject(e):r?.ok?resolve():reject(Error(r?.error||'Disable failed'))));
    const disabled=await(await fetch(url+'/api/info')).json();assert.equal(disabled.requiresJoinCode,false);
    socket.disconnect();await new Promise(r=>setTimeout(r,100));
    const recoveredResponse=await fetch(url+'/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({hostRecovery:true,name:'Host recovery'})});
    assert.equal(recoveredResponse.status,200);const recovered=await recoveredResponse.json();
    assert.equal(recovered.user.id,host.user.id);assert.equal(recovered.user.role,'owner');assert.notEqual(recovered.token,host.token);
    const remoteRecovery=await fetch(url+'/api/join',{method:'POST',headers:{'Content-Type':'application/json','x-forwarded-for':'203.0.113.9','x-forwarded-proto':'https'},body:JSON.stringify({hostRecovery:true,name:'Remote takeover'})});
    assert.equal(remoteRecovery.status,400);assert.match((await remoteRecovery.json()).error,/only from localhost/i);
  }finally{
    socket?.disconnect();
    if(server?.exitCode===null){server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));}
    await rm(dir,{recursive:true,force:true});
  }
});
