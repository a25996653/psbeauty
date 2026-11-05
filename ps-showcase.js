/* PSの貼心日和所 · 公開商品／文章展示讀取器 (無管理員 Token) */
(() => {
  'use strict';
  const opts = window.PS_SHOWCASE_CONFIG || {};
  const byId = id => document.getElementById(id);
  const NO_SRC = '';
  const LINE_URL = 'https://lin.ee/paqZOSh';
  const SAFE_CATEGORIES = new Set(['stock', 'preorder', 'sold_out']);
  const DEMO_PRODUCTS = [
    {id:'demo-1',title:'YUKINOUE 雪之上全效合一水凝霜',category:'保養選品',sale_mode:'preorder',summary:'讓日常保養，成為溫柔的生活儀式。',price_twd:null,cover_url:'',shop_url:LINE_URL,icon:'🫙',published:true},
    {id:'demo-2',title:'療癒系電子儲金箱',category:'生活雜貨',sale_mode:'stock',summary:'把日常的小心願，一點一點存起來。',price_twd:null,cover_url:'',shop_url:LINE_URL,icon:'🎁',published:true},
    {id:'demo-3',title:'Ochcahser 抹茶套組・米色臘腸狗',category:'生活選物',sale_mode:'preorder',summary:'可愛又療癒的居家選物提案。',price_twd:null,cover_url:'',shop_url:LINE_URL,icon:'🍵',published:true}
  ];
  const DEMO_ARTICLES = [
    {id:'demo-j1',title:'保養的第一步：找到適合自己的洗臉方式',category:'保養小知識',summary:'洗得乾淨，也要讓肌膚感到舒服。',content_text:'依膚況挑選合適的潔顏產品，以溫和方式清潔肌膚，是日常保養的起點。\n這是文章展示版型的示例內容，正式內容將由後台已發布文章提供。',cover_url:'',icon:'🫧',published:true},
    {id:'demo-j2',title:'為什麼日系生活雜貨總能讓人覺得療癒？',category:'日本生活',summary:'那些被好好設計的日常小物，藏著生活的心意。',content_text:'從材質、色彩到包裝，日本生活選物常在細節中傳遞溫柔。\n這是文章展示版型的示例內容，正式內容將由後台已發布文章提供。',cover_url:'',icon:'🍃',published:true},
    {id:'demo-j3',title:'慢慢保養：建立自己的日常保養順序',category:'保養日記',summary:'不用追求複雜，找到適合自己的步調更重要。',content_text:'保養不必追求一次做很多，而是找到適合自己的程序和使用習慣。\n這是文章展示版型的示例內容，正式內容將由後台已發布文章提供。',cover_url:'',icon:'🌷',published:true}
  ];
  const state = {products:[], articles:[], filter:'all'};
  const CATEGORY_LABELS = {
    skincare:'保養品', beauty:'美妝選品', health:'健康保健',
    daily:'生活雜貨', daily_goods:'生活雜貨', lifestyle:'生活選品',
    skincare_tips:'保養小知識', personal_review:'PS 愛用心得',
    japanese_lifestyle:'日本生活', japan_lifestyle:'日本生活'
  };
  const categoryLabel = value => CATEGORY_LABELS[String(value||'')] || String(value||'');
  // PocketBase 編輯器可能含 HTML；只擷取可閱讀文字，絕不把原始 HTML 插入頁面。
  function readableText(v) {
    const raw=String(v||'');
    if(!/<[a-z][\s\S]*?>/i.test(raw)) return raw;
    const prepared=raw.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi,'\n');
    const parsed=new DOMParser().parseFromString(prepared,'text/html');
    return (parsed.body.textContent||'').replace(/\n[ \t]*\n[ \t]*\n/g,'\n\n').trim();
  }
  // Reconstruct only approved rich-text nodes; never inject PocketBase HTML with innerHTML.
  function safeArticleDocument(content){
    const root=el('div',{class:'ps-article-richtext'});
    const parsed=new DOMParser().parseFromString(String(content||''),'text/html');
    const allow=new Set(['p','div','span','h2','h3','h4','strong','b','em','i','u','s','br','blockquote','ul','ol','li','a','img','figure','figcaption','hr','mark']);
    function url(v){
      if(!v||typeof v!=='string')return '';
      try{const u=new URL(v,location.href);
        if(u.protocol!=='https:'&&!(u.origin===location.origin&&u.protocol==='http:'))return '';
        if(u.username||u.password)return '';
        return u.href;
      }catch{return '';}
    }
    function styleValue(raw){
      return String(raw||'').split(';').map(x=>x.trim()).filter(v=>{
        const m=v.match(/^([a-z-]+)\s*:\s*(.+)$/i);if(!m)return false;
        const key=m[1].toLowerCase(),value=m[2].toLowerCase();
        return (['color','background-color'].includes(key)&&/^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/.test(value))||(key==='text-align'&&['left','right','center','justify'].includes(value));
      }).join(';');
    }
    function build(node){
      if(node.nodeType===Node.TEXT_NODE)return document.createTextNode(node.textContent||'');
      if(node.nodeType!==Node.ELEMENT_NODE)return document.createDocumentFragment();
      const tag=node.tagName.toLowerCase();
      if(['script','style','iframe','object','embed','svg','form','math','template'].includes(tag))return document.createDocumentFragment();
      if(tag==='div'&&node.getAttribute('data-ps-video')){
        const candidate=url(node.getAttribute('data-ps-video'));
        const u=candidate?new URL(candidate):null;
        if(!u||u.hostname!=='www.youtube-nocookie.com'||!/^\/embed\/[A-Za-z0-9_-]{11}$/.test(u.pathname))return document.createDocumentFragment();
        const box=el('div',{class:'ps-rich-video'}),frame=el('iframe');
        frame.src=`https://www.youtube-nocookie.com${u.pathname}`;frame.title='文章中的 YouTube 影片';
        frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
        frame.allow='accelerometer; encrypted-media; gyroscope; picture-in-picture';frame.allowFullscreen=true;
        box.append(frame);return box;
      }
      if(!allow.has(tag)){
        const frag=document.createDocumentFragment();
        for(const child of node.childNodes)frag.append(build(child));
        return frag;
      }
      const out=el(tag);const style=styleValue(node.getAttribute('style'));
      if(style)out.setAttribute('style',style);
      if(tag==='a'){
        const href=url(node.getAttribute('href'));
        if(href){out.href=href;out.target='_blank';out.rel='noopener noreferrer';}
      }else if(tag==='img'){
        const src=url(node.getAttribute('src'));
        if(!src)return document.createDocumentFragment();
        out.src=src;out.alt=String(node.getAttribute('alt')||'文章圖片').slice(0,180);out.loading='lazy';out.decoding='async';
        return out;
      }
      for(const child of node.childNodes)out.append(build(child));
      return out;
    }
    for(const child of parsed.body.childNodes)root.append(build(child));
    return root;
  }
  function articleStyle(){
    if(document.getElementById('ps-article-rich-style'))return;
    const style=document.createElement('style');style.id='ps-article-rich-style';
    style.textContent=`
    .ps-article-richtext{font-size:15px;line-height:1.9;color:#423b33;max-width:100%;overflow-wrap:anywhere}
    .ps-article-richtext p{white-space:pre-wrap;margin:.8em 0}
    .ps-article-richtext h2,.ps-article-richtext h3,.ps-article-richtext h4{color:#795439;line-height:1.5;margin:1.3em 0 .5em}
    .ps-article-richtext blockquote{margin:1.2em 0;background:#fbf3e9;border-left:4px solid #c6a78b;padding:12px 16px}
    .ps-article-richtext a{color:#356d9c;text-decoration:underline;overflow-wrap:anywhere}
    .ps-article-richtext img{display:block;max-width:100%;height:auto;margin:18px auto;border-radius:10px}
    .ps-article-richtext figure{margin:16px auto;max-width:100%}
    .ps-article-richtext figcaption{font-size:12px;color:#897568;text-align:center}
    .ps-article-richtext ul,.ps-article-richtext ol{padding-left:1.6em}
    .ps-article-richtext .ps-rich-video{max-width:100%;width:100%;aspect-ratio:16/9;margin:18px auto}
    .ps-article-richtext iframe{width:100%;height:100%;border:0;border-radius:10px}
    .ps-article-richtext hr{border:0;border-top:1px solid #e1d4c8;margin:24px 0}
    .ps-article-richtext mark{background:#fff0a7}
    `;
    document.head.append(style);
  }
  const modeText = mode => mode==='stock'?'現貨商品':mode==='sold_out'?'暫無現貨':'推薦預購';
  const actionText = mode => mode==='stock'?'前往賣場':mode==='sold_out'?'詢問補貨':'詢問預購';
  function el(tag, attrs={}, text) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>{
      if(k==='class') node.className=v;
      else if(k==='title') node.title=v;
      else if(k==='type') node.type=v;
      else if(k==='id') node.id=v;
      else if(k==='aria-label') node.setAttribute(k,v);
    });
    if (text!==undefined && text!==null) node.textContent=String(text);
    return node;
  }
  function safeUrl(v) {
    if(!v || typeof v!=='string') return '';
    try {
      // PocketBase 的 /api/files/... 必須連回 NAS，不可誤指向 GitHub Pages 網域。
      const base = v.startsWith('/api/files/') && opts.publicFeedUrl ? opts.publicFeedUrl : location.href;
      const u=new URL(v, base);
      return ['http:','https:'].includes(u.protocol) ? u.href : '';
    } catch (_) {return '';}
  }
  function money(v) {const x=Number(v);return Number.isFinite(x)&&x>=0 ? 'NT$'+Math.round(x).toLocaleString('zh-TW') : '私訊詢價';}
  function fallback(label,icon) {
    const b=el('div',{class:'ps-card-fallback'});
    b.append(el('span',{class:'ps-fallback-icon'},icon||'✿'),el('span',{class:'ps-fallback-label'},label||'PS SELECTED'));
    return b;
  }
  function media(src,article,title,icon){
    const box=el('div',{class:'ps-card-media'+(article?' ps-card-media--journal':'')});
    const url=safeUrl(src);
    if(url){const img=el('img');img.loading='lazy';img.decoding='async';img.alt=title||'';img.src=url;img.addEventListener('error',()=>{box.replaceChildren(fallback('PS SELECTED',icon));},{once:true});box.append(img);}
    else box.append(fallback(article?'PS JOURNAL':'PS SELECTED',icon));
    return box;
  }
  function openDialog(item,isArticle){
    const dlg=byId('ps-content-dialog'); const root=byId('ps-dialog-body');
    if(!dlg||!root) return;
    root.replaceChildren();
    const cover=el('div',{class:'ps-dialog-cover'+(isArticle?'':' ps-dialog-cover--product')});
    const image=media(item.cover_url,isArticle,item.title,item.icon);
    cover.append(...image.childNodes);
    const wrap=el('div',{class:'ps-dialog-content'});
    wrap.append(el('p',{class:'ps-dialog-meta'},[item.category,isArticle?'文章分享':modeText(item.sale_mode)].filter(Boolean).join(' · ')),el('h2',{id:'ps-dialog-heading'},item.title));
    const body=String(isArticle?(item.content_text||item.summary||''):(item.description||item.summary||''));
    if(isArticle && item.content_html) wrap.append(safeArticleDocument(item.content_html));
    else if(body) wrap.append(el('p',{},body));
    if(!isArticle && Array.isArray(item.gallery_urls) && item.gallery_urls.length){
      const gallery=el('div',{class:'ps-dialog-gallery'});
      for(const raw of item.gallery_urls.slice(0,9)){const u=safeUrl(raw);if(!u)continue;
        const photo=el('img');photo.src=u;photo.alt=(item.title||'商品')+' 詳細介紹圖片';photo.loading='lazy';gallery.append(photo);}
      if(gallery.childNodes.length)wrap.append(gallery);
    }
    if(!isArticle){const link=safeUrl(item.shop_url)||LINE_URL;const button=el('a',{class:'ps-dialog-shop'},item.sale_mode==='stock'?'前往購買／詢問':actionText(item.sale_mode));button.href=link;button.target='_blank';button.rel='noopener noreferrer';wrap.append(button);}
    root.append(cover,wrap);
    if(typeof dlg.showModal==='function') dlg.showModal();else dlg.setAttribute('open','');
  }
  function renderProducts(){
    const grid=byId('ps-product-grid');const empty=byId('ps-product-empty');
    if(!grid||!empty) return;
    grid.replaceChildren();
    const items=state.products.filter(p=>(state.filter==='all'||p.sale_mode===state.filter));
    empty.hidden=items.length>0;
    for(const p of items){
      const card=el('article',{class:'ps-product-card'});
      const picture=media(p.cover_url,false,p.title,p.icon);
      const badge=el('span',{class:'ps-card-badge'+(p.sale_mode!=='stock'?' ps-card-badge--preorder':'')},modeText(p.sale_mode));
      picture.append(badge);
      const body=el('div',{class:'ps-card-content'});
      const category=el('p',{class:'ps-card-category'},p.category||'PS SELECTED');
      const titleBtn=el('button',{class:'ps-card-title',type:'button',title:'查看商品詳情'},p.title||'未命名商品');
      titleBtn.style.textAlign='left';titleBtn.addEventListener('click',()=>openDialog(p,false));
      const summary=el('p',{class:'ps-card-description'},p.summary||'點選查看商品與詢問方式。');
      const bottom=el('div',{class:'ps-card-bottom'});
      const price=el('span',{class:'ps-card-price'},p.price_twd===null||p.price_twd===undefined?'價格請洽詢':money(p.price_twd));
      const link=el('a',{class:'ps-card-action'},actionText(p.sale_mode));
      link.href=safeUrl(p.shop_url)||LINE_URL;link.target='_blank';link.rel='noopener noreferrer';
      const icon=el('i',{class:'fa-solid fa-arrow-up-right-from-square'});icon.setAttribute('aria-hidden','true');link.append(icon);
      bottom.append(price,link);body.append(category,titleBtn,summary,bottom);card.append(picture,body);grid.append(card);
    }
  }
  function renderArticles(){
    const grid=byId('ps-article-grid');const empty=byId('ps-article-empty');
    if(!grid||!empty)return;
    grid.replaceChildren();empty.hidden=state.articles.length>0;
    for(const a of state.articles){
      const card=el('article',{class:'ps-article-card'});
      const picture=media(a.cover_url,true,a.title,a.icon);
      const body=el('div',{class:'ps-card-content'});
      const category=el('p',{class:'ps-card-category'},a.category||'PS JOURNAL');
      const title=el('button',{class:'ps-card-title',type:'button'},a.title||'未命名文章');
      title.style.textAlign='left';title.addEventListener('click',()=>openDialog(a,true));
      const summary=el('p',{class:'ps-card-description'},a.summary||'點擊閱讀這篇分享。');
      const bottom=el('div',{class:'ps-card-bottom'});
      bottom.append(el('span',{class:'ps-card-price'},a.published_at||'日和分享'));
      const more=el('button',{class:'ps-card-action',type:'button'},'閱讀文章');more.addEventListener('click',()=>openDialog(a,true));
      bottom.append(more);body.append(category,title,summary,bottom);card.append(picture,body);grid.append(card);
    }
  }
  function setup(){
    articleStyle();
    byId('ps-dialog-close')?.addEventListener('click',()=>byId('ps-content-dialog')?.close());
    byId('ps-content-dialog')?.addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.close();});
    document.querySelectorAll('[data-product-filter]').forEach(b=>b.addEventListener('click',()=>{
      state.filter=b.dataset.productFilter||'all';
      document.querySelectorAll('[data-product-filter]').forEach(x=>{const chosen=x===b;x.classList.toggle('is-active',chosen);x.setAttribute('aria-pressed',String(chosen));});
      renderProducts();
    }));
  }
  function normalizeProduct(p){
    if(!p || typeof p !== 'object')return null;
    const mode=String(p.sale_mode||'').toLowerCase();
    if(p.published!==true || !SAFE_CATEGORIES.has(mode)||!p.title)return null;
    return {id:String(p.id||''),title:String(p.title),category:categoryLabel(p.category),sku:String(p.sku||''),sale_mode:mode,summary:readableText(p.summary||'').slice(0,125),description:readableText(p.description||''),price_twd:p.price_twd===null||p.price_twd===undefined?null:Number(p.price_twd),cover_url:safeUrl(p.cover_url),shop_url:safeUrl(p.shop_url),gallery_urls:Array.isArray(p.gallery_urls)?p.gallery_urls.map(safeUrl).filter(Boolean):[],published:true};
  }
  function normalizeArticle(a){
    if(!a||a.published!==true||!a.title)return null;
    return {id:String(a.id||''),title:String(a.title),category:categoryLabel(a.category),summary:readableText(a.summary||''),content_text:readableText(a.content_text||''),content_html:String(a.content_html||''),cover_url:safeUrl(a.cover_url),published_at:String(a.published_at||'').slice(0,10),published:true};
  }
  async function load(){
    const feedUrl=safeUrl(opts.publicFeedUrl);
    if(opts.previewMode){
      state.products=DEMO_PRODUCTS;state.articles=DEMO_ARTICLES;
      byId('ps-product-feedback').textContent='＊版型預覽：示例商品不代表實際上架';
      byId('ps-article-feedback').textContent='＊版型預覽：示例文章不代表已發布';
    }else if(feedUrl){
      try{
        const response=await fetch(feedUrl,{method:'GET',credentials:'omit',cache:'no-store',headers:{'Accept':'application/json'}});
        if(!response.ok)throw new Error('HTTP '+response.status);
        const data=await response.json();
        state.products=(Array.isArray(data.products)?data.products:[]).map(normalizeProduct).filter(Boolean);
        state.articles=(Array.isArray(data.articles)?data.articles:[]).map(normalizeArticle).filter(Boolean);
      }catch(error){
        byId('ps-product-feedback').textContent='商品資料暫時無法讀取，歡迎透過 LINE 詢問。';
        byId('ps-article-feedback').textContent='文章資料暫時無法讀取。';
        console.warn('PS 公開內容連線失敗：',error);
      }
    }
    else {
      byId('ps-product-feedback').textContent='商品展示串接準備中，歡迎先透過 LINE 詢問。';
      byId('ps-article-feedback').textContent='文章專區整理中。';
    }
    renderProducts();renderArticles();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{setup();load();},{once:true});
  else{setup();load();}
})();
