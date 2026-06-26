type ProductCommandSyncResult = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  created: number;
  updated: number;
  blocked: number;
  conflicts: number;
  mediaUploads: number;
  mediaSkipped?: number;
  errors: Array<{ row: number; message: string }>;
};

declare module "../../../../../scripts/lib/product-command-sync.mjs" {
  export function runProductCommandSync(options?: { env?: NodeJS.ProcessEnv; dryRun?: boolean }): Promise<ProductCommandSyncResult>;
  export function syncDriveMedia(options: Record<string, unknown>): Promise<void>;
}

declare module "../../scripts/lib/product-command-sync.mjs" {
  export function runProductCommandSync(options?: { env?: NodeJS.ProcessEnv; dryRun?: boolean }): Promise<ProductCommandSyncResult>;
  export function syncDriveMedia(options: Record<string, unknown>): Promise<void>;
}
declare module "../../scripts/lib/google-drive-client.mjs" {
  export class GoogleDriveClient {
    constructor(env?: NodeJS.ProcessEnv);
    env: NodeJS.ProcessEnv;
    folderId(url: string): string | null;
    listMedia(folderUrl: string): Promise<Array<{ id: string; name: string; mediaType: "image" | "video" }>>;
    listChildFolders(folderUrl: string): Promise<Array<{ id: string; name: string; url: string }>>;
    findChildFolderByName(parentFolderUrl: string, names: string[]): Promise<{ id: string; name: string; url: string } | null>;
    download(fileId: string): Promise<{ bytes: Uint8Array; contentType: string }>;
  }
}

declare module "../../scripts/lib/google-sheets-client.mjs" {
  export class GoogleSheetsClient {
    constructor(options: { spreadsheetId: string; env?: NodeJS.ProcessEnv });
    getValues(range: string): Promise<unknown[][]>;
    batch(data: Array<{ range: string; values: unknown[][] }>, option?: string): Promise<void>;
    clear(ranges: string[]): Promise<void>;
  }
}
