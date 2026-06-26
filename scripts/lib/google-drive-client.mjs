import {googleToken} from "./google-service-account.mjs";

const SCOPE="https://www.googleapis.com/auth/drive.readonly";
const MEDIA_MIME_PREFIXES=["image/","video/"];
const FOLDER_MIME="application/vnd.google-apps.folder";

export class GoogleDriveClient{
  constructor(env=process.env){this.env=env}

  folderId(url){
    const value=String(url||"");
    const folderMatch=value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if(folderMatch)return folderMatch[1];
    const idParam=value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return idParam?.[1]||null;
  }

  async listChildFolders(folderUrl){
    const id=this.folderId(folderUrl);
    if(!id)return[];
    const q=`'${id}' in parents and trashed = false and mimeType = '${FOLDER_MIME}'`;
    const url=new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q",q);
    url.searchParams.set("fields","files(id,name,mimeType,createdTime,modifiedTime)");
    url.searchParams.set("orderBy","name");
    const data=await this.request(url);
    return(data.files||[]).map(f=>({...f,url:`https://drive.google.com/drive/folders/${f.id}`}));
  }

  async findChildFolderByName(parentFolderUrl,names=[]){
    const wanted=new Set(names.map(normalizeName).filter(Boolean));
    if(!wanted.size)return null;
    const folders=await this.listChildFolders(parentFolderUrl);
    return folders.find(folder=>wanted.has(normalizeName(folder.name)))||null;
  }

  async listMedia(folderUrl){
    const id=this.folderId(folderUrl);
    if(!id)return[];
    const q=`'${id}' in parents and trashed = false`;
    const url=new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q",q);
    url.searchParams.set("fields","files(id,name,mimeType,createdTime,modifiedTime,md5Checksum)");
    url.searchParams.set("orderBy","createdTime,name");
    const data=await this.request(url);
    return(data.files||[])
      .filter(f=>MEDIA_MIME_PREFIXES.some(prefix=>String(f.mimeType).startsWith(prefix)))
      .map(f=>({...f,mediaType:String(f.mimeType).startsWith("video/")?"video":"image"}));
  }

  async listImages(folderUrl){
    return (await this.listMedia(folderUrl)).filter(file=>file.mediaType==="image");
  }

  async download(fileId){
    return this.request(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,{},true);
  }

  async request(url,init={},binary=false){
    const token=await googleToken([SCOPE],this.env),res=await fetch(url,{...init,headers:{authorization:`Bearer ${token}`,...(init.headers||{})}});
    if(!res.ok)throw new Error(`Google Drive API failed: ${res.status} ${await res.text()}`);
    return binary?{bytes:new Uint8Array(await res.arrayBuffer()),contentType:res.headers.get("content-type")||"application/octet-stream"}:res.json();
  }
}

function normalizeName(value){return String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
