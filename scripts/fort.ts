// VERIFY RAIGAD FORT — Google + OSM must agree. My memory is not a source.
const KEY = process.env.GOOGLE_PLACES_API_KEY || "";
const hav=(a:number[],b:number[])=>{const R=6371,t=(d:number)=>d*Math.PI/180;const x=t(b[0]-a[0]),y=t(b[1]-a[1]);const s=Math.sin(x/2)**2+Math.cos(t(a[0]))*Math.cos(t(b[0]))*Math.sin(y/2)**2;return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));};
const g=async(q:string)=>{const r=await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&components=country:IN&key=${KEY}`);const j:any=await r.json();if(j.status!=="OK")return null;const l=j.results[0].geometry.location;return[+l.lat,+l.lng] as [number,number];};
const o=async(q:string)=>{const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1&countrycodes=in`,{headers:{"User-Agent":"WayToIndia/1.0 (info@waytoindia.com)"}});const j:any=await r.json();const h=j?.[0];return h?[+h.lat,+h.lon] as [number,number]:null;};
const el=async(p:[number,number])=>{const r=await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${p[0]}&longitude=${p[1]}`);const j:any=await r.json();return Math.round(j.elevation[0]);};
const ga=await g("Raigad Fort, Maharashtra"); await new Promise(r=>setTimeout(r,1200)); const oa=await o("Raigad Fort, Maharashtra");
console.log("\nRAIGAD FORT — two independent sources");
console.log("  Google:", ga); console.log("  OSM   :", oa);
if(ga&&oa){ const km=hav(ga,oa); const mid:[number,number]=[(ga[0]+oa[0])/2,(ga[1]+oa[1])/2];
  console.log(`  agree to ${km.toFixed(1)} km  -> ${km<=5?"ACCEPT":"REFUSE"}`);
  if(km<=5){ console.log(`  midpoint ${mid[0].toFixed(4)}, ${mid[1].toFixed(4)}   elevation ${await el(mid)} m`);
    console.log(`  (my guess was 18.23, 73.44 -- off by ${hav(mid,[18.23,73.44]).toFixed(1)} km)`); } }
process.exit(0);
