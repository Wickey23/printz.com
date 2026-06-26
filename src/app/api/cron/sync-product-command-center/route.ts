import {revalidatePath} from "next/cache";
import {runProductCommandSync} from "../../../../../scripts/lib/product-command-sync.mjs";
export const runtime="nodejs";
export const maxDuration=300;
export async function GET(request:Request){return handle(request)}
export async function POST(request:Request){return handle(request)}
async function handle(request:Request){const secret=process.env.PRODUCT_SYNC_SECRET||process.env.CRON_SECRET,auth=request.headers.get("authorization"),url=new URL(request.url);if(!secret||(auth!==`Bearer ${secret}`&&url.searchParams.get("secret")!==secret))return Response.json({ok:false,message:"Unauthorized."},{status:401});try{const dryRun=url.searchParams.get("dryRun")==="true",result=await runProductCommandSync({dryRun});if(!dryRun){revalidatePath("/");revalidatePath("/products");revalidatePath("/admin")}return Response.json({ok:result.errors.length===0,...result},{status:result.errors.length?207:200})}catch(error){return Response.json({ok:false,message:error instanceof Error?error.message:"Product command-center sync failed."},{status:500})}}
