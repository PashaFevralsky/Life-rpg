import * as z from "zod";
import { createIcons, House, Wallet, Briefcase, Trophy, Ellipsis, Plus, Minus, CreditCard, Landmark, BookOpen, Search, Activity } from "lucide";
const icons={House,Wallet,Briefcase,Trophy,Ellipsis,Plus,Minus,CreditCard,Landmark,BookOpen,Search,Activity};

const BackupSchema=z.object({version:z.number().optional()}).passthrough().refine(v=>Object.keys(v).some(k=>["profile","settings","debts","accounts","books","expenses","incomeLogs","payments","workLogs","tennis","readingLogs","crmDeals"].includes(k)),{message:"Файл не похож на резервную копию Life RPG"});
const ReadingListSchema=z.object({format:z.literal("life-rpg-reading-list-v1"),title:z.string().optional(),books:z.array(z.object({order:z.number().optional(),author:z.string().optional(),title:z.string().min(1),totalPages:z.number().nonnegative().optional()}).passthrough()).min(1)}).passthrough();
const AiPackageSchema=z.union([
  z.object({format:z.literal("life-rpg-statement-import-v1"),transactions:z.array(z.unknown()).min(1)}).passthrough(),
  z.object({format:z.literal("life-rpg-ai-import-v1"),actions:z.array(z.unknown())}).passthrough()
]);
const wrap=schema=>value=>{const r=schema.safeParse(value);return r.success?{ok:true,data:r.data}:{ok:false,error:r.error.issues?.[0]?.message||"Данные не прошли проверку"}};
function refreshIcons(){try{createIcons({icons,attrs:{"stroke-width":2,"aria-hidden":"true"}})}catch{}}
const previous=window.LifePlatform||{};
window.LifePlatform={...previous,mode:"vite",zod:true,lucide:true,workbox:true,validateBackup:wrap(BackupSchema),validateReadingList:wrap(ReadingListSchema),validateAiPackage:wrap(AiPackageSchema),refreshIcons,status:()=>"Zod ✓ • Lucide ✓ • Workbox ✓"};
refreshIcons();
window.addEventListener("DOMContentLoaded",refreshIcons,{once:true});
window.dispatchEvent(new CustomEvent("life-platform-ready"));
