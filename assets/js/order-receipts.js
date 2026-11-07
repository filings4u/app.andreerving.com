// Andre Erving customer receipt downloads. Authenticated orders only.
// No checkout confirmation token is required, and the PDF is built locally.
const PAGE_W=612,PAGE_H=792;
const enc=new TextEncoder();
const validId=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
const money=(v,c='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD'}).format(Number(v)||0);
const date=v=>new Date(v).toLocaleString('en-US',{dateStyle:'long',timeStyle:'short'});
const cleaned=v=>String(v??'').normalize('NFKD').replace(/[^\x20-\x7e]/g,' ').replace(/[\\()]/g,m=>'\\'+m);
const txt=(value,x,y,size=11,bold=false,color='0.07 0.16 0.27')=>color+' rg\nBT /'+(bold?'F2':'F1')+' '+size+' Tf 1 0 0 1 '+x+' '+y+' Tm ('+cleaned(value)+') Tj ET\n';
const box=(x,y,w,h,color)=>color+' rg\n'+x+' '+y+' '+w+' '+h+' re f\n';
function wrap(value,limit=52){
 const words=String(value??'').split(/\s+/),rows=[];let row='';
 for(const word of words){if(!word)continue;
  if((row+' '+word).trim().length>limit&&row){rows.push(row);row=''}
  if(word.length>limit){if(row){rows.push(row);row=''}for(let n=0;n<word.length;n+=limit)rows.push(word.slice(n,n+limit))}
  else row=(row+' '+word).trim()
 }if(row)rows.push(row);return rows.length?rows:['—'];
}
async function logoBytes(){
 try{
  const image=new Image();image.decoding='async';
  image.src=new URL('images/logo.png',document.baseURI).href;
  await image.decode();
  const canvas=document.createElement('canvas'),ratio=image.naturalWidth/image.naturalHeight;
  canvas.width=700;canvas.height=Math.max(1,Math.round(700/ratio));
  const context=canvas.getContext('2d');
  if(!context)return null;
  context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(image,0,0,canvas.width,canvas.height);
  const base64=canvas.toDataURL('image/jpeg',.94).split(',')[1],binary=atob(base64),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return {bytes,width:canvas.width,height:canvas.height};
 }catch(error){console.warn('Receipt logo unavailable',error);return null}
}
function generatePages(order,items,logo){
 const pages=[],chunkSize=8;
 for(let offset=0;offset<items.length;offset+=chunkSize){
  const pageNumber=pages.length+1,last=offset+chunkSize>=items.length;
  let commands=box(0,0,PAGE_W,PAGE_H,'1 1 1');
  if(logo){const width=246,height=Math.min(74,246*logo.height/logo.width);
   commands+='q '+width+' 0 0 '+height+' 41 '+(708+(74-height)/2)+' cm /Brand Do Q\n';
  }else{
   commands+=box(43,715,43,43,'0.11 0.29 0.77')+txt('AE',51,729,20,true,'1 1 1');
   commands+=txt('ANDRE ERVING',98,736,18,true)+txt('GROWTH  |  STRATEGY  |  EDUCATION',98,720,8,true,'0.77 0.57 0.19');
  }
  commands+=txt('OFFICIAL ORDER RECEIPT',424,745,9,true,'0.11 0.29 0.71');
  commands+=txt('andreerving.com',486,726,8,false,'0.38 0.48 0.61');
  commands+=box(42,688,528,3,'0.80 0.60 0.21');
  commands+=box(42,577,528,95,'0.055 0.14 0.26');
  commands+=txt('ANDRE ERVING  /  PURCHASE CONFIRMATION',62,646,9,true,'0.93 0.75 0.43');
  commands+=txt(Number(order.total)===0?'Complimentary order':'Payment receipt',62,608,24,true,'1 1 1');
  commands+=txt('Confirmed  |  '+(Number(order.total)===0?'No payment charged':'Payment received'),62,588,10,false,'0.85 0.91 0.97');
  commands+=txt('ORDER NUMBER',43,546,9,true,'0.41 0.50 0.62');
  commands+=txt(order.order_number,43,524,12,true);
  commands+=txt('PURCHASE DATE',337,546,9,true,'0.41 0.50 0.62');
  commands+=txt(date(order.created_at),337,524,10,true);
  commands+=box(42,505,528,1,'0.86 0.91 0.95');
  commands+=txt('CUSTOMER',43,479,9,true,'0.41 0.50 0.62');
  commands+=txt(order.customer_name||[order.customer_first_name,order.customer_last_name].filter(Boolean).join(' ')||'Customer',43,459,11,true);
  commands+=txt('RECEIPT EMAIL',337,479,9,true,'0.41 0.50 0.62');
  commands+=txt(order.customer_email||'—',337,459,10,true);
  commands+=box(42,435,528,1,'0.86 0.91 0.95');
  commands+=txt('PURCHASE SUMMARY',43,412,12,true);
  commands+=box(42,370,528,27,'0.95 0.97 0.99');
  commands+=txt('ITEM',54,380,9,true,'0.39 0.48 0.60')+txt('QTY',437,380,9,true,'0.39 0.48 0.60')+txt('AMOUNT',503,380,9,true,'0.39 0.48 0.60');
  let y=345;
  for(const item of items.slice(offset,offset+chunkSize)){
   const lines=wrap(item.item_name,52).slice(0,2);
   for(let i=0;i<lines.length;i++)commands+=txt(lines[i],54,y-i*13,10);
   commands+=txt(item.quantity||1,440,y,10);
   commands+=txt(money(item.line_total,order.currency),500,y,10,true);
   y-=Math.max(27,lines.length*13+6);
   commands+=box(43,y+12,526,0.6,'0.88 0.91 0.95');
  }
  if(last){
   commands+=box(42,71,528,63,'0.92 0.95 0.99');
   commands+=txt(Number(order.total)===0?'TOTAL':'TOTAL PAID',59,95,12,true);
   commands+=txt(money(order.total,order.currency),445,93,21,true,'0.12 0.30 0.66');
  }else commands+=txt('Continued on next page',43,87,10,false,'0.42 0.51 0.62');
  commands+=txt('THANK YOU FOR CHOOSING ANDRE ERVING',43,56,8,true);
  commands+=txt('support@andreerving.com',43,39,8,false,'0.40 0.49 0.60');
  commands+=txt('Page '+pageNumber,533,39,8,false,'0.40 0.49 0.60');
  commands+=box(0,0,612,8,'0.80 0.60 0.21');
  pages.push(enc.encode(commands));
 }
 return pages;
}
function pdfBlob(order,items,logo){
 const pages=generatePages(order,items,logo);
 const contents=[],offsets=[0],objects=[],putBytes=x=>contents.push(x),put=x=>putBytes(enc.encode(x));
 const length=()=>contents.reduce((total,x)=>total+x.byteLength,0);
 const count=pages.length,firstPageId=3,fontsId=3+count*2,imgId=fontsId+2;
 objects.push('<< /Type /Catalog /Pages 2 0 R >>');
 objects.push('<< /Type /Pages /Kids ['+pages.map((_,i)=>(firstPageId+i*2)+' 0 R').join(' ')+'] /Count '+count+' >>');
 for(let i=0;i<count;i++){
  const pageId=firstPageId+i*2,contentId=pageId+1;
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 '+fontsId+' 0 R /F2 '+(fontsId+1)+' 0 R >>'+(logo?' /XObject << /Brand '+imgId+' 0 R >>':'')+' >> /Contents '+contentId+' 0 R >>');
  objects.push({stream:pages[i],dict:'<< /Length '+pages[i].length+' >>'});
 }
 objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
 if(logo)objects.push({stream:logo.bytes,dict:'<< /Type /XObject /Subtype /Image /Width '+logo.width+' /Height '+logo.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+logo.bytes.length+' >>'});
 put('%PDF-1.4\n');
 for(let i=0;i<objects.length;i++){
  offsets.push(length());put((i+1)+' 0 obj\n');
  const item=objects[i];
  if(typeof item==='string')put(item);
  else{put(item.dict+'\nstream\n');putBytes(item.stream);put('\nendstream')}
  put('\nendobj\n');
 }
 const xref=length();put('xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n');
 for(const offset of offsets.slice(1))put(String(offset).padStart(10,'0')+' 00000 n \n');
 put('trailer\n<< /Root 1 0 R /Size '+(objects.length+1)+' >>\nstartxref\n'+xref+'\n%%EOF\n');
 return new Blob(contents,{type:'application/pdf'});
}
export async function downloadOrderReceipt(db,orderId,currentUser){
 if(!validId(orderId)||!currentUser?.id||!currentUser.email||!currentUser.email_confirmed_at)throw Error('A verified customer account is required.');
 const {data:order,error}=await db.from('orders')
  .select('id,user_id,order_number,customer_name,customer_first_name,customer_last_name,customer_email,total,currency,status,created_at')
  .eq('id',orderId).maybeSingle();
 if(error||!order)throw Error('Order not found or access denied.');
 const owns=order.user_id===currentUser.id||String(order.customer_email||'').toLowerCase()===currentUser.email.toLowerCase();
 if(!owns)throw Error('This receipt does not belong to your account.');
 if(!['paid','completed'].includes(order.status))throw Error('A confirmed order is required to download a receipt.');
 const result=await db.from('order_items').select('item_name,quantity,line_total').eq('order_id',orderId).order('created_at',{ascending:true}).limit(100);
 if(result.error)throw Error('Unable to load the purchased items: '+result.error.message);
 if(!result.data?.length)throw Error('This order is missing itemized details. Please contact support.');
 const logo=await logoBytes(),blob=pdfBlob(order,result.data,logo);
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;
 link.download='Andre-Erving-Receipt-'+String(order.order_number||order.id).replace(/[^A-Za-z0-9-]/g,'')+'.pdf';
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
 return true;
}
