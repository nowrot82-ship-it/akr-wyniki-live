
/* AKR — wspólne komunikaty, bez ingerencji w system pomiarowy */
(function(){
  'use strict';

  if(window.AKRNoticesLoaded)return;
  window.AKRNoticesLoaded=true;

  const API='https://script.google.com/macros/s/AKfycbwtcbpTmcDbpIlW7YtfmmWJXyyg1Tgp9M-LS5CepIfh4vtdoHHicTK3MdOQQkjs9Jxb/exec';
  const KEY='akr-notices-confirmed-v2';

  let seen={};
  try{
    seen=JSON.parse(localStorage.getItem(KEY)||'{}')||{};
  }catch(e){}

  const style=document.createElement('style');
  style.textContent=`
    .akr-notice-overlay[hidden]{display:none!important}
    .akr-notice-overlay{
      position:fixed;inset:0;z-index:10000;
      background:rgba(0,0,0,.82);
      display:flex;align-items:center;justify-content:center;
      padding:18px
    }
    .akr-notice-dialog{
      background:#171717;
      border:2px solid #d71920;
      border-radius:16px;
      width:min(100%,520px);
      max-height:85dvh;
      overflow:auto;
      padding:22px;
      box-shadow:0 15px 65px #000;
      color:#fff;
      font:15px/1.5 Arial,sans-serif
    }
    .akr-notice-dialog h2{
      margin:0 0 12px;font-size:23px
    }
    .akr-notice-date{
      color:#ff7d83;font-size:12px;font-weight:800
    }
    .akr-notice-title{
      font-size:20px;font-weight:900;margin:8px 0
    }
    .akr-notice-body{
      white-space:pre-wrap;
      overflow-wrap:anywhere;
      line-height:1.55
    }
    .akr-notice-ok{
      width:100%;margin-top:20px;padding:14px;
      background:#d71920;border:0;border-radius:9px;
      color:#fff;font-size:16px;font-weight:900;
      cursor:pointer
    }
    .akr-announcement-card{
      border:1px solid #393939;
      border-radius:12px;
      background:#171717;
      color:#fff;
      margin:9px 0;
      padding:13px 15px;
      font:14px/1.6 Arial,sans-serif
    }
    .akr-announcement-card time{
      display:block;
      font-size:12px;color:#ff767b;font-weight:800
    }
    .akr-announcement-card h3{
      font-size:18px;margin:5px 0 7px
    }
    .akr-announcement-card p{
      margin:0;
      white-space:pre-wrap;
      overflow-wrap:anywhere
    }
  `;
  document.head.appendChild(style);

  const overlay=document.createElement('div');
  overlay.className='akr-notice-overlay';
  overlay.hidden=true;

  overlay.innerHTML=`
    <section class="akr-notice-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="akr-notice-heading">
      <h2 id="akr-notice-heading">📢 NOWY KOMUNIKAT</h2>
      <div class="akr-notice-date"></div>
      <div class="akr-notice-title"></div>
      <div class="akr-notice-body"></div>
      <button class="akr-notice-ok" type="button">
        POTWIERDZAM / ZAMKNIJ
      </button>
    </section>
  `;

  document.body.appendChild(overlay);

  const button=overlay.querySelector('button');
  let current=null;
  let latestId=null;
  let latestItems=[];

  function fingerprint(k){
    const raw=[
      k.id??'',
      k.data??'',
      k.godzina??'',
      k.tytul??'',
      k.tresc??''
    ].map(String).join('\u001f');

    let h=2166136261;
    for(let i=0;i<raw.length;i++){
      h^=raw.charCodeAt(i);
      h=Math.imul(h,16777619);
    }
    return(h>>>0).toString(36)+':'+raw.length;
  }

  function save(){
    try{
      localStorage.setItem(KEY,JSON.stringify(seen));
    }catch(e){}
  }

  function renderList(items){
    const el=document.getElementById('akr-home-announcements');
    if(!el)return;

    el.replaceChildren();

    if(!items.length){
      el.textContent='Brak opublikowanych komunikatów.';
      return;
    }

    items.forEach(k=>{
      const article=document.createElement('article');
      article.className='akr-announcement-card';

      const time=document.createElement('time');
      time.textContent=[k.data,k.godzina]
        .filter(Boolean).join(' • ');

      const h=document.createElement('h3');
      h.textContent=k.tytul||'';

      const p=document.createElement('p');
      p.textContent=k.tresc||'';

      article.append(time,h,p);
      el.appendChild(article);
    });
  }

  function accept(items){
    if(!Array.isArray(items))return;

    items=items.filter(x=>x&&typeof x==='object');
    latestItems=items;
    renderList(items);

    if(!items.length){
      latestId=null;
      overlay.hidden=true;
      current=null;
      return;
    }

    const newest=items[0];
    const id=fingerprint(newest);

    // Starsze komunikaty nie trafiają do kolejki.
    for(const item of items.slice(1)){
      seen[fingerprint(item)]=true;
    }

    save();
    latestId=id;

    if(current&&current.id!==id){
      overlay.hidden=true;
      current=null;
    }

    if(!seen[id]&&!current){
      current={id,item:newest};

      overlay.querySelector('.akr-notice-date')
        .textContent=[newest.data,newest.godzina]
          .filter(Boolean).join(' • ');

      overlay.querySelector('.akr-notice-title')
        .textContent=newest.tytul||'Komunikat organizatora';

      overlay.querySelector('.akr-notice-body')
        .textContent=newest.tresc||'';

      overlay.hidden=false;
      button.focus();
    }
  }

  button.addEventListener('click',()=>{
    if(!current)return;

    seen[current.id]=true;
    save();
    current=null;
    overlay.hidden=true;
  });

  function jsonp(){
    return new Promise((resolve,reject)=>{
      const name='AKRcallback_notice_'+Date.now()+'_'
        +Math.floor(Math.random()*100000);

      const s=document.createElement('script');
      let done=false;

      const timeout=setTimeout(
        ()=>finish(new Error('Brak odpowiedzi')),
        12000
      );

      function finish(e,value){
        if(done)return;
        done=true;
        clearTimeout(timeout);
        delete window[name];
        s.remove();
        e?reject(e):resolve(value);
      }

      window[name]=d=>finish(null,d);
      s.onerror=()=>finish(new Error('Błąd połączenia'));

      s.src=API+'?callback='+encodeURIComponent(name)
        +'&t='+Date.now();

      document.head.appendChild(s);
    });
  }

  function refresh(){
    jsonp()
      .then(d=>{
        if(d&&d.ok)accept(d.komunikaty);
      })
      .catch(()=>{});
  }

  refresh();
  setInterval(refresh,30000);

  window.AKRNotices={refresh,accept};
})();
