import test from "node:test";
import assert from "node:assert/strict";
import {calculatePrice,findExistingProduct,hasSyncConflict,normalizeUrl,validateProduct} from "./product-command-rules.mjs";
import {syncDriveMedia} from "./product-command-sync.mjs";
test("normalizes URLs",()=>assert.equal(normalizeUrl("https://www.makerworld.com/en/models/123/?from=search&utm_source=x#profile"),"https://makerworld.com/en/models/123"));
test("matches source URL",()=>{const match=findExistingProduct({source_url:"https://example.com/model/1?utm_source=x"},[{id:"1",source_url:"https://example.com/model/1"}]);assert.equal(match.product.id,"1")});
test("detects conflicts",()=>{assert.equal(hasSyncConflict({sync_version:2},{sync_version:3}),true);assert.equal(hasSyncConflict({sync_version:3},{sync_version:3}),false)});
test("requires attribution",()=>{const r=validateProduct({name:"Holder",slug:"holder",short_description:"Useful holder",category:"Organization",source_url:"https://example.com/model",license_type:"CC BY 4.0",rights_status:"Approved",active:true,main_image_url:"https://example.com/a.jpg"});assert.equal(r.valid,false);assert.match(r.errors.join(" "),/Creator name/)});
test("allows active product with Drive media folder pending import",()=>{const r=validateProduct({name:"Holder",slug:"holder",short_description:"Useful holder",category:"Organization",rights_status:"Approved",active:true,drive_media_folder_url:"https://drive.google.com/drive/folders/demo"});assert.equal(r.valid,true)});
test("calculates price",()=>{const r=calculatePrice({estimated_grams:100,estimated_print_hours:5});assert.equal(r.status,"Calculated");assert.ok(r.suggestedPrice>r.estimatedCost)});

test("syncs Drive images and videos without overwriting existing main image",async()=>{
  const calls=[];
  const supabase=mockSupabase(calls);
  const drive={
    listMedia:async()=>[
      {id:"img1",name:"photo.jpg",mediaType:"image"},
      {id:"vid1",name:"clip.mp4",mediaType:"video"},
    ],
    download:async(id)=>({bytes:new Uint8Array([1,2,3]),contentType:id==="vid1"?"video/mp4":"image/jpeg"}),
  };
  const sheets={batch:async(items)=>calls.push(["sheetBatch",items])};
  const idx=new Map([["Media Status",0],["Video URL",1],["Drive Media Folder URL",2],["Main Image (Drive or Direct URL)",3]]);
  const product={id:"p1",main_image_url:"https://site/main.jpg",video_url:null};
  const report={mediaUploads:0,mediaSkipped:0};

  await syncDriveMedia({drive,supabase,product,folderUrl:"https://drive.google.com/drive/folders/f1",row:{},idx,rowNumber:2,sheets,report});

  assert.equal(product.main_image_url,"https://site/main.jpg");
  assert.equal(product.video_url,"https://public/products/p1/vid1-clip.mp4");
  assert.equal(report.mediaUploads,2);
  assert.equal(calls.some(call=>call[0]==="insertMedia"&&call[1].some(row=>row.media_type==="video")),true);
});

test("does not delete existing gallery when Drive folder listing fails",async()=>{
  const calls=[];
  const supabase=mockSupabase(calls);
  const drive={listMedia:async()=>{throw new Error("Drive denied")}};
  const sheets={batch:async(items)=>calls.push(["sheetBatch",items])};
  await assert.rejects(()=>syncDriveMedia({drive,supabase,product:{id:"p1"},folderUrl:"bad",idx:new Map(),rowNumber:2,sheets,report:{mediaUploads:0,mediaSkipped:0}}),/Drive denied/);
  assert.equal(calls.some(call=>call[0]==="deleteMedia"),false);
  assert.equal(calls.some(call=>call[0]==="updateProduct"&&call[1].media_status==="Error"),true);
});

function mockSupabase(calls){
  return {
    storage:{
      from:()=>({
        getPublicUrl:(path)=>({data:{publicUrl:`https://public/${path}`}}),
        list:async()=>({data:[],error:null}),
        upload:async(path,bytes,options)=>{calls.push(["upload",path,options.contentType,bytes.length]);return {error:null}},
      }),
    },
    from:(table)=>({
      update:(patch)=>({eq:async()=>{calls.push([table==="products"?"updateProduct":"update",patch]);return {error:null}}}),
      delete:()=>({eq:async()=>{calls.push([table==="product_media"?"deleteMedia":"delete"]);return {error:null}}}),
      insert:async(rows)=>{calls.push([table==="product_media"?"insertMedia":"insert",rows]);return {error:null}},
    }),
  };
}