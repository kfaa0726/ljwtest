/* Stores ordered gallery and sponsor records in the existing published page content. */
window.KosacCollections=(()=>{
  const supported=new Set(['gallery','sponsors']);
  const orderKey=page=>page+'_collection_order';
  const prefix=page=>page+'_collection_item_';
  const idOk=id=>typeof id==='string' && /^[a-z0-9-]{1,80}$/.test(id);
  const imageKey=(item,image)=>item.id+'/'+image.id;
  const newId=()=>crypto.randomUUID();
  const createImage=()=>({id:newId(),url:'',alt:''});
  const createLink=()=>({id:newId(),url:'',label:''});
  const createItem=()=>({id:'item-'+newId(),title:'',description:'',published:true,images:[createImage()],links:[]});

  function publishedItems(page,values){
    if(!supported.has(page) || typeof values[orderKey(page)]!=='string')return null;
    try{
      const order=JSON.parse(values[orderKey(page)]);
      if(!Array.isArray(order))return null;
      return [...new Set(order)].filter(idOk).flatMap(id=>{
        try{
          const item=JSON.parse(values[prefix(page)+id]);
          if(item?.id!==id || typeof item.title!=='string' || typeof item.description!=='string' ||
             !Array.isArray(item.images)||!Array.isArray(item.links))return [];
          return [item];
        }catch{return [];}
      });
    }catch{return null;}
  }

  function legacyItems(page,doc,values){
    const text=(node,attr)=>values[node.getAttribute('data-edit'+(attr?'-'+attr:''))] ??
      (attr?node.getAttribute(attr):node.textContent.trim());
    if(page==='gallery'){
      return [...doc.querySelectorAll('.gallery-archive figure')].map(figure=>{
        const image=figure.querySelector('img');
        return {id:figure.id,title:text(figure.querySelector('figcaption'),'')||image.alt,description:'',published:true,
          images:[{id:'original',url:text(image,'src'),alt:text(image,'alt')}],links:[]};
      });
    }
    return [...doc.querySelectorAll('.sponsor-profile')].map(article=>({
      id:article.id,title:text(article.querySelector('h2'),'')||article.querySelector('h2').textContent.trim(),
      description:'',published:true,
      images:[...article.querySelectorAll('img')].map((image,index)=>({id:'image-'+index,url:text(image,'src'),alt:image.alt})),
      links:[...article.querySelectorAll('.sponsor-company-links a')].map((link,index)=>({id:'link-'+index,url:text(link,'href'),label:link.textContent.trim()})),
    }));
  }

  function storeItems(page,items,content){
    const order=JSON.stringify(items.map(item=>item.id));
    if(order.length>12000)throw Error('항목이 너무 많습니다.');
    for(const key of Object.keys(content))if(key.startsWith(prefix(page)))delete content[key];
    content[orderKey(page)]=order;
    for(const item of items){
      const value=JSON.stringify(item);
      if(value.length>12000)throw Error(item.title+'의 설명이나 링크가 너무 깁니다.');
      content[prefix(page)+item.id]=value;
    }
  }

  function element(doc,tag,className,text){
    const node=doc.createElement(tag);
    if(className)node.className=className;
    if(text)node.textContent=text;
    return node;
  }

  function render(doc,page,items,options={}){
    const {preview=false,images=new Map()}=options;
    const active=items.filter(item=>item.published && item.title.trim());
    const safeUrl=window.KosacContent.validUrl;
    const source=(item,image)=>images.get(imageKey(item,image))||safeUrl(image.url);
    const makeImage=(item,image,url)=>{
      const img=element(doc,'img');
      img.src=url;img.alt=image.alt||item.title;img.loading='lazy';
      return img;
    };
    const empty=()=>element(doc,'p','empty',page==='sponsors'?'등록된 후원사 소개가 없습니다.':'등록된 갤러리 사진이 없습니다.');
    if(page!=='sponsors'){
      const home=page==='index';
      const target=doc.querySelector(home?'.gallery-grid':'.gallery-archive');
      if(!target)return;
      const photos=active.flatMap(item=>{
        const image=item.images[0];
        const url=image&&source(item,image);
        if(!url)return [];
        const link=element(doc,'a');
        link.href=home?'./gallery.html#'+item.id:url;
        link.append(makeImage(item,image,url));
        if(home)return [link];
        const figure=element(doc,'figure');figure.id=item.id;
        figure.append(link,element(doc,'figcaption','',item.title));
        if(item.description)figure.append(element(doc,'p','gallery-description',item.description));
        return [figure];
      });
      target.replaceChildren(...(photos.length?photos.slice(0,home?5:photos.length):[empty()]));
      return;
    }

    const menu=doc.querySelector('.sponsor-sidebar ul');
    const target=doc.querySelector('.sponsor-profiles');
    if(!menu||!target)return;
    const entries=[],profiles=[];
    for(const item of active){
      const li=element(doc,'li'),link=element(doc,'a','',item.title);
      link.href='#'+item.id;li.append(link);entries.push(li);
      const article=element(doc,'article','sponsor-profile');article.id=item.id;
      const title=element(doc,'h2','',item.title);title.id=item.id+'-name';
      article.setAttribute('aria-labelledby',title.id);
      const material=element(doc,'div','sponsor-material');
      if(item.description)material.append(element(doc,'p','sponsor-description',item.description));
      for(const image of item.images){
        const url=source(item,image);
        if(url)material.append(makeImage(item,image,url));
      }
      const list=element(doc,'ul','sponsor-company-links');
      for(const entry of item.links){
        const href=safeUrl(entry.url);
        if(!href)continue;
        const li=element(doc,'li'),link=element(doc,'a','',entry.label||href);
        link.href=href;li.append(link);list.append(li);
      }
      if(list.childElementCount)material.append(list);
      article.append(title,material);profiles.push(article);
    }
    menu.replaceChildren(...entries);
    target.replaceChildren(...(profiles.length?profiles:[empty()]));
    if(!preview)doc.dispatchEvent(new Event('kosac:sponsors-updated'));
  }
  return {supported,publishedItems,legacyItems,storeItems,createItem,createImage,createLink,imageKey,render};
})();
