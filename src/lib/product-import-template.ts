import { getImportTemplate, importTemplateCsv } from "@/lib/mass-import-templates";

export const productImportHeaders = getImportTemplate("full_product").headers;
export const productImportExample = getImportTemplate("full_product").example;

export function productImportTemplateCsv() {
  return importTemplateCsv("full_product");
}
