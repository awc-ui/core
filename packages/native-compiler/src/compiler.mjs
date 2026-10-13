import {readFile,readdir,mkdir,writeFile,unlink} from 'node:fs/promises';
import {resolve,relative,dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {analyzeSource,analyzeCSS,extractTokens} from './analyze.mjs';
import {swiftComponents,kotlinComponents,swiftCatalog,kotlinCatalog,swiftTokens,kotlinTokens} from './emit.mjs';

export const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const hash=text=>createHash('sha256').update(text).digest('hex');
export async function staleIRFiles(root,tags){
  const directory='packages/native-compiler/generated/ir';
  let files=[];try{files=await readdir(join(root,directory));}catch(error){if(error.code!=='ENOENT')throw error;}
  return files.filter(file=>/^md-[a-z0-9-]+\.json$/.test(file)&&!tags.has(file.slice(0,-5))).map(file=>`${directory}/${file}`).sort();
}
async function readPolicy(root,platform){
  const paths=platform==='ios'?['packages/native-ios/NativeSupport.json','packages/native-ios/support.json']:['packages/native-android/support.json','packages/native-android/NativeSupport.json'];
  for(const file of paths){try{return {file,...await json(join(root,file))};}catch(error){if(error.code!=='ENOENT')throw error;}}
  return {components:{}};
}
function nativeEquivalents(component,policy,entry){
  if(!entry||!Object.hasOwn(entry,'nativeEquivalents'))return undefined;
  const context=`${policy.file??'Native support policy'}: ${component.tag}.nativeEquivalents`;
  const invalid=(field,message)=>{throw new Error(`${context}${field}: ${message}`);};
  const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const nonempty=value=>typeof value==='string'&&value.trim().length>0;
  const equivalents=entry.nativeEquivalents;
  if(!record(equivalents))invalid('','expected an object keyed by source diagnostic code');
  const codes=new Set(component.diagnostics.map(d=>d.code));
  return Object.fromEntries(Object.entries(equivalents).map(([code,value])=>{
    if(!codes.has(code))invalid(`.${code}`,'diagnostic code is not present on this component');
    if(!record(value))invalid(`.${code}`,'expected an object');
    const fields=['status','api','description','limitations'];
    if(fields.some(field=>!Object.hasOwn(value,field))||Object.keys(value).some(field=>!fields.includes(field)))
      invalid(`.${code}`,'expected exactly status, api, description and limitations');
    if(!['implemented','partial'].includes(value.status))invalid(`.${code}.status`,'expected implemented or partial');
    for(const field of ['api','description'])if(!nonempty(value[field]))invalid(`.${code}.${field}`,'expected a nonempty string');
    if(!Array.isArray(value.limitations)||!value.limitations.every(nonempty))invalid(`.${code}.limitations`,'expected an array of nonempty strings');
    if(value.status==='partial'&&!value.limitations.length)invalid(`.${code}.limitations`,'partial equivalents require at least one limitation');
    return [code,{status:value.status,api:value.api,description:value.description,limitations:[...value.limitations]}];
  }));
}
function coverage(component,policy){
  const entry=policy.components?.[component.tag];
  const props=entry?.properties??[], events=entry?.events??[], methods=entry?.methods??[], slots=entry?.slots??[];
  const names=values=>values.map(x=>typeof x==='string'?x:x.name);
  const equivalents=nativeEquivalents(component,policy,entry);
  return {status:entry?'adapter-implemented':'missing-adapter',
    properties:names(props),events:names(events),methods:names(methods),slots:names(slots),
    unsupportedProperties:component.properties.map(p=>p.name).filter(p=>!names(props).includes(p)),
    unsupportedEvents:component.events.map(p=>p.name).filter(p=>!names(events).includes(p)),
    unsupportedMethods:component.methods.map(p=>p.name).filter(p=>!names(methods).includes(p)),
    unsupportedSlots:component.slots.map(p=>p.name).filter(p=>!names(slots).includes(p)),
    notes:entry?.notes??[], verification:'not-device-verified',
    ...(Array.isArray(entry?.visualParts) ? {visualParts: entry.visualParts.filter(value=>typeof value==='string')} : {}),
    ...(entry?.appearance && typeof entry.appearance.api==='string' && Array.isArray(entry.appearance.fields) ? {appearance:{api:entry.appearance.api,fields:entry.appearance.fields.filter(value=>typeof value==='string')}} : {}),
    ...(equivalents===undefined?{}:{nativeEquivalents:equivalents}),
  };
}

export async function compile({root=repositoryRoot,write=true,check=false,strict=false}={}){
  const manifest=await json(join(root,'packages/core/custom-elements.json'));
  const declarations=manifest.modules.flatMap(m=>m.declarations??[]).filter(d=>d.customElement);
  const byTag=new Map(declarations.map(d=>[d.tagName,d]));
  const sourceDir=join(root,'packages/core/src/components');
  const tags=(await readdir(sourceDir,{withFileTypes:true})).filter(d=>d.isDirectory()&&d.name.startsWith('md-')).map(d=>d.name).sort();
  const policies={ios:await readPolicy(root,'ios'),android:await readPolicy(root,'android')};
  const components=[],outputs=new Map();
  const swiftPath='packages/native-ios/Sources/AWCUI/Generated/Components.swift';
  const kotlinPath='packages/native-android/src/main/java/dev/awc/nativeui/generated/Components.kt';
  const irBase='packages/native-compiler/generated';
  for(const tag of tags){
    const sourcePath=`packages/core/src/components/${tag}/${tag}.tsx`;
    const source=await readFile(join(root,sourcePath),'utf8');
    const ir=analyzeSource(source,sourcePath,byTag.get(tag));
    if(ir.tag!==tag)throw new Error(`Source directory ${tag} differs from @Component tag ${ir.tag}`);
    const doc=await json(join(root,`apps/docs/src/data/components/${tag.replace(/^md-/,'')}.json`));
    const cssPath=`packages/core/src/components/${tag}/${ir.source.styleUrl}`;
    let css='';
    if(ir.source.styleUrl) css=await readFile(join(root,cssPath),'utf8');
    ir.styles=analyzeCSS(css,cssPath);
    ir.schemaVersion=1;
    ir.source.sha256=hash(source+'\n'+css);
    ir.lowering={strategy:'explicit-native-adapter',arbitraryTypeScriptTranslated:false,arbitraryCSSTranslated:false};
    const component={...ir,name:doc.title,category:doc.category??'Components',parent:doc.subComponentOf??null,
      description:byTag.get(tag)?.summary??`${doc.title} component`,swiftPath,kotlinPath,irPath:`${irBase}/ir/${tag}.json`,
      sources:{stencil:sourcePath,css:cssPath,swift:swiftPath,kotlin:kotlinPath,
        swiftImplementation:'packages/native-ios/Sources/AWCUI/AWCNativeView.swift',
        kotlinImplementation:'packages/native-android/src/main/java/dev/awc/nativeui/AWCComponent.kt'},
      support:{ios:coverage(ir,policies.ios),android:coverage(ir,policies.android)}};
    outputs.set(component.irPath,JSON.stringify(component,null,2)+'\n');
    components.push(component);
  }
  const tokenSource=await readFile(join(root,'packages/tokens/src/tokens.css'),'utf8');
  const tokens={schemaVersion:1,sourceHash:hash(tokenSource),...extractTokens(tokenSource)};
  const summary={components:components.length,topLevelComponents:components.filter(c=>!c.parent).length,
    properties:components.reduce((n,c)=>n+c.properties.length,0),events:components.reduce((n,c)=>n+c.events.length,0),
    tokens:Object.keys(tokens.light).length,
    iosAdapters:components.filter(c=>c.support.ios.status==='adapter-implemented').length,
    androidAdapters:components.filter(c=>c.support.android.status==='adapter-implemented').length,
    diagnosticCount:components.reduce((n,c)=>n+c.diagnostics.length,0),
    sourceParityVerified:false};
  const catalog={schemaVersion:1,compilerVersion:'0.1.0',strategy:'source-contracts-with-native-adapters',summary,
    verification:{ios:'requires Xcode build and simulator/device tests',android:'requires Gradle build and emulator/device tests',
      parity:'Generated API coverage is not behavior parity. See support fields for implemented properties, events, methods and slots.'},
    components:components.map(({render,styles,state,...c})=>c)};
  outputs.set(`${irBase}/catalog.json`,JSON.stringify(catalog,null,2)+'\n');
  outputs.set(`${irBase}/tokens.json`,JSON.stringify(tokens,null,2)+'\n');
  outputs.set(swiftPath,swiftComponents(components));
  outputs.set(kotlinPath,kotlinComponents(components));
  outputs.set('packages/native-ios/Sources/AWCUI/Generated/ComponentCatalog.swift',swiftCatalog(components));
  outputs.set('packages/native-android/src/main/java/dev/awc/nativeui/generated/ComponentCatalog.kt',kotlinCatalog(components));
  outputs.set('packages/native-ios/Sources/AWCUI/Generated/Tokens.swift',swiftTokens(tokens));
  outputs.set('packages/native-android/src/main/java/dev/awc/nativeui/generated/Tokens.kt',kotlinTokens(tokens));
  const removed=await staleIRFiles(root,new Set(tags));
  const changed=[...removed];
  if(write&&!check)for(const file of removed)await unlink(join(root,file));
  for(const [file,content] of outputs){
    const path=join(root,file);
    let current='';try{current=await readFile(path,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
    if(current!==content){changed.push(file);if(write&&!check){await mkdir(dirname(path),{recursive:true});await writeFile(path,content);}}
  }
  const incomplete=components.filter(c=>Object.values(c.support).some(s=>s.status==='missing-adapter'||s.unsupportedProperties.length||s.unsupportedEvents.length||s.unsupportedMethods.length||s.unsupportedSlots.length));
  return {catalog,tokens,components,outputs,changed,removed,incomplete,ok:!(check&&changed.length)&&!(strict&&(incomplete.length||summary.diagnosticCount))};
}
