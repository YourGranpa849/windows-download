import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {features} from '../src/features.js';

let server,dir,url,owner,alice,bob,outsider;
const clients=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(extra={}){server=spawn(process.execPath,['server.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',DATA_DIR:dir,HOST:'127.0.0.1',...extra},stdio:['ignore','pipe','pipe']});url=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Server did not start: '+output)),10000);server.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/localhost:(\d+)/);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1]);}});server.stderr.on('data',chunk=>{output+=chunk;});server.once('error',reject);server.once('exit',code=>{if(code)reject(Error(output));});});}
async function stop(){for(const c of clients)c.socket?.disconnect();if(server?.exitCode===null){const exited=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');await exited;}}
async function join(name,token){const r=await fetch(url+'/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,token})});const body=await r.json();assert.equal(r.status,200,body.error);return body;}
async function connect(session){const client={...session,state:null};client.socket=io(url,{auth:{token:session.token},transports:['websocket'],reconnection:false,autoConnect:false,forceNew:true,timeout:5000});client.socket.on('state',s=>client.state=s);const ready=new Promise((resolve,reject)=>{client.socket.once('state',resolve);client.socket.once('connect_error',e=>reject(Error(session.user.name+': '+e.message)));});client.socket.connect();await ready;clients.push(client);return client;}
const action=(c,type,payload={})=>new Promise((resolve,reject)=>c.socket.timeout(5000).emit('action',{type,payload},(err,r)=>err?reject(err):resolve(r)));
async function ok(c,type,p={}){const r=await action(c,type,p);assert.equal(r.ok,true,r.error);return r.result;}
async function denied(c,type,p={},match){const r=await action(c,type,p);assert.equal(r.ok,false);if(match)assert.match(r.error,match);}
async function settle(){await delay(35);}
before(async()=>{dir=await mkdtemp(path.join(os.tmpdir(),'hacker-toes-test-'));await boot();owner=await connect(await join('Host'));alice=await connect(await join('Alice'));bob=await connect(await join('Bob'));outsider=await connect(await join('Outsider'));});
after(async()=>{await stop();await rm(dir,{recursive:true,force:true});});

test('at least 100 documented, uniquely named features',()=>{assert.ok(features.length>=100);assert.equal(new Set(features.map(f=>f.name)).size,features.length);});
test('health, LAN information, and host identity',async()=>{assert.equal((await(await fetch(url+'/api/health')).json()).ok,true);assert.equal(owner.state.me.role,'owner');assert.equal(alice.state.me.role,'member');assert.ok((await(await fetch(url+'/api/info')).json()).addresses instanceof Array);});
test('host stop requires the separate host computer control secret',async()=>{assert.equal((await fetch(url+'/api/host/stop',{method:'POST'})).status,403);assert.equal((await fetch(url+'/api/host/stop',{method:'POST',headers:{Authorization:'Bearer '+owner.token}})).status,403);});
test('name-only session can be restored without creating another user',async()=>{const restored=await join('',alice.token);assert.equal(restored.user.id,alice.user.id);assert.equal(restored.token,alice.token);});
test('session secrets never appear in snapshots or exports',async()=>{const exported=await(await fetch(url+'/api/export',{headers:{Authorization:'Bearer '+alice.token}})).json();const serialized=JSON.stringify(exported);assert.ok(!serialized.includes('tokenHash'));assert.ok(!serialized.includes(owner.token));assert.ok(!serialized.includes(alice.token));});
test('unauthenticated clients and cross-origin browser requests are rejected',async()=>{assert.equal((await fetch(url+'/api/export')).status,401);assert.equal((await fetch(url+'/api/join',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://unrelated.example'},body:JSON.stringify({name:'Cross origin'})})).status,403);const bad=io(url,{auth:{token:'not-a-session'},transports:['websocket'],reconnection:false});const error=await new Promise(r=>bad.once('connect_error',r));assert.match(error.message,/session/);bad.disconnect();});
test('real-time messages arrive at another client and retry IDs prevent duplicates',async()=>{const received=new Promise(r=>bob.socket.once('message:new',r));const m=await ok(alice,'message:send',{channel:'general',text:'Hello network',clientId:'retry-proof-1'});assert.equal((await received).id,m.id);const duplicate=await ok(alice,'message:send',{channel:'general',text:'Hello network',clientId:'retry-proof-1'});assert.equal(duplicate.id,m.id);assert.equal(owner.state.messages.filter(x=>x.id===m.id).length,1);});
test('only authors edit messages; author edits and deletions synchronize',async()=>{const m=await ok(alice,'message:send',{channel:'general',text:'Before'});await denied(bob,'message:edit',{id:m.id,text:'Hijacked'},/own/);await ok(alice,'message:edit',{id:m.id,text:'After'});await settle();assert.equal(bob.state.messages.find(x=>x.id===m.id).text,'After');assert.ok(bob.state.messages.find(x=>x.id===m.id).edited);await ok(alice,'message:delete',{id:m.id});await settle();assert.equal(bob.state.messages.find(x=>x.id===m.id).deleted,true);});
test('private channel content, metadata, tasks, and membership are isolated',async()=>{const c=await ok(alice,'channel:create',{name:'private-lab',private:true,members:[bob.user.id],category:'LAB'});const m=await ok(alice,'message:send',{channel:c.id,text:'Only Alice and Bob'});await ok(alice,'task:create',{channel:c.id,title:'Private task'});await settle();assert.ok(bob.state.channels.some(x=>x.id===c.id));assert.ok(!outsider.state.channels.some(x=>x.id===c.id));assert.ok(!outsider.state.messages.some(x=>x.id===m.id));assert.ok(!owner.state.messages.some(x=>x.id===m.id));await denied(outsider,'message:send',{channel:c.id,text:'Sneak in'},/not found/);await denied(outsider,'message:react',{id:m.id,emoji:'👍'},/not found/);await ok(alice,'channel:update',{id:c.id,members:[]});await settle();assert.ok(!bob.state.channels.some(x=>x.id===c.id));assert.ok(!bob.state.tasks.some(t=>t.channel===c.id));});
test('direct and group conversations are private and existing DMs are reused',async()=>{const dm=await ok(alice,'dm:create',{users:[bob.user.id]});const same=await ok(bob,'dm:create',{users:[alice.user.id]});assert.equal(same.id,dm.id);const m=await ok(bob,'message:send',{channel:dm.id,text:'A direct hello'});await settle();assert.ok(!outsider.state.messages.some(x=>x.id===m.id));const group=await ok(alice,'dm:create',{users:[bob.user.id,outsider.user.id]});assert.equal(group.members.length,3);assert.notEqual(group.id,dm.id);});
test('channel creators can rename, categorize, lock, archive, and delete their channel',async()=>{const c=await ok(alice,'channel:create',{name:'channel-lifecycle'});await denied(bob,'channel:update',{id:c.id,topic:'Hijacked'});await ok(alice,'channel:update',{id:c.id,name:'renamed-lifecycle',topic:'A topic',category:'LAB',readOnly:true});await denied(bob,'message:send',{channel:c.id,text:'Blocked'},/moderators/);await ok(alice,'message:send',{channel:c.id,text:'Allowed creator'});await ok(alice,'channel:update',{id:c.id,archived:true});await denied(alice,'message:send',{channel:c.id,text:'Archived'},/archived/);await ok(alice,'channel:update',{id:c.id,archived:false});await ok(alice,'channel:delete',{id:c.id});await settle();assert.ok(!owner.state.channels.some(x=>x.id===c.id));assert.ok(!owner.state.messages.some(x=>x.channel===c.id));await denied(owner,'channel:delete',{id:'general'});});
test('slow mode throttles regular members while permitting managers',async()=>{const c=await ok(owner,'channel:create',{name:'slow-room'});await ok(owner,'channel:update',{id:c.id,slow:5});await ok(bob,'message:send',{channel:c.id,text:'First'});await denied(bob,'message:send',{channel:c.id,text:'Too soon'},/Slow mode/);await ok(owner,'message:send',{channel:c.id,text:'Manager one'});await ok(owner,'message:send',{channel:c.id,text:'Manager two'});});
test('replies and thread messages keep their parent; cross-channel replies fail',async()=>{const p=await ok(alice,'message:send',{channel:'random',text:'Thread parent'});const reply=await ok(bob,'message:send',{channel:'random',text:'Thread reply',reply:p.id,thread:true});assert.equal(reply.reply,p.id);assert.equal(reply.thread,true);await denied(bob,'message:send',{channel:'general',text:'Wrong channel',reply:p.id},/same channel/);});
test('reactions toggle and pins synchronize',async()=>{const m=await ok(owner,'message:send',{channel:'general',text:'React here'});await ok(bob,'message:react',{id:m.id,emoji:'🔥'});await ok(alice,'message:pin',{id:m.id});await settle();assert.deepEqual(owner.state.messages.find(x=>x.id===m.id).reactions['🔥'],[bob.user.id]);assert.equal(owner.state.messages.find(x=>x.id===m.id).pinned,true);await ok(bob,'message:react',{id:m.id,emoji:'🔥'});await settle();assert.equal(owner.state.messages.find(x=>x.id===m.id).reactions['🔥'],undefined);});
test('polls enforce one vote per option, switch single votes, and respect close state',async()=>{const m=await ok(alice,'message:send',{channel:'general',poll:{question:'Lunch?',options:['Pizza','Tacos']}});await ok(bob,'poll:vote',{id:m.id,option:0});await ok(bob,'poll:vote',{id:m.id,option:1});await settle();assert.deepEqual(owner.state.messages.find(x=>x.id===m.id).poll.votes[bob.user.id],[1]);await denied(outsider,'poll:close',{id:m.id});await ok(alice,'poll:close',{id:m.id});await denied(bob,'poll:vote',{id:m.id,option:0},/closed/);await ok(alice,'poll:close',{id:m.id});await ok(bob,'poll:vote',{id:m.id,option:1});await settle();assert.deepEqual(owner.state.messages.find(x=>x.id===m.id).poll.votes[bob.user.id],[]);});
test('multiple-choice polls preserve distinct options and reject invalid options',async()=>{const m=await ok(owner,'message:send',{channel:'projects',poll:{question:'Activities?',options:['Build','Play','Read'],multiple:true}});await ok(bob,'poll:vote',{id:m.id,option:0});await ok(bob,'poll:vote',{id:m.id,option:2});await settle();assert.deepEqual(owner.state.messages.find(x=>x.id===m.id).poll.votes[bob.user.id],[0,2]);await denied(bob,'poll:vote',{id:m.id,option:9});});
test('tasks store assignments and due dates, can be completed, and enforce deletion rights',async()=>{const t=await ok(alice,'task:create',{channel:'projects',title:'Ship the app',assignee:bob.user.id,due:'2026-12-01'});assert.equal(t.assignee,bob.user.id);assert.equal(t.due,'2026-12-01');await ok(bob,'task:update',{id:t.id,done:true});await settle();assert.equal(alice.state.tasks.find(x=>x.id===t.id).done,true);await denied(bob,'task:delete',{id:t.id});await ok(alice,'task:delete',{id:t.id});});
test('private notes are never exposed to another guest or host snapshot',async()=>{await ok(alice,'notes:save',{text:'A private thought'});await settle();assert.equal(alice.state.notes,'A private thought');assert.ok(!JSON.stringify(bob.state).includes('A private thought'));assert.ok(!JSON.stringify(owner.state).includes('A private thought'));});
test('profile settings synchronize and invisible presence is hidden',async()=>{await ok(bob,'profile:update',{name:'Bobby',bio:'Hello!',emoji:'🐸',color:'#7dd3fc',customStatus:'Building things',status:'invisible'});await settle();const u=owner.state.users.find(u=>u.id===bob.user.id);assert.equal(u.name,'Bobby');assert.equal(u.emoji,'🐸');assert.equal(u.online,false);await ok(bob,'profile:update',{status:'online'});});
test('uploads are authenticated and private attachments cannot be downloaded by outsiders',async()=>{const c=await ok(owner,'channel:create',{name:'private-files',private:true,members:[alice.user.id]});const fd=new FormData();fd.append('file',new Blob(['private contents'],{type:'text/plain'}),'notes.txt');const r=await fetch(url+'/api/upload',{method:'POST',headers:{Authorization:'Bearer '+owner.token},body:fd});assert.equal(r.status,200);const f=await r.json();assert.ok(!Object.hasOwn(f,'disk'));await ok(owner,'message:send',{channel:c.id,text:'A file',attachments:[f.id]});assert.equal((await fetch(url+'/files/'+f.id,{headers:{Authorization:'Bearer '+outsider.token}})).status,404);const download=await fetch(url+'/files/'+f.id,{headers:{Authorization:'Bearer '+alice.token}});assert.equal(download.status,200);assert.match(download.headers.get('content-disposition'),/attachment/);assert.equal(await download.text(),'private contents');await denied(bob,'message:send',{channel:'general',attachments:[f.id]});});
test('unsafe SVG and HTML uploads are forced to download, and PNG previews are recognized',async()=>{for(const [name,type,content] of [['test.svg','image/svg+xml','<svg onload="alert(1)"/>'],['test.html','text/html','<script>alert(1)</script>']]){const fd=new FormData();fd.append('file',new Blob([content],{type}),name);const f=await(await fetch(url+'/api/upload',{method:'POST',headers:{Authorization:'Bearer '+alice.token},body:fd})).json();assert.equal(f.mime,'application/octet-stream');const r=await fetch(url+'/files/'+f.id,{headers:{Authorization:'Bearer '+alice.token}});assert.match(r.headers.get('content-disposition'),/attachment/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');}const fd=new FormData();fd.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')],{type:'image/png'}),'pixel.png');const png=await(await fetch(url+'/api/upload',{method:'POST',headers:{Authorization:'Bearer '+alice.token},body:fd})).json();assert.equal(png.mime,'image/png');});
test('moderation enforces roles, timeouts, and host protection',async()=>{await denied(alice,'workspace:update',{name:'Hijacked'});await denied(alice,'member:moderate',{id:bob.user.id,action:'timeout'});await ok(owner,'member:moderate',{id:alice.user.id,action:'role'});await ok(alice,'member:moderate',{id:bob.user.id,action:'timeout'});await denied(bob,'message:send',{channel:'general',text:'Timed out'},/timed out/);await denied(alice,'member:moderate',{id:owner.user.id,action:'timeout'});await denied(alice,'member:moderate',{id:bob.user.id,action:'role'});await ok(owner,'member:moderate',{id:bob.user.id,action:'unmute'});await ok(bob,'message:send',{channel:'general',text:'Back again'});await ok(owner,'member:moderate',{id:alice.user.id,action:'role'});});
test('workspace settings and moderation audit are visible only as intended',async()=>{await ok(owner,'workspace:update',{name:'Test hangout',description:'Temporary test workspace',locked:true});await settle();assert.equal(bob.state.settings.locked,true);assert.equal(bob.state.audit.length,0);assert.ok(owner.state.audit.length>0);await ok(owner,'workspace:update',{locked:false});});
test('typing events reach eligible members',async()=>{const got=new Promise(r=>bob.socket.once('typing',r));alice.socket.emit('typing','general');const event=await got;assert.equal(event.user,alice.user.id);assert.equal(event.channel,'general');});
test('scheduled messages can be cancelled and are sent after their due time',async()=>{const cancelled=await ok(owner,'message:send',{channel:'general',text:'Never send',scheduledAt:Date.now()+60000});assert.ok(owner.state.scheduled.some(m=>m.id===cancelled.id));await ok(owner,'schedule:delete',{id:cancelled.id});await settle();assert.ok(!owner.state.scheduled.some(m=>m.id===cancelled.id));const m=await ok(owner,'message:send',{channel:'general',text:'Scheduled delivery',scheduledAt:Date.now()+5200});assert.ok(!bob.state.messages.some(x=>x.id===m.id));await delay(6400);assert.ok(bob.state.messages.some(x=>x.id===m.id));assert.ok(!owner.state.scheduled.some(x=>x.id===m.id));});
test('invalid scheduled timestamps are rejected instead of creating undeliverable messages',async()=>{await denied(owner,'message:send',{channel:'general',text:'Bad date',scheduledAt:'invalid-date'},/Schedule/);});
test('removed sessions disconnect and cannot authenticate again',async()=>{await ok(owner,'member:moderate',{id:outsider.user.id,action:'remove'});await settle();assert.equal(outsider.socket.connected,false);const r=await fetch(url+'/api/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:outsider.token})});assert.equal(r.status,400);});

test('soundboard uploads are authenticated and remote playback targets one opted-in listener',async()=>{
 const wav=new Uint8Array(44);wav.set([82,73,70,70],0);wav.set([87,65,86,69],8);
 const form=new FormData();form.append('file',new Blob([wav],{type:'audio/wav'}),'test.wav');form.append('category','Memes & clips');
 const uploaded=await fetch(url+'/api/sounds',{method:'POST',headers:{Authorization:'Bearer '+alice.token},body:form});
 const sound=await uploaded.json();assert.equal(uploaded.status,200,sound.error);assert.equal(sound.user,alice.user.id);assert.equal(sound.category,'Memes & clips');
 assert.equal((await fetch(url+'/sounds/'+sound.id)).status,401);
 assert.equal((await fetch(url+'/sounds/'+sound.id,{headers:{Authorization:'Bearer '+alice.token}})).status,200);
 await ok(bob,'soundboard:settings',{receive:false});
 const blocked=await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:play',{soundId:sound.id,target:bob.user.id,volume:75},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(blocked.ok,false);assert.match(blocked.error,/turned off/);
 await ok(bob,'soundboard:settings',{receive:true,muted:false});
 const received=new Promise(resolve=>bob.socket.once('sound:play',resolve));
 const sent=await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:play',{soundId:sound.id,target:bob.user.id,volume:65},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(sent.ok,true,sent.error);const event=await received;assert.equal(event.from.id,alice.user.id);assert.equal(event.volume,65);assert.equal(event.url,'/sounds/'+sound.id);assert.equal(event.remoteVolumeControl,false);assert.equal(event.remoteTransportControl,false);assert.equal(event.minigame,false);assert.equal(event.monitorShare,false);
 const withoutOptIn=await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:volume',{playbackId:sent.playback.playbackId,volume:80},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(withoutOptIn.ok,false);assert.match(withoutOptIn.error,/not enabled/);
 const transportWithoutOptIn=await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:transport',{playbackId:sent.playback.playbackId,action:'pause'},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));assert.equal(transportWithoutOptIn.ok,false);assert.match(transportWithoutOptIn.error,/not enabled/);
 await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:stop',{playbackId:sent.playback.playbackId},(err,r)=>resolve(r)));
 await delay(3100);
 await ok(bob,'soundboard:settings',{remoteVolumeControl:true,remoteTransportControl:true,minigame:true,monitorShare:true,maxVolume:150});
 const boostedReceived=new Promise(resolve=>bob.socket.once('sound:play',resolve));
 const boosted=await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:play',{soundId:sound.id,target:bob.user.id,volume:150,volumeMode:'detention',overdrive:true},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 const boostedEvent=await boostedReceived;assert.equal(boosted.ok,true,boosted.error);assert.equal(boostedEvent.volume,150);assert.equal(boosted.playback.overdrive,true);assert.equal(boostedEvent.remoteVolumeControl,true);assert.equal(boostedEvent.remoteTransportControl,true);assert.equal(boostedEvent.minigame,true);assert.equal(boostedEvent.monitorShare,true);assert.equal(boostedEvent.maxVolume,150);
 const remoteVolumeEvent=new Promise(resolve=>bob.socket.once('sound:volume',resolve));
 const changed=await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:volume',{playbackId:boosted.playback.playbackId,volume:120},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(changed.ok,true,changed.error);assert.equal((await remoteVolumeEvent).volume,120);
 const pausedEvent=new Promise(resolve=>bob.socket.once('sound:transport',resolve));
 const paused=await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:transport',{playbackId:boosted.playback.playbackId,action:'pause'},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(paused.ok,true,paused.error);assert.equal(paused.playback.state,'paused');assert.equal((await pausedEvent).action,'pause');
 const stolenControl=await new Promise(resolve=>owner.socket.timeout(3000).emit('sound:transport',{playbackId:boosted.playback.playbackId,action:'resume'},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(stolenControl.ok,false);assert.match(stolenControl.error,/Only the person who sent/);
 const stolenStop=await new Promise(resolve=>owner.socket.timeout(3000).emit('sound:stop',{playbackId:boosted.playback.playbackId},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));assert.equal(stolenStop.ok,false);assert.match(stolenStop.error,/cannot stop/);
 const resumedEvent=new Promise(resolve=>bob.socket.once('sound:transport',resolve));
 const resumed=await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:transport',{playbackId:boosted.playback.playbackId,action:'resume'},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(resumed.ok,true,resumed.error);assert.equal(resumed.playback.state,'playing');assert.equal((await resumedEvent).action,'resume');
 const challengeRestarted=new Promise(resolve=>bob.socket.once('sound:minigame:control',resolve));
 const restarted=await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:minigame:control',{playbackId:boosted.playback.playbackId,action:'restart'},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(restarted.ok,true,restarted.error);assert.equal((await challengeRestarted).action,'restart');
 const challengeProgress=new Promise(resolve=>alice.socket.once('sound:minigame:progress',resolve));
 const progress=await new Promise(resolve=>bob.socket.timeout(3000).emit('sound:minigame:progress',{playbackId:boosted.playback.playbackId,hits:2,missed:1},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(progress.ok,true,progress.error);assert.equal((await challengeProgress).hits,2);
 const stolenChallenge=await new Promise(resolve=>owner.socket.timeout(3000).emit('sound:minigame:control',{playbackId:boosted.playback.playbackId,action:'restart'},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(stolenChallenge.ok,false);assert.match(stolenChallenge.error,/Only the person who sent/);

 const monitorEvent=new Promise(resolve=>alice.socket.once('sound:monitor',resolve));
 const monitor=await new Promise(resolve=>bob.socket.timeout(3000).emit('sound:monitor',{playbackId:boosted.playback.playbackId,playbackVolume:120,outputLabel:'Built-in Output'},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(monitor.ok,true,monitor.error);const monitorReport=await monitorEvent;assert.equal(monitorReport.playbackVolume,120);assert.equal(monitorReport.outputLabel,'Built-in Output');assert.equal(monitorReport.systemVolumeAvailable,false);
 const spoofedMonitor=await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:monitor',{playbackId:boosted.playback.playbackId,playbackVolume:150,outputLabel:'Fake'},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(spoofedMonitor.ok,false);
 const stoppedByRecipient=new Promise(resolve=>alice.socket.once('sound:stop',resolve));
 await new Promise(resolve=>bob.socket.timeout(3000).emit('sound:stop',{playbackId:boosted.playback.playbackId},(err,r)=>resolve(r)));
 assert.equal((await stoppedByRecipient).reason,'stopped');
 await delay(3100);
 const normalVolumeReceived=new Promise(resolve=>bob.socket.once('sound:play',resolve));
 const normalVolume=await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:play',{soundId:sound.id,target:bob.user.id,volume:100,volumeMode:'detention',overdrive:false},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 const normalEvent=await normalVolumeReceived;assert.equal(normalVolume.ok,true,normalVolume.error);assert.equal(normalEvent.recipientMaxVolume,150);assert.equal(normalEvent.maxVolume,100);
 const stopNormal=new Promise(resolve=>bob.socket.once('sound:stop',resolve));await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:stop',{playbackId:normalVolume.playback.playbackId},(err,r)=>resolve(r)));assert.equal((await stopNormal).reason,'stopped');
 await delay(3100);
 const belowFloor=await new Promise(resolve=>alice.socket.timeout(3000).emit('sound:play',{soundId:sound.id,target:bob.user.id,volume:39,volumeMode:'tuff',overdrive:true},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(belowFloor.ok,false);assert.match(belowFloor.error,/40%/);
 await ok(alice,'sound:category',{id:sound.id,category:'Favourite noises'});await settle();assert.equal(alice.state.sounds.find(s=>s.id===sound.id).category,'Favourite noises');
 await ok(alice,'sound:delete',{id:sound.id});
});

test('voice calls are one-to-one and relay signalling/audio only reaches the other participant',async()=>{
 const incoming=new Promise(resolve=>bob.socket.once('call:incoming',resolve));
 const invited=await new Promise(resolve=>alice.socket.timeout(3000).emit('call:invite',{to:bob.user.id},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(invited.ok,true,invited.error);const invite=await incoming;assert.equal(invite.callId,invited.callId);assert.equal(invite.from.id,alice.user.id);
 const acceptedA=new Promise(resolve=>alice.socket.once('call:accepted',resolve));const acceptedB=new Promise(resolve=>bob.socket.once('call:accepted',resolve));
 const accepted=await new Promise(resolve=>bob.socket.timeout(3000).emit('call:accept',{callId:invite.callId},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(accepted.ok,true,accepted.error);assert.equal((await acceptedA).initiator,true);assert.equal((await acceptedB).initiator,false);
 const videoSignal=new Promise(resolve=>bob.socket.once('call:signal',resolve));const videoSdp='v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=mid:1\r\n'+('a=x-test-padding:1234567890\r\n'.repeat(1500));alice.socket.emit('call:signal',{callId:invite.callId,data:{kind:'offer',sdp:videoSdp}});const relayedVideo=await videoSignal;assert.equal(relayedVideo.data.kind,'offer');assert.ok(relayedVideo.data.sdp.includes('m=video'));assert.equal(relayedVideo.data.sdp.length,videoSdp.length);
 const signal=new Promise(resolve=>bob.socket.once('call:signal',resolve));alice.socket.emit('call:signal',{callId:invite.callId,data:{kind:'relay'}});assert.equal((await signal).data.kind,'relay');
 const audio=new Promise(resolve=>bob.socket.once('call:audio',resolve));alice.socket.emit('call:audio',{callId:invite.callId,pcm:new Uint8Array(320).buffer});const packet=await audio;assert.equal(packet.callId,invite.callId);assert.equal(packet.pcm.byteLength||packet.pcm.length,320);
 const endedA=new Promise(resolve=>alice.socket.once('call:ended',resolve));const endedB=new Promise(resolve=>bob.socket.once('call:ended',resolve));
 const ended=await new Promise(resolve=>alice.socket.timeout(3000).emit('call:end',{callId:invite.callId},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(ended.ok,true,ended.error);assert.equal((await endedA).reason,'ended');assert.equal((await endedB).reason,'ended');
});

test('data survives a full server restart and restored sessions still work',async()=>{const m=await ok(owner,'message:send',{channel:'general',text:'Persist across restart'});const ownerSession={token:owner.token,user:owner.user};await stop();const disk=JSON.parse(await readFile(path.join(dir,'workspace.json'),'utf8'));assert.ok(disk.messages.some(x=>x.id===m.id));assert.ok(!JSON.stringify(disk).includes(owner.token));await boot();const restored=await connect(await join('',ownerSession.token));assert.equal(restored.state.me.id,ownerSession.user.id);assert.ok(restored.state.messages.some(x=>x.id===m.id));assert.equal(restored.state.settings.name,'Test hangout');});


test('internet mode rejects uninvited guests, protects host role through the proxy, and rotates invitations',async()=>{
  await stop(); await boot({REMOTE_MODE:'1'});
  const host=await connect(await join('',owner.token));
  const headers={'Content-Type':'application/json','CF-Connecting-IP':'198.51.100.45','X-Forwarded-Proto':'https','Host':'chat.example.test'};
  assert.equal((await fetch(url+'/api/info',{headers:{'CF-Connecting-IP':'198.51.100.45','X-Forwarded-Proto':'http'}})).status,403);
  const remoteJoin=body=>fetch(url+'/api/join',{method:'POST',headers,body:JSON.stringify(body)});
  let r=await remoteJoin({name:'Remote guest'});assert.equal(r.status,400);
  r=await remoteJoin({name:'Remote guest',invite:'incorrect'});assert.equal(r.status,400);
  const invite=JSON.parse(await readFile(path.join(dir,'remote-access.json'),'utf8')).inviteKey;
  r=await remoteJoin({name:'Remote guest',invite});assert.equal(r.status,200);
  assert.match(r.headers.get('set-cookie'),/Secure/);const remote=await r.json();assert.equal(remote.user.role,'member');
  const info=await(await fetch(url+'/api/info',{headers})).json();assert.equal(info.requiresInvite,true);assert.equal(info.hostLocal,false);assert.deepEqual(info.addresses,[]);assert.equal(info.inviteKey,undefined);
  const guest=await connect(remote);await ok(guest,'message:send',{channel:'general',text:'Across the internet'});await settle();assert.ok(host.state.messages.some(m=>m.text==='Across the internet'));
  const hostControl=JSON.parse(await readFile(path.join(dir,'host-control.json'),'utf8'));
  assert.equal((await fetch(url+'/api/host/stop',{method:'POST',headers:{...headers,Authorization:'Bearer '+hostControl.token}})).status,403);
  await denied(guest,'invite:rotate');await ok(host,'invite:rotate');
  assert.equal((await remoteJoin({name:'Old invitation',invite})).status,400);
  assert.equal((await remoteJoin({token:remote.token})).status,200);
  const renewed=await(await fetch(url+'/api/invite',{headers:{Authorization:'Bearer '+host.token}})).json();assert.notEqual(renewed.inviteKey,invite);
});


test('sound sending has no recipient-wide 10-per-10-minute quota and retains a per-sender cooldown',async()=>{
 await stop();await boot({SOUND_SEND_COOLDOWN_MS:'3000'});
 const sender=await connect(await join('',alice.token));const recipient=await connect(await join('Test Recipient'));
 const wav=new Uint8Array(44);wav.set([82,73,70,70],0);wav.set([87,65,86,69],8);
 const form=new FormData();form.append('file',new Blob([wav],{type:'audio/wav'}),'send-test.wav');
 const uploaded=await fetch(url+'/api/sounds',{method:'POST',headers:{Authorization:'Bearer '+sender.token},body:form});const sound=await uploaded.json();assert.equal(uploaded.status,200,sound.error);
 const emitPlay=()=>new Promise(resolve=>sender.socket.timeout(3000).emit('sound:play',{soundId:sound.id,target:recipient.user.id,volume:65,volumeMode:'detention'},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 const first=await emitPlay();assert.equal(first.ok,true,first.error);assert.equal(first.cooldownMs,3000);
 const tooSoon=await emitPlay();assert.equal(tooSoon.ok,false);assert.match(tooSoon.error,/wait .* seconds/i);
 await stop();await boot({SOUND_SEND_COOLDOWN_MS:'1'});
 const sender2=await connect(await join('',alice.token));const recipient2=await connect(await join('',recipient.token));
 const send=()=>new Promise(resolve=>sender2.socket.timeout(3000).emit('sound:play',{soundId:sound.id,target:recipient2.user.id,volume:65,volumeMode:'detention'},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 for(let i=0;i<15;i++){const result=await send();assert.equal(result.ok,true,`send ${i+1}: ${result.error||''}`);await delay(4);}
});

test('Teacher Alert is targeted, recipient-controlled, expires into an acknowledge action, and can be dismissed by its recipient',async()=>{
 const sender=await connect(await join('',alice.token));const recipient=await connect(await join('',owner.token));const other=await connect(await join('',bob.token));
 const incoming=new Promise(resolve=>recipient.socket.once('teacher-alert:incoming',resolve));
 const sent=await new Promise(resolve=>sender.socket.timeout(3000).emit('teacher-alert:send',{target:recipient.user.id},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(sent.ok,true,sent.error);const alert=await incoming;assert.equal(alert.alertId,sent.alertId);assert.equal(alert.from.id,sender.user.id);assert.equal(alert.durationMs,35000);
 const duplicate=await new Promise(resolve=>sender.socket.timeout(3000).emit('teacher-alert:send',{target:recipient.user.id},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(duplicate.ok,false);assert.match(duplicate.error,/already has a Teacher Alert/);
 const unauthorized=await new Promise(resolve=>other.socket.timeout(3000).emit('teacher-alert:dismiss',{alertId:alert.alertId},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(unauthorized.ok,false);
 const dismissedEvent=new Promise(resolve=>sender.socket.once('teacher-alert:dismissed',resolve));
 const dismissed=await new Promise(resolve=>recipient.socket.timeout(3000).emit('teacher-alert:dismiss',{alertId:alert.alertId},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(dismissed.ok,true,dismissed.error);assert.equal((await dismissedEvent).reason,'acknowledged');
 await ok(recipient,'soundboard:settings',{teacherAlertReceive:false});
 const disabled=await new Promise(resolve=>sender.socket.timeout(3000).emit('teacher-alert:send',{target:recipient.user.id},(err,r)=>resolve(err?{ok:false,error:err.message}:r)));
 assert.equal(disabled.ok,false);assert.match(disabled.error,/disabled Teacher Alerts/);
});
