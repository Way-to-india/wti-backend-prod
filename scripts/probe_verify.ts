import { verifyCity } from "@/services/route-optimizer/cityVerify";
for (const q of ["Manali, Himachal Pradesh", "Manali Himachal Pradesh", "Manali"]) {
  const r = await verifyCity(q);
  console.log(JSON.stringify(q), "->", JSON.stringify(r));
}
process.exit(0);
