import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
const root=resolve('dist');
function cssFiles(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?cssFiles(resolve(dir,entry.name)):entry.name.endsWith('.css')?[resolve(dir,entry.name)]:[]);}
test('every font referenced by production CSS ships as a valid font asset',()=>{
 const styles=cssFiles(root);assert.ok(styles.length,'Build the app before running this test.');let fonts=0;
 for(const file of styles){const css=readFileSync(file,'utf8');for(const match of css.matchAll(/url\(["']?([^\s)"']+\.(?:woff2?|ttf|otf))["']?\)/g)){
  const url=new URL(match[1],'https://assets.example/'+relative(root,file));assert.equal(url.origin,'https://assets.example','Fonts must be served by this app.');
  const target=resolve(root,'.'+decodeURIComponent(url.pathname));const font=readFileSync(target);assert.ok((['wOF2','wOFF','OTTO'].includes(font.toString('latin1',0,4))||font.readUInt32BE(0)===0x00010000),`${url.pathname} is not a font file`);fonts++;
 }}assert.ok(fonts>0,'No fonts were found in the compiled stylesheet.');
});
