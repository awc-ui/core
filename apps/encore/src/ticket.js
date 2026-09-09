import { escapeHtml as h, dateLabel, timeLabel, money } from './model.js';
import { eventById, sessionById } from './data.js';
export function ticketFile(order) {
  if (order.status !== 'confirmed') throw new Error('Cancelled tickets cannot be downloaded.');
  const event=eventById(order.eventId),session=sessionById(event,order.sessionId);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="620" viewBox="0 0 1000 620" role="img" aria-label="Encore demo ticket"><rect width="1000" height="620" rx="28" fill="#f8f6ff"/><rect width="1000" height="210" rx="28" fill="#432579"/><g font-family="Arial,sans-serif"><text x="48" y="64" font-size="28" font-weight="700" fill="white">encore.</text><text x="48" y="138" font-size="44" font-weight="700" fill="white">${h(event.title)}</text><text x="48" y="181" font-size="20" fill="#e8dcff">DEMO TICKET · NOT VALID FOR ENTRY</text><g fill="#241a32" font-size="24"><text x="48" y="274">${h(dateLabel(session.start,{weekday:'long',year:'numeric'}))} · ${h(timeLabel(session.start))}</text><text x="48" y="319">${h(event.venue)}, ${h(event.city)}</text><text x="48" y="385">Guest: ${h(order.name.slice(0,48))}</text>${order.lines.map((l,i)=>`<text x="48" y="${432+i*32}" font-size="20">${l.quantity} × ${h(l.name)}</text>`).join('')}<text x="650" y="385" font-size="20">${h(order.id)}</text><text x="650" y="425" font-size="20">Demo total: ${h(money(order.total))}</text><text x="48" y="581" font-size="16" fill="#63586e">Fictional event. No payment taken. AWC UI showcase.</text></g></g></svg>`;
}
export function downloadFile(contents,type,filename) {
  const url=URL.createObjectURL(new Blob([contents],{type}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
