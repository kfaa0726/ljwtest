/* Text fields only: no HTML input or executable content. */
window.KosacContentAdmin=(()=>{
  'use strict';
  const defaults=window.KOSAC_CONTENT_DEFAULTS;
  const state={client:null,user:null,ready:false,pending:null,pages:{},dirty:new Set(),busy:false,bound:false};
  const $=id=>document.getElementById(id);
  const owns=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  function status(text,error=false){$('cmsStatus').textContent=text;$('cmsStatus').classList.toggle('cms-error',error);}
  function page(){return $('cmsPage').value;}
  function buttons(){const disabled=!state.ready||state.busy;['cmsSave','cmsReload','cmsPreview','cmsPage','cmsGroup','cmsSearch'].forEach(id=>$(id).disabled=disabled);$('cmsFields').querySelectorAll('textarea').forEach(el=>el.disabled=disabled);}
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
      const input=document.createElement('textarea');input.id='edit-'+field.key;input.value=draft[field.key];input.maxLength=12000;input.rows=input.value.length>130?5:2;input.disabled=!state.ready;
      input.addEventListener('input',()=>{draft[field.key]=input.value;state.dirty.add(current);status('저장하지 않은 변경사항이 있습니다. 아래 저장 버튼을 눌러 반영해 주세요.');});
      wrap.append(label,input);$('cmsFields').append(wrap);
    }
    $('cmsCount').textContent=fields.length+'개 항목 · '+(state.dirty.has(current)?'수정 중':'저장된 내용');
    $('cmsPreviewBox').hidden=true;
  }
  function failure(error){return '불러오기/저장 실패: '+(error?.message||String(error))+'\n처음 설치하는 경우 setup-content.sql을 실행하고 관리자 이메일 등록을 확인해 주세요.';}
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
        if(allowed!==true)throw new Error('이 계정에는 소개·시행요강 수정 권한이 없습니다.');
        const [pages,legacy]=await Promise.all([state.client.from('kosac_page_content').select('slug,content,version,updated_at').in('slug',['about','guidelines']),state.client.from('site_settings').select('about_text').eq('id',1).maybeSingle()]);
        if(pages.error)throw pages.error;
        if(!pages.data || pages.data.length!==2)throw new Error('페이지 초기 데이터가 없습니다.');
        const next={};
        for(const key of ['about','guidelines']){
          const row=pages.data.find(x=>x.slug===key);if(!row)throw new Error('페이지 초기 데이터가 없습니다.');
          const draft={};for(const field of defaults[key].fields)draft[field.key]=field.value;
          if(key==='about' && legacy.data?.about_text)draft.about_lead=legacy.data.about_text;
          for(const field of defaults[key].fields)if(owns(row.content||{},field.key)&&typeof row.content[field.key]==='string')draft[field.key]=row.content[field.key];
          next[key]={draft,version:row.version};
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
    const content={};for(const field of defaults[current].fields){const v=record.draft[field.key];if(typeof v!=='string'||v.length>12000){status('한 항목은 12,000자 이내로 입력해 주세요.',true);return;}content[field.key]=v;}
    if(new TextEncoder().encode(JSON.stringify(content)).length>250000){status('페이지 내용이 너무 깁니다. 내용을 줄여 주세요.',true);return;}
    state.busy=true;buttons();status('저장 중입니다.');
    try{
      const res=await state.client.from('kosac_page_content').update({content}).eq('slug',current).eq('version',record.version).select('version,updated_at');
      if(res.error)throw res.error;
      if(!res.data||res.data.length!==1)throw new Error('다른 창에서 내용이 변경되었거나 수정 권한이 만료되었습니다. 수정 내용을 복사해 둔 뒤 최신 내용 불러오기를 눌러 주세요.');
      record.version=res.data[0].version;state.dirty.delete(current);status(defaults[current].title+' 저장 완료 · 홈페이지를 새로고침하면 확인할 수 있습니다.');$('cmsCount').textContent='저장 완료';
    }catch(error){status(failure(error),true);}finally{state.busy=false;buttons();}
  }
  async function preview(){
    if(!state.ready||state.busy)return;
    const current=page();state.busy=true;buttons();
    try{
      const response=await fetch('./'+current+'.html',{cache:'no-store'});if(!response.ok)throw new Error('미리보기 페이지를 불러올 수 없습니다.');
      const doc=new DOMParser().parseFromString(await response.text(),'text/html');
      doc.querySelectorAll('script').forEach(x=>x.remove());
      const walker=doc.createTreeWalker(doc.querySelector('main'),NodeFilter.SHOW_COMMENT),comments=[];while(walker.nextNode())comments.push(walker.currentNode);
      for(const c of comments){if(!c.data.startsWith('cms:'))continue;const key=c.data.slice(4),value=state.pages[current].draft[key];if(typeof value!=='string')continue;if(c.nextSibling?.nodeType===3)c.nextSibling.textContent=value;else c.after(doc.createTextNode(value));if(value.includes('\n'))c.parentElement.style.whiteSpace='pre-line';}
      // No scripts, forms, or active navigation inside the unsaved preview.
      doc.querySelectorAll('a').forEach(a=>a.removeAttribute('href'));
      const policy=doc.createElement('meta');policy.httpEquiv='Content-Security-Policy';policy.content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https:;";doc.head.prepend(policy);
      $('cmsPreviewFrame').srcdoc='<!doctype html>'+doc.documentElement.outerHTML;$('cmsPreviewBox').hidden=false;
      status('미리보기입니다. 실제 반영하려면 저장 버튼을 눌러 주세요.');
    }catch(error){status(error.message,true);}finally{state.busy=false;buttons();}
  }
  function bind(){
    if(state.bound)return;state.bound=true;
    $('cmsPage').addEventListener('change',groups);$('cmsGroup').addEventListener('change',render);$('cmsSearch').addEventListener('input',render);
    $('cmsSave').addEventListener('click',save);$('cmsPreview').addEventListener('click',preview);
    $('cmsReload').addEventListener('click',()=>{if(state.dirty.size&&!confirm('저장하지 않은 소개·시행요강 변경사항을 버리고 다시 불러올까요?'))return;load(true);});
    window.addEventListener('beforeunload',event=>{if(state.dirty.size){event.preventDefault();event.returnValue='';}});
    buttons();
  }
  function mount(client){state.client=client;bind();return load();}
  function clear(){state.ready=false;state.user=null;state.pages={};state.dirty.clear();$('cmsFields').replaceChildren();$('cmsPreviewFrame').srcdoc='';$('cmsPreviewBox').hidden=true;buttons();}
  function selectPage(key){if(!defaults[key])return;$('cmsPage').value=key;if(state.ready)groups();}
  return {mount,clear,selectPage,hasUnsaved:()=>state.dirty.size>0};
})();
