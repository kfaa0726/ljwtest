/* Shared renderer for published content and the administrator's unsaved preview. */
window.KosacContent=(()=>{
  const origin=location.href;
  const validUrl=value=>{
    if(typeof value!=='string' || !value.trim())return '';
    try{
      const url=new URL(value,origin);
      return ['https:','http:'].includes(url.protocol) &&
        !['kosac.ad.co.kr','www.kosac.ad.co.kr'].includes(url.hostname) ? url.href : '';
    }catch{return '';}
  };
  const isText=(values,key)=>typeof values?.[key]==='string' && values[key].length<=12000;

  function apply(doc,values){
    const root=doc.querySelector('main');
    if(root){
      const walker=doc.createTreeWalker(root,NodeFilter.SHOW_COMMENT);
      const comments=[];
      while(walker.nextNode())comments.push(walker.currentNode);
      for(const comment of comments){
        if(!comment.data.startsWith('cms:'))continue;
        const key=comment.data.slice(4);
        if(!isText(values,key))continue;
        const value=values[key];
        if(comment.nextSibling?.nodeType===Node.TEXT_NODE)comment.nextSibling.textContent=value;
        else comment.after(doc.createTextNode(value));
        if(value.includes('\n'))comment.parentElement.style.whiteSpace='pre-line';
      }
    }
    for(const node of doc.querySelectorAll('[data-edit]')){
      const key=node.dataset.edit;
      if(isText(values,key))node.textContent=values[key];
    }
    for(const attr of ['src','srcset','href','alt']){
      for(const node of doc.querySelectorAll('[data-edit-'+attr+']')){
        const key=node.getAttribute('data-edit-'+attr);
        if(!isText(values,key))continue;
        const value=attr==='alt'?values[key]:validUrl(values[key]);
        if(value){
          const changed=attr==='src' && validUrl(node.getAttribute(attr))!==value;
          node.setAttribute(attr,value);
          if(attr==='src')node.hidden=false;
          if(changed){node.removeAttribute('width');node.removeAttribute('height');}
        }else{
          node.removeAttribute(attr);
          if(attr==='src')node.hidden=true;
        }
      }
    }
  }
  return {apply,validUrl};
})();

(async()=>{
  const page=document.currentScript?.dataset.page;
  const cfg=window.KOSAC_CONFIG;
  if(!page||!window.supabase||!cfg?.SUPABASE_URL||!cfg.SUPABASE_ANON_KEY)return;
  const client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  });
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const jobs=[client.from('kosac_page_content').select('slug,content').in('slug',page==='guidelines'?['about','guidelines']:['about']).abortSignal(controller.signal)];
    if(page==='about'){
      jobs.push(client.from('site_settings').select('about_text,contact_phone,contact_fax,contact_email,contact_address').eq('id',1).abortSignal(controller.signal).maybeSingle());
    }
    const [pages,settings]=await Promise.all(jobs);
    const values={};
    if(settings?.data?.about_text)values.about_lead=settings.data.about_text;
    for(const row of pages.data||[])Object.assign(values,row.content);
    window.KosacContent.apply(document,values);
    const collection=page==='index'?'gallery':page;
    const items=window.KosacCollections?.publishedItems(collection,values);
    if(items)window.KosacCollections.render(document,page,items);
    if(settings?.data){
      for(const node of document.querySelectorAll('[data-contact]')){
        const value=settings.data['contact_'+node.dataset.contact];
        if(typeof value==='string' && value)node.textContent=value;
      }
    }
  }catch{
    // Each page includes the published defaults even if the connection is unavailable.
  }finally{
    clearTimeout(timer);
  }
})();
