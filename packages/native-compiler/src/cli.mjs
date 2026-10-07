#!/usr/bin/env node
import {compile} from './compiler.mjs';

const [command='build',...args]=process.argv.slice(2);
if(!['build','check','audit'].includes(command)||args.some(a=>a!=='--strict')){
  console.error('Usage: awc-native <build|check|audit> [--strict]');process.exitCode=2;
}else{
  try{
    const result=await compile({write:command==='build',check:command==='check',strict:args.includes('--strict')});
    const s=result.catalog.summary;
    console.log(`AWC Native: ${s.components} elements, ${s.properties} source props, ${s.events} events, ${s.tokens} tokens.`);
    console.log(`Adapters: iOS ${s.iosAdapters}/${s.components}; Android ${s.androidAdapters}/${s.components}.`);
    console.log(`${s.diagnosticCount} browser-portability findings; ${result.incomplete.length} elements have unported API surface. Full source parity is not claimed.`);
    if(command==='check') console.log(result.changed.length?`Stale generated files:\n${result.changed.map(p=>'  '+p).join('\n')}`:'Generated files are current.');
    if(command==='build')console.log(`Updated ${result.changed.length} generated files.`);
    if(command==='audit')for(const c of result.incomplete)console.log(`${c.tag}: ${['ios','android'].map(p=>`${p} ${c.support[p].unsupportedProperties.length} props / ${c.support[p].unsupportedEvents.length} events / ${c.support[p].unsupportedMethods.length} methods / ${c.support[p].unsupportedSlots.length} slots`).join('; ')}`);
    if(!result.ok){process.exitCode=1;if(args.includes('--strict'))console.error('Strict portability gate failed. Implement and verify adapters before claiming parity.');}
  }catch(error){console.error(error.stack??String(error));process.exitCode=1;}
}
