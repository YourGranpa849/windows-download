import {isIP} from 'node:net';
export const socketIsLocal = req => ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
export function hostName(req){try{return new URL('http://'+req.headers.host).hostname.replace(/^\[|\]$/g,'').toLowerCase();}catch{return '';}}
export const isPrivateHost = host => host==='localhost'||host==='::1'||/^127\./.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host)||host.endsWith('.local');
export const isForwarded = req => !!(req.headers['cf-connecting-ip']||req.headers['cf-ray']||req.headers['x-forwarded-for']||req.headers['forwarded']||req.headers['x-forwarded-host']);
export const hostIsLocal = req => socketIsLocal(req)&&!isForwarded(req)&&['localhost','127.0.0.1','::1'].includes(hostName(req));
export const isInternetRequest = req => isForwarded(req)||!isPrivateHost(hostName(req));
export const clientAddress = req => socketIsLocal(req)&&isIP(req.headers['cf-connecting-ip']||'')?req.headers['cf-connecting-ip']:req.socket.remoteAddress;
export const isSecureRequest = req => !!req.socket.encrypted||(socketIsLocal(req)&&isForwarded(req)&&req.headers['x-forwarded-proto']==='https');
export function validPublicUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash&&!isPrivateHost(u.hostname)?u.origin:null;}catch{return null;}}
