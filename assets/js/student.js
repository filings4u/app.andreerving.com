import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import {downloadOrderReceipt} from './order-receipts.js?v=official-full-logo-20261107';
const db=createClient('https://gnfyidajbectlppsekzj.supabase.co','sb_publishable_DGt4HrHAwWyMt-0Xtzlfog_F18RnOyf');
const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmtDate=v=>v?new Date(v).toLocaleDateString():'—',money=(v,c='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD'}).format(Number(v)||0);
const state={user:null,page:'dashboard',profile:null,orders:[],enrollments:[],courses:[],documents:[],progress:[],tickets:[],selectedTicket:null,loaded:false,refreshing:false,ebookOrders:[],extensionPrices:{},channel:null,messageChannel:null};
function notify(message,error=false){const n=$('toast');n.querySelector('.student-toast-content').textContent=message;n.className='visible'+(error?' error':'');n.querySelector('.student-toast-dismiss').onclick=()=>{n.className=''};setTimeout(()=>{if(n.querySelector('.student-toast-content').textContent===message)n.className=''},4200)}
const heading=(title,sub)=>'<div class="page-heading"><span class="eyebrow">MY ACCOUNT / '+esc(title.toUpperCase())+'</span><h1>'+esc(title)+'</h1><p>'+esc(sub)+'</p></div>';
const empty=(title,sub,link='')=>'<div class="empty"><strong>'+esc(title)+'</strong><div>'+esc(sub)+'</div>'+link+'</div>';
const button=(label,page)=>'<button class="action secondary" data-route="'+page+'">'+esc(label)+'</button>';
const progressFor=id=>{
 const course=state.courses.find(c=>c.id===id);
 const lessonIds=course?.lessonIds||[];
 const completedIds=new Set(state.progress.filter(p=>p.course_id===id&&p.completed).map(p=>p.lesson_id));
 const completed=lessonIds.filter(lessonId=>completedIds.has(lessonId)).length;
 const total=lessonIds.length;
 return {completed,total,percentage:total?Math.min(100,Math.round(100*completed/total)):0};
};
async function read(table,columns='*',sort='created_at'){
 if(!state.user)return [];
 let q=db.from(table).select(columns).eq('user_id',state.user.id);
 if(sort)q=q.order(sort,{ascending:false});
 const {data,error}=await q.limit(250);
 if(error)throw new Error(table+': '+error.message);
 return data||[];
}
async function ownOrders(){
 const u=state.user;if(!u)return [];
 const columns='id,order_number,total,currency,status,created_at';
 const byId=db.from('orders').select(columns).eq('user_id',u.id).order('created_at',{ascending:false}).limit(250);
 const byEmail=db.from('orders').select(columns).eq('customer_email',u.email.toLowerCase()).order('created_at',{ascending:false}).limit(250);
 const [idResult,emailResult]=await Promise.all([byId,byEmail]);
 if(idResult.error||emailResult.error)throw Error('Unable to load purchase history');
 return [...new Map([...(idResult.data||[]),...(emailResult.data||[])].map(row=>[row.id,row])).values()].sort((x,y)=>new Date(y.created_at)-new Date(x.created_at));
}
async function load(){const u=state.user;if(!u)return;const snapshotUser=u.id;
const results=await Promise.allSettled([db.from('customer_profiles').select('full_name,phone,email').eq('id',u.id).maybeSingle(),ownOrders(),read('course_enrollments','id,course_id,status,enrolled_at,expires_at,completed_at','enrolled_at'),read('customer_documents','id,title,description,file_url,document_type,created_at'),read('lesson_progress','course_id,lesson_id,completed','updated_at'),read('support_tickets','id,subject,category,status,priority,created_at,updated_at')]);
if(state.user?.id!==snapshotUser)return;
const [profile,orders,enrollments,documents,progress,tickets]=results;
state.profile=profile.status==='fulfilled'?profile.value.data:null;
for(const [key,item] of [['orders',orders],['enrollments',enrollments],['documents',documents],['progress',progress],['tickets',tickets]]){if(item.status==='fulfilled')state[key]=item.value;else{state[key]=[];notify('Unable to load '+key+'. Please refresh.',true)}}
const ids=[...new Set(state.enrollments.map(e=>e.course_id))];state.courses=[];
if(ids.length){const {data,error}=await db.from('courses').select('id,title,short_description,category,featured_image_url,slug').in('id',ids);if(!error)state.courses=data||[];
const lessonRows=[];
 for(let start=0;start<ids.length;start+=30){
  for(let offset=0;;offset+=500){
   const {data:lessons,error:lessonError}=await db.from('course_lessons').select('id,course_id').in('course_id',ids.slice(start,start+30)).range(offset,offset+499);
   if(lessonError){console.warn('Unable to load course lesson counts',lessonError);break}
   lessonRows.push(...(lessons||[]));if(!lessons||lessons.length<500)break;
  }
 }
 state.courses.forEach(course=>{course.lessonIds=[...new Set(lessonRows.filter(l=>l.course_id===course.id).map(l=>l.id))];course.lessonCount=course.lessonIds.length})}
if(ids.length){
 const prices=await db.from('course_extension_prices').select('course_id,amount,enabled,days').in('course_id',ids);
 if(!prices.error)state.extensionPrices=Object.fromEntries((prices.data||[]).map(x=>[x.course_id,x]));
 else console.warn('Extension pricing unavailable',prices.error);
}else state.extensionPrices={};
state.enrollments=state.enrollments.filter(e=>e.course_id!=='e2bbeac6-c901-4f03-816c-ab25958cbc43');
state.courses=state.courses.filter(c=>c.id!=='e2bbeac6-c901-4f03-816c-ab25958cbc43');
state.loaded=true;
}
function courseCards(items){return '<div class="cards">'+items.map(e=>{const c=state.courses.find(c=>c.id===e.course_id);const p=progressFor(e.course_id);return '<article class="course-card"><span class="tag">'+esc(e.status)+'</span><h3>'+esc(c?.title||'Course')+'</h3><p>'+esc(c?.short_description||c?.category||'Your learning journey')+'</p><div class="ae-course-progress" data-progress-course="'+esc(e.course_id)+'"><div class="ae-progress-header"><span>Course progress</span><strong>'+p.percentage+'%</strong></div><div class="progress-track" role="progressbar" aria-label="'+esc(c?.title||'Course')+' completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+p.percentage+'"><span style="width:'+p.percentage+'%"></span></div><div class="muted-note">'+p.completed+' of '+p.total+' lessons completed</div></div><div class="row-actions">'+(['active','completed'].includes(e.status)&&e.expires_at&&new Date(e.expires_at)>new Date()
 ?'<button class="action" type="button" data-course="'+esc(e.course_id)+'">Continue learning →</button><span class="ae-access-date">Access ends '+esc(fmtDate(e.expires_at))+'</span>'
 :e.expires_at&&new Date(e.expires_at)<=new Date()&&e.status!=='cancelled'
 ?'<span class="ae-access-expired">Course access expired '+esc(fmtDate(e.expires_at))+'</span>'+
 (state.extensionPrices[e.course_id]?.enabled&&Number(state.extensionPrices[e.course_id].amount)>0?
 '<button class="action ae-extend-button" type="button" data-extend-course="'+esc(e.course_id)+'">Purchase 30-day extension · '+esc(money(state.extensionPrices[e.course_id].amount))+'</button>':
 '<span class="muted-note">Contact support about renewing access.</span>')
 :'<span class="muted-note">Access '+esc(e.status)+'</span>')+'</div></article>'}).join('')+'</div>'}
function classroomPage(){
 const courseId=state.classroomId;
 const enrolled=state.enrollments.some(e=>e.course_id===courseId&&(e.status==='active'||e.status==='completed')&&(!e.expires_at||new Date(e.expires_at)>new Date()));
 if(!enrolled)return heading('Course access','This course is not active for your account.')+'<button class="action secondary" data-route="courses">Back to my courses</button>';
 return '<div class="ae-classroom-head"><div><span class="eyebrow">LEARNING / CLASSROOM</span><h1>'+esc(state.courses.find(c=>c.id===courseId)?.title||'Classroom')+'</h1></div><div class="ae-classroom-controls"><button class="ae-sidebar-toggle" id="ae-sidebar-toggle" type="button" aria-controls="student-nav" aria-expanded="false">Show sidebar</button><button class="action secondary" data-route="courses">← My courses</button></div></div>'+
 '<iframe class="ae-classroom-frame" title="Secure course player" loading="eager" src="training.html?course='+encodeURIComponent(courseId)+'&embedded=1" allow="fullscreen" referrerpolicy="same-origin"></iframe>';
}
function ebookPage(){return heading('My eBooks','Download the digital books you purchased or claimed.')+
 '<section class="panel"><div class="ae-panel-title"><h2>Your eBook library</h2><span class="ae-count">'+state.ebookOrders.length+' titles</span></div>'+
 (state.ebookOrders.length?'<div class="ae-ebook-grid">'+state.ebookOrders.map(o=>'<article class="ae-ebook-tile"><div class="ae-book-art" aria-hidden="true">AE<span>eBOOK</span></div><div><span class="ae-book-eyebrow">DIGITAL LIBRARY</span><h3>'+esc(o.title)+'</h3><p>Purchased '+esc(fmtDate(o.date))+'</p><button class="action" type="button" data-ebook="'+esc(o.id)+'">Download eBook</button></div></article>').join('')+'</div>':empty('No eBooks yet','eBooks you purchase or claim will appear in your library.','<a class="action" href="https://andreerving.com/ebooks.html" target="_blank" rel="noopener noreferrer">Explore eBooks ↗</a>'))+'</section>'}
function dashboard(){const active=state.enrollments.filter(e=>['active','completed'].includes(e.status)&&e.expires_at&&new Date(e.expires_at)>new Date());const completed=state.courses.reduce((sum,course)=>sum+progressFor(course.id).completed,0);const name=state.profile?.full_name?.trim()?.split(' ')[0]||'there';return heading('My dashboard','Everything you need to keep learning and manage your account.')+
'<section class="hero"><div><span class="eyebrow">WELCOME BACK</span><h2>Good to see you, '+esc(name)+'.</h2><p>Pick up where you left off, explore your courses and stay connected.</p></div><div class="hero-stat"><strong>'+active.length+'</strong><span>Active courses</span></div></section>'+
'<div class="metric-grid"><div class="metric"><span>My courses</span><strong>'+state.enrollments.length+'</strong><span>Enrolled</span></div><div class="metric"><span>Lessons completed</span><strong>'+completed+'</strong><span>Learning progress</span></div><div class="metric"><span>Orders</span><strong>'+state.orders.length+'</strong><span>Purchase records</span></div><div class="metric"><span>Support tickets</span><strong>'+state.tickets.filter(t=>!['closed','resolved'].includes(t.status)).length+'</strong><span>Open requests</span></div></div>'+
'<h2 class="section-title">Continue learning</h2>'+(active.length?courseCards(active):'<section class="panel">'+empty('No courses assigned yet','Once you enroll in a course, it will appear here.','<div class="row-actions"><a class="action" href="https://andreerving.com/courses.html" target="_blank" rel="noopener noreferrer">Browse courses ↗</a></div>')+'</section>')+
'<section class="panel"><h2>Quick access</h2><div class="row-actions">'+button('View all courses','courses')+button('Orders & receipts','orders')+button('My eBooks','ebooks')+button('My documents','documents')+button('Contact support','support')+'</div></section>'}
function coursesPage(){return heading('My courses','Access your programs and track learning progress.')+(state.enrollments.length?courseCards(state.enrollments):'<section class="panel">'+empty('You are not enrolled yet','Your courses will appear here after enrollment.','<div class="row-actions"><a class="action" target="_blank" rel="noopener noreferrer" href="https://andreerving.com/courses.html">Explore courses ↗</a></div>')+'</section>')}

function liveTrainingPage(){
 return heading('Live Training Sessions','Register for instructor-led sessions, review your training schedule, and join Microsoft Teams.')+
 '<section class="panel ae-live-training-panel"><div class="ae-live-training-header"><div><span class="eyebrow">FREIGHT BROKER TRAINING / LIVE LEARNING</span><h2>Upcoming live sessions</h2><p class="muted">Select an available session to reserve your seat. Your meeting link opens 30 minutes before class.</p></div><button class="action secondary" id="ae-live-refresh" type="button">Refresh sessions</button></div><div id="ae-live-training-sessions"><p class="muted">Loading live training sessions…</p></div></section>'+
 '<section class="panel ae-live-training-help"><h2>How live training works</h2><p>Choose a session, register to reserve a seat, then use <strong>Join Meeting</strong> when the class opens. Dates display in your local time. Active enrollment in the associated course is required.</p></section>';
}
async function liveTrainingApi(action,body={}){
 const {data,error}=await db.functions.invoke('andre-live-training',{body:{action,...body}});
 if(error){let detail=null;try{detail=await error.context?.json()}catch{}throw new Error(detail?.error||error.message)}
 if(data?.error)throw new Error(data.error);
 return data;
}
let latestLiveSessionsSignature='';let liveFetchSequence=0;
async function mountLiveTraining(){
 const holder=$('ae-live-training-sessions');
 if(!holder||state.page!=='live-training')return;
 const refresh=$('ae-live-refresh');
 const fetchSequence=++liveFetchSequence;
 if(refresh)refresh.disabled=true;
 try{
  const result=await liveTrainingApi('student_list');
  if(state.page!=='live-training'||!holder.isConnected||fetchSequence!==liveFetchSequence)return;
  const sessions=result.sessions||[];
  const signature=JSON.stringify({sessions,joinAvailability:sessions.map(x=>x.registered&&Date.now()>=new Date(x.start_at).getTime()-1800000&&Date.now()<=new Date(x.end_at).getTime()+3600000)});
  if(signature===latestLiveSessionsSignature&&holder.dataset.loaded==='1')return;
  latestLiveSessionsSignature=signature;holder.dataset.loaded='1';
  const fmt=(value,options)=>new Date(value).toLocaleString(undefined,options);
  holder.innerHTML=sessions.length?'<div class="ae-live-session-grid">'+sessions.map(session=>{
   const start=new Date(session.start_at).getTime(),end=new Date(session.end_at).getTime(),now=Date.now();
   const joinOpen=session.registered&&now>=start-30*60000&&now<=end+60*60000;
   const space=Math.max(0,session.capacity-session.registered_count);
   return '<article class="ae-live-session"><span class="ae-live-course-name">'+esc(session.course_title||'Freight Broker Training')+'</span><h3>'+esc(session.title)+'</h3><p>'+esc(session.description||'Instructor-led training and practical exercises.')+'</p>'+
    '<div class="ae-live-session-details"><span><strong>When:</strong> '+esc(fmt(session.start_at,{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}))+' – '+esc(fmt(session.end_at,{hour:'numeric',minute:'2-digit'}))+'</span><span><strong>Training timezone:</strong> '+esc(session.timezone||'America/Chicago')+'</span><span><strong>Instructor:</strong> '+esc(session.host_name||'Andre Erving Training')+'</span></div>'+
    (session.registered?'<p class="ae-live-registered">✓ You are registered</p>':'')+
    '<div class="row-actions ae-live-session-actions">'+(session.registered?
       '<button type="button" class="action" data-live-join="'+esc(session.id)+'" '+(joinOpen?'':'disabled')+'>Join Meeting</button><button type="button" class="action secondary" data-live-cancel="'+esc(session.id)+'">Cancel registration</button>':
       '<button type="button" class="action" data-live-register="'+esc(session.id)+'" '+(space===0||now>=start?'disabled':'')+'>Register for session</button>')+'</div>'+
    (session.registered&&!joinOpen?'<p class="muted">Join opens 30 minutes before the session starts.</p>':'')+'</article>';
  }).join('')+'</div>':'<div class="empty"><strong>No live sessions available yet</strong><p>Sessions will appear when a class is scheduled for a course you are enrolled in.</p></div>';
  const change=async(button,action,id)=>{
   button.disabled=true;
   try{await liveTrainingApi(action,{session_id:id});notify(action==='register'?'Your seat is reserved.':'Your registration has been cancelled.');await mountLiveTraining()}
   catch(error){notify(error.message,true);button.disabled=false}
  };
  holder.querySelectorAll('[data-live-register]').forEach(button=>button.onclick=()=>change(button,'register',button.dataset.liveRegister));
  holder.querySelectorAll('[data-live-cancel]').forEach(button=>button.onclick=()=>change(button,'unregister',button.dataset.liveCancel));
  holder.querySelectorAll('[data-live-join]').forEach(button=>button.onclick=()=>go('meeting/'+button.dataset.liveJoin));
 }catch(error){if(holder.isConnected)holder.innerHTML='<div class="empty"><strong>Unable to load live sessions</strong><p>'+esc(error.message)+'</p><button type="button" class="action secondary" id="ae-live-retry">Try again</button></div>';holder.querySelector('#ae-live-retry')?.addEventListener('click',mountLiveTraining)}
 finally{if(refresh?.isConnected)refresh.disabled=false}
}
let activeMeetingRoom=null;
function meetingRoomPage(){return '<section id="ae-embedded-room"><div class="panel"><h2>Loading live classroom…</h2><p>Preparing the secure meeting room inside the portal.</p></div></section>'}
async function mountEmbeddedRoom(){
 const root=$('ae-embedded-room'),id=state.meetingId;
 if(!root||!id||state.page!=='meeting')return;
 try{
  const {createEmbeddedMeeting}=await import('./embedded-meeting.js?v=20261109-screenings4u');
  if(state.page!=='meeting'||state.meetingId!==id||!root.isConnected)return;
  activeMeetingRoom=createEmbeddedMeeting({root,api:liveTrainingApi,sessionId:id,escapeHTML:esc,onExit:()=>go('live-training')});
 }catch(e){
  console.error('Embedded classroom unavailable',e);
  if(root.isConnected)root.innerHTML='<section class="panel"><h2>Unable to initialize classroom</h2><p>'+esc(e.message||'Meeting components could not load.')+'</p><button type="button" class="action secondary" id="ae-room-return">Back to sessions</button></section>';
  root.querySelector('#ae-room-return')?.addEventListener('click',()=>go('live-training'));
 }
}
function releaseMeetingRoom(){const room=activeMeetingRoom;activeMeetingRoom=null;if(room)void room.dispose()}
function ordersPage(){return heading('Orders & purchases','View your purchases and download your Andre Erving PDF receipts.')+
 '<section class="panel ae-orders-panel"><div class="ae-orders-panel-header"><h2>Purchase history</h2><span class="ae-order-count">'+state.orders.length+' orders</span></div>'+
 (state.orders.length?'<div class="data-list ae-orders-list">'+state.orders.map(o=>'<div class="data-row ae-order-row"><div class="ae-order-details"><strong>'+esc(o.order_number)+'</strong><p>Placed '+esc(fmtDate(o.created_at))+'</p></div><div class="ae-order-actions"><div class="ae-order-payment"><strong>'+esc(money(o.total,o.currency))+'</strong><span class="tag">'+esc(o.status)+'</span></div>'+
 (['paid','completed'].includes(o.status)?'<button class="action secondary ae-receipt-download" type="button" data-order-receipt="'+esc(o.id)+'"><span aria-hidden="true">↓</span> Download receipt (PDF)</button>':'<span class="muted-note">Receipt available after payment</span>')+
 '</div></div>').join('')+'</div>':empty('No orders yet','Purchases will appear here when processed.'))+'</section>'}
function documentsPage(){return heading('My documents','Access private files shared with you.')+'<section class="panel"><h2>Secure document library</h2>'+(state.documents.length?'<div class="data-list">'+state.documents.map(d=>'<div class="data-row"><div><strong>'+esc(d.title)+'</strong><p>'+esc(d.description||d.document_type||'Document')+' · '+esc(fmtDate(d.created_at))+'</p></div><button class="action secondary" data-download="'+esc(d.id)+'">Download securely</button></div>').join('')+'</div>':empty('No shared documents','Files shared by your team will appear here.'))+'</section>'}
function settings(){return heading('Account settings','Keep your student profile information up to date.')+'<section class="panel"><h2>Personal details</h2><form id="profile-form"><div class="form-grid ae-profile-fields"><label class="form-field">First name<input name="first_name" maxlength="80" autocomplete="given-name" value="'+esc((state.profile?.full_name||'').trim().split(/\s+/)[0]||'')+'"></label><label class="form-field">Last name<input name="last_name" maxlength="80" autocomplete="family-name" value="'+esc((state.profile?.full_name||'').trim().split(/\s+/).slice(1).join(' '))+'"></label><label class="form-field">Phone number<input name="phone" maxlength="40" autocomplete="tel" value="'+esc(state.profile?.phone||'')+'"></label><label class="form-field">Account email<input type="email" disabled value="'+esc(state.user.email)+'"></label></div><div class="form-actions"><button class="primary" type="submit">Save changes</button></div></form></section><section class="panel"><h2>Security</h2><p class="muted">Use password reset to change your account password.</p><a href="forgot.html" class="action secondary">Send password reset link</a></section>'}
function supportPage(){const selected=state.tickets.find(t=>t.id===state.selectedTicket)||state.tickets[0];if(selected)state.selectedTicket=selected.id;return heading('Support center','Get help with courses, billing, documents, and technical issues.')+
'<div class="ticket-grid"><section class="panel"><h2>Start a support request</h2><form id="ticket-form"><label class="form-field">Subject<input name="subject" minlength="3" maxlength="180" required placeholder="How can we help?"></label><label class="form-field">Category<select name="category"><option value="general">General question</option><option value="course">Courses & learning</option><option value="billing">Orders & billing</option><option value="technical">Technical help</option><option value="documents">Documents</option></select></label><label class="form-field">Message<textarea name="message" minlength="1" maxlength="10000" required placeholder="Describe what you need help with"></textarea></label><button class="primary" type="submit">Submit ticket</button></form></section>'+
'<section class="panel"><h2>My support tickets</h2>'+(state.tickets.length?state.tickets.map(t=>'<button class="ticket-button '+(selected?.id===t.id?'active':'')+'" data-ticket="'+esc(t.id)+'"><strong>'+esc(t.subject)+'</strong><p class="muted">'+esc(fmtDate(t.created_at))+' · '+esc(t.status.replace('_',' '))+'</p></button>').join(''):empty('No support tickets yet','Submit a request to start a conversation.'))+'</section></div>'+
(selected?'<section class="panel"><h2>'+esc(selected.subject)+' <span class="tag '+esc(selected.status)+'">'+esc(selected.status.replace('_',' '))+'</span></h2><div id="ticket-messages" class="message-list">Loading messages…</div>'+(selected.status==='closed'?'<p class="muted">This ticket is closed.</p>':'<form id="message-form" class="form-actions"><label class="form-field">Reply<textarea name="message" required maxlength="10000" placeholder="Write a reply…"></textarea></label><button class="primary" type="submit">Send reply</button></form>')+'</section>':'')}
function render(){if(!state.user)return;let page=state.page;document.body.classList.toggle('ae-dashboard-view',page==='dashboard');document.body.classList.toggle('ae-classroom-route',page==='classroom');const titles={classroom:'Course player',dashboard:'Dashboard',courses:'My courses',orders:'Orders & purchases',ebooks:'My eBooks',documents:'My documents',support:'Support center',settings:'Account settings','live-training':'Live Training Sessions',meeting:'Live Classroom'};if(!titles[page])page='dashboard';state.page=page;$('top-heading').textContent=titles[page];document.querySelectorAll('[data-page]').forEach(b=>{b.classList.toggle('active',b.dataset.page===page);b.setAttribute('aria-current',b.dataset.page===page?'page':'false')});$('student-content').innerHTML=({dashboard,courses:coursesPage,orders:ordersPage,ebooks:ebookPage,documents:documentsPage,support:supportPage,settings,classroom:classroomPage,'live-training':liveTrainingPage,meeting:meetingRoomPage})[page]();if(page==='support'&&state.selectedTicket){loadMessages();connectTicketMessages()}else if(state.messageChannel){db.removeChannel(state.messageChannel);state.messageChannel=null}document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>go(b.dataset.route));if(page==='live-training'){$('ae-live-refresh')?.addEventListener('click',mountLiveTraining);void mountLiveTraining()}if(page==='meeting')void mountEmbeddedRoom()
 const sidebarButton=$('ae-sidebar-toggle');
 if(sidebarButton){
  const applySidebar=expanded=>{
   document.body.classList.toggle('ae-classroom-show-nav',expanded);
   sidebarButton.setAttribute('aria-expanded',String(expanded));
   sidebarButton.textContent=expanded?'Hide sidebar':'Show sidebar';
  };
  applySidebar(false);
  sidebarButton.addEventListener('click',()=>applySidebar(!document.body.classList.contains('ae-classroom-show-nav')));
 }else document.body.classList.remove('ae-classroom-show-nav');document.querySelectorAll('[data-course]').forEach(b=>b.onclick=()=>go('classroom/'+b.dataset.course));document.querySelectorAll('[data-extend-course]').forEach(b=>b.onclick=()=>purchaseExtension(b));document.querySelectorAll('[data-ticket]').forEach(b=>b.onclick=()=>{state.selectedTicket=b.dataset.ticket;render()});document.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>download(b.dataset.download));document.querySelectorAll('[data-order-receipt]').forEach(b=>b.onclick=()=>downloadReceipt(b));document.querySelectorAll('[data-ebook]').forEach(b=>b.onclick=()=>downloadEbook(b.dataset.ebook));$('profile-form')?.addEventListener('submit',saveProfile);$('ticket-form')?.addEventListener('submit',createTicket);$('message-form')?.addEventListener('submit',sendMessage)}
function go(page){if(!state.user)return;if(state.page==='meeting'&&!page.startsWith('meeting/'))releaseMeetingRoom();state.classroomId=page.startsWith('classroom/')?page.slice(10):null;state.meetingId=page.startsWith('meeting/')?page.slice(8):null;state.page=state.classroomId?'classroom':state.meetingId?'meeting':page;if(location.hash!=='#/'+page)history.pushState(null,'','#/'+page);render();document.querySelector('.student-main')?.scrollTo(0,0)}
async function downloadReceipt(button){
 const id=button.dataset.orderReceipt;
 if(!state.orders.some(o=>o.id===id&&['paid','completed'].includes(o.status)))return notify('This order does not have a confirmed receipt.',true);
 if(button.disabled)return;
 button.disabled=true;
 const label=button.innerHTML;button.textContent='Preparing PDF…';
 try{
  const {data:{user},error}=await db.auth.getUser();
  if(error||!user||user.id!==state.user?.id)throw Error('Please sign in again to download your receipt.');
  await downloadOrderReceipt(db,id,user);
 }catch(error){notify(error.message||'Unable to download this receipt.',true)}
 finally{button.disabled=false;button.innerHTML=label}
}
async function purchaseExtension(button){
 if(button.disabled)return;
 const courseId=button.dataset.extendCourse;
 const enrollment=state.enrollments.find(x=>x.course_id===courseId),setting=state.extensionPrices[courseId];
 if(!enrollment||!enrollment.expires_at||new Date(enrollment.expires_at)>new Date()||enrollment.status==='cancelled'||!setting?.enabled||Number(setting.amount)<=0){
  return notify('This course is not currently eligible for an extension.',true);
 }
 button.disabled=true;const label=button.textContent;button.textContent='Preparing secure checkout…';
 try{
  const {data:{session},error}=await db.auth.getSession();
  if(error||!session?.access_token)throw Error('Sign in again to purchase an extension.');
  const response=await fetch('https://gnfyidajbectlppsekzj.supabase.co/functions/v1/andre-course-extension',{method:'POST',
   headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({courseId})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.url)throw Error(data.error||'Extension checkout is unavailable.');
  const dest=new URL(data.url);
  if(dest.origin!=='https://andreerving.com'||dest.pathname!=='/checkout.html')throw Error('Invalid checkout destination');
  window.location.assign(dest.href);
 }catch(error){notify(error.message||'Unable to open extension checkout',true);button.disabled=false;button.textContent=label}
}
async function downloadEbook(id){
 const item=state.ebookOrders.find(x=>x.id===id);if(!item)return;
 const {data:{session}}=await db.auth.getSession();if(!session?.access_token)return logoutToLogin();
 try{const response=await fetch('https://gnfyidajbectlppsekzj.supabase.co/functions/v1/customer-ebook-library',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'download',offeringId:id})});
 const data=await response.json().catch(()=>({}));if(!response.ok||!data.url)throw Error(data.error||'Download unavailable');window.open(data.url,'_blank','noopener,noreferrer')
 }catch(e){notify(e.message||'Unable to download eBook',true)}
}
async function download(id){const doc=state.documents.find(d=>d.id===id);if(!doc)return;const path=doc.file_url;if(!path||path.startsWith('http'))return notify('Document link is unavailable.',true);const {data,error}=await db.storage.from('andreerving-customer-documents').createSignedUrl(path,60);if(error||!data?.signedUrl)return notify('Unable to access this document.',true);window.open(data.signedUrl,'_blank','noopener,noreferrer')}
async function saveProfile(e){e.preventDefault();const f=new FormData(e.target),firstName=String(f.get('first_name')||'').trim(),lastName=String(f.get('last_name')||'').trim(),data={full_name:[firstName,lastName].filter(Boolean).join(' '),phone:String(f.get('phone')||'').trim()};const {data:updated,error}=await db.from('customer_profiles').update(data).eq('id',state.user.id).select('full_name,phone,email').single();if(error)return notify('Could not update your account: '+error.message,true);state.profile=updated;notify('Account updated.')}
async function createTicket(e){e.preventDefault();const f=new FormData(e.target),subject=String(f.get('subject')||'').trim(),message=String(f.get('message')||'').trim(),category=String(f.get('category')||'general');if(subject.length<3||!message)return notify('Enter a subject and message.',true);const {data,error}=await db.from('support_tickets').insert({user_id:state.user.id,subject,category}).select('id').single();if(error)return notify('Ticket could not be created: '+error.message,true);const m=await db.from('support_messages').insert({ticket_id:data.id,sender_id:state.user.id,message});if(m.error){notify('Ticket created, but your message failed: '+m.error.message,true)}else notify('Support ticket submitted.');state.tickets=await read('support_tickets','id,subject,category,status,priority,created_at,updated_at');state.selectedTicket=data.id;render()}
async function loadMessages(){const ticketId=state.selectedTicket;const el=$('ticket-messages');if(!el)return;const {data,error}=await db.from('support_messages').select('id,sender_id,message,created_at').eq('ticket_id',ticketId).order('created_at');if(state.selectedTicket!==ticketId)return;if(error){el.textContent='Unable to load messages.';return}el.innerHTML=(data||[]).map(m=>'<div class="message '+(m.sender_id===state.user.id?'mine':'')+'"><div>'+esc(m.message).replace(/\n/g,'<br>')+'</div><small>'+(m.sender_id===state.user.id?'You':'Support')+' · '+esc(fmtDate(m.created_at))+'</small></div>').join('')||'<p class="muted">No messages yet.</p>';el.scrollTop=el.scrollHeight}
async function sendMessage(e){e.preventDefault();const message=String(new FormData(e.target).get('message')||'').trim();if(!message)return;const {error}=await db.from('support_messages').insert({ticket_id:state.selectedTicket,sender_id:state.user.id,message});if(error)return notify('Unable to send reply: '+error.message,true);e.target.reset();await loadMessages();notify('Reply sent.')}
function logoutToLogin(){state.user=null;state.loaded=false;state.orders=[];state.enrollments=[];state.courses=[];state.documents=[];state.ebookOrders=[];state.progress=[];state.tickets=[];state.selectedTicket=null;if(state.channel){db.removeChannel(state.channel);state.channel=null}if(state.messageChannel){db.removeChannel(state.messageChannel);state.messageChannel=null}document.body.classList.remove('ae-authenticated','ae-classroom-route','ae-classroom-show-nav');$('student-view').inert=true;$('student-view').hidden=true;$('auth-check').hidden=true;$('login-view').hidden=false;$('student-content').replaceChildren()}
async function loadEbooks(){
 const current=state.user;if(!current)return;
 try{
  const {data:{session}}=await db.auth.getSession();if(!session?.access_token)return;
  const res=await fetch('https://gnfyidajbectlppsekzj.supabase.co/functions/v1/customer-ebook-library',{method:'POST',
  headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'list'})});
  if(!res.ok)throw Error('eBook library temporarily unavailable');
  const json=await res.json();if(state.user?.id!==current.id)return;
  state.ebookOrders=Array.isArray(json.items)?json.items:[];
 }catch(error){console.warn('eBook library loading issue',error);if(state.page==='ebooks')notify('Your eBooks could not load. Try this page again.',true)}
}
// Realtime changes are applied only when the current view's relevant data changes.
// Never replace a live-session page or an active form just because the browser gained focus.
function currentViewFingerprint(){
 const page=state.page;
 const values=page==='dashboard'?[state.orders,state.enrollments,state.courses,state.progress,state.tickets,state.profile]:
 page==='courses'?[state.enrollments,state.courses,state.progress,state.extensionPrices]:
 page==='orders'?[state.orders]:
 page==='ebooks'?[state.ebookOrders]:
 page==='documents'?[state.documents]:
 page==='support'?[state.tickets]:
 page==='settings'?[state.profile]:
 page==='classroom'?[state.enrollments]:
 page==='live-training'?[state.enrollments]:[];
 return JSON.stringify(values);
}
let loadingLive=false;let pendingLiveRefresh=false;
async function refreshLive(){
 if(!state.user)return;
 if(loadingLive){pendingLiveRefresh=true;return}
 if(document.querySelector('#student-content form:focus-within')){pendingLiveRefresh=true;return}
 loadingLive=true;
 try{
  const userId=state.user.id;
  const before=currentViewFingerprint();
  await load();
  if(state.page==='ebooks')await loadEbooks();
  if(state.user?.id!==userId)return;
  if(currentViewFingerprint()===before)return;
  if(state.page==='live-training'){void mountLiveTraining();return}
  if(state.page==='meeting')return;
  if(state.page==='classroom'){
   const valid=state.enrollments.some(e=>e.course_id===state.classroomId&&['active','completed'].includes(e.status)&&(!e.expires_at||new Date(e.expires_at)>new Date()));
   if(!valid)render();
   return;
  }
  if(document.querySelector('#student-content form:focus-within'))return;
  render();
 }catch(error){console.warn('Background account synchronization failed',error)}
 finally{loadingLive=false;if(pendingLiveRefresh){pendingLiveRefresh=false;setTimeout(()=>{if(state.user&&!document.querySelector('#student-content form:focus-within'))void refreshLive()},1000)}}
}
function connectTicketMessages(){
 if(state.messageChannel){db.removeChannel(state.messageChannel);state.messageChannel=null}
 if(!state.user||!state.selectedTicket||state.page!=='support')return;
 if(!/^[0-9a-f-]{36}$/i.test(state.selectedTicket))return;
 state.messageChannel=db.channel('ticket-'+state.selectedTicket)
 .on('postgres_changes',{event:'INSERT',schema:'public',table:'support_messages',filter:'ticket_id=eq.'+state.selectedTicket},()=>{void loadMessages()})
 .subscribe();
}
function connectLive(){
 if(state.channel)db.removeChannel(state.channel);const userId=state.user?.id;if(!userId)return;
 state.channel=db.channel('customer-'+userId)
 .on('postgres_changes',{event:'*',schema:'public',table:'orders',filter:'user_id=eq.'+userId},()=>{void refreshLive();setTimeout(()=>void refreshLive(),1200)})
 .on('postgres_changes',{event:'*',schema:'public',table:'orders',filter:'customer_email=eq.'+state.user.email.toLowerCase()},()=>{void refreshLive();setTimeout(()=>void refreshLive(),1200)})
 .on('postgres_changes',{event:'*',schema:'public',table:'course_enrollments',filter:'user_id=eq.'+userId},refreshLive)
 .on('postgres_changes',{event:'*',schema:'public',table:'customer_documents',filter:'user_id=eq.'+userId},refreshLive)
 .on('postgres_changes',{event:'*',schema:'public',table:'support_tickets',filter:'user_id=eq.'+userId},refreshLive)
 .on('postgres_changes',{event:'*',schema:'public',table:'lesson_progress',filter:'user_id=eq.'+userId},refreshLive)
 .on('postgres_changes',{event:'*',schema:'public',table:'live_training_attendees',filter:'user_id=eq.'+userId},()=>{if(state.page==='live-training')void mountLiveTraining()})
 .on('postgres_changes',{event:'*',schema:'public',table:'live_training_session_updates'},()=>{if(state.page==='live-training')void mountLiveTraining()})
 .subscribe();
}
async function boot(){const {data:{user},error}=await db.auth.getUser();if(error||!user){logoutToLogin();return}state.user=user;document.body.classList.remove('ae-authenticated');$('login-view').hidden=true;$('student-view').hidden=true;$('sidebar-email').textContent=user.email;$('top-email').textContent=user.email;$('student-content').innerHTML='<div class="panel">Loading your account…</div>';await load();await loadEbooks();if(state.user?.id!==user.id)return;const route=location.hash.replace(/^#\/?/,'');state.classroomId=route.startsWith('classroom/')?route.slice(10):null;state.meetingId=route.startsWith('meeting/')?route.slice(8):null;state.page=state.classroomId?'classroom':state.meetingId?'meeting':['dashboard','courses','orders','ebooks','documents','support','settings','live-training'].includes(route)?route:'dashboard';render();$('student-view').inert=false;$('student-view').hidden=false;$('auth-check').hidden=true;document.body.classList.add('ae-authenticated');connectLive()}
const passwordToggle=$('toggle-password');
if(passwordToggle){
 passwordToggle.addEventListener('click',()=>{
  const input=$('password');
  const showing=input.type==='password';
  input.type=showing?'text':'password';
  passwordToggle.textContent=showing?'Hide':'Show';
  passwordToggle.setAttribute('aria-label',showing?'Hide password':'Show password');
  passwordToggle.setAttribute('aria-pressed',String(showing));
 });
}
$('login').addEventListener('submit',async e=>{e.preventDefault();const submit=e.target.querySelector('button');submit.disabled=true;const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});submit.disabled=false;if(error){$('login-status').textContent='Sign in failed: '+error.message;return}await boot()});
$('signout').onclick=async()=>{await db.auth.signOut();history.replaceState(null,'',location.pathname);logoutToLogin()};
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=e=>{e.preventDefault();go(b.dataset.page)});
window.addEventListener('hashchange',()=>{const page=location.hash.replace(/^#\/?/,'');if(!state.user)return;if(!page.startsWith('classroom/')&&!page.startsWith('meeting/')&&!['dashboard','courses','orders','ebooks','documents','support','settings','live-training'].includes(page))return;if(state.page==='meeting'&&!page.startsWith('meeting/'))releaseMeetingRoom();state.classroomId=page.startsWith('classroom/')?page.slice(10):null;state.meetingId=page.startsWith('meeting/')?page.slice(8):null;state.page=state.classroomId?'classroom':state.meetingId?'meeting':page;render()});
// The database change stream updates in place; focus/visibility must not redraw the portal.
// Refresh session cards when the page becomes visible, only if the server data changed.
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state.user&&state.page==='live-training')void mountLiveTraining()});
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||!state.user)return;
 if(event.data?.type==='ae-player-exit'){go('courses');return}
 if(event.data?.type==='ae-lesson-completed'&&event.data.courseId===state.classroomId){void refreshLive()}
});
db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'||!session&&event==='TOKEN_REFRESHED')logoutToLogin()});
boot().catch(e=>{logoutToLogin();$('login-status').textContent='Could not verify your session. Please sign in again.'});
