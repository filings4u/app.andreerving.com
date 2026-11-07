import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.58.0';
const auth=createClient('https://gnfyidajbectlppsekzj.supabase.co','sb_publishable_DGt4HrHAwWyMt-0Xtzlfog_F18RnOyf');
const form=document.querySelector('#invite-form'),status=document.querySelector('#status'),loading=document.querySelector('#invite-loading'),params=new URLSearchParams(location.search);
function message(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
document.querySelectorAll('[data-password]').forEach(button=>button.onclick=()=>{const input=document.getElementById(button.dataset.password);input.type=input.type==='password'?'text':'password';button.textContent=input.type==='password'?'Show':'Hide'});
async function begin(){
 try{
  const token=params.get('token_hash'),type=params.get('type');
  if(!token||!['invite','magiclink'].includes(type))throw Error('Open the secure account invitation from your email.');
  const {data,error}=await auth.auth.verifyOtp({token_hash:token,type});if(error||!data.user)throw error||new Error('Invitation verification failed.');
  history.replaceState({},'',location.pathname);
  loading.hidden=true;form.hidden=false;
 }catch(e){loading.hidden=true;history.replaceState({},'',location.pathname);message(e.message||'The invitation has expired. Request a new one.',true)}
}
form.addEventListener('submit',async e=>{e.preventDefault();const password=document.querySelector('#invite-password').value,confirm=document.querySelector('#invite-confirm').value;if(password!==confirm)return message('Passwords do not match.',true);if(password.length<12)return message('Use at least 12 characters.',true);const btn=form.querySelector('button[type=submit]');btn.disabled=true;try{const {error}=await auth.auth.updateUser({password});if(error)throw error;form.hidden=true;message('Your account is active. You can sign in using your new password.');await auth.auth.signOut()}catch(e){message(e.message,true)}finally{btn.disabled=false}});
begin();