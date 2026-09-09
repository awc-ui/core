import test from 'node:test';
import assert from 'node:assert/strict';
import {airports,airport,dateAfter,validateSearch,flightsFor,quoteBooking,bookingFromInput,bookingFingerprint,seats,seatUnavailable} from '../lib/flights.mjs';
const future=()=>({from:'OTP',to:'LIS',depart:dateAfter(14),returnDate:dateAfter(21),trip:'roundtrip',travelers:2});
function choices(s){return [flightsFor(s.from,s.to,s.depart)[0],flightsFor(s.to,s.from,s.returnDate)[0]].map(f=>({flightId:f.id,fare:'light',seats:Array(s.travelers).fill(null)}));}
test('booking dates use the departure airport’s calendar at midnight',t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-09-09T22:30:00Z'));
 assert.equal(dateAfter(0,'Europe/Bucharest'),'2026-09-10');assert.equal(dateAfter(0,'Europe/Lisbon'),'2026-09-09');
 assert.throws(()=>validateSearch({...future(),depart:'2026-09-09'}),/departure/);
 assert.doesNotThrow(()=>validateSearch({...future(),from:'LIS',to:'OTP',depart:'2026-09-09'}));
});
test('invalid dates, airports, return ordering and traveler counts are rejected',()=>{
 for(const change of [{depart:'2026-02-30'},{from:'ZZZ'},{to:'OTP'},{returnDate:dateAfter(13)},{travelers:0},{travelers:7},{travelers:1.5}])assert.throws(()=>validateSearch({...future(),...change}));
});
test('only departures more than one hour away remain bookable',t=>{
 t.mock.method(Date,'now',()=>Date.parse('2026-09-10T08:30:00Z'));
 const flights=flightsFor('OTP','LIS','2026-09-10');assert.deepEqual(flights.map(f=>f.departure),['15:50','19:10']);assert.ok(flights.every(f=>f.start>Date.now()+3600000));
});
test('local schedules preserve elapsed duration through daylight saving and route connections are distinct',()=>{
 for(const day of ['2026-10-24','2026-10-25'])for(const from of airports)for(const to of airports){if(from.code===to.code)continue;for(const f of flightsFor(from.code,to.code,day)){assert.equal(f.end-f.start,f.duration*60000);assert.notEqual(f.via,from.code);assert.notEqual(f.via,to.code);assert.equal(new Intl.DateTimeFormat('en-GB',{timeZone:airport(from.code).tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(f.start),f.departure);}}
});
test('booking validation prices both legs, every traveler, bags and paid seats without trusting a submitted price',()=>{
 const search=future(),picked=choices(search);const available=seats.filter(s=>parseInt(s)>2&&!seatUnavailable(picked[0].flightId,s));picked[0].seats=available.slice(0,2);picked[1].fare='comfort';
 const quote=quoteBooking(search,picked,true);assert.equal(quote.seats,24);assert.equal(quote.bags,58);assert.equal(quote.total,quote.legs.reduce((n,l)=>n+2*(l.flight.price+(l.fare==='comfort'?39:0)),0)+82);
 const details=bookingFromInput({requestId:crypto.randomUUID(),search,choices:picked,passengers:[{firstName:' Alex ',lastName:'Morgan'},{firstName:'Sam',lastName:'Morgan'}],email:'alex@example.com',extraBag:true,accepted:true,total:1});assert.equal(details.quote.total,quote.total);assert.equal(details.passengers[0].firstName,'Alex');
});
test('unavailable, duplicate and wrong-leg seats or flights cannot be booked',()=>{
 const search=future(),picked=choices(search),available=seats.find(s=>!seatUnavailable(picked[0].flightId,s)),unavailable=seats.find(s=>seatUnavailable(picked[0].flightId,s));
 assert.throws(()=>quoteBooking(search,[{...picked[0],seats:[available,available]},picked[1]]),/different seat/);
 assert.throws(()=>quoteBooking(search,[{...picked[0],seats:[unavailable,null]},picked[1]]),/unavailable/);
 assert.throws(()=>quoteBooking(search,[picked[1],picked[0]]),/invalid/);
 assert.throws(()=>quoteBooking(search,[{...picked[0],seats:['99Z',null]},picked[1]]),/unavailable/);
});
test('retry fingerprints are stable across time and reject changed choices',t=>{
 const input={requestId:crypto.randomUUID(),search:future(),passengers:[{firstName:'Alex',lastName:'Morgan'}],email:'alex@example.com',choices:[],extraBag:false,accepted:true};const key=bookingFingerprint(input);
 t.mock.method(Date,'now',()=>Date.parse('2030-01-01T12:00:00Z'));assert.equal(bookingFingerprint(input),key);assert.equal(bookingFingerprint({...input,total:1}),key);assert.notEqual(bookingFingerprint({...input,extraBag:true}),key);
 assert.throws(()=>bookingFromInput({...input,requestId:'-'.repeat(36)}),/Invalid booking request/);
});
