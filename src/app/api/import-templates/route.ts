import { getImportTemplate, importTemplateCsv } from "@/lib/mass-import-templates";

export async function GET(request: Request) {
  const templateKey = new URL(request.url).searchParams.get("type");
  const template = getImportTemplate(templateKey);
  const date = new Date().toISOString().slice(0, 10);

  return new Response(importTemplateCsv(template.key), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${template.filename}-${date}.csv"`,
    },
  });
}
