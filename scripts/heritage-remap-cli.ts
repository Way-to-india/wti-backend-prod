/** CLI wrapper for the heritage remap engine: bun run scripts/heritage-remap-cli.ts <collectionId> */
import { remapCollection } from "@/services/common/heritage.service";
const id = Number(process.argv[2]);
remapCollection(id).then((r) => { console.log(JSON.stringify(r)); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
