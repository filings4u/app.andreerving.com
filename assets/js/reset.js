import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.58.0';
const auth=createClient('https://gnfyidajbectlppsekzj.supabase.co','sb_publishable_DGt4HrHAwWyMt-0Xtzlfog_F18RnOyf');
const status=document.querySelector('#status'),form=document.querySelector('#reset-new'),loader=document.querySelector('#recovery-loading');
const params=new URLSearchParams(location.search);
function message(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
function scrub(){history.replaceState({},'',location.pathname)}
const requestForm=document.querySelector('#reset-request');
requestForm.addEventListener('submit',async event=>{
 event.preventDefault();const button=requestForm.querySelector('button[type=submit]');
 button.disabled=true;message('Sending instructions…');
 try{
  const response=await fetch('https://gnfyidajbectlppsekzj.supabase.co/functions/v1/andre-auth-email',{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.querySelector('#reset-email').value.trim()})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Unable to send reset instructions');
  requestForm.hidden=true;message(data.message||'If this account exists, instructions will arrive by email.');
 }catch(error){message(error.message||'Unable to send reset instructions.',true)}
 finally{button.disabled=false}
});
document.querySelectorAll('[data-password]').forEach(button=>button.addEventListener('click',()=>{
 const input=document.getElementById(button.dataset.password),visible=input.type==='text';input.type=visible?'password':'text';button.textContent=visible?'Show':'Hide';button.setAttribute('aria-label',(visible?'Show':'Hide')+' password');
}));
async function verifyRecovery(){
 let error=null;
 const hash=params.get('token_hash'),type=params.get('type');
 try{
  if(hash&&type==='recovery'){
   const verified=await auth.auth.verifyOtp({token_hash:hash,type:'recovery'});
   if(verified.error)throw verified.error;
  }else if(location.hash.includes('access_token=')){
   // Supports legacy Supabase links that return an authenticated recovery session in the URL fragment.
   const result=await auth.auth.getSession();if(result.error||!result.data.session)throw new Error('This reset link is invalid or has expired.');
  }else{
   loader.hidden=true;requestForm.hidden=false;
   document.querySelector('#intro').textContent='Enter your account email and we will send a secure link to reset your password.';
   return;
  }
  const active=await auth.auth.getUser();
  if(active.error||!active.data.user)throw new Error('The reset link could not be verified.');
 }catch(e){error=e}
 scrub();loader.hidden=true;
 if(error){message(error.message||'This reset link is invalid or expired. Request a new one.',true);form.hidden=true;return}
 form.hidden=false;document.querySelector('#intro').textContent='Choose a new password of at least 12 characters. Enter it twice to confirm.';
}
form.addEventListener('submit',async e=>{
 e.preventDefault();const password=document.querySelector('#new-password').value,confirm=document.querySelector('#confirm-password').value;
 if(password!==confirm)return message('Your passwords do not match.',true);
 if(password.length<12)return message('Use at least 12 characters.',true);
 const button=form.querySelector('button[type=submit]');button.disabled=true;
 try{const {error}=await auth.auth.updateUser({password});if(error)throw error;form.hidden=true;message('Your password has been updated. You can now sign in.');await auth.auth.signOut()}catch(err){message(err.message||'Unable to update password.',true)}finally{button.disabled=false}
});
verifyRecovery();