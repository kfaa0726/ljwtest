/* Administrators edit lists in place and save the whole ordered list together. */
window.KosacCollectionAdmin=(()=>{
  function node(tag,className,text){
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text)el.textContent=text;
    return el;
  }
  function button(text,action,{disabled=false,primary=false}={}){
    const el=node('button',primary?'primary':'secondary',text);
    el.type='button';el.disabled=disabled;
    el.addEventListener('click',action);
    return el;
  }
  function field(label,value,change,{area=false,max=2000}={}){
    const wrapper=node('label','cms-list-field');
    wrapper.append(node('span','',label));
    const input=node(area?'textarea':'input');
    input.maxLength=max;input.value=value||'';
    if(area)input.rows=3;
    input.addEventListener('input',()=>change(input.value));
    wrapper.append(input);
    return wrapper;
  }
  function render(container,page,record,changed,error){
    const api=window.KosacCollections;
    const {items}=record;
    const sponsor=page==='sponsors';
    const title=sponsor?'후원사':'사진';
    const refresh=()=>render(container,page,record,changed,error);
    const edit=()=>{changed();refresh();};
    const forget=key=>{record.files.delete(key);record.uploads.delete(key);};
    function move(index,offset){
      const item=items.splice(index,1)[0];items.splice(index+offset,0,item);
      record.openItem=item.id;edit();
    }

    const root=node('div','cms-collection');
    const top=node('div','cms-list-toolbar');
    top.append(node('strong','',items.length+'개 항목'),button('+ '+title+' 등록',()=>{
      const item=api.createItem();items.push(item);record.openItem=item.id;edit();
      container.querySelector('[data-collection-item="'+item.id+'"] input')?.focus();
    },{primary:true}));
    root.append(top);
    root.append(node('p','help',sponsor?'회사별로 소개 이미지와 링크를 여러 개 등록할 수 있습니다.':'공개 순서에 따라 메인 화면에 사진을 최대 5장 표시합니다.'));
    if(!items.length)root.append(node('p','help','등록한 항목이 없습니다.'));
    items.forEach((item,index)=>{
      const card=node('details','cms-entry');card.dataset.collectionItem=item.id;
      card.open=record.openItem===item.id;
      const summary=node('summary','',item.title||('새 '+title));
      card.append(summary);
      card.addEventListener('toggle',()=>{
        if(card.open)record.openItem=item.id;
        else if(record.openItem===item.id)record.openItem=null;
      });

      const body=node('div','cms-entry-fields');
      body.append(field(sponsor?'후원사 이름':'사진 제목',item.title,value=>{
        item.title=value;summary.textContent=value||('새 '+title);changed();
      },{max:180}));
      body.append(field(sponsor?'소개 문구':'사진 설명',item.description,value=>{item.description=value;changed();},{area:true,max:4000}));
      const publish=node('label','check');
      const visible=node('input');visible.type='checkbox';visible.checked=item.published;
      visible.addEventListener('change',()=>{item.published=visible.checked;changed();});
      publish.append(visible,document.createTextNode(' 홈페이지 공개'));body.append(publish);

      for(const [i,image] of item.images.entries()){
        const key=api.imageKey(item,image);
        const group=node('fieldset','cms-media');
        group.append(node('legend','',sponsor?'소개 이미지 '+(i+1):'사진 이미지'));
        const src=window.KosacContent.validUrl(image.url);
        if(src){
          const picture=node('img','cms-thumb');picture.src=src;picture.alt=image.alt||item.title;picture.loading='lazy';group.append(picture);
        }
        const picker=node('input');picker.type='file';picker.accept='image/jpeg,image/png,image/webp,image/gif';
        picker.setAttribute('aria-label',(item.title||title)+' 이미지 '+(i+1)+' 파일');
        const selection=node('span','help',record.files.get(key)?.name||'JPG, PNG, WebP, GIF · 최대 20MB');
        picker.addEventListener('change',()=>{
          const file=picker.files[0];
          if(!file)return;
          if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)||file.size>20*1024*1024){
            picker.value='';error('JPG, PNG, WebP, GIF 이미지를 20MB 이하로 선택해 주세요.');return;
          }
          record.files.set(key,file);record.uploads.delete(key);
          selection.textContent=file.name;changed();
        });
        group.append(field('이미지 주소',image.url,value=>{image.url=value;forget(key);picker.value='';selection.textContent='';changed();}),picker,selection);
        group.append(field('이미지 대체 설명',image.alt,value=>{image.alt=value;changed();},{max:400}));
        if(sponsor)group.append(button('이 이미지 삭제',()=>{item.images.splice(i,1);forget(key);edit();}));
        body.append(group);
      }
      if(sponsor){
        body.append(button('+ 소개 이미지 추가',()=>{item.images.push(api.createImage());edit();}));
        item.links.forEach((entry,i)=>{
          const group=node('fieldset','cms-media');
          group.append(node('legend','','관련 링크 '+(i+1)));
          group.append(field('링크 이름',entry.label,value=>{entry.label=value;changed();},{max:180}),
            field('링크 주소',entry.url,value=>{entry.url=value;changed();}),
            button('이 링크 삭제',()=>{item.links.splice(i,1);edit();}));
          body.append(group);
        });
        body.append(button('+ 관련 링크 추가',()=>{item.links.push(api.createLink());edit();}));
      }
      const actions=node('div','cms-list-toolbar cms-entry-actions');
      actions.append(button('위로',()=>move(index,-1),{disabled:index===0}),
        button('아래로',()=>move(index,1),{disabled:index===items.length-1}),
        button('항목 삭제',()=>{
          for(const image of item.images)forget(api.imageKey(item,image));
          items.splice(index,1);edit();
        }));
      body.append(actions);card.append(body);root.append(card);
    });
    container.replaceChildren(root);
  }
  return {render};
})();
