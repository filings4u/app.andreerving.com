import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.58.0';
const db=createClient('https://gnfyidajbectlppsekzj.supabase.co','sb_publishable_DGt4HrHAwWyMt-0Xtzlfog_F18RnOyf');
const byId=id=>document.getElementById(id);
const status=byId('status');
const say=message=>{status.textContent=message};
byId('login').addEventListener('submit',async event=>{
 event.preventDefault();
 const email=byId('email').value.trim();
 const {error}=await db.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
 say(error?error.message:'Check your email for the sign-in link.');
});
byId('signout').addEventListener('click',async()=>{await db.auth.signOut();location.reload()});
async function render(){
 const {data:{user}}=await db.auth.getUser();
 byId('login').hidden=!!user;byId('dashboard').hidden=!user;byId('signout').hidden=!user;
 if(!user)return;
 say('Signed in as '+user.email);
 const {data:profile}=await db.from('customer_profiles').select('full_name,phone').eq('id',user.id).maybeSingle();
 byId('profile-name').value=profile?.full_name||'';
 byId('profile-phone').value=profile?.phone||'';
 for(const [table,target,columns] of [
  ['orders','orders','order_number,status,total,created_at'],
  ['course_enrollments','enrollments','course_id,status,enrolled_at'],
  ['customer_documents','documents','title,description,file_url']]){
  const holder=byId(target);holder.replaceChildren();
  const {data,error}=await db.from(table).select(columns).limit(100);
  if(error){holder.textContent='Unable to load records.';continue}
  if(!data?.length){holder.textContent='No records yet.';continue}
  for(const record of data){
   const card=document.createElement('div');card.className='item';
   const summary=document.createElement('p');summary.textContent=table==='customer_documents'?record.title:table==='orders'?record.order_number+' · '+record.status+' · $'+record.total:record.status+' course';card.append(summary);
   if(table==='course_enrollments'&&record.status==='active'){
    const link=document.createElement('a');link.href='training.html?course='+encodeURIComponent(record.course_id);link.textContent='Open training';card.append(link);
   }
   if(table==='customer_documents'&&record.file_url&&!record.file_url.startsWith('http')){
    const button=document.createElement('button');button.textContent='Download securely';
    button.addEventListener('click',async()=>{
     const {data:signed,error:downloadError}=await db.storage.from('andreerving-customer-documents').createSignedUrl(record.file_url,60);
     if(downloadError||!signed?.signedUrl){say('Download unavailable.');return}
     window.open(signed.signedUrl,'_blank','noopener');
    });card.append(button);
   }
   holder.append(card);
  }
 }
}
db.auth.onAuthStateChange(()=>setTimeout(render,0));
render();

byId('profile-form')?.addEventListener('submit',async event=>{
 event.preventDefault();const {data:{user}}=await db.auth.getUser();if(!user){say('Sign in before editing your profile.');return}
 const full_name=byId('profile-name').value.trim(),phone=byId('profile-phone').value.trim();
 const {error}=await db.from('customer_profiles').update({full_name,phone}).eq('id',user.id);
 say(error?'Unable to save your profile.':'Your profile was saved.');
});
