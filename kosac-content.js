/* Public content: text only. A failed request keeps the bundled page readable. */
(()=>{
  'use strict';
  const page=document.currentScript?.dataset.page;
  const cfg=window.KOSAC_CONFIG||{};
  if(!['about','guidelines'].includes(page)||!window.supabase||!cfg.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY||cfg.SUPABASE_URL.includes('YOUR_PROJECT'))return;
  const client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  function apply(values){
    const walker=document.createTreeWalker(document.querySelector('main'),NodeFilter.SHOW_COMMENT);
    const comments=[];while(walker.nextNode())comments.push(walker.currentNode);
    for(const comment of comments){
      if(!comment.data.startsWith('cms:'))continue;
      const key=comment.data.slice(4);
      if(!Object.hasOwn(values,key)||typeof values[key]!=='string')continue;
      const text=values[key];if(text.length>12000)continue;
      if(comment.nextSibling?.nodeType===Node.TEXT_NODE)comment.nextSibling.textContent=text;
      else comment.after(document.createTextNode(text));
      if(text.includes('\n'))comment.parentElement.style.whiteSpace='pre-line';
    }
  }
  async function load(){
    const timer=new AbortController();const timeout=setTimeout(()=>timer.abort(),8000);
    try{
      const [res,base]=await Promise.all([
        client.from('kosac_page_content').select('content').eq('slug',page).abortSignal(timer.signal).maybeSingle(),
        client.from('site_settings').select('about_text,contact_phone,contact_fax,contact_email,contact_address').eq('id',1).abortSignal(timer.signal).maybeSingle()
      ]);
      const values={};
      if(page==='about' && base.data?.about_text)values.about_lead=base.data.about_text;
      if(!res.error && res.data?.content && typeof res.data.content==='object')Object.assign(values,res.data.content);
      apply(values);
      const s=base.data;if(s){
        for(const [key,id] of [['contact_phone','contactPhone'],['contact_fax','contactFax'],['contact_email','contactEmail'],['contact_address','contactAddress']]){
          const node=document.getElementById(id);if(node && typeof s[key]==='string' && s[key])node.textContent=key==='contact_phone'&&s[key]==='02-2144-0764'?'02-2144-0764, 0755':s[key];
        }
      }
    }catch(error){console.warn('페이지 기본 내용을 표시합니다.');}finally{clearTimeout(timeout);}
  }
  load();
})();
