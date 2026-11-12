import {certificateMarkup,certificateEscape as esc,downloadCertificate} from "./certificate-renderer.js?v=20261112";
const ENDPOINT="https://gnfyidajbectlppsekzj.supabase.co/functions/v1/andre-certificates";
const date=v=>v?new Date(v).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}):"—";
export function createStudentCertificates({db,notify,root}){
 let current=null;
 async function api(action,params={}){
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw Error("Sign in to view your certificates.");
  const r=await fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},body:JSON.stringify({action,...params})});
  const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||"Certificate service is unavailable");return data;
 }
 async function load(){
  const holder=root.querySelector("#student-certificate-area");
  if(!holder)return;holder.innerHTML='<p class="muted">Loading your certificates…</p>';
  try{
   const result=await api("my_certificates");
   if(!holder.isConnected)return;
   const issued=result.certificates||[],pending=result.eligibleCourses||[];
   holder.innerHTML='<div class="ae-student-cert-intro"><span class="ae-cert-overline">YOUR ACHIEVEMENTS</span><h2>Certificates of completion</h2><p>When you complete every published lesson and quiz in a course, your certificate is issued with a unique tracking number. You can view and download it here.</p></div>'+
    (issued.length?'<div class="ae-student-cert-grid">'+issued.map(c=>
      '<article class="ae-student-cert-card"><span class="ae-cert-overline">CERTIFICATE ISSUED</span><h3>'+esc(c.course_title)+'</h3><p>Certificate number: <strong>'+esc(c.certificate_number)+'</strong></p><p>Issued '+date(c.issued_at)+'</p><div class="ae-cert-controls"><button type="button" class="ae-cert-button primary" data-student-cert="'+c.id+'">View certificate</button></div></article>'
    ).join("")+'</div>':'<section class="ae-student-cert-empty"><strong>No certificates issued yet</strong><p>Complete the lessons and quizzes in an enrolled course to earn your first certificate.</p></section>')+
    (pending.length?'<section class="ae-student-cert-pending"><h3>Courses awaiting certificate issuance</h3><p>Once you finish a course, use Check Completion to verify and issue your certificate.</p>'+pending.map(c=>'<div class="ae-student-cert-pending-row"><span>'+esc(c.title)+'</span><button class="ae-cert-button" type="button" data-cert-check="'+c.courseId+'">Check completion</button></div>').join("")+'</section>':'')+
    '<section id="student-cert-view" class="ae-student-cert-view" hidden></section><p id="student-cert-status" role="status" aria-live="polite"></p>';
   const notice=(text,error=false)=>{const el=holder.querySelector("#student-cert-status");if(el){el.textContent=text;el.classList.toggle("error",error)}else notify(text,error)};
   holder.querySelectorAll("[data-student-cert]").forEach(btn=>btn.onclick=()=>{
    current=issued.find(c=>c.id===btn.dataset.studentCert);if(!current)return;
    const view=holder.querySelector("#student-cert-view");
    view.hidden=false;view.innerHTML='<div class="ae-student-cert-view-top"><h3>'+esc(current.course_title)+'</h3><div class="ae-cert-controls"><button type="button" class="ae-cert-button primary" id="student-cert-download">Download PDF</button><button type="button" class="ae-cert-button" id="student-cert-close">Close</button></div></div>'+certificateMarkup(current)+'<p class="ae-cert-id-note">Certificate tracking number: '+esc(current.certificate_number)+'</p>';
    view.querySelector("#student-cert-close").onclick=()=>{view.hidden=true;current=null;view.innerHTML=""};
    view.querySelector("#student-cert-download").onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await downloadCertificate(view.querySelector(".ae-certificate"),current.certificate_number);notice("Certificate PDF downloaded")}catch(e){notice("PDF download failed: "+e.message,true)}finally{button.disabled=false}};
    view.scrollIntoView({behavior:"smooth",block:"start"});
   });
   holder.querySelectorAll("[data-cert-check]").forEach(btn=>btn.onclick=async()=>{
    btn.disabled=true;try{
      const result=await api("issue_mine",{courseId:btn.dataset.certCheck});
      notify("Certificate "+result.certificate.certificate_number+" is ready.");
      await load();
      holder.querySelector('[data-student-cert="'+result.certificate.id+'"]')?.click();
    }catch(e){notice(e.message||"Not eligible yet",true);btn.disabled=false}
   });
  }catch(e){if(holder.isConnected)holder.innerHTML='<div role="alert" class="ae-student-cert-error">'+esc(e.message)+'</div><button class="ae-cert-button" id="student-certificate-retry">Retry</button>';holder.querySelector("#student-certificate-retry")?.addEventListener("click",load)}
 }
 return {load};
}
