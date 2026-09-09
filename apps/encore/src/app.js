import { shellMarkup } from './shell.js';
import { events, eventById } from './data.js';
import { loadState, saveState, newDraft, restoreDraft, saveDraft, quote, validateAttendee, remaining, getOrders, purchase, cancelOrder, calendarFile, escapeHtml as h, filterEvents } from './model.js';
import { listingMarkup, resultsMarkup, detailMarkup, checkoutMarkup, walletMarkup, ticketMarkup, summaryMarkup, empty } from './views.js';
import { createActions, trackImage } from './loading.js';
import { switchFramework } from './frameworks.js';
import { ticketFile, downloadFile } from './ticket.js';
const defaultFilters = () => ({ query:'',category:'All shows',city:'All cities',month:'all',price:'all',sort:'recommended' });

export function mountEncore(root, { framework='html', renderShell=false } = {}) {
  if (renderShell) root.innerHTML=shellMarkup();
  const $=selector=>root.querySelector(selector), $$=selector=>[...root.querySelectorAll(selector)];
  const main=$('#main'), frameworkSelect=$('#framework'), notice=$('#notice'), actions=createActions($('#action-progress'));
  const controller=new AbortController(), {signal}=controller;
  let state=loadState(), draft=restoreDraft(), orders=[], loaded=false, loadError='', filters=defaultFilters(), segment='confirmed', justBooked='', pendingCancel='', busy=false, disposed=false, imageCleanups=new Map();
  const media=matchMedia('(max-width: 700px)'), dark=matchMedia('(prefers-color-scheme: dark)');
  const channel=typeof BroadcastChannel==='function' ? new BroadcastChannel('encore.orders') : null;
  const toast=message=>{ if(disposed)return;notice.message=message;notice.show(); };
  let storageWarning=false;
  function persist() { try { saveState(state);saveDraft(draft); } catch { if(!storageWarning){toast('Preferences could not be saved on this browser.');storageWarning=true;} } }
  function applyAppearance() {
    const doc=document.documentElement;
    doc.dataset.theme=state.theme==='system'?(dark.matches?'dark':'light'):state.theme;
    doc.dataset.accent=state.accent;doc.dataset.density=state.compact?'compact':'comfortable';doc.dir=state.direction;
    $$('[data-pref]').forEach(el=>{const key=el.dataset.pref;if(el.tagName==='MD-SWITCH')el.selected=key==='direction'?state.direction==='rtl':state[key];else el.value=state[key];});
  }
  function route() { const [path,search='']=location.hash.replace(/^#\/?/,'').split('?');const [page='discover',id]=path.split('/');return {page:page||'discover',id,step:Math.max(0,Math.min(2,Number(new URLSearchParams(search).get('step'))||0))}; }
  const go=path=>{location.hash=`#/${path}`;};
  function errorAt(id,error) { const el=$(id);if(el){el.textContent=error.message||error;el.hidden=false;}else toast(error.message||error); }
  function hydrateImages(scope=main) {
    for (const [image, cleanup] of imageCleanups) if (!image.isConnected) { cleanup(); imageCleanups.delete(image); }
    scope.querySelectorAll('img').forEach(image=>{ if(!imageCleanups.has(image)) imageCleanups.set(image,trackImage(image)); });
  }
  function responsive() { const search=$('#show-search');if(search)search.layout=media.matches?'full-screen':'docked'; }
  function render(focus=false) {
    if(disposed)return;
    imageCleanups.forEach(fn=>fn());imageCleanups.clear();
    const r=route(), needsOrders=['event','checkout','tickets','ticket'].includes(r.page);
    const nav=r.page==='saved'?1:['ticket','tickets'].includes(r.page)?2:0;
    $$('.desktop-nav [data-nav]').forEach((el,i)=>{el.variant=i===nav?'tonal':'text';if(i===nav)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    $('.mobile-nav').activeIndex=nav;
    try {
      if(needsOrders&&!loaded) main.innerHTML=loadError ? empty('cloud_off','Your tickets couldn’t be loaded.',loadError,'<md-button data-action="retry-orders" variant="filled">Try again</md-button>') : '<div class="loading-orders" role="status" aria-label="Loading tickets"><md-skeleton variant="rounded" height="5rem" full-width></md-skeleton><md-skeleton variant="rounded" height="26rem" full-width></md-skeleton></div>';
      else if(r.page==='discover'||r.page==='saved') main.innerHTML=listingMarkup(state,filters,orders,r.page==='saved');
      else if(r.page==='event') { const event=eventById(r.id);if(!event)throw new Error('This show could not be found.');if(draft?.eventId!==event.id){draft=newDraft(event);persist();}main.innerHTML=detailMarkup(event,state,draft,orders); }
      else if(r.page==='checkout') {
        if(!draft || r.id!==draft.id) { main.innerHTML=empty('confirmation_number','Let’s find your tickets first.','Choose a show and add some tickets to start checkout.'); }
        else { const q=quote(draft,orders);if(!q.count)throw new Error('Choose at least one ticket to check out.');if(r.step===2){try{validateAttendee(draft);}catch{go(`checkout/${draft.id}?step=1`);return;}}main.innerHTML=checkoutMarkup(draft,orders,r.step); }
      } else if(r.page==='tickets') main.innerHTML=walletMarkup(orders,segment);
      else if(r.page==='ticket') { const order=orders.find(o=>o.id===r.id);if(!order)throw new Error('This booking could not be found in this browser.');main.innerHTML=ticketMarkup(order,order.id===justBooked); }
      else main.innerHTML=empty('explore','This page has left the stage.','Find another great night on Discover.');
    } catch(error) { main.innerHTML=empty('confirmation_number','Let’s take another look.',error.message,draft?`<md-button href="#/event/${h(draft.eventId)}" variant="filled">Update tickets</md-button>`:undefined); }
    hydrateImages();responsive();if(r.page==='event'&&loaded)updateQuote();
    document.title=`${({discover:'Live a little',saved:'Saved shows',event:eventById(r.id)?.title,checkout:'Checkout',tickets:'My tickets',ticket:'Your booking'})[r.page]||'Discover'} · Encore`;
    if(focus){window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});}
    window.dispatchEvent(new Event('encore-ready'));
  }
  function updateResults() { const container=$('#show-results');if(!container)return;container.innerHTML=resultsMarkup(state,filters,orders,route().page==='saved');hydrateImages(container); }
  function updateQuote() {
    const el=$('#price-summary');if(el)el.innerHTML=summaryMarkup(draft,orders,route().page==='checkout');
    const button=$('[data-action="checkout"]');if(button){try{button.disabled=!quote(draft,orders).count;}catch{button.disabled=true;}}
    persist();
  }
  async function loadOrders({initial=false}={}) {
    try {const result=await getOrders();if(disposed)return;orders=result;loaded=true;loadError='';if(initial||['tickets','ticket'].includes(route().page))render();else if(route().page==='event')refreshAvailability();}
    catch(error){loadError=error.message;if(initial)render();toast(error.message);}
  }
  function refreshAvailability() { const event=eventById(draft?.eventId);if(!event)return;$$('[data-quantity]').forEach(el=>{const count=remaining(event,draft.sessionId,el.dataset.quantity,orders);el.max=Math.min(6,count);el.disabled=!count;const label=$(`[data-availability="${el.dataset.quantity}"]`);if(label)label.textContent=count?`${count} available`:'Sold out';});updateQuote(); }
  async function advance() {
    if(busy)return;
    const r=route();if(r.page!=='checkout'||!draft)return;
    try {
      if(!quote(draft,orders).count)throw new Error('Choose at least one ticket.');
      if(r.step===1){$$('[data-attendee]').forEach(el=>draft[el.dataset.attendee]=el.value);validateAttendee(draft);}
      persist();
      if(r.step<2){go(`checkout/${draft.id}?step=${r.step+1}`);return;}
      if(!$('#demo-consent')?.checked)throw new Error('Confirm that you understand this is a demo booking.');
      const button=$('[data-action="next-step"]');busy=true;frameworkSelect.disabled=true;
      const order=await actions.run(button,'Saving your demo booking',()=>purchase(structuredClone(draft)),$('#checkout-form'));
      if(disposed)return;
      orders=[order,...orders.filter(item=>item.id!==order.id)];justBooked=order.id;draft=null;persist();channel?.postMessage('changed');go(`ticket/${order.id}`);toast('You’re on the list. Your demo tickets are ready.');
    } catch(error) { errorAt('#checkout-error',error); }
    finally {busy=false;frameworkSelect.disabled=false;}
  }
  async function click(event) {
    const target=event.composedPath().find(el=>el instanceof Element && (el.matches('[data-action],[data-save],[data-category],.skip-link')));
    if(!target||!root.contains(target))return;
    if(target.matches('.skip-link')){event.preventDefault();main.focus();return;}
    if(target.hasAttribute('data-category')){filters.category=target.dataset.category;$$('[data-category]').forEach(el=>el.selected=el===target);updateResults();return;}
    if(target.hasAttribute('data-save')){const id=target.dataset.save;state.saved=state.saved.includes(id)?state.saved.filter(value=>value!==id):[...state.saved,id];persist();target.selected=state.saved.includes(id);target.setAttribute('aria-label',`${target.selected?'Unsave':'Save'} ${eventById(id).title}`);target.parentElement.text=`${target.selected?'Unsave':'Save'} show`;toast(target.selected?'Added to your saved shows.':'Removed from saved shows.');if(route().page==='saved')updateResults();return;}
    const action=target.dataset.action;
    try {
      if(action==='appearance')$('#appearance').show();
      else if(action==='find-shows'){$('#shows')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
      else if(action==='reset-filters'){filters=defaultFilters();render();}
      else if(action==='retry-orders'){await actions.run(target,'Loading your tickets',()=>loadOrders({initial:true}),main);}
      else if(action==='checkout'){if(!quote(draft,orders).count)throw new Error('Choose at least one ticket.');persist();go(`checkout/${draft.id}?step=0`);}
      else if(action==='previous-step')go(`checkout/${draft.id}?step=${Math.max(0,route().step-1)}`);
      else if(action==='demo-details'){draft.name='Alex Morgan';draft.email='alex@example.com';$$('[data-attendee]').forEach(el=>el.value=draft[el.dataset.attendee]);persist();}
      else if(action==='apply-promo'){const value=$('#promo').value.trim().toUpperCase();if(value&&value!=='ENCORE10')throw new Error('That code isn’t available. Try ENCORE10.');$('#checkout-error').hidden=true;draft.promo=value;$('#promo-status').textContent=value?'10% off your tickets has been applied.':'Promo code removed.';updateQuote();}
      else if(action==='cancel-booking'){pendingCancel=target.dataset.order;$('#cancel-dialog').show();}
      else if(action==='keep-booking')$('#cancel-dialog').close();
      else if(action==='confirm-cancel') {if(busy)return;busy=true;frameworkSelect.disabled=true;const order=await actions.run(target,'Cancelling your demo booking',()=>cancelOrder(pendingCancel),$('#cancel-dialog'));if(disposed)return;orders=orders.map(o=>o.id===order.id?order:o);$('#cancel-dialog').close();channel?.postMessage('changed');render();toast('Demo booking cancelled.');}
      else if(action==='download-ticket'||action==='calendar') { const order=orders.find(o=>o.id===target.dataset.order);await actions.run(target,action==='calendar'?'Preparing your calendar event':'Preparing your ticket',async()=>{if(action==='calendar')downloadFile(calendarFile(order),'text/calendar;charset=utf-8',`${order.id}.ics`);else downloadFile(ticketFile(order),'image/svg+xml',`${order.id}-demo.svg`);});toast(action==='calendar'?'Calendar file prepared.':'Demo ticket prepared.'); }
    } catch(error) { errorAt(route().page==='checkout'?'#checkout-error':'#booking-error',error); }
    finally {if(action==='confirm-cancel'){busy=false;frameworkSelect.disabled=false;}}
  }
  function input(event) {
    const el=event.target;
    if(el.matches('[data-quantity]')){draft.quantities[el.dataset.quantity]=event.detail.value??0;updateQuote();}
    else if(el.matches('[data-attendee]')){draft[el.dataset.attendee]=event.detail;persist();}
    else if(el.id==='show-search'){filters.query=event.detail.value||'';updateResults();const found=filterEvents({...filters}).slice(0,5);$('#search-results').innerHTML=filters.query?`<md-list label="Matching shows">${found.map(e=>`<md-list-item type="link" href="#/event/${e.id}" headline="${h(e.title)}" supporting-text="${h(e.venue)}, ${h(e.city)}" trailing-icon="north_east"></md-list-item>`).join('')}</md-list>${found.length?'':'<p class="search-empty">No matches. Try another search.</p>'}`:'<p class="search-empty">Search by artist, show, venue, or city.</p>';}
  }
  function change(event) {
    const el=event.target;
    if(el.id==='framework'){if(!busy){persist();switchFramework(event.detail);}return;}
    if(el.dataset.pref){const key=el.dataset.pref;state[key]=el.tagName==='MD-SWITCH'?(key==='direction'?(event.detail.selected?'rtl':'ltr'):event.detail.selected):event.detail;persist();applyAppearance();}
    else if(el.dataset.filter){filters[el.dataset.filter]=event.detail;updateResults();}
    else if(el.id==='performance'){draft.sessionId=event.detail;refreshAvailability();}
    else if(el.id==='ticket-segments'){segment=event.detail[0]||'confirmed';render();}
    else if(el.tagName==='MD-RADIO'&&event.detail.checked){draft.payment=event.detail.value;persist();}
    else if(el.matches('[data-quantity]'))input(event);
  }
  frameworkSelect.value=framework;applyAppearance();
  root.addEventListener('click',click,{signal});root.addEventListener('mdInput',input,{signal});root.addEventListener('mdChange',change,{signal});
  root.addEventListener('submit',event=>{if(event.target.id==='checkout-form'){event.preventDefault();void advance();}},{signal});
  root.addEventListener('mdSubmit',event=>{if(event.target.id==='show-search'){event.target.close();$('#shows').scrollIntoView();}},{signal});
  root.addEventListener('mdClear',event=>{if(event.target.id==='show-search'){filters.query='';updateResults();}},{signal});
  window.addEventListener('hashchange',()=>{if(location.hash==='#main')return;render(true);},{signal});
  window.addEventListener('focus',()=>{if(!busy)void loadOrders();},{signal});
  window.addEventListener('storage',event=>{if(event.key==='encore.preferences.v1'){state=loadState();applyAppearance();if(['discover','saved'].includes(route().page))render();}},{signal});
  channel?.addEventListener('message',()=>{if(!busy)void loadOrders();},{signal});
  media.addEventListener('change',responsive,{signal});dark.addEventListener('change',applyAppearance,{signal});
  render();void loadOrders({initial:true});
  return ()=>{disposed=true;controller.abort();channel?.close();imageCleanups.forEach(fn=>fn());actions.dispose();};
}
