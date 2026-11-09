import {createClient} from "https://esm.sh/@supabase/supabase-js@2.58.0";
const db=createClient("https://gnfyidajbectlppsekzj.supabase.co","sb_publishable_DGt4HrHAwWyMt-0Xtzlfog_F18RnOyf");
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const by=id=>document.getElementById(id);
let sessions=[],busy=false;
const status=(message,error=false)=>{by("live-status").textContent=message;by("live-status").classList.toggle("error",error)};
async function api(action,values={}){
 const {data,error}=await db.functions.invoke("andre-live-training",{body:{action,...values}});
 if(error){let detail;try{detail=await error.context?.json()}catch{}throw Error(detail?.error||error.message)}
 if(data?.error)throw Error(data.error);return data;
}
const format=s=>new Date(s).toLocaleString(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
function render(){
 const root=by("live-sessions");
 if(!sessions.length){root.innerHTML='<div class="live-empty"><strong>No live sessions available yet.</strong><p>Upcoming sessions for your enrolled courses will appear here after the instructor schedules them.</p></div>';return}
 root.innerHTML=sessions.map(s=>{
 const opens=new Date(s.start_at).getTime()-30*60000,now=Date.now(),closes=new Date(s.end_at).getTime()+60*60000;
 const canJoin=s.registered&&now>=opens&&now<=closes;
 return '<article class="live-card"><span class="live-course">'+esc(s.course_title)+'</span><h3>'+esc(s.title)+'</h3><p>'+esc(s.description||"Instructor-led training and discussion.")+'</p>'+(s.registered?'<span class="live-tag">Registered</span>':'')+'<div class="live-card-meta"><span>◷ '+esc(format(s.start_at))+' – '+esc(new Date(s.end_at).toLocaleTimeString(undefined,{timeStyle:"short"}))+'</span><span>Training timezone: '+esc(s.timezone)+'</span><span>Instructor: '+esc(s.host_name)+'</span></div><div class="live-card-actions">'+(s.registered?'<button class="primary" data-join="'+esc(s.id)+'" '+(canJoin?'':'disabled')+'>Join Meeting</button><button data-cancel="'+esc(s.id)+'">Cancel registration</button>':'<button class="primary" data-register="'+esc(s.id)+'" '+(s.registered_count>=s.capacity||now>=new Date(s.start_at).getTime()?'disabled':'')+'>Register for session</button>')+'</div>'+(s.registered&&!canJoin?'<p>Join opens 30 minutes before the start.</p>':'')+'</article>'
 }).join("");
 root.querySelectorAll("[data-register]").forEach(b=>b.onclick=()=>change(b,"register",b.dataset.register));
 root.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=()=>change(b,"unregister",b.dataset.cancel));
 root.querySelectorAll("[data-join]").forEach(b=>b.onclick=async()=>{
  b.disabled=true;try{const s=await api("join",{session_id:b.dataset.join});window.open(s.url,"_blank","noopener,noreferrer");status("Joining "+s.title+".")}catch(e){status(e.message,true)}finally{b.disabled=false}
 });
}
async function change(button,action,id){button.disabled=true;try{await api(action,{session_id:id});await load();status(action==="register"?"You're registered for this live session.":"Registration cancelled.")}catch(e){status(e.message,true)}finally{button.disabled=false}}
async function load(){
 if(busy)return;busy=true;by("live-refresh").disabled=true;
 try{
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user){status("Sign in to your student portal to view live training.",true);by("live-sessions").innerHTML='<a href="index.html#/courses">Sign in to your account</a>';return}
  const result=await api("student_list");sessions=result.sessions||[];render();
  status(sessions.length?"Your eligible live training sessions are shown below.":"No upcoming live sessions are currently scheduled for your enrolled courses.");
 }catch(e){status("Unable to load live training: "+e.message,true)}finally{busy=false;by("live-refresh").disabled=false}
}
by("live-refresh").onclick=load;
db.auth.onAuthStateChange((event)=>{if(event==="SIGNED_IN"||event==="SIGNED_OUT")load()});
load();