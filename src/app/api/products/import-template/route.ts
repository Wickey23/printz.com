import { productImportTemplateCsv } from "@/lib/product-import-template";

export async function GET() {
  return new Response(productImportTemplateCsv(), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="printz-product-import-template-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
