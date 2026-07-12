// Are the 12 refusals a GAZETTEER problem, or a SPELLING problem?
// If the second, no new API fixes it -- it would fail on the same misspellings.
const KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
async function g(q:string){ try{ const r=await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&components=country:IN&key=${KEY}`); const j:any=await r.json(); if(j.status!=="OK")return null; const l=j.results[0].geometry.location; return {lat:+l.lat,lng:+l.lng,label:j.results[0].formatted_address}; }catch{return null;} }
async function o(q:string){ try{ const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&countrycodes=in`,{headers:{"User-Agent":"WayToIndia/1.0 (info@waytoindia.com)"}}); const j:any=await r.json(); const h=j?.[0]; return h?{lat:+h.lat,lng:+h.lon,label:String(h.display_name)}:null; }catch{return null;} }
const hav=(a:number[],b:number[])=>{const R=6371,t=(d:number)=>d*Math.PI/180;const dla=t(b[0]-a[0]),dlo=t(b[1]-a[1]);const s=Math.sin(dla/2)**2+Math.cos(t(a[0]))*Math.cos(t(b[0]))*Math.sin(dlo/2)**2;return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));};

// ours -> the spelling the rest of the world uses
const CASES: [string,string][] = [
  ["Bandavgarh","Bandhavgarh National Park, Madhya Pradesh"],
  ["Shiridi","Shirdi, Maharashtra"],
  ["Chikmangalur","Chikmagalur, Karnataka"],
  ["Puttaparthy","Puttaparthi, Andhra Pradesh"],
  ["Thiruvannamalai","Tiruvannamalai, Tamil Nadu"],
  ["Murudeshwar","Murdeshwar, Karnataka"],
  ["Ram Nagar","Ramnagar, Uttarakhand"],
  ["Araku Valley Hill Station","Araku Valley, Andhra Pradesh"],
  ["Sundarbans","Sundarbans National Park, West Bengal"],
  ["Ratnagiri","Ratnagiri, Maharashtra"],
];
console.log("\nIS IT THE GAZETTEER, OR IS IT OUR SPELLING?\n");
for (const [ours, corrected] of CASES) {
  const [ga,oa] = [await g(corrected), (await sleep(150), await o(corrected))];
  await sleep(1100);
  if (!ga || !oa) { console.log(`  ${ours.padEnd(26)} -> ${corrected.padEnd(38)} still only ${ga?"Google":oa?"OSM":"neither"}`); continue; }
  const km = hav([ga.lat,ga.lng],[oa.lat,oa.lng]);
  console.log(`  ${ours.padEnd(26)} -> ${corrected.split(",")[0].padEnd(26)} ${km<=25?"BOTH AGREE":"disagree"} (${km.toFixed(0)} km)  ${km<=25?ga.lat.toFixed(4)+","+ga.lng.toFixed(4):""}`);
}
process.exit(0);
