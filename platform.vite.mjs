import * as z from "zod";
import { createIcons, House, Wallet, Briefcase, Trophy, Ellipsis, Plus, Minus, CreditCard, Landmark, BookOpen, Search, Activity } from "lucide";
const icons={House,Wallet,Briefcase,Trophy,Ellipsis,Plus,Minus,CreditCard,Landmark,BookOpen,Search,Activity};

const DateKey=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
const Money=z.number().finite().nonnegative();
const Id=z.string().min(1);
const AccountSchema=z.object({id:z.string().optional(),name:z.string().optional(),verifiedBalance:z.number().finite().nullable().optional(),verifiedAt:z.string().optional(),active:z.boolean().optional()}).passthrough();
const DebtSchema=z.object({id:z.string().optional(),name:z.string().optional(),balance:Money.optional(),rate:Money.optional(),min:Money.optional(),nextPaymentDate:z.string().optional(),active:z.boolean().optional()}).passthrough();
const WorkSchema=z.object({id:z.string().optional(),date:DateKey,sales:Money.optional(),contacts:Money.optional(),followups:Money.optional(),lpr:Money.optional(),meetings:Money.optional(),proposals:Money.optional(),wins:Money.optional(),pipeline:Money.optional()}).passthrough();
const MatchSchema=z.object({id:z.string().optional(),opponent:z.string().optional(),opponentRating:Money.optional(),result:z.enum(["W","L",""]).optional(),score:z.string().optional(),note:z.string().optional()}).passthrough();
const TennisSchema=z.object({id:z.string().optional(),dateKey:DateKey,min:Money.optional(),load:z.number().finite().min(1).max(10).optional(),serveMin:Money.optional(),footMin:Money.optional(),matches:z.array(MatchSchema).optional()}).passthrough();
const BookSchema=z.object({id:z.string().optional(),title:z.string().optional(),author:z.string().optional(),totalPages:Money.optional(),currentPage:Money.optional(),status:z.enum(["queued","reading","paused","done","dropped","archived"]).or(z.string()).optional()}).passthrough();
const ReadingSchema=z.object({id:z.string().optional(),bookId:z.string().optional(),dateKey:DateKey,minutes:Money.optional(),pages:Money.optional(),note:z.string().optional(),application:z.string().optional(),tags:z.array(z.string()).optional()}).passthrough();
const CrmSchema=z.object({id:z.string().optional(),name:z.string().optional(),potential:Money.optional(),stage:z.string().optional(),probability:z.number().finite().min(0).max(100).optional(),nextDate:z.string().optional(),timeline:z.array(z.unknown()).optional()}).passthrough();

const BackupSchema=z.object({
  version:z.number().optional(),profile:z.record(z.string(),z.unknown()).optional(),settings:z.record(z.string(),z.unknown()).optional(),
  accounts:z.array(AccountSchema).optional(),debts:z.array(DebtSchema).optional(),workLogs:z.array(WorkSchema).optional(),tennis:z.array(TennisSchema).optional(),books:z.array(BookSchema).optional(),readingLogs:z.array(ReadingSchema).optional(),crmDeals:z.array(CrmSchema).optional(),expenses:z.array(z.record(z.string(),z.unknown())).optional(),incomeLogs:z.array(z.record(z.string(),z.unknown())).optional(),payments:z.array(z.record(z.string(),z.unknown())).optional()
}).passthrough().refine(v=>Object.keys(v).some(k=>["profile","settings","debts","accounts","books","expenses","incomeLogs","payments","workLogs","tennis","readingLogs","crmDeals"].includes(k)),{message:"Файл не похож на резервную копию Life RPG"});

const ReadingListSchema=z.object({format:z.literal("life-rpg-reading-list-v1"),title:z.string().optional(),books:z.array(z.object({order:z.number().int().positive().optional(),author:z.string().optional(),title:z.string().min(1),totalPages:Money.optional()}).passthrough()).min(1)}).passthrough();
const StatementTxSchema=z.object({date:z.string().min(8),amount:z.number().finite().optional(),signedAmount:z.number().finite().optional(),kind:z.string().min(1)}).passthrough().refine(x=>Number.isFinite(x.amount)||Number.isFinite(x.signedAmount),{message:"Операция выписки без суммы"});
const AiActionSchema=z.discriminatedUnion("type",[
  z.object({type:z.literal("income"),amount:Money,date:z.string().optional()}).passthrough(),
  z.object({type:z.literal("expense"),amount:Money,date:z.string().optional()}).passthrough(),
  z.object({type:z.literal("debt_update"),debt:z.string().optional(),name:z.string().optional(),balance:Money.optional(),rate:Money.optional(),min:Money.optional()}).passthrough(),
  z.object({type:z.literal("asset_update"),name:z.string().min(1),value:Money}).passthrough(),
  z.object({type:z.literal("transfer"),amount:Money,from:z.string().optional(),to:z.string().optional()}).passthrough()
]);
const AiPackageSchema=z.union([
  z.object({format:z.literal("life-rpg-statement-import-v1"),transactions:z.array(StatementTxSchema).min(1)}).passthrough(),
  z.object({format:z.literal("life-rpg-ai-import-v1"),actions:z.array(AiActionSchema)}).passthrough()
]);
const wrap=schema=>value=>{const r=schema.safeParse(value);return r.success?{ok:true,data:r.data}:{ok:false,error:r.error.issues?.[0]?.message||"Данные не прошли проверку"}};
function refreshIcons(){try{createIcons({icons,attrs:{"stroke-width":2,"aria-hidden":"true"}})}catch{}}
const previous=window.LifePlatform||{};
window.LifePlatform={...previous,mode:"vite",zod:true,lucide:true,workbox:true,validateBackup:wrap(BackupSchema),validateReadingList:wrap(ReadingListSchema),validateAiPackage:wrap(AiPackageSchema),refreshIcons,status:()=>"Zod deep ✓ • Lucide ✓ • Workbox ✓"};
refreshIcons();
window.addEventListener("DOMContentLoaded",refreshIcons,{once:true});
window.dispatchEvent(new CustomEvent("life-platform-ready"));
