(() => {
'use strict';
const CFG=window.KOSAC_CONFIG||{};
const configured=
  CFG.SUPABASE_URL &&
  !CFG.SUPABASE_URL.includes('YOUR_PROJECT') &&
  CFG.SUPABASE_ANON_KEY &&
  !CFG.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');

const setupWarning=document.getElementById('setupWarning');
const noticeBoard=document.getElementById('noticeBoard');
const noticeModal=document.getElementById('noticeModal');
const modalTitle=document.getElementById('modalTitle');
const modalCategory=document.getElementById('modalCategory');
const modalDate=document.getElementById('modalDate');
const modalBody=document.getElementById('modalBody');
const modalActions=document.getElementById('modalActions');
const modalFile=document.getElementById('modalFile');
const modalLink=document.getElementById('modalLink');
const closeModal=document.getElementById('closeModal');
const phone=document.getElementById('phone');
const fax=document.getElementById('fax');
const email=document.getElementById('email');
const address=document.getElementById('address');

let sb=null;
let notices=[];
let activeNotice=null;

try {
  if(configured && window.supabase){
    sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
  }
} catch {
  // The public fallback is available when client initialization fails.
}

function esc(s){
  return String(s??'').replace(/[&<>"']/g,m=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#039;'
  }[m]));
}

function formatDate(d){
  return d ? d.replaceAll('-','.') : '';
}

async function load(){
  if(!sb){
    loadFallback();
    return;
  }

  const signal=AbortSignal.timeout(8000);
  const [settingsRes,noticeRes]=await Promise.all([
    sb.from('site_settings').select('*').eq('id',1).abortSignal(signal).single(),
    sb.from('notices')
      .select('*')
      .eq('published',true)
      .order('pinned',{ascending:false})
      .order('published_at',{ascending:false})
      .order('created_at',{ascending:false})
      .abortSignal(signal)
  ]);

  if(settingsRes.data){
    const s=settingsRes.data;
    if(phone && s.contact_phone) phone.textContent=s.contact_phone;
    if(fax && s.contact_fax) fax.textContent=s.contact_fax;
    if(email && s.contact_email) email.textContent=s.contact_email;
    if(address && s.contact_address) address.textContent=s.contact_address;
  }

  if(noticeRes.error){
    loadFallback();
    return;
  }

  notices=noticeRes.data||[];
  renderNotices();
}

function loadFallback(){
  setupWarning.hidden=false;
  notices=[
    {
      category:'공지',
      title:'2027 대한민국 대학생 광고대회(KOSAC) 임시 홈페이지 안내',
      body:'KOSAC 홈페이지 개편 및 클라우드 이전 준비에 따라 임시 홈페이지를 운영합니다. 주요 안내는 본 페이지를 통해 공지됩니다.',
      published_at:'2026-10-02'
    },
    {
      category:'대회',
      title:'2027 KOSAC 시행요강 및 작품접수 안내 예정',
      body:'2027 KOSAC 시행요강과 작품접수 일정은 추후 공지사항을 통해 안내드릴 예정입니다.',
      published_at:'2026-10-01'
    }
  ];
  renderNotices();
}

function renderNotices(){
  noticeBoard.innerHTML='';

  if(!notices.length){
    noticeBoard.innerHTML='<div class="empty">등록된 공지사항이 없습니다.</div>';
    return;
  }

  const previewLimit=Number(noticeBoard.dataset.limit)||notices.length;
  notices.slice(0,previewLimit).forEach(n=>{
    const row=document.createElement('button');
    row.className='notice-row';
    row.type='button';
    row.innerHTML=`
      <span class="notice-title">${esc(n.title)}</span>
      <span class="notice-date">${esc(formatDate(n.published_at))}</span>
    `;
    row.addEventListener('click',()=>openNotice(n,row));
    noticeBoard.appendChild(row);
  });
}

function usableUrl(value){
  if(!value) return '';
  try{
    const url=new URL(value,document.baseURI);
    if(!['http:','https:'].includes(url.protocol)) return '';
    if(url.hostname==='kosac.ad.co.kr') return '';
    return url.href;
  }catch{
    return '';
  }
}

function openNotice(n,row){
  activeNotice=row;
  modalTitle.textContent=n.title||'';
  modalCategory.textContent=n.category||'공지';
  modalDate.textContent=formatDate(n.published_at||'');
  modalBody.textContent=n.body||'';

  const attachment=usableUrl(n.attachment_url);
  const related=usableUrl(n.link_url);

  let hasAction=false;

  if(attachment){
    modalFile.href=attachment;
    modalFile.textContent=n.attachment_name
      ? `첨부파일 다운로드 · ${n.attachment_name}`
      : '첨부파일 다운로드';
    modalFile.style.display='inline-flex';
    hasAction=true;
  }else{
    modalFile.removeAttribute('href');
    modalFile.style.display='none';
  }

  if(related){
    modalLink.href=related;
    modalLink.style.display='inline-flex';
    hasAction=true;
  }else{
    modalLink.removeAttribute('href');
    modalLink.style.display='none';
  }

  modalActions.classList.toggle('show',hasAction);

  noticeModal.classList.add('show');
  document.body.style.overflow='hidden';
  closeModal.focus();
}

function closeNoticeModal(){
  noticeModal.classList.remove('show');
  document.body.style.overflow='';
  activeNotice?.focus();
  activeNotice=null;
}

closeModal.addEventListener('click',closeNoticeModal);
noticeModal.addEventListener('click',e=>{
  if(e.target===noticeModal) closeNoticeModal();
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') closeNoticeModal();
});

load().catch(loadFallback);

})();
