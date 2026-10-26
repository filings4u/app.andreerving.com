import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.58.0';
const db=createClient('https://gnfyidajbectlppsekzj.supabase.co','sb_publishable_DGt4HrHAwWyMt-0Xtzlfog_F18RnOyf');
const status=document.getElementById('status'),container=document.getElementById('modules');
const courseId=new URLSearchParams(location.search).get('course');
const text=(tag,value)=>{const n=document.createElement(tag);n.textContent=String(value??'');return n};
async function run(){
 const {data:{user}}=await db.auth.getUser();
 if(!user){status.textContent='Sign in from your customer dashboard to view training.';return}
 if(!courseId||!/^[-0-9a-f]{36}$/i.test(courseId)){status.textContent='Invalid course selected.';return}
 const {data:enrollment,error:enrollmentError}=await db.from('course_enrollments').select('id,status,expires_at').eq('user_id',user.id).eq('course_id',courseId).in('status',['active','completed']).limit(1).maybeSingle();
 if(enrollmentError||!enrollment){status.textContent='You do not have access to this training.';return}
 if(enrollment.expires_at && new Date(enrollment.expires_at)<new Date()){status.textContent='Your course access has expired.';return}
 const [{data:course},{data:modules,error:mError},{data:lessons,error:lError},{data:progress}]=await Promise.all([
 db.from('courses').select('title').eq('id',courseId).single(),
 db.from('course_modules').select('id,title,description,sort_order').eq('course_id',courseId).order('sort_order'),
 db.from('course_lessons').select('id,module_id,title,lesson_type,content_html,video_url,resource_url,duration_minutes,sort_order').eq('course_id',courseId).order('sort_order'),
 db.from('lesson_progress').select('id,lesson_id,completed').eq('course_id',courseId).eq('user_id',user.id)
 ]);
 if(mError||lError){status.textContent='Training content could not be loaded.';return}
 document.getElementById('course-title').textContent=course?.title||'Course';
 status.textContent=(lessons?.length||0)+' lessons available';
 if(!modules?.length){container.append(text('p','Training modules have not yet been published.'));return}
 for(const module of modules){
  const section=document.createElement('section');section.className='item';
  section.append(text('h2',module.title),text('p',module.description));
  for(const lesson of (lessons||[]).filter(l=>l.module_id===module.id)){
   const details=document.createElement('details');details.className='item';
   details.append(text('summary',lesson.title));
   if(lesson.content_html)details.append(text('p',lesson.content_html.replace(/<[^>]*>/g,'')));
   if(lesson.video_url){const a=text('a','Watch lesson video');a.href=lesson.video_url;a.rel='noopener noreferrer';a.target='_blank';details.append(a)}
   if(lesson.resource_url){const a=text('a','Lesson resource');a.href=lesson.resource_url;a.rel='noopener noreferrer';a.target='_blank';details.append(a)}
   const isDone=progress?.find(p=>p.lesson_id===lesson.id);
   const button=text('button',isDone?.completed?'Completed':'Mark complete');
   button.disabled=!!isDone?.completed;
   button.addEventListener('click',async()=>{
    button.disabled=true;
    const request=isDone?db.from('lesson_progress').update({completed:true,completed_at:new Date().toISOString()}).eq('id',isDone.id):db.from('lesson_progress').insert({user_id:user.id,course_id:courseId,lesson_id:lesson.id,completed:true,completed_at:new Date().toISOString()});
    const {error}=await request;
    if(error){button.disabled=false;status.textContent='Unable to save lesson progress.';return}
    button.textContent='Completed';status.textContent='Progress saved.';
   });
   details.append(button);section.append(details);
  }
  container.append(section);
 }
}
run().catch(()=>{status.textContent='Unable to load training.'});