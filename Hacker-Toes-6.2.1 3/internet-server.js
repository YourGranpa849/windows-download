import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validPublicUrl} from './access.js';

const root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=process.env.DATA_DIR||path.join(root,'data');
const toolsDir=process.env.TOOLS_DIR||path.join(root,'tools');
const port=Number(process.env.PORT||5050);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be a number from 1 to 65535.');
const local=`http://127.0.0.1:${port}`;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let appProcess,tunnelProcess,stopping=false;
fs.mkdirSync(dataDir,{recursive:true});
const configPath=process.env.INTERNET_CONFIG_PATH||path.join(root,'internet.config.json');
const config=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8')):{mode:'quick'};
if(!['quick','named'].includes(config.mode))throw Error('internet.config.json mode must be quick or named.');
const configuredUrl=config.mode==='named'?validPublicUrl(config.publicUrl):'';
if(config.mode==='named'&&!configuredUrl)throw Error('Set a valid HTTPS publicUrl in internet.config.json. See INTERNET-SETUP.md.');
const tokenFile=config.mode==='named'?(process.env.CLOUDFLARE_TOKEN_FILE||path.resolve(dataDir,path.basename(config.tokenFile||'cloudflare-token.txt'))):'';
if(config.mode==='named'&&!fs.existsSync(tokenFile))throw Error('Save your Cloudflare tunnel token in '+tokenFile+'. See INTERNET-SETUP.md.');
const localInfo=async()=>{try{const r=await fetch(local+'/api/info',{signal:AbortSignal.timeout(1500)});return r.ok?await r.json():null;}catch{return null;}};
function openLocal(){const u=`http://localhost:${port}`;if(process.env.OPEN_BROWSER==='0')return;if(process.platform==='win32')spawn('cmd.exe',['/c','start','',u],{stdio:'ignore'});else if(process.platform==='darwin')spawn('open',[u],{stdio:'ignore'});}
async function ensureConnector(){
  const custom=process.env.CLOUDFLARED_PATH;
  if(custom){execFileSync(custom,['--version'],{stdio:'ignore'});return custom;}
  const executable=path.join(toolsDir,process.platform==='win32'?'cloudflared.exe':'cloudflared');
  const recordPath=path.join(toolsDir,'cloudflared-download.json');
  if(fs.existsSync(executable)&&fs.existsSync(recordPath)){
    const record=JSON.parse(fs.readFileSync(recordPath,'utf8'));
    if(Date.now()-record.downloaded<180*86400000&&createHash('sha256').update(fs.readFileSync(executable)).digest('hex')===record.executableSha)return executable;
  }
  fs.mkdirSync(toolsDir,{recursive:true});
  console.log('Installing the Cloudflare connector from its official GitHub release…');
  const releaseResponse=await fetch('https://api.github.com/repos/cloudflare/cloudflared/releases/latest',{headers:{Accept:'application/vnd.github+json','User-Agent':'Hacker-Toes-6.0'},signal:AbortSignal.timeout(30000)});
  if(!releaseResponse.ok)throw Error('Could not look up the Cloudflare download. Check your internet connection.');
  const release=await releaseResponse.json();
  const name=process.platform==='win32'?(process.arch==='ia32'?'cloudflared-windows-386.exe':'cloudflared-windows-amd64.exe'):process.platform==='darwin'?`cloudflared-darwin-${process.arch==='arm64'?'arm64':'amd64'}.tgz`:`cloudflared-linux-${process.arch==='arm64'?'arm64':'amd64'}`;
  const asset=release.assets.find(a=>a.name===name);
  if(!asset)throw Error('No compatible official Cloudflare connector was found for this computer.');
  let expected=asset.digest?.startsWith('sha256:')?asset.digest.slice(7):null;
  if(!expected){const line=(release.body||'').split('\n').find(line=>line.includes(name+':'));expected=line?.match(/\b[a-f0-9]{64}\b/i)?.[0];}
  if(!expected)throw Error('The official release did not include a SHA-256 checksum. Download and verify cloudflared manually, then set CLOUDFLARED_PATH.');
  const response=await fetch(asset.browser_download_url,{signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw Error('Cloudflare download failed: '+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(createHash('sha256').update(bytes).digest('hex')!==expected.toLowerCase())throw Error('Cloudflare download verification failed. No downloaded code was run.');
  if(name.endsWith('.tgz')){const archive=path.join(toolsDir,'cloudflared.tgz');fs.writeFileSync(archive,bytes);execFileSync('tar',['-xzf',archive,'-C',toolsDir,'cloudflared']);fs.rmSync(archive,{force:true});}
  else fs.writeFileSync(executable,bytes);
  if(process.platform!=='win32')fs.chmodSync(executable,0o755);
  const executableSha=createHash('sha256').update(fs.readFileSync(executable)).digest('hex');
  fs.writeFileSync(recordPath,JSON.stringify({version:release.tag_name,downloaded:Date.now(),asset:name,sha256:expected,executableSha},null,2));
  console.log('Cloudflare connector installed and checksum verified.');return executable;
}
async function stop(){if(stopping)return;stopping=true;if(tunnelProcess&&!tunnelProcess.killed)tunnelProcess.kill();if(appProcess&&!appProcess.killed){try{const control=JSON.parse(fs.readFileSync(path.join(dataDir,'host-control.json'),'utf8'));await fetch(local+'/api/host/stop',{method:'POST',headers:{Authorization:'Bearer '+control.token},signal:AbortSignal.timeout(2000)});}catch{}if(process.platform!=='win32')appProcess.kill('SIGTERM');}setTimeout(()=>process.exit(0),500).unref();}
async function setPublicUrl(url){const control=JSON.parse(fs.readFileSync(path.join(dataDir,'host-control.json'),'utf8'));const r=await fetch(local+'/api/host/remote-url',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+control.token},body:JSON.stringify({url})});if(!r.ok)throw Error('Could not register the internet address with the host.');}
async function main(){
  console.log('\nHACKER TOES 6.0 — INTERNET SERVER\n');
  const existing=await localInfo();
  if(existing){if(!existing.remoteMode)throw Error('The local-only host is already running. Stop it with Stop Hacker Toes, then start Internet Server again.');if(existing.publicUrl){console.log('An internet host is already running: '+existing.publicUrl+'\nOpen Invite people in the host app to copy the private invite link.');openLocal();return;}throw Error('Another host is starting. Wait for it, or stop it before trying again.');}
  appProcess=spawn(process.execPath,[path.join(root,'server.js')],{cwd:process.env.APP_WORKING_DIR||process.cwd(),env:{...process.env,PORT:String(port),DATA_DIR:dataDir,REMOTE_MODE:'1',PUBLIC_URL:configuredUrl||'',OPEN_BROWSER:'0'},stdio:['ignore','pipe','pipe']});
  appProcess.stdout.on('data',chunk=>process.stdout.write(chunk));appProcess.stderr.on('data',chunk=>process.stderr.write(chunk));
  appProcess.on('error',e=>{console.error('Host failed: '+e.message);stop();});appProcess.on('exit',()=>{if(!stopping){console.log('Host stopped. Closing the internet connection.');stop();}});
  let ready=false;for(let i=0;i<60;i++){if(await localInfo()){ready=true;break;}if(appProcess.exitCode!==null)break;await pause(250);}if(!ready)throw Error('The chat host did not start.');
  console.log(`\nLocal host access is ready: http://localhost:${port}\nThe desktop app can use this local address even if the internet tunnel is unavailable.\n`);
  openLocal();
  let connector;
  try { connector=await ensureConnector(); }
  catch(e) { console.error('The local Hacker Toes host is running, but the Cloudflare connector could not be started: '+e.message); console.error('Check the network or connector settings. The local app remains available.'); return; }
  console.log(config.mode==='quick'?'Opening a temporary HTTPS tunnel. The address changes when you restart.':'Connecting your permanent HTTPS address.');
  const args=config.mode==='named'?['tunnel','--no-autoupdate','run','--token-file',tokenFile]:['tunnel','--no-autoupdate','--url',local];
  if(process.env.TUNNEL_PROTOCOL)args.splice(2,0,'--protocol',process.env.TUNNEL_PROTOCOL);
  tunnelProcess=spawn(connector,args,{cwd:dataDir,stdio:['ignore','pipe','pipe']});
  const log=fs.createWriteStream(path.join(dataDir,'internet-server.log'),{flags:'a',mode:0o600});
  let printed=false,buffer='';
  const announce=async(url)=>{if(printed)return;printed=true;await setPublicUrl(url);const info=await localInfo();const guestSteps=info?.requiresJoinCode?'Share this website address and the four-digit join code with guests.':'Open Invite people and copy the full private invite link for guests.';console.log(`\nInternet address: ${url}\n${guestSteps}\n\nKeep this window and your PC running. Ctrl+C stops the host and tunnel.\n`);};
  function output(chunk){const line=chunk.toString();log.write(line);buffer=(buffer+line).slice(-16000);if(config.mode==='quick'){const found=buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/);if(found)announce(found[0]).catch(e=>{console.error(e.message);stop();});}else if(/Registered tunnel connection/.test(buffer))announce(configuredUrl).catch(e=>{console.error(e.message);stop();});if(/ERR|WRN/.test(line))process.stderr.write(line);}
  tunnelProcess.stdout.on('data',output);tunnelProcess.stderr.on('data',output);tunnelProcess.on('error',e=>{console.error('Tunnel failed: '+e.message+'\nThe local app remains available at http://localhost:'+port+'.');tunnelProcess=null;});tunnelProcess.on('exit',(code)=>{log.end();tunnelProcess=null;if(!stopping){console.error('The internet tunnel stopped ('+code+'). The local app remains available at http://localhost:'+port+'. Check data/internet-server.log and your network administrator for outbound tunnel access.');}});
  const watch=setInterval(async()=>{if(stopping){clearInterval(watch);return;}if(!await localInfo()){console.log('Host stopped. Closing the tunnel.');clearInterval(watch);stop();}},5000);watch.unref();
}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
main().catch(e=>{console.error('\n'+e.message+'\nSee INTERNET-SETUP.md for help.');if(appProcess||tunnelProcess)stop();else process.exitCode=1;});
