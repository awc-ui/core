export const airports = [
  {code:'OTP',city:'Bucharest',name:'Henri Coandă',tz:'Europe/Bucharest'},
  {code:'LIS',city:'Lisbon',name:'Humberto Delgado',tz:'Europe/Lisbon'},
  {code:'LHR',city:'London',name:'Heathrow',tz:'Europe/London'},
  {code:'CDG',city:'Paris',name:'Charles de Gaulle',tz:'Europe/Paris'},
  {code:'BCN',city:'Barcelona',name:'El Prat',tz:'Europe/Madrid'},
  {code:'FCO',city:'Rome',name:'Fiumicino',tz:'Europe/Rome'},
  {code:'AMS',city:'Amsterdam',name:'Schiphol',tz:'Europe/Amsterdam'},
  {code:'BER',city:'Berlin',name:'Brandenburg',tz:'Europe/Berlin'},
];
export const airport = code => airports.find(a=>a.code===code);
export const airportOptions = airports.map(a=>({value:a.code,label:`${a.city} (${a.code})`,supportingText:a.name}));
export function dateAfter(days=0,timeZone='UTC'){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(Date.now()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));const d=new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export const money = value => new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value);
export const dayLabel = value => new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'}).format(new Date(value+'T12:00:00'));
export function validDate(value){return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
export function validateSearch(s){
 if(!s || !airport(s.from)||!airport(s.to)||s.from===s.to)throw new Error('Choose two different airports.');
 if(!validDate(s.depart)||s.depart<dateAfter(0,airport(s.from).tz)||s.depart>dateAfter(330,airport(s.from).tz))throw new Error('Choose a departure within the next 330 days.');
 if(s.trip!=='oneway'&&s.trip!=='roundtrip')throw new Error('Choose a valid trip type.');
 if(s.trip==='roundtrip'&&(!validDate(s.returnDate)||s.returnDate<=s.depart||s.returnDate>dateAfter(330,airport(s.from).tz)))throw new Error('Return must be after departure and within the next 330 days.');
 if(!Number.isInteger(s.travelers)||s.travelers<1||s.travelers>6)throw new Error('Choose between 1 and 6 adult travelers.');
 return s;
}
const hash = text => [...text].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
function instant(date,hour,tz){
 const target=Date.parse(`${date}T${hour}:00Z`);let guess=target;
 for(let n=0;n<3;n++){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(guess).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));const represented=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);guess+=target-represented;}
 return guess;
}
export function flightsFor(from,to,date){
 if(!airport(from)||!airport(to)||!validDate(date)||from===to)return [];
 const seed=hash(from+to+date);const route=Math.abs(airports.findIndex(a=>a.code===from)-airports.findIndex(a=>a.code===to));
 const mins=from==='OTP'||to==='OTP'?(from==='LIS'||to==='LIS'?260:155+route*8):110+route*9;
 return ['06:40','09:25','12:15','15:50','19:10'].map((time,i)=>{
 const stops=i===1||i===3?1:0;const duration=mins+stops*115+(i===4?15:0);const start=instant(date,time,airport(from).tz);const end=start+duration*60000;
 const clock=(ms,code)=>new Intl.DateTimeFormat('en-GB',{timeZone:airport(code).tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(ms);
 const arrivalDate=new Intl.DateTimeFormat('en-CA',{timeZone:airport(to).tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(end);
 return {id:`${from}-${to}-${date}-${i}`,from,to,date,number:`${i%2?'MB':'AE'}${120+seed%600+i}`,airline:i%2?'Meridian':'Aero',departure:clock(start,from),arrival:clock(end,to),arrivalDate,start,end,duration,stops,via:['FCO','CDG','AMS'].find(code=>code!==from&&code!==to),price:79+seed%43+i*18-stops*28,aircraft:i%2?'Airbus A320':'Airbus A321neo'};
 }).filter(flight=>flight.start>Date.now()+60*60*1000);
}
export const durationLabel = mins=>`${Math.floor(mins/60)}h ${mins%60}m`;
export const fares = [
 {id:'light',name:'Light',add:0,bag:false,seat:false,description:'Travel light, keep it simple.',features:['Personal item + 8 kg cabin bag','Seat assigned at check-in','Non-refundable demo fare']},
 {id:'comfort',name:'Comfort',add:39,bag:true,seat:true,description:'A little more room for your plans.',features:['Cabin bag + 23 kg checked bag','Standard seat selection included','Changes without a change fee']},
 {id:'flex',name:'Flex',add:79,bag:true,seat:true,description:'For plans that might change.',features:['Cabin bag + 23 kg checked bag','All available seats included','Refundable demo fare']},
];
export const seats = Array.from({length:12},(_,row)=>'ABCDEF'.split('').map(letter=>`${row+1}${letter}`)).flat();
export const seatUnavailable=(flightId,seat)=>hash(flightId+seat)%7===0;
export const seatPrice=(fare,seat)=>!seat?0:fare==='flex'?0:parseInt(seat)<=2?24:fare==='comfort'?0:12;

export function quoteBooking(search,choices,extraBag=false){
 validateSearch(search);
 const legCount=search.trip==='roundtrip'?2:1;
 if(!Array.isArray(choices)||choices.length!==legCount)throw new Error('Choose a flight for every part of your trip.');
 const legs=choices.map((choice,index)=>{
  const from=index?search.to:search.from,to=index?search.from:search.to,date=index?search.returnDate:search.depart;
  const flight=flightsFor(from,to,date).find(f=>f.id===choice?.flightId);
  const fare=fares.find(f=>f.id===choice?.fare);
  if(!flight||!fare)throw new Error('The selected flight or fare is invalid. Search again.');
  const selected=Array.isArray(choice.seats)?choice.seats:Array(search.travelers).fill(null);
  if(selected.length!==search.travelers)throw new Error('Seat selections must match the number of travelers.');
  const occupied=selected.filter(Boolean);
  if(new Set(occupied).size!==occupied.length)throw new Error('Each traveler needs a different seat.');
  for(const seat of selected)if(seat!==null&&(!seats.includes(seat)||seatUnavailable(flight.id,seat)))throw new Error('One of those seats is unavailable. Choose another seat.');
  const flightTotal=(flight.price+fare.add)*search.travelers;
  const seatTotal=selected.reduce((sum,seat)=>sum+seatPrice(fare.id,seat),0);
  const bagTotal=extraBag&&!fare.bag?29*search.travelers:0;
  return {flight,fare:fare.id,seats:selected,flightTotal,seatTotal,bagTotal,total:flightTotal+seatTotal+bagTotal};
 });
 return {legs,flights:legs.reduce((n,l)=>n+l.flightTotal,0),seats:legs.reduce((n,l)=>n+l.seatTotal,0),bags:legs.reduce((n,l)=>n+l.bagTotal,0),total:legs.reduce((n,l)=>n+l.total,0),currency:'EUR'};
}
export function validatePassengers(passengers,count,email){
 if(!Array.isArray(passengers)||passengers.length!==count)throw new Error('Enter details for every traveler.');
 const clean=passengers.map(p=>{
  const firstName=typeof p?.firstName==='string'?p.firstName.trim():'';
  const lastName=typeof p?.lastName==='string'?p.lastName.trim():'';
  if(firstName.length<1||lastName.length<1||firstName.length>60||lastName.length>60||/[\x00-\x1f<>]/.test(firstName+lastName))throw new Error('Enter a first and last name for every traveler (up to 60 characters each).');
  return {firstName,lastName};
 });
 const contact=typeof email==='string'?email.trim():'';
 if(contact.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(contact))throw new Error('Enter a valid contact email.');
 return {passengers:clean,email:contact};
}
export function bookingFromInput(input){
 if(!input||typeof input!=='object'||!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(input.requestId||''))throw new Error('Invalid booking request. Please try again.');
 if(input.accepted!==true)throw new Error('Confirm the passenger details before booking.');
 if(typeof input.extraBag!=='boolean')throw new Error('Choose a valid baggage option.');
 const quote=quoteBooking(input.search,input.choices,input.extraBag);
 const contact=validatePassengers(input.passengers,input.search.travelers,input.email);
 const {from,to,depart,returnDate,trip,travelers}=input.search;
 return {search:{from,to,depart,returnDate:trip==='roundtrip'?returnDate:null,trip,travelers},...contact,extraBag:input.extraBag,quote};
}

// A retry compares the user's stable choices, not a newly calculated price or clock.
export function bookingFingerprint(input){
 const s=input?.search;
 return JSON.stringify({search:{from:s?.from,to:s?.to,depart:s?.depart,returnDate:s?.trip==='roundtrip'?s?.returnDate:null,trip:s?.trip,travelers:s?.travelers},choices:Array.isArray(input?.choices)?input.choices.map(c=>({flightId:c?.flightId,fare:c?.fare,seats:c?.seats})):null,passengers:Array.isArray(input?.passengers)?input.passengers.map(p=>({firstName:typeof p?.firstName==='string'?p.firstName.trim():null,lastName:typeof p?.lastName==='string'?p.lastName.trim():null})):null,email:typeof input?.email==='string'?input.email.trim():null,extraBag:input?.extraBag,accepted:input?.accepted});
}
