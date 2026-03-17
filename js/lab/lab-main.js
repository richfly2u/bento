// ==========================================
// 1. 彈跳視窗與提示 UI (Modals & Toasts)
// ==========================================
function showModal({title,desc,type='alert',inputVal='',onOk,onCancel,okText='確定',cancelText='取消',isDanger=false}){
  const modal=document.getElementById('custom-modal');
  const tEl=document.getElementById('m-title'),dEl=document.getElementById('m-desc'),iEl=document.getElementById('m-input');
  const bCancel=document.getElementById('m-cancel'),bOk=document.getElementById('m-ok');
  tEl.textContent=title;
  tEl.style.color=isDanger?'var(--red)':(title.includes('🎉')||title.includes('✅')?'var(--primary)':'var(--gold)');
  dEl.innerHTML=desc;
  if(type==='prompt'){iEl.style.display='block';iEl.value=inputVal;setTimeout(()=>iEl.focus(),200);}
  else{iEl.style.display='none';}
  if(type==='alert'){bCancel.style.display='none';}
  else{bCancel.style.display='block';bCancel.textContent=cancelText;}
  bOk.textContent=okText;bOk.className=isDanger?'btn btn-danger':'btn btn-primary-grad';
  modal.classList.add('show');
  bOk.onclick=()=>{modal.classList.remove('show');if(onOk)onOk(type==='prompt'?iEl.value:null);};
  bCancel.onclick=()=>{modal.classList.remove('show');if(onCancel)onCancel();};
}
function customAlert(desc,title='💡 系統提示'){showModal({title,desc,type:'alert'});}
function customConfirm(title,desc,onOk,onCancel){showModal({title,desc,type:'confirm',onOk,onCancel,okText:'確定放棄',cancelText:'取消保留',isDanger:true});}
function customPrompt(title,desc,defaultVal,onOk){showModal({title,desc,type:'prompt',inputVal:defaultVal,onOk});}
window.alert=function(msg){
  if(String(msg).includes('✅'))customAlert(String(msg).replace(/\n/g,'<br>'),'🎉 成功');
  else if(String(msg).includes('⚠️')||String(msg).includes('❌'))customAlert(String(msg).replace(/\n/g,'<br>'),'⚠️ 注意');
  else customAlert(String(msg).replace(/\n/g,'<br>'));
};

let toastTimer;
function showToast(msg){const el=document.getElementById('copy-toast');el.innerHTML=String(msg).replace(/\n/g,'<br>');el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3000);}

// ==========================================
// 2. 資料庫與分類系統 (IndexedDB & Categories)
// ==========================================
const DB_NAME='ChefBentoCloudDB',STORE='dishes',DB_VER=5;
let db;
const dbReq=indexedDB.open(DB_NAME,DB_VER);
dbReq.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains(STORE)){const s=d.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});s.createIndex('category','category',{unique:false});}};
dbReq.onsuccess=e=>{db=e.target.result;};

const DEF_CATS=[{val:'待分類',icon:'💡'},{val:'主食類',icon:'🍚'},{val:'鮮蔬類',icon:'🥬'},{val:'菇果類',icon:'🍄'},{val:'豆製品',icon:'🍢'},{val:'烤煎類',icon:'🔥'},{val:'酥炸類',icon:'🍤'},{val:'點心類',icon:'🥟'}];
function getCats(){let s=localStorage.getItem('bento_cats');return(s?JSON.parse(s):DEF_CATS).filter(c=>c.val!=='全部');}
function renderCats(sel='待分類'){
  const el=document.getElementById('catSel');el.innerHTML='';
  getCats().forEach(c=>{const o=document.createElement('option');o.value=c.val;o.textContent=`${c.icon} 放入：${c.val}`;el.appendChild(o);});
  if(getCats().some(c=>c.val===sel))el.value=sel;
}
window.addCategory = function(){
  customPrompt('➕ 新增分類','請輸入新分類名稱<br>（例：海鮮類）','',(name)=>{
    if(!name||!name.trim())return;
    let cats=getCats();
    if(cats.find(c=>c.val===name.trim())){alert('⚠️ 分類已存在！');return;}
    customPrompt('🎨 設定圖示','請輸入代表 Emoji<br>（例：🦐）','🍱',(icon)=>{
      let orig=JSON.parse(localStorage.getItem('bento_cats')||JSON.stringify(DEF_CATS));
      orig.push({val:name.trim(),icon:(icon||'🍱').trim()});
      localStorage.setItem('bento_cats',JSON.stringify(orig));
      renderCats(name.trim());showToast(`✅ 已新增分類：${name.trim()}`);
    });
  });
};
renderCats();

// ==========================================
// 3. 全局狀態與畫布綁定 (State & Canvas)
// ==========================================
let mode='manual',tool='magic';
const mainC=document.getElementById('mainC'),overC=document.getElementById('overlayC');
const mCtx=mainC.getContext('2d',{willReadFrequently:true}),oCtx=overC.getContext('2d');
const magEl=document.getElementById('mag'),magCEl=document.getElementById('magC');
const magCtx=magCEl.getContext('2d');magCEl.width=100;magCEl.height=100;
const brushCursor=document.getElementById('brush-cursor');

let srcImg=new Image(),mask=null,selHist=[],isDrawing=false,touchMoved=false,downPos=null;
let polyPts=[],freePts=[],rectStart=null,rectCur=null,lastBrush=null,polyPreviewPos=null;
let floatingRect=null,rectAction=null,dragOffset={x:0,y:0},fixedCorner=null;
let bgH=300,bgR=0,bgG=0,bgB=0;
let lastTouchTime=0; 
let marchOffset = 0;
let marchTimer = null;

// ==========================================
// 4. 動畫與模式切換 (Animations & Modes)
// ==========================================
function startMarchTimer() {
  if (marchTimer) return;
  marchTimer = setInterval(() => {
    marchOffset = (marchOffset + 1.5) % 24;
    if (mode === 'manual' && mask) {
      const hasSel = mask.includes(1) || floatingRect || (tool==='poly' && (polyPts.length>0 || polyPreviewPos)) || (tool==='free'&&freePts.length>0);
      if (hasSel) drawOverlay();
    }
  }, 60);
}

function stopMarchTimer() {
  if (marchTimer) { clearInterval(marchTimer); marchTimer = null; }
}

function resetCanvas(){
  srcImg=new Image();mask=null;selHist=[];polyPts=[];freePts=[];
  rectStart=null;rectCur=null;floatingRect=null;rectAction=null;fixedCorner=null;isDrawing=false;
  polyPreviewPos=null;
  bgH=300;bgR=0;bgG=0;bgB=0;
  stopMarchTimer();
  mCtx.clearRect(0,0,mainC.width,mainC.height);oCtx.clearRect(0,0,overC.width,overC.height);
  mainC.width=0;mainC.height=0;overC.width=0;overC.height=0;
  document.querySelectorAll('input[type="file"]').forEach(el=>el.value='');
  document.getElementById('fname').textContent='目前尚未選擇任何圖片...';
  document.getElementById('bgDot').style.background='#333';
  document.getElementById('bgName').textContent='未知';
  document.getElementById('result-grid').innerHTML='';
  document.getElementById('gallery').classList.add('hidden');
  updateCount();
}

window.switchMode = function(m,btn){
  const prev=mode;if(prev===m)return;
  const hasActiveSelection=(prev==='manual'&&mask&&mask.includes(1));
  const hasUnsavedResults=document.querySelectorAll('.ing-item').length>0;
  if((m==='manual'||m==='batch')&&(prev==='manual'||prev==='batch')&&(hasActiveSelection||hasUnsavedResults)){
    customConfirm('⚠️ 確定放棄目前的進度嗎？','切換模式將會清空畫布與圖庫，<br>尚未儲存或匯入的食材將會遺失。',()=>{resetCanvas();executeModeSwitch(m,btn,prev);});return;
  }
  resetCanvas();executeModeSwitch(m,btn,prev);
};

function executeModeSwitch(m,btn,prev){
  mode=m;document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  document.getElementById('sec-manual').classList.toggle('hidden',m!=='manual');
  document.getElementById('sec-batch').classList.toggle('hidden',m!=='batch');
  document.getElementById('sec-prompt').classList.toggle('hidden',m!=='prompt');
  const actionBar=document.querySelector('.action-bar');
  if(actionBar){if(m==='prompt'||document.querySelectorAll('.ing-item.selected').length===0)actionBar.classList.add('hidden');else actionBar.classList.remove('hidden');}
  document.getElementById('prompt-panel').classList.toggle('hidden',m!=='prompt');
  document.getElementById('upload-wrapper').classList.toggle('hidden',m==='prompt');
  document.getElementById('fname').classList.toggle('hidden',m==='prompt');
  document.getElementById('viewport').classList.toggle('hidden',m==='prompt');
  if(m==='prompt')oCtx.clearRect(0,0,overC.width,overC.height);
  else if(prev==='prompt'&&srcImg&&srcImg.width>0)m==='manual'?drawOverlay():drawBatchGrid();
}

// ==========================================
// 5. 影像處理與去背演算法 (Algorithms)
// ==========================================
function rgbToHsv(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0,s=mx?d/mx:0,v=mx;if(d){if(mx===r)h=((g-b)/d+(g<b?6:0))/6;else if(mx===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}return[h*360,s,v];}
function detectBg(imgEl){
  const tmp=document.createElement('canvas');tmp.width=imgEl.width;tmp.height=imgEl.height;const tc=tmp.getContext('2d');tc.drawImage(imgEl,0,0);
  const W=imgEl.width,H=imgEl.height,rad=Math.max(1,Math.round(Math.min(W,H)*.03));
  const pts=[[0,0],[rad,0],[0,rad],[rad,rad],[W-1,0],[W-1-rad,0],[W-1,rad],[W-1-rad,rad],[0,H-1],[rad,H-1],[0,H-1-rad],[rad,H-1-rad],[W-1,H-1],[W-1-rad,H-1],[W-1,H-1-rad],[W-1-rad,H-1-rad],[Math.round(W/2),0],[Math.round(W/2),rad],[Math.round(W/2),H-1],[Math.round(W/2),H-1-rad],[0,Math.round(H/2)],[rad,Math.round(H/2)],[W-1,Math.round(H/2)],[W-1-rad,Math.round(H/2)]];
  let sR=0,sG=0,sB=0,samples=[];
  for(const[x,y]of pts){const px=tc.getImageData(Math.max(0,Math.min(W-1,x)),Math.max(0,Math.min(H-1,y)),1,1).data;sR+=px[0];sG+=px[1];sB+=px[2];samples.push(rgbToHsv(px[0],px[1],px[2]));}
  bgR=Math.round(sR/pts.length);bgG=Math.round(sG/pts.length);bgB=Math.round(sB/pts.length);
  const vivid=samples.filter(([h,s,v])=>s>.3&&v>.2);
  if(vivid.length<3)return{h:120,name:'綠幕',css:'#00cc44'};
  const sinS=vivid.reduce((a,[h])=>a+Math.sin(h*Math.PI/180),0),cosS=vivid.reduce((a,[h])=>a+Math.cos(h*Math.PI/180),0);
  const aH=(Math.atan2(sinS,cosS)*180/Math.PI+360)%360;
  let name,css;
  if(aH>=90&&aH<=150){name='綠幕';css='#00e050';}else if(aH>=280&&aH<=340){name='洋紅幕';css='#ff00cc';}else if(aH<=30||aH>=340){name='紅幕';css='#ff2020';}else if(aH>30&&aH<90){name='黃幕';css='#ddcc00';}else if(aH>=190&&aH<=260){name='藍幕';css='#0055ff';}else if(aH>=150&&aH<=200){name='青幕';css='#00cccc';}else if(aH>240&&aH<280){name='紫幕';css='#9900ff';}else{name=`自訂(${Math.round(aH)}°)`;css=`hsl(${Math.round(aH)},80%,50%)`;}
  return{h:aH,name,css};
}

window.onFileSelect = function(e){
  const f=e.target.files[0];if(!f)return;
  document.getElementById('fname').textContent=f.name;
  const rdr=new FileReader();
  rdr.onload=ev=>{
    srcImg=new Image();
    srcImg.onload=()=>{
      const info=detectBg(srcImg);bgH=info.h;document.getElementById('bgDot').style.background=info.css;document.getElementById('bgName').textContent=info.name;
      const vp=document.getElementById('viewport');
      const vpRect=vp.getBoundingClientRect();
      const hdrH=(document.querySelector('header')||{offsetHeight:48}).offsetHeight||48;
      const vpW=Math.max(100, vpRect.width>10 ? vpRect.width-10 : (window.innerWidth-380));
      const vpH=Math.max(200, vpRect.height>10 ? vpRect.height-10 : (window.innerHeight-hdrH-120));
      const sc=Math.min(vpW/srcImg.width,vpH/srcImg.height,1);
      mainC.width=overC.width=Math.round(srcImg.width*sc);mainC.height=overC.height=Math.round(srcImg.height*sc);
      mCtx.clearRect(0,0,mainC.width,mainC.height);mCtx.drawImage(srcImg,0,0,mainC.width,mainC.height);
      mask=new Uint8Array(mainC.width*mainC.height);selHist=[];polyPts=[];freePts=[];
      rectStart=null;rectCur=null;floatingRect=null;rectAction=null;fixedCorner=null;isDrawing=false;
      polyPreviewPos=null;
      mode==='manual'?drawOverlay():drawBatchGrid();
      startMarchTimer();
    };srcImg.src=ev.target.result;
  };rdr.readAsDataURL(f);
};

function boxBlurAlpha(src,w,h,r){
  if(r<=0)return src;
  const dst=new Float32Array(w*h),tmp=new Float32Array(w*h),len=2*r+1;
  for(let y=0;y<h;y++){let acc=0;for(let x=0;x<Math.min(len,w);x++)acc+=src[y*w+x];for(let x=0;x<w;x++){tmp[y*w+x]=acc/Math.min(len,w);const xl=x-r,xr=x+r+1;if(xl>=0)acc-=src[y*w+xl];if(xr<w)acc+=src[y*w+xr];}}
  for(let x=0;x<w;x++){let acc=0;for(let y=0;y<Math.min(len,h);y++)acc+=tmp[y*w+x];for(let y=0;y<h;y++){dst[y*w+x]=acc/Math.min(len,h);const yl=y-r,yr=y+r+1;if(yl>=0)acc-=tmp[yl*w+x];if(yr<h)acc+=tmp[yr*w+x];}}
  return dst;
}
function featherAlpha(a,w,h,s){if(s<=0)return a;const r=Math.round(s);let v=new Float32Array(a);v=boxBlurAlpha(v,w,h,r);v=boxBlurAlpha(v,w,h,r);v=boxBlurAlpha(v,w,h,r);return v;}

function removeBackground(ctx,w,h,tH){
  const id=ctx.getImageData(0,0,w,h),px=id.data,N=w*h;
  const isMag=(tH>=270&&tH<=360)||tH<=25;const bgRn=bgR/255,bgGn=bgG/255,bgBn=bgB/255;const alpha=new Float32Array(N);
  for(let i=0;i<N;i++){
    const pi=i*4,r=px[pi],g=px[pi+1],b=px[pi+2];const maxC=Math.max(r,g,b),minC=Math.min(r,g,b);const v=maxC/255,s=maxC>0?(maxC-minC)/maxC:0;alpha[i]=1;
    if(v<0.18||s<0.10)continue;
    if(isMag){
      if(g>r*1.25&&g>b*1.25&&g>55){alpha[i]=1;continue;}
      const score=((Math.min(r,b)-g)/200)*(0.6+(s*v)*0.4),HARD=0.35,SOFT=0.10;
      if(score>=HARD){alpha[i]=0;}else if(score>=SOFT){const t=(score-SOFT)/(HARD-SOFT);alpha[i]=1-(t*t*(3-2*t));}
    }else{
      const[hue,,]=rgbToHsv(r,g,b);let hd=Math.abs(hue-tH);if(hd>180)hd=360-hd;const HR=42,FT=24;
      if(hd<HR){if(hd<HR-FT){alpha[i]=0;}else{const t=(hd-(HR-FT))/FT;alpha[i]=t*t*(3-2*t);}}
    }
  }
  const eroded=new Float32Array(alpha);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(alpha[i]>0){const mn=Math.min(alpha[i-1],alpha[i+1],alpha[i-w],alpha[i+w]);if(mn<0.25)eroded[i]*=0.4;}}
  const soft=featherAlpha(eroded,w,h,1.2),ZONE=4,edgeDist=new Float32Array(N).fill(ZONE+1),bfsQ=new Int32Array(N);let qh=0,qt=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(soft[i]<0.05){edgeDist[i]=0;continue;}for(const n of[i-1,i+1,i-w,i+w]){if(n>=0&&n<N&&soft[n]<0.05){edgeDist[i]=1;bfsQ[qt++]=i;break;}}}
  while(qh<qt){const i=bfsQ[qh++],d=edgeDist[i];if(d>=ZONE)continue;const x=i%w,y=Math.floor(i/w);for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;const ni=ny*w+nx;if(soft[ni]>0.05&&edgeDist[ni]>d+1){edgeDist[ni]=d+1;bfsQ[qt++]=ni;}}}
  for(let i=0;i<N;i++){
    const a=soft[i],pi=i*4;if(a<0.005){px[pi+3]=0;continue;}
    let r=px[pi]/255,g=px[pi+1]/255,b=px[pi+2]/255;const d=edgeDist[i],inZone=d<=ZONE;let effA=a;
    if(a>0.95&&inZone){const bleed=Math.max(0,1-(d-1)/ZONE)*0.35;effA=1-bleed;}
    if(effA<0.98&&effA>0.01){const inv=1/effA;r=Math.max(0,Math.min(1,(r-bgRn*(1-effA))*inv));g=Math.max(0,Math.min(1,(g-bgGn*(1-effA))*inv));b=Math.max(0,Math.min(1,(b-bgBn*(1-effA))*inv));}
    if(inZone){
      const sp=Math.max(0,1-(d-.5)/(ZONE+1));
      if(isMag&&sp>0){
        const refR=bgRn>0.05?g*(bgRn/Math.max(bgGn,.05)):g;const refB=bgBn>0.05?g*(bgBn/Math.max(bgGn,.05)):g;
        r=Math.max(0,r-Math.max(0,r-refR)*sp*0.78);b=Math.max(0,b-Math.max(0,b-refB)*sp*0.78);
        if(a>0.9&&d<=3){const es=(1-d/4)*0.28;r=Math.max(0,r-Math.max(0,r-g*1.05)*es);b=Math.max(0,b-Math.max(0,b-g*1.05)*es);}
      }else if(!isMag&&sp>0&&bgGn>0.4){const refG=Math.max(r,b)*(bgGn/Math.max(Math.max(bgRn,bgBn),.05));g=Math.max(0,g-Math.max(0,g-refG)*sp*.7);}
    }
    px[pi]=Math.round(Math.max(0,Math.min(1,r))*255);px[pi+1]=Math.round(Math.max(0,Math.min(1,g))*255);px[pi+2]=Math.round(Math.max(0,Math.min(1,b))*255);px[pi+3]=Math.round(a*255);
  }
  ctx.putImageData(id,0,0);
}

function autoCenter(canvas){
  const ctx=canvas.getContext('2d'),{width,height}=canvas,imgData=ctx.getImageData(0,0,width,height),data=imgData.data;
  let minX=width,minY=height,maxX=0,maxY=0,found=false;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){if(data[(y*width+x)*4+3]>10){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;found=true;}}
  if(!found)return canvas.toDataURL('image/webp',0.92);
  const sw=maxX-minX+1,sh=maxY-minY+1,size=Math.max(sw,sh)+40;
  const tempC=document.createElement('canvas');tempC.width=tempC.height=size;
  const tCtx=tempC.getContext('2d');tCtx.imageSmoothingEnabled=true;tCtx.imageSmoothingQuality='high';
  tCtx.drawImage(canvas,minX,minY,sw,sh,Math.floor((size-sw)/2),Math.floor((size-sh)/2),sw,sh);
  return tempC.toDataURL('image/webp',0.92);
}

// ==========================================
// 6. 批次處理與手動工具核心 (Batch & Tools)
// ==========================================
window.doBatchSlice = function(){
  if(!srcImg.width){alert('請先上傳圖片');return;}
  const cols=parseInt(document.getElementById('grid-c').value)||8,rows=parseInt(document.getElementById('grid-r').value)||5;
  const pl=parseFloat(document.getElementById('grid-pl').value||0)/100;
  const pr=parseFloat(document.getElementById('grid-pr').value||0)/100;
  const pt=parseFloat(document.getElementById('grid-pt').value||0)/100;
  const pb=parseFloat(document.getElementById('grid-pb').value||0)/100;
  const gap=parseFloat(document.getElementById('grid-gap').value||2); 

  const w=srcImg.width, h=srcImg.height;
  const startX=w*pl, startY=h*pt;
  const effW=w - startX - (w*pr);
  const effH=h - startY - (h*pb);
  const unitW=effW/cols, unitH=effH/rows;

  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const sx=Math.floor(startX+c*unitW+gap);
    const sy=Math.floor(startY+r*unitH+gap);
    const sw=Math.floor(unitW-gap*2);
    const sh=Math.floor(unitH-gap*2);
    if(sw<=0||sh<=0)continue;
    const tc=document.createElement('canvas');tc.width=sw;tc.height=sh;
    const tCtx=tc.getContext('2d',{willReadFrequently:true});tCtx.imageSmoothingEnabled=true;tCtx.imageSmoothingQuality='high';
    tCtx.drawImage(srcImg,sx,sy,sw,sh,0,0,sw,sh);
    removeBackground(tCtx,sw,sh,bgH);addResult(autoCenter(tc));
  }
  scrollBottom();showToast(`✅ 成功精準切割並置中 ${cols*rows} 項食材`);
};

window.drawBatchGrid = function(){
  if(mode!=='batch'||!srcImg.width)return;
  const c=parseInt(document.getElementById('grid-c').value)||8,r=parseInt(document.getElementById('grid-r').value)||5;
  const pl=parseFloat(document.getElementById('grid-pl').value||0)/100;
  const pr=parseFloat(document.getElementById('grid-pr').value||0)/100;
  const pt=parseFloat(document.getElementById('grid-pt').value||0)/100;
  const pb=parseFloat(document.getElementById('grid-pb').value||0)/100;

  oCtx.clearRect(0,0,overC.width,overC.height);oCtx.strokeStyle='rgba(79,142,247,.9)';oCtx.lineWidth=1.5;

  const w=overC.width, h=overC.height;
  const startX=w*pl, startY=h*pt;
  const effW=w - startX - (w*pr); 
  const effH=h - startY - (h*pb); 
  const cw=effW/c, ch=effH/r;

  oCtx.setLineDash([5,5]);oCtx.strokeRect(startX,startY,effW,effH);oCtx.setLineDash([]);
  for(let i=1;i<c;i++){oCtx.beginPath();oCtx.moveTo(startX+i*cw,startY);oCtx.lineTo(startX+i*cw,startY+effH);oCtx.stroke();}
  for(let j=1;j<r;j++){oCtx.beginPath();oCtx.moveTo(startX,startY+j*ch);oCtx.lineTo(startX+effW,startY+j*ch);oCtx.stroke();}
};

function srgbToLinear(c){c/=255;return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);}
function rgbToLab(r,g,b){let R=srgbToLinear(r),G=srgbToLinear(g),B=srgbToLinear(b);let X=(R*.4124564+G*.3575761+B*.1804375)/.95047,Y=(R*.2126729+G*.7151522+B*.0721750)/1,Z=(R*.0193339+G*.1191920+B*.9503041)/1.08883;const f=t=>t>.008856?Math.pow(t,1/3):7.787*t+16/116;const fx=f(X),fy=f(Y),fz=f(Z);return[116*fy-16,500*(fx-fy),200*(fy-fz)];}
function labDist(r1,g1,b1,r2,g2,b2){const[L1,a1,b1_]=rgbToLab(r1,g1,b1),[L2,a2,b2_]=rgbToLab(r2,g2,b2);return Math.sqrt((L1-L2)**2+(a1-a2)**2+(b1_-b2_)**2);}
function erodeMask(m,w,h,r){if(r<=0)return m;const out=new Uint8Array(m);for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(!m[y*w+x])continue;let kill=false;outer:for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(dx*dx+dy*dy>r*r)continue;const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h||!m[ny*w+nx]){kill=true;break outer;}}if(kill)out[y*w+x]=0;}return out;}
function gaussBlur(alpha,w,h,sigma){if(sigma<=0)return alpha;const kS=Math.ceil(sigma*3)*2+1,half=Math.floor(kS/2),kernel=[];let sum=0;for(let i=0;i<kS;i++){const v=Math.exp(-((i-half)**2)/(2*sigma*sigma));kernel.push(v);sum+=v;}const k=kernel.map(v=>v/sum),tmp=new Float32Array(w*h),out=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){let a=0;for(let i=0;i<kS;i++){const xi=x+i-half;if(xi>=0&&xi<w)a+=alpha[y*w+xi]*k[i];}tmp[y*w+x]=a;}for(let y=0;y<h;y++)for(let x=0;x<w;x++){let a=0;for(let i=0;i<kS;i++){const yi=y+i-half;if(yi>=0&&yi<h)a+=tmp[yi*w+x]*k[i];}out[y*w+x]=a;}return out;}
function despillManual(pixels,rawMask,w,h){const out=new Uint8ClampedArray(pixels),N=w*h,ZONE=6;const bgRn=bgR/255,bgGn=bgG/255,bgBn=bgB/255;const isMag=(bgH>=270&&bgH<=360)||bgH<=25;const dist=new Float32Array(N).fill(ZONE+1);const Q=new Int32Array(N);let qh=0,qt=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!rawMask[i]){dist[i]=0;continue;}for(const n of[i-1,i+1,i-w,i+w]){if(n>=0&&n<N&&!rawMask[n]){dist[i]=1;Q[qt++]=i;break;}}}while(qh<qt){const i=Q[qh++],d=dist[i];if(d>=ZONE)continue;const x=i%w,y=Math.floor(i/w);for(const[dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;const ni=ny*w+nx;if(rawMask[ni]&&dist[ni]>d+1){dist[ni]=d+1;Q[qt++]=ni;}}}for(let i=0;i<N;i++){if(!rawMask[i]||dist[i]>ZONE)continue;const pi=i*4,d=dist[i];let r=pixels[pi]/255,g=pixels[pi+1]/255,b=pixels[pi+2]/255;const sp=Math.max(0,1-(d-.5)/(ZONE+1));if(isMag){const rR=bgRn>0.05?g*(bgRn/Math.max(bgGn,.05)):g;const rB=bgBn>0.05?g*(bgBn/Math.max(bgGn,.05)):g;r=Math.max(0,r-Math.max(0,r-rR)*sp*.78);b=Math.max(0,b-Math.max(0,b-rB)*sp*.78);}out[pi]=Math.round(Math.max(0,Math.min(1,r))*255);out[pi+2]=Math.round(Math.max(0,Math.min(1,b))*255);}return out;}

window.extractManual = function(){
  if(tool==='rect'&&floatingRect){saveH();fillRect({x:floatingRect.x,y:floatingRect.y},{x:floatingRect.x+floatingRect.w,y:floatingRect.y+floatingRect.h});floatingRect=null;drawOverlay();}
  if(!mask)return;if(!mask.includes(1)){alert('⚠️ 請先圈選食材！（選到背景請按🔄反選）');return;}
  const w=mainC.width,h=mainC.height,src=mCtx.getImageData(0,0,w,h),pixels=src.data;
  const erR=parseInt(document.getElementById('erodeR').value)||0,feR=parseInt(document.getElementById('featherR').value)||0,doDs=document.getElementById('despillCk').checked;
  let m=erR>0?erodeMask(mask,w,h,erR):new Uint8Array(mask);
  let aF=new Float32Array(w*h);for(let i=0;i<w*h;i++)aF[i]=m[i]?1:0;
  if(feR>0)aF=gaussBlur(aF,w,h,feR);
  const fp=doDs?despillManual(pixels,m,w,h):pixels;
  let x0=w,y0=h,x1=0,y1=0,valid=false;
  for(let i=0;i<w*h;i++){if(aF[i]>.01){valid=true;const x=i%w,y=Math.floor(i/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
  if(!valid||x0>x1){alert('⚠️ 選取區域太小或收縮過大');return;}
  const cw=x1-x0+1,ch=y1-y0+1,tc=document.createElement('canvas');tc.width=cw;tc.height=ch;
  const tCtx=tc.getContext('2d'),out=tCtx.createImageData(cw,ch);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const si=(y*w+x)*4,di=((y-y0)*cw+(x-x0))*4;out.data[di]=fp[si];out.data[di+1]=fp[si+1];out.data[di+2]=fp[si+2];out.data[di+3]=Math.round(aF[y*w+x]*(fp[si+3]/255)*255);}
  tCtx.putImageData(out,0,0);addResult(autoCenter(tc));
  clearSel();scrollBottom();
};

window.setTool = function(t){
  if(tool==='rect'&&floatingRect&&t!=='rect'){saveH();fillRect({x:floatingRect.x,y:floatingRect.y},{x:floatingRect.x+floatingRect.w,y:floatingRect.y+floatingRect.h});floatingRect=null;}
  tool=t;overC.style.cursor='crosshair';
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));document.getElementById('t-'+t).classList.add('active');
  if(t!=='poly'){polyPts=[]; polyPreviewPos=null;}
  drawOverlay();
};

window.saveH = function(){selHist.push(new Uint8Array(mask));};
window.undoSel = function(){if(selHist.length){mask=selHist.pop();drawOverlay();}};
window.clearSel = function(){
  if(!mask)return;saveH();mask.fill(0);floatingRect=null;rectCur=null;fixedCorner=null;
  polyPts=[];freePts=[];polyPreviewPos=null;drawOverlay();
};
window.invertSel = function(){
  if(!mask)return;
  saveH();
  if(tool==='rect' && floatingRect){
    fillRect({x:floatingRect.x,y:floatingRect.y},{x:floatingRect.x+floatingRect.w,y:floatingRect.y+floatingRect.h});
    floatingRect=null;
  }
  if(tool==='poly' && polyPts.length>2){
    fillPoly(polyPts);
    polyPts=[];
    polyPreviewPos=null;
  }
  for(let i=0;i<mask.length;i++) mask[i]=mask[i]===1?0:1;
  drawOverlay();
};

function getPos(e){
  const rect=overC.getBoundingClientRect();let cx=e.clientX,cy=e.clientY,isTouch=false;
  if(e.changedTouches&&e.changedTouches.length>0){cx=e.changedTouches[0].clientX;cy=e.changedTouches[0].clientY;isTouch=true;}
  if(isTouch&&(tool==='add'||tool==='erase'))cy-=60;
  return{x:Math.round((cx-rect.left)*(overC.width/rect.width)),y:Math.round((cy-rect.top)*(overC.height/rect.height))};
}
function floodFill(sx,sy,tol){const w=mainC.width,h=mainC.height,d=mCtx.getImageData(0,0,w,h).data;const idx=(sy*w+sx)*4,tr=d[idx],tg=d[idx+1],tb=d[idx+2];const useLab=document.getElementById('labCk').checked,labTol=tol*.35;const vis=new Uint8Array(w*h),q=[sy*w+sx];vis[sy*w+sx]=1;while(q.length){const pos=q.pop(),px=pos%w,py=Math.floor(pos/w);mask[pos]=1;for(const n of[pos-1,pos+1,pos-w,pos+w]){const nx=n%w,ny=Math.floor(n/w);if(nx<0||nx>=w||ny<0||ny>=h||vis[n])continue;const ni=n*4;const dist=useLab?labDist(d[ni],d[ni+1],d[ni+2],tr,tg,tb):Math.sqrt((d[ni]-tr)**2+(d[ni+1]-tg)**2+(d[ni+2]-tb)**2);if(dist<=(useLab?labTol:tol)){vis[n]=1;q.push(n);}}}}
function fillRect(a,b){const x0=Math.min(a.x,b.x),y0=Math.min(a.y,b.y),x1=Math.max(a.x,b.x),y1=Math.max(a.y,b.y),w=mainC.width;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)mask[y*w+x]=1;}
function fillPoly(pts){const w=mainC.width,h=mainC.height,tmp=document.createElement('canvas');tmp.width=w;tmp.height=h;const tc=tmp.getContext('2d');tc.beginPath();tc.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>tc.lineTo(p.x,p.y));tc.closePath();tc.fillStyle='#fff';tc.fill();const id=tc.getImageData(0,0,w,h).data;for(let i=0;i<w*h;i++)if(id[i*4]>128)mask[i]=1;}
function brushPaint(p){const r=parseInt(document.getElementById('brushR').value),w=mainC.width,h=mainC.height;const x0=Math.max(0,p.x-r),x1=Math.min(w-1,p.x+r),y0=Math.max(0,p.y-r),y1=Math.min(h-1,p.y+r);for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if((x-p.x)**2+(y-p.y)**2<=r*r)mask[y*w+x]=(tool==='add')?1:0;}

function showBrushCursor(e){ return; }

function strokeDouble(drawFn, brightColor='#ffffff', dashOffset=0) {
  oCtx.save();
  oCtx.strokeStyle = 'rgba(0,0,0,0.75)';
  oCtx.lineWidth = 5;
  oCtx.setLineDash([8, 6]);
  oCtx.lineDashOffset = -dashOffset;
  drawFn();
  oCtx.strokeStyle = brightColor;
  oCtx.lineWidth = 2.5;
  oCtx.setLineDash([8, 6]);
  oCtx.lineDashOffset = -dashOffset;
  drawFn();
  oCtx.setLineDash([]);
  oCtx.restore();
}

// ==========================================
// 7. UI 動態繪製與畫布監聽 (Drawing & Events)
// ==========================================
function drawCornerHandles() {
  if (tool !== 'rect' || !floatingRect) return;
  const sz = 14, hSz = 7;
  const pts = [
    { x: floatingRect.x,               y: floatingRect.y,               cursor: 'nwse-resize' },
    { x: floatingRect.x + floatingRect.w, y: floatingRect.y,             cursor: 'nesw-resize' },
    { x: floatingRect.x,               y: floatingRect.y + floatingRect.h, cursor: 'nesw-resize' },
    { x: floatingRect.x + floatingRect.w, y: floatingRect.y + floatingRect.h, cursor: 'nwse-resize' },
  ];
  oCtx.setLineDash([]);
  pts.forEach(pt => {
    oCtx.fillStyle = '#000000';
    oCtx.fillRect(pt.x - hSz - 2, pt.y - hSz - 2, sz + 4, sz + 4);
    oCtx.fillStyle = '#ffffff';
    oCtx.fillRect(pt.x - hSz - 1, pt.y - hSz - 1, sz + 2, sz + 2);
    oCtx.fillStyle = '#D4A843';
    oCtx.fillRect(pt.x - hSz, pt.y - hSz, sz, sz);
    oCtx.fillStyle = '#ffffff';
    oCtx.beginPath();
    oCtx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
    oCtx.fill();
  });
}

function drawOverlay() {
  if (mode !== 'manual' || !mask) return;
  const w = mainC.width, h = mainC.height;
  oCtx.clearRect(0, 0, w, h);

  let frx0=-1, fry0=-1, frx1=-1, fry1=-1;
  if (tool === 'rect') {
    if (rectAction === 'create' && rectStart && rectCur) {
      frx0 = Math.min(rectStart.x, rectCur.x); fry0 = Math.min(rectStart.y, rectCur.y);
      frx1 = Math.max(rectStart.x, rectCur.x); fry1 = Math.max(rectStart.y, rectCur.y);
    } else if (floatingRect) {
      frx0 = floatingRect.x; fry0 = floatingRect.y;
      frx1 = floatingRect.x + floatingRect.w; fry1 = floatingRect.y + floatingRect.h;
    }
  }
  const hasRectPreview = frx0 !== -1;
  const hasMaskSel = mask.includes(1);

  const id = oCtx.createImageData(w, h);
  const d = id.data;
  const mo = Math.round(marchOffset);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const isMasked = mask[i] === 1;
      const inRect = hasRectPreview && x >= frx0 && x <= frx1 && y >= fry0 && y <= fry1;
      const selected = isMasked || inRect;

      if (selected) {
        if (isMasked) {
          const isEdge = (x === 0 || !mask[i - 1]) || (x === w-1 || !mask[i + 1]) || (y === 0 || !mask[i - w]) || (y === h-1 || !mask[i + w]);
          if (isEdge) {
            const antPhase = (x + y + mo) % 16;
            if (antPhase < 8) { d[i*4]=255; d[i*4+1]=255; d[i*4+2]=255; d[i*4+3]=255; }
            else { d[i*4]=0; d[i*4+1]=0; d[i*4+2]=0; d[i*4+3]=255; }
          } else { d[i*4]=100; d[i*4+1]=160; d[i*4+2]=255; d[i*4+3]=45; }
        }
      } else { d[i*4]=0; d[i*4+1]=0; d[i*4+2]=0; d[i*4+3]=130; }
    }
  }

  if (hasMaskSel) {
    for (let y = 1; y < h-1; y++) {
      for (let x = 1; x < w-1; x++) {
        const i = y * w + x;
        if (mask[i]) continue;
        const hasSelNeighbor = mask[i-1] || mask[i+1] || mask[i-w] || mask[i+w];
        if (hasSelNeighbor) {
          const antPhase = (x + y + mo + 4) % 16;
          if (antPhase < 8) { d[i*4]=255; d[i*4+1]=255; d[i*4+2]=255; d[i*4+3]=220; }
          else { d[i*4]=20; d[i*4+1]=20; d[i*4+2]=20; d[i*4+3]=220; }
        }
      }
    }
  }

  oCtx.putImageData(id, 0, 0);

  if (tool === 'rect') {
    if (rectAction === 'create' && rectStart && rectCur) {
      const rx = Math.min(rectStart.x, rectCur.x), ry = Math.min(rectStart.y, rectCur.y);
      const rw = Math.abs(rectCur.x - rectStart.x), rh = Math.abs(rectCur.y - rectStart.y);
      if (rw > 2 && rh > 2) {
        oCtx.fillStyle = 'rgba(79,142,247,0.12)';
        oCtx.fillRect(rx, ry, rw, rh);
        strokeDouble(() => { oCtx.strokeRect(rx, ry, rw, rh); }, '#00ddff', marchOffset);
      }
    }
    if (floatingRect) {
      oCtx.fillStyle = 'rgba(79,200,130,0.10)';
      oCtx.fillRect(floatingRect.x, floatingRect.y, floatingRect.w, floatingRect.h);
      strokeDouble(() => { oCtx.strokeRect(floatingRect.x, floatingRect.y, floatingRect.w, floatingRect.h); }, '#44ff99', marchOffset);
    }
  }

  if (tool === 'poly' && (polyPts.length > 0 || polyPreviewPos)) {
    let activePreviewP = polyPreviewPos;
    let isClosing = false;
    if (polyPreviewPos && polyPts.length > 2) {
      const dx = polyPreviewPos.x - polyPts[0].x;
      const dy = polyPreviewPos.y - polyPts[0].y;
      if (Math.sqrt(dx*dx + dy*dy) < 25) { isClosing = true; activePreviewP = polyPts[0]; }
    }
    if (polyPts.length > 2 && isClosing) {
      oCtx.beginPath(); oCtx.moveTo(polyPts[0].x, polyPts[0].y); polyPts.slice(1).forEach(p => oCtx.lineTo(p.x, p.y)); oCtx.closePath();
      oCtx.fillStyle = 'rgba(255,200,0,0.15)'; oCtx.fill();
    } else if (polyPts.length > 2 && !polyPreviewPos) {
      oCtx.beginPath(); oCtx.moveTo(polyPts[0].x, polyPts[0].y); polyPts.slice(1).forEach(p => oCtx.lineTo(p.x, p.y)); oCtx.closePath();
      oCtx.fillStyle = 'rgba(255,200,0,0.10)'; oCtx.fill();
    }
    const drawPolyLine = () => {
      if (polyPts.length > 0) {
        oCtx.beginPath(); oCtx.moveTo(polyPts[0].x, polyPts[0].y); polyPts.slice(1).forEach(p => oCtx.lineTo(p.x, p.y));
        if (activePreviewP) oCtx.lineTo(activePreviewP.x, activePreviewP.y);
        if (polyPts.length > 1 || activePreviewP) oCtx.stroke();
      }
    };
    strokeDouble(drawPolyLine, '#ffdd00', marchOffset);

    polyPts.forEach((p, i) => {
      oCtx.beginPath(); oCtx.arc(p.x, p.y, i === 0 ? 9 : 4, 0, Math.PI * 2);
      oCtx.fillStyle = i === 0 ? '#ff3333' : 'rgba(255,220,0,0.9)'; oCtx.fill();
      oCtx.strokeStyle = '#fff'; oCtx.lineWidth = 2; oCtx.setLineDash([]); oCtx.stroke();
    });

    if (activePreviewP && !isClosing) {
      oCtx.beginPath(); oCtx.arc(activePreviewP.x, activePreviewP.y, 4, 0, Math.PI * 2);
      oCtx.fillStyle = '#ffffff'; oCtx.fill(); oCtx.strokeStyle = '#ff3333'; oCtx.lineWidth = 1.5; oCtx.setLineDash([]); oCtx.stroke();
    }
    if (polyPts.length > 2) {
      oCtx.fillStyle = 'rgba(0,0,0,0.7)'; oCtx.fillRect(polyPts[0].x + 12, polyPts[0].y - 18, 80, 20);
      oCtx.fillStyle = isClosing ? '#00ff66' : '#ffdd00'; oCtx.font = 'bold 11px sans-serif';
      oCtx.fillText(isClosing ? '放開以封閉！' : '點此封閉', polyPts[0].x + 16, polyPts[0].y - 4);
    }
  }

  if (tool === 'free' && freePts.length > 1) {
    const drawFreeLine = () => { oCtx.beginPath(); oCtx.moveTo(freePts[0].x, freePts[0].y); freePts.slice(1).forEach(p => oCtx.lineTo(p.x, p.y)); oCtx.stroke(); };
    strokeDouble(drawFreeLine, '#ff88ff', marchOffset);
    oCtx.beginPath(); oCtx.arc(freePts[0].x, freePts[0].y, 8, 0, Math.PI * 2); oCtx.fillStyle = '#ff3333'; oCtx.fill();
    oCtx.strokeStyle = '#fff'; oCtx.lineWidth = 2; oCtx.setLineDash([]); oCtx.stroke();
  }

  if ((tool === 'add' || tool === 'erase') && lastBrush) {
    const r = parseInt(document.getElementById('brushR').value);
    const color = tool === 'add' ? '#00ff66' : '#ff4444';
    oCtx.setLineDash([]); oCtx.strokeStyle = 'rgba(0,0,0,0.8)'; oCtx.lineWidth = 5;
    oCtx.beginPath(); oCtx.arc(lastBrush.x, lastBrush.y, r, 0, Math.PI * 2); oCtx.stroke();
    oCtx.strokeStyle = color; oCtx.lineWidth = 2.5;
    oCtx.beginPath(); oCtx.arc(lastBrush.x, lastBrush.y, r, 0, Math.PI * 2); oCtx.stroke();
    oCtx.strokeStyle = 'rgba(255,255,255,0.6)'; oCtx.lineWidth = 1;
    oCtx.beginPath(); oCtx.arc(lastBrush.x, lastBrush.y, r - 3, 0, Math.PI * 2); oCtx.stroke();
    oCtx.strokeStyle = color; oCtx.lineWidth = 1.5;
    oCtx.beginPath(); oCtx.moveTo(lastBrush.x - 6, lastBrush.y); oCtx.lineTo(lastBrush.x + 6, lastBrush.y); oCtx.stroke();
    oCtx.beginPath(); oCtx.moveTo(lastBrush.x, lastBrush.y - 6); oCtx.lineTo(lastBrush.x, lastBrush.y + 6); oCtx.stroke();
  }

  drawCornerHandles();

  const extractBtn = document.getElementById('btn-extract');
  if (extractBtn) {
    const hasSelection = (mask && mask.includes(1)) || floatingRect !== null;
    if (hasSelection) {
      extractBtn.disabled = false; extractBtn.innerHTML = '✂️ 擷取選取範圍 (精修去背與置中)'; 
      extractBtn.style.background = 'linear-gradient(135deg,var(--accent),#2196F3)'; extractBtn.style.color = '#fff';
      extractBtn.style.cursor = 'pointer'; extractBtn.style.border = 'none';
    } else {
      extractBtn.disabled = true; extractBtn.innerHTML = '☝️ 請先在上方選取食材'; 
      extractBtn.style.background = '#2a2f3b'; extractBtn.style.color = '#555';
      extractBtn.style.cursor = 'not-allowed'; extractBtn.style.border = '1px dashed #555';
    }
  }
}

// ==========================================
// 8. 滑鼠與觸控監聽事件 (Event Listeners)
// ==========================================
function handleDown(e){
  if(e.type.includes('touch'))lastTouchTime=Date.now();
  else if(e.type.includes('mouse')&&Date.now()-lastTouchTime<500)return;
  if(mode!=='manual'||!mask||e.target!==overC)return;
  const p=getPos(e); downPos = p; touchMoved = false;

  if (tool === 'poly') { polyPreviewPos = p; isDrawing = true; updateMag(e, p); drawOverlay(); return; }

  if(tool==='rect'){
    if(floatingRect){
      const{x,y,w,h}=floatingRect; const hit=35; const inBox=(px,py,tx,ty)=>Math.abs(px-tx)<hit&&Math.abs(py-ty)<hit;
      if(inBox(p.x,p.y,x,y)){rectAction='resize';fixedCorner={x:x+w,y:y+h};isDrawing=true;drawOverlay();return;}
      else if(inBox(p.x,p.y,x+w,y)){rectAction='resize';fixedCorner={x:x,y:y+h};isDrawing=true;drawOverlay();return;}
      else if(inBox(p.x,p.y,x,y+h)){rectAction='resize';fixedCorner={x:x+w,y:y};isDrawing=true;drawOverlay();return;}
      else if(inBox(p.x,p.y,x+w,y+h)){rectAction='resize';fixedCorner={x:x,y:y};isDrawing=true;drawOverlay();return;}
      else if(p.x>=x&&p.x<=x+w&&p.y>=y&&p.y<=y+h){rectAction='move';dragOffset={x:p.x-x,y:p.y-y};isDrawing=true;drawOverlay();return;}
      saveH();mask.fill(0);floatingRect=null;
    }else{ saveH();mask.fill(0); }
    rectAction='create';rectStart=p;rectCur=p;isDrawing=true;drawOverlay();
  }
  else if(tool==='free'){freePts=[p];isDrawing=true;}
  else if(tool==='add'||tool==='erase'){saveH();isDrawing=true;lastBrush=p;brushPaint(p);drawOverlay();showBrushCursor(e);}
  updateMag(e,p);
}

function handleMove(e){
  if(e.type.includes('touch'))lastTouchTime=Date.now();
  else if(e.type.includes('mouse')&&Date.now()-lastTouchTime<500)return;
  if(mode!=='manual'||!mask)return;
  if(!e.type.includes('touch')&&!isDrawing&&e.target!==overC){magEl.style.display='none';return;}
  if(e.type.includes('touch')&&e.target===overC)e.preventDefault();
  const p=getPos(e);

  if (downPos && ((p.x - downPos.x)**2 + (p.y - downPos.y)**2 > 225)) { touchMoved = true; }

  if (tool === 'poly' && isDrawing) { polyPreviewPos = p; updateMag(e, p); drawOverlay(); return; }

  if(!isDrawing){
    if(e.target===overC){
      updateMag(e,p);
      if(tool==='rect'&&floatingRect){
        const{x,y,w,h}=floatingRect;const hit=35; const inBox=(px,py,tx,ty)=>Math.abs(px-tx)<hit&&Math.abs(py-ty)<hit;
        if(inBox(p.x,p.y,x,y)||inBox(p.x,p.y,x+w,y+h))overC.style.cursor='nwse-resize';
        else if(inBox(p.x,p.y,x+w,y)||inBox(p.x,p.y,x,y+h))overC.style.cursor='nesw-resize';
        else if(p.x>=x&&p.x<=x+w&&p.y>=y&&p.y<=y+h)overC.style.cursor='move';
        else overC.style.cursor='crosshair';
      }else{overC.style.cursor='crosshair';}
    }else{magEl.style.display='none';overC.style.cursor='crosshair';}
    return;
  }

  if(tool==='rect'){
    if(rectAction==='create'){rectCur=p;}
    else if(rectAction==='move'&&floatingRect){floatingRect.x=p.x-dragOffset.x;floatingRect.y=p.y-dragOffset.y;}
    else if(rectAction==='resize'&&fixedCorner){ floatingRect={x:Math.min(p.x,fixedCorner.x),y:Math.min(p.y,fixedCorner.y),w:Math.abs(p.x-fixedCorner.x),h:Math.abs(p.y-fixedCorner.y)}; }
    drawOverlay();
  }
  else if(tool==='free'){freePts.push(p);drawOverlay();}
  else if(tool==='add'||tool==='erase'){lastBrush=p;brushPaint(p);drawOverlay();showBrushCursor(e);}
  updateMag(e,p);
}

function handleUp(e){
  if(e.type.includes('touch'))lastTouchTime=Date.now();
  else if(e.type.includes('mouse')&&Date.now()-lastTouchTime<500)return;
  magEl.style.display='none';brushCursor.style.display='none';
  if(mode!=='manual'||!mask)return;
  const p=getPos(e); const isTouchEvt=e.type.includes('touch');

  if (tool === 'poly' && isDrawing) {
    isDrawing = false; const finalP = polyPreviewPos || p; polyPreviewPos = null; 
    if (polyPts.length > 0) {
      const dx = finalP.x - polyPts[0].x, dy = finalP.y - polyPts[0].y;
      if (polyPts.length > 2 && Math.sqrt(dx*dx + dy*dy) < 25) { saveH(); fillPoly(polyPts); polyPts = []; drawOverlay(); return; }
    }
    polyPts.push(finalP); drawOverlay(); return;
  }

  const canFire = !isDrawing && (isTouchEvt ? (!touchMoved && e.target===overC) : (downPos !== null));
  if(canFire){
    if(tool==='magic'){ const fp = (isTouchEvt ? p : downPos); saveH(); floodFill(fp.x,fp.y,parseInt(document.getElementById('tolerR').value)); drawOverlay(); }
  }

  if(isDrawing){
    if(tool==='rect'){
      if(rectAction==='create'&&rectStart&&rectCur){
        const rx=Math.min(rectStart.x,rectCur.x),ry=Math.min(rectStart.y,rectCur.y);
        const rw=Math.abs(rectCur.x-rectStart.x),rh=Math.abs(rectCur.y-rectStart.y);
        if(rw>5&&rh>5)floatingRect={x:rx,y:ry,w:rw,h:rh};
      }
      rectStart=null;rectCur=null;fixedCorner=null;rectAction=null;drawOverlay();
    }
    else if(tool==='free'&&freePts.length>2){saveH();fillPoly(freePts);freePts=[];drawOverlay();}
    isDrawing=false;lastBrush=null;drawOverlay();
  }
}

function updateMag(e,p){
  if(mode!=='manual'||!srcImg.width||(tool!=='poly'&&tool!=='free')){magEl.style.display='none';return;}
  magEl.style.display='block';let cx=e.clientX,cy=e.clientY;
  if(e.changedTouches&&e.changedTouches.length>0){cx=e.changedTouches[0].clientX;cy=e.changedTouches[0].clientY;}
  magEl.style.left=(cx-50)+'px';magEl.style.top=(cy-140>0?cy-140:cy+40)+'px';
  magCtx.clearRect(0,0,100,100);magCtx.imageSmoothingEnabled=false;
  magCtx.drawImage(mainC,p.x-25,p.y-25,50,50,0,0,100,100);
  magCtx.drawImage(overC,p.x-25,p.y-25,50,50,0,0,100,100);
}

overC.addEventListener('mousedown',  handleDown);
document.addEventListener('mousemove', handleMove);
document.addEventListener('mouseup', handleUp);
overC.addEventListener('touchstart', handleDown, {passive:false});
overC.addEventListener('touchmove',  handleMove, {passive:false});
document.addEventListener('touchend', handleUp,  {passive:false});

let resizeTimer=null;
window.addEventListener('resize',()=>{
  if(!srcImg||!srcImg.width)return;
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{
    const vp=document.getElementById('viewport'); const vpRect=vp.getBoundingClientRect();
    const hdrH=(document.querySelector('header')||{offsetHeight:48}).offsetHeight||48;
    const vpW=Math.max(100,vpRect.width>10?vpRect.width-10:(window.innerWidth-380));
    const vpH=Math.max(200,vpRect.height>10?vpRect.height-10:(window.innerHeight-hdrH-120));
    const sc=Math.min(vpW/srcImg.width,vpH/srcImg.height,1);
    const nw=Math.round(srcImg.width*sc),nh=Math.round(srcImg.height*sc);
    if(nw===mainC.width&&nh===mainC.height)return;
    mainC.width=overC.width=nw;mainC.height=overC.height=nh; mCtx.drawImage(srcImg,0,0,nw,nh);
    if(mask)mask=new Uint8Array(nw*nh);
    selHist=[];polyPts=[];freePts=[];floatingRect=null;
    mode==='manual'?drawOverlay():drawBatchGrid();
  },200);
});

// ==========================================
// 9. 匯出、打包與圖庫結果 (Export & Gallery)
// ==========================================
function addResult(dataUrl){
  const grid=document.getElementById('result-grid'),div=document.createElement('div');
  div.className='ing-item selected';div.innerHTML=`<img src="${dataUrl}">`;
  div.onclick=function(){this.classList.toggle('selected');updateCount();};
  grid.appendChild(div);document.getElementById('gallery').classList.remove('hidden');updateCount();
}
function updateCount(){
  const count=document.querySelectorAll('.ing-item.selected').length;document.getElementById('sel-count').textContent=count;
  const actionBar=document.querySelector('.action-bar');
  if(actionBar){if(count===0&&mode!=='prompt')actionBar.classList.add('hidden');else if(mode!=='prompt')actionBar.classList.remove('hidden');}
}
let allSel=true;
window.toggleAll = function(){allSel=!allSel;document.querySelectorAll('.ing-item').forEach(el=>{allSel?el.classList.add('selected'):el.classList.remove('selected');});updateCount();};
function scrollBottom(){setTimeout(()=>{const sc=document.getElementById('ctrl-scroll');if(sc)sc.scrollTo({top:sc.scrollHeight,behavior:'smooth'});},120);}
window.deleteSelected = function(){
  const selected=document.querySelectorAll('.ing-item.selected');if(selected.length===0){alert('⚠️ 請先點選要刪除的食材！');return;}
  selected.forEach(el=>el.remove());showToast(`🗑️ 已順利刪除 ${selected.length} 個食材`);updateCount();
  if(document.querySelectorAll('.ing-item').length===0)document.getElementById('gallery').classList.add('hidden');
};

window.importToDB = function(){
  if(!db)return alert('⚠️ 資料庫尚未就緒');
  const sel=document.querySelectorAll('.ing-item.selected img');if(!sel.length)return alert('⚠️ 請先勾選食材');
  const cat=document.getElementById('catSel').value;const btn=document.getElementById('btn-import');
  btn.textContent='⏳ 寫入中…';btn.disabled=true;
  const tx=db.transaction([STORE],'readwrite'),store=tx.objectStore(STORE);
  sel.forEach((img,i)=>store.add({src:img.src,name:'擷取素食_'+(Date.now()+i).toString().slice(-4),category:cat}));
  tx.oncomplete=()=>{alert(`✅ 已匯入 ${sel.length} 個食材至【${cat}】\n點擊左上角「⬅️ 回擺盤」即可使用！`);resetCanvas();btn.textContent='📥 匯入資料庫';btn.disabled=false;};
  tx.onerror=()=>{alert('❌ 寫入失敗');btn.textContent='📥 匯入資料庫';btn.disabled=false;};
};
window.exportZip = async function(){
  const sel=document.querySelectorAll('.ing-item.selected img');if(!sel.length)return alert('⚠️ 請先勾選食材');
  const btn=document.getElementById('btn-zip');btn.textContent='📦 打包中…';btn.disabled=true;
  try{
    const zip=new JSZip();sel.forEach((img,i)=>zip.file(`veg_ingredient_${i+1}.png`,img.src.split(',')[1],{base64:true}));
    const blob=await zip.generateAsync({type:'blob'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='veg_ingredients.zip';a.click();
    showToast('✅ ZIP 打包下載成功！');resetCanvas();
  }catch(err){alert('匯出失敗');}finally{btn.textContent='📦 ZIP 打包';btn.disabled=false;}
};

// 提示詞相關
window.openGemini = function(id){
  const btn=event.currentTarget,oldHtml=btn.innerHTML;let text=document.getElementById(id).textContent.trim();
  if(id==='pt1'||text.includes('[食材名稱]')){customPrompt('🥦 生成食材','想生成什麼素食料理？(不含五辛)','五寶鮮蔬',(name)=>{if(name){text=text.replace(/\[食材名稱\]/g,name);finalizeGeminiAction(text,btn,oldHtml);}});}
  else finalizeGeminiAction(text,btn,oldHtml);
};
function finalizeGeminiAction(text,btn,oldHtml){
  navigator.clipboard.writeText(text).then(()=>{
    btn.innerHTML='✅ 提示詞已複製！準備跳轉...';btn.style.filter='brightness(1.1)';showToast('🚀 提示詞已複製！正在跳轉至 Gemini...');
    setTimeout(()=>{window.open('https://gemini.google.com','_blank');setTimeout(()=>{btn.innerHTML=oldHtml;btn.style.filter='none';},1000);},500);
  }).catch(()=>{alert('❌ 複製失敗，請手動複製文字。');});
}
