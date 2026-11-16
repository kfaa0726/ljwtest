/* Edit published text and media through the existing page-content permissions. */
window.KosacContentAdmin=(()=>{
  'use strict';
  const defaults=window.KOSAC_CONTENT_DEFAULTS;
  const state={client:null,user:null,ready:false,pending:null,pages:{},rows:{},dirty:new Set(),busy:false,bound:false};
  const $=id=>document.getElementById(id);
  const owns=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  function status(text,error=false){$('cmsStatus').textContent=text;$('cmsStatus').classList.toggle('cms-error',error);}
  function rowSlug(page){return page==='guidelines'?'guidelines':'about';}
  function page(){return $('cmsPage').value;}
  function buttons(){const disabled=!state.ready||state.busy;['cmsSave','cmsReload','cmsPreview','cmsPage','cmsGroup','cmsSearch'].forEach(id=>$(id).disabled=disabled);$('cmsFields').querySelectorAll('input,textarea').forEach(el=>el.disabled=disabled);}
  function groups(){
    const select=$('cmsGroup');select.replaceChildren();
    for(const group of defaults[page()].groups){const option=document.createElement('option');option.value=group.id;option.textContent=group.title;select.append(option);}
    $('cmsSearch').value='';render();
  }
  function render(){
    const current=page(),draft=state.pages[current]?.draft;if(!draft)return;
    const query=$('cmsSearch').value.trim().toLowerCase(), group=$('cmsGroup').value;
    const fields=defaults[current].fields.filter(f=>query?(f.label+' '+draft[f.key]).toLowerCase().includes(query):f.group===group);
    $('cmsFields').replaceChildren();
    for(const field of fields){
      const wrap=document.createElement('div');wrap.className='field cms-field';
      const label=document.createElement('label');label.htmlFor='edit-'+field.key;label.textContent=field.label;
      const input=document.createElement(field.type?'input':'textarea');
      input.id='edit-'+field.key;input.value=draft[field.key];input.maxLength=12000;input.disabled=!state.ready;
      if(!field.type)input.rows=input.value.length>130?5:2;
      const change=()=>{
        draft[field.key]=input.value;
        state.pages[current].files.delete(field.key);
        state.pages[current].uploads.delete(field.key);
        state.dirty.add(current);
        status('저장하지 않은 변경사항이 있습니다.');
      };
      input.addEventListener('input',change);
      wrap.append(label,input);
      if(field.type==='image'){
        const picker=document.createElement('input');
        picker.type='file';picker.accept='image/jpeg,image/png,image/webp,image/gif';
        picker.setAttribute('aria-label',field.label+' 파일 선택');
        const selected=document.createElement('span');selected.className='help';
        selected.textContent=state.pages[current].files.get(field.key)?.name||'이미지 URL을 입력하거나 파일을 선택하세요. 최대 20MB.';
        input.addEventListener('input',()=>{picker.value='';selected.textContent='';});
        picker.addEventListener('change',()=>{
          const file=picker.files[0];
          if(!file)return;
          if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||file.size>20*1024*1024){
            picker.value='';status('JPG, PNG, WebP, GIF 이미지(20MB 이하)를 선택해 주세요.',true);return;
          }
          state.pages[current].files.set(field.key,file);
          state.pages[current].uploads.delete(field.key);
          state.dirty.add(current);
          selected.textContent=file.name;
          status('저장하면 선택한 이미지가 반영됩니다.');
        });
        wrap.append(picker,selected);
      }
      $('cmsFields').append(wrap);
    }
    $('cmsCount').textContent=fields.length+'개 항목 · '+(state.dirty.has(current)?'수정 중':'저장된 내용');
    $('cmsPreviewBox').hidden=true;
  }
  function failure(error){return '불러오기/저장 실패: '+(error?.message||String(error))+'\n관리자 계정의 페이지 수정 권한을 확인해 주세요.';}
  async function load(force=false){
    if(state.pending)return state.pending;
    if(!state.client)return;
    if(state.ready&&!force)return;
    state.pending=(async()=>{
      state.busy=true;buttons();status('페이지 내용을 불러오는 중입니다.');
      try{
        const {data:identity,error:authError}=await state.client.auth.getUser();if(authError)throw authError;
        if(!identity?.user)throw new Error('관리자 로그인이 필요합니다.');
        const {data:allowed,error:permissionError}=await state.client.rpc('kosac_can_edit_pages');if(permissionError)throw permissionError;
        if(allowed!==true)throw new Error('이 계정에는 페이지 수정 권한이 없습니다.');
        const [pages,legacy]=await Promise.all([state.client.from('kosac_page_content').select('slug,content,version,updated_at').in('slug',['about','guidelines']),state.client.from('site_settings').select('about_text').eq('id',1).maybeSingle()]);
        if(pages.error)throw pages.error;
        if(!pages.data || pages.data.length!==2)throw new Error('페이지 초기 데이터가 없습니다.');
        const next={};
        state.rows=Object.fromEntries(pages.data.map(row=>[row.slug,row]));
        for(const key of Object.keys(defaults)){
          const row=state.rows[rowSlug(key)];
          if(!row)throw new Error('페이지 초기 데이터가 없습니다.');
          const draft={};
          for(const field of defaults[key].fields){
            draft[field.key]=field.value;
            if(field.key==='about_lead'&&legacy.data?.about_text)draft[field.key]=legacy.data.about_text;
            if(owns(row.content||{},field.key)&&typeof row.content[field.key]==='string')draft[field.key]=row.content[field.key];
          }
          next[key]={draft,files:new Map(),uploads:new Map()};
        }
        state.pages=next;state.user=identity.user.id;state.ready=true;state.dirty.clear();groups();status('내용을 수정한 뒤 저장하면 홈페이지에 반영됩니다.');
      }catch(error){state.ready=false;status(failure(error),true);}finally{state.busy=false;state.pending=null;buttons();}
    })();
    return state.pending;
  }
  async function save(){
    if(!state.ready||state.busy)return;
    const current=page(),record=state.pages[current];
    if(!state.dirty.has(current)){status('변경된 내용이 없습니다.');return;}
    const slug=rowSlug(current),row=state.rows[slug];
    const content={...row.content};
    for(const field of defaults[current].fields){
      const value=record.draft[field.key];
      if(typeof value!=='string'||value.length>12000){status('한 항목은 12,000자 이내로 입력해 주세요.',true);return;}
      if(field.type && value.trim() && !record.files.has(field.key) && !window.KosacContent.validUrl(value)){
        status(field.label+'에 사용할 수 있는 URL을 입력해 주세요.',true);return;
      }
      content[field.key]=value;
    }
    state.busy=true;buttons();status('저장 중입니다.');
    try{
      const bucket=state.client.storage.from('kosac-files');
      for(const [key,file] of record.files){
        if(record.uploads.has(key)){content[key]=record.uploads.get(key);continue;}
        const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[file.type];
        const path='notices/site-'+crypto.randomUUID()+'.'+ext;
        const {error}=await bucket.upload(path,file,{contentType:file.type});
        if(error)throw error;
        content[key]=bucket.getPublicUrl(path).data.publicUrl;
        record.uploads.set(key,content[key]);
      }
      if(new TextEncoder().encode(JSON.stringify(content)).length>250000)throw new Error('저장할 메뉴 내용이 너무 깁니다. 내용을 줄여 주세요.');
      const res=await state.client.from('kosac_page_content').update({content}).eq('slug',slug).eq('version',row.version).select('version,updated_at');
      if(res.error)throw res.error;
      if(res.data?.length!==1)throw new Error('다른 창에서 내용이 변경되었거나 수정 권한이 만료되었습니다. 최신 내용을 불러온 뒤 다시 저장해 주세요.');
      row.version=res.data[0].version;
      row.content=content;
      for(const key of record.files.keys())record.draft[key]=content[key];
      record.files.clear();
      record.uploads.clear();
      state.dirty.delete(current);render();
      status(defaults[current].title+' 저장 완료 · 홈페이지를 새로고침하면 확인할 수 있습니다.');
    }catch(error){
      // Retain uploaded URLs if a network error makes the update result uncertain.
      if(record.uploads.size)status(failure(error)+' 선택한 이미지와 입력 내용은 저장 화면에 남아 있습니다.',true);
      else status(failure(error),true);
    }finally{state.busy=false;buttons();}
  }
  async function preview(){
    if(!state.ready||state.busy)return;
    const current=page();state.busy=true;buttons();
    try{
      const path=defaults[current].path||current+'.html';
      const response=await fetch('./'+path,{cache:'no-store'});
      if(!response.ok)throw new Error('미리보기 페이지를 불러올 수 없습니다.');
      const doc=new DOMParser().parseFromString(await response.text(),'text/html');
      doc.querySelectorAll('script').forEach(x=>x.remove());
      const values={...state.rows.about.content,...state.rows.guidelines.content,...state.pages[current].draft};
      window.KosacContent.apply(doc,values);
      for(const [key,file] of state.pages[current].files){
        const url=await new Promise((resolve,reject)=>{
          const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);
        });
        for(const node of doc.querySelectorAll('[data-edit-src],[data-edit-srcset]')){
          if(node.dataset.editSrc===key){node.src=url;node.hidden=false;}
          if(node.dataset.editSrcset===key)node.srcset=url;
        }
      }
      doc.querySelectorAll('a').forEach(a=>a.removeAttribute('href'));
      const policy=doc.createElement('meta');policy.httpEquiv='Content-Security-Policy';
      policy.content="default-src 'none'; style-src 'unsafe-inline' https:; img-src data: https:; font-src https:;";
      doc.head.prepend(policy);
      $('cmsPreviewFrame').srcdoc='<!doctype html>'+doc.documentElement.outerHTML;$('cmsPreviewBox').hidden=false;
      status('미리보기입니다. 실제 반영하려면 저장 버튼을 눌러 주세요.');
    }catch(error){status(error.message,true);}finally{state.busy=false;buttons();}
  }
  function bind(){
    if(state.bound)return;state.bound=true;
    for(const [key,props] of Object.entries(defaults)){
      const option=document.createElement('option');option.value=key;option.textContent=props.title;$('cmsPage').append(option);
    }
    $('cmsPage').addEventListener('change',groups);$('cmsGroup').addEventListener('change',render);$('cmsSearch').addEventListener('input',render);
    $('cmsSave').addEventListener('click',save);$('cmsPreview').addEventListener('click',preview);
    $('cmsReload').addEventListener('click',()=>{if(state.dirty.size&&!confirm('저장하지 않은 페이지 변경사항을 버리고 다시 불러올까요?'))return;load(true);});
    window.addEventListener('beforeunload',event=>{if(state.dirty.size){event.preventDefault();event.returnValue='';}});
    buttons();
  }
  function mount(client){state.client=client;bind();return load();}
  function clear(){state.ready=false;state.user=null;state.pages={};state.dirty.clear();$('cmsFields').replaceChildren();$('cmsPreviewFrame').srcdoc='';$('cmsPreviewBox').hidden=true;buttons();}
  function selectPage(key){if(!defaults[key])return;$('cmsPage').value=key;if(state.ready)groups();}
  return {mount,clear,selectPage,hasUnsaved:()=>state.dirty.size>0};
})();
