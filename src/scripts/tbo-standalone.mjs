// TBO Pan-India coverage check — standalone (fetch only, read-only, no bookings)
const BASE = process.env.TBO_BASE_URL || 'https://api.tektravels.com';
const IP   = process.env.SERVER_IP || '127.0.0.1';
const CRED = { ClientId: process.env.TBO_CLIENT_ID, UserName: process.env.TBO_USERNAME, Password: process.env.TBO_PASSWORD };
const CITIES = ['Delhi','Agra','Jaipur','Munnar','Goa'];

for (const [k,v] of Object.entries(CRED)) if(!v){ console.error(`Missing env ${k}. If creds are only in PM2, run:  TBO_CLIENT_ID=.. TBO_USERNAME=.. TBO_PASSWORD=.. bun run src/scripts/tbo-standalone.mjs`); process.exit(1);}

const post = async (path, body) => {
  const r = await fetch(BASE+path, { method:'POST', headers:{'Content-Type':'application/json',Accept:'application/json'}, body: JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw:t.slice(0,200) }; }
  return { status:r.status, j };
};
const dates = () => { const ci=new Date(); ci.setDate(ci.getDate()+45); const co=new Date(ci); co.setDate(co.getDate()+2);
  const iso=d=>d.toISOString().slice(0,10); return {checkIn:iso(ci),checkOut:iso(co)}; };
const band = s => s>=5?'5*':s>=4?'4*':s>=3?'3*':'<3*';

(async () => {
  const {checkIn,checkOut} = dates();
  console.log(`\n=== TBO COVERAGE (standalone) ===\n${checkIn} -> ${checkOut} | 2 adults 1 room | nat IN | base ${BASE}\n`);

  const auth = await post('/SharedServices/SharedData.svc/rest/Authenticate', {...CRED, EndUserIp:IP});
  const TokenId = auth.j?.TokenId;
  if (!TokenId){ console.error('AUTH FAILED:', auth.status, JSON.stringify(auth.j).slice(0,300)); process.exit(1); }
  console.log('Auth OK. TokenId acquired.\n');

  const cl = await post('/HotelAPI/GetHotelCityList', { CountryCode:'IN', TokenId, EndUserIp:IP });
  const list = cl.j?.CityList || cl.j?.HotelCityList || [];
  console.log(`City list: ${list.length} Indian cities returned. (HTTP ${cl.status})\n`);
  if (!list.length) console.log('Raw city resp:', JSON.stringify(cl.j).slice(0,300),'\n');

  for (const name of CITIES) {
    const m = list.find(c => (c.CityName||'').toLowerCase()===name.toLowerCase())
           || list.find(c => (c.CityName||'').toLowerCase().includes(name.toLowerCase()));
    if (!m){ console.log(`❌ ${name.padEnd(8)} — not in TBO city list\n`); continue; }
    const cityId = m.CityId || m.Code;
    const s = await post('/HotelAPI/Search', {
      CheckInDate:checkIn, CheckOutDate:checkOut, HotelCityCode:cityId, GuestNationality:'IN',
      NoOfRooms:'1', RoomGuests:[{NoOfAdults:2,NoOfChild:0,ChildAge:[]}],
      MaxRating:5, MinRating:0, ResponseTime:23, IsNearBySearchAllowed:false, TokenId, EndUserIp:IP });
    const hotels = s.j?.HotelSearchResult?.HotelResults || s.j?.HotelResults || [];
    if (!hotels.length){ console.log(`⚠️  ${name.padEnd(8)} (CityId ${cityId}) — 0 hotels (HTTP ${s.status}) ${JSON.stringify(s.j?.Status||s.j).slice(0,160)}\n`); continue; }
    const b = {};
    for (const h of hotels){ const st=h.StarRating||0; const pr=h.MinPrice||h.Rooms?.[0]?.TotalFare||0;
      const k=band(st); b[k]??={n:0,min:Infinity}; b[k].n++; if(pr&&pr<b[k].min)b[k].min=pr; }
    console.log(`✅ ${name.padEnd(8)} (CityId ${cityId}) — ${hotels.length} hotels`);
    for (const k of ['5*','4*','3*','<3*']) if(b[k]) console.log(`     ${k.padEnd(4)} ${String(b[k].n).padStart(3)}   lowest ₹${isFinite(b[k].min)?Math.round(b[k].min):'n/a'}`);
    console.log('');
  }
  console.log('=== DONE. No bookings made. ===\n');
})();
