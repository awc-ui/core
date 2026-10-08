import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, readFile, writeFile, rename, unlink, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

const run = promisify(execFile);
const MAX_BODY = 128 * 1024;
const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key,canonical(value[key])])) : value;

export class RenderError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function validateRenderRequest(value, tags) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RenderError(400,'INVALID_REQUEST','Send a component render request.');
  if (typeof value.tag !== 'string' || !tags.has(value.tag)) throw new RenderError(400,'UNKNOWN_COMPONENT','Choose an existing AWC component.');
  const props = value.properties === undefined ? {} : value.properties;
  if (props === null || typeof props !== 'object' || Array.isArray(props)) throw new RenderError(400,'INVALID_PROPERTIES','Properties must be a JSON object.');
  if (value.dark !== undefined && typeof value.dark !== 'boolean') throw new RenderError(400,'INVALID_THEME','dark must be a boolean.');
  if (value.width !== undefined && (typeof value.width !== 'number' || !Number.isFinite(value.width))) throw new RenderError(400,'INVALID_WIDTH','width must be a finite number.');
  function depth(v, level=0) {
    if (level>32) throw new RenderError(400,'INVALID_PROPERTIES','Property nesting is too deep.');
    if (v && typeof v==='object') for(const child of Object.values(v))depth(child,level+1);
  }
  depth(props);
  return {tag:value.tag,properties:canonical(props),dark:value.dark??false,width:Math.round(Math.min(1200,Math.max(320,value.width??640)))};
}

export async function readLocalJSONRequest(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type']??'')) throw new RenderError(415,'JSON_REQUIRED','Send application/json.');
  const host = req.headers.host??'';
  if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host)) throw new RenderError(403,'LOCAL_ONLY','Native rendering is available only on localhost.');
  if ((req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site']==='cross-site') throw new RenderError(403,'ORIGIN_REJECTED','Use the local AWC playground to request native renders.');
  if(Number(req.headers['content-length'])>MAX_BODY) throw new RenderError(413,'REQUEST_TOO_LARGE','The render request is too large.');
  let size=0;const chunks=[];
  for await (const chunk of req) {
    size+=chunk.length;if(size>MAX_BODY)throw new RenderError(413,'REQUEST_TOO_LARGE','The render request is too large.');
    chunks.push(chunk);
  }
  let value;try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new RenderError(400,'INVALID_JSON','Properties must be valid JSON.');}
  return value;
}

export async function readRenderRequest(req, tags) {
  return validateRenderRequest(await readLocalJSONRequest(req),tags);
}

export function createNativeRenderer({repoRoot, executable=process.env.AWC_NATIVE_RENDERER, renderRoot, platform=process.platform, execute=run}={}) {
  const binary=path.resolve(executable||path.join(repoRoot,'apps/native-ios-playground/.build/debug/AWCSnapshots'));
  const directory=path.resolve(renderRoot||path.join(repoRoot,'.cache/native-playground/renders'));
  let fingerprint;let active=0;
  const pending=new Map();
  async function status(){
    if(platform!=='darwin')return {available:false,platform:'macos',renderer:'SwiftUI',message:'The SwiftUI renderer requires macOS. Use the native Android playground on other systems.'};
    try{await access(binary,constants.X_OK);return {available:true,platform:'macos',renderer:'SwiftUI',message:'Real SwiftUI snapshot rendered with the macOS SDK. This is not an iOS simulator render.'};}
    catch{return {available:false,platform:'macos',renderer:'SwiftUI',message:'Build the renderer: swift build --package-path apps/native-ios-playground --product AWCSnapshots. Then refresh this preview.'};}
  }
  async function render(request){
    const availability=await status();if(!availability.available)throw new RenderError(503,'RENDERER_UNAVAILABLE',availability.message);
    const binaryInfo=await stat(binary),signature=`${binaryInfo.size}:${binaryInfo.mtimeMs}`;
    if(fingerprint?.signature!==signature)fingerprint={signature,hash:createHash('sha256').update(await readFile(binary)).digest('hex')};
    const key=createHash('sha256').update(fingerprint.hash).update(JSON.stringify(request)).digest('hex');
    const output=path.join(directory,`${key}.png`);
    const metadata=path.join(directory,`${key}.json`);
    try{
      const [result,png]=await Promise.all([readFile(metadata,'utf8').then(JSON.parse),readFile(output)]);
      if(png.subarray(0,8).equals(PNG_SIGNATURE))return result;
    }catch{}
    if(pending.has(key))return pending.get(key);
    if(active>=2)throw new RenderError(429,'RENDERER_BUSY','The native renderer is busy. Try again in a moment.');
    const work=(async()=>{
      active++;
      const id=randomUUID(),input=path.join(directory,`${id}.request.json`),temporary=path.join(directory,`${id}.png`);
      try{
        await mkdir(directory,{recursive:true});await writeFile(input,JSON.stringify(request),{mode:0o600});
        const {stdout}=await execute(binary,['--request',input,'--output',temporary],{timeout:20000,maxBuffer:1024*1024,windowsHide:true});
        let details;try{details=JSON.parse(stdout.trim());}catch{throw new RenderError(502,'INVALID_RENDER','The native renderer returned invalid metadata.');}
        const png=await readFile(temporary);
        if(!png.subarray(0,8).equals(PNG_SIGNATURE)||details.tag!==request.tag||!Number.isFinite(details.width)||!Number.isFinite(details.height))throw new RenderError(502,'INVALID_RENDER','The native renderer did not produce a valid component image.');
        const result={imageUrl:`/native-renders/${key}.png`,platform:'macos',renderer:'SwiftUI',tag:request.tag,width:details.width,height:details.height};
        await rename(temporary,output);await writeFile(metadata,JSON.stringify(result));return result;
      }catch(error){
        if(error instanceof RenderError)throw error;
        throw new RenderError(502,'RENDER_FAILED',error.killed?'The native render timed out. Try a simpler configuration.':'SwiftUI could not render this configuration. Check the native renderer or try Reset.');
      }finally{
        active--;pending.delete(key);await Promise.allSettled([unlink(input),unlink(temporary)]);
      }
    })();
    pending.set(key,work);return work;
  }
  return {status,render,directory};
}
