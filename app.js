(() => {
  const $ = (s) => document.querySelector(s);
  const storeKey = 'goodkid-study-v1';
  let state = loadState();
  let activeSet = null;
  let activeQuestion = 0;
  let answers = [];
  let startTime = 0;
  let toastTimer;

  function loadState() {
    try { return { sets: [], minutes: 0, weeklyDays: [], scores: [], ...JSON.parse(localStorage.getItem(storeKey) || '{}') }; }
    catch { return { sets: [], minutes: 0, weeklyDays: [], scores: [] }; }
  }
  function save() { localStorage.setItem(storeKey, JSON.stringify(state)); renderStats(); renderRecent(); }
  function escapeHtml(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function toast(message, error=false) { const el=$('#toast'); el.textContent=message; el.classList.toggle('error',error); el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2900); }
  function dateKey(d=new Date()) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
  function dayLabel() { return new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date()); }
  function weekStart() { const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-(d.getDay()+6)%7); return d; }
  function currentStreak() { const days=new Set(state.weeklyDays||[]); let d=new Date(); let count=0; if(!days.has(dateKey(d)))d.setDate(d.getDate()-1); while(days.has(dateKey(d))){count++;d.setDate(d.getDate()-1);} return count; }
  function renderStats() {
    $('#stat-minutes').innerHTML=`${state.minutes||0}<span> min</span>`;
    $('#stat-sets').innerHTML=`${state.sets.length}<span> ${state.sets.length===1?'set':'sets'}</span>`;
    $('#material-count').textContent=state.sets.length; $('#material-bubble').textContent=state.sets.length;
    const scores=state.scores||[];
    if(scores.length){const avg=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);$('#stat-recall').innerHTML=`${avg}<span>%</span>`;$('#recall-trend').textContent=`Across ${scores.length} ${scores.length===1?'quiz':'quizzes'}`;}
    else {$('#stat-recall').innerHTML='—<span></span>';$('#recall-trend').textContent=state.sets.length?'Ready when you are':'Your first quiz awaits';}
    const days=new Set((state.weeklyDays||[]).filter(d=>new Date(d.replaceAll('-','/')).getTime()>=weekStart().getTime()));
    $('#weekly-progress').textContent=`${Math.min(days.size,5)} / 5 days`;$('.focus-progress span').style.width=`${Math.min(days.size*20,100)}%`;
    $('#streak-days').textContent=`${currentStreak()} ${currentStreak()===1?'day':'day'} streak`;
    $('#week-label').textContent=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(weekStart());
  }
  function renderRecent() {
    const recent=$('#recent-list');
    if(!state.sets.length){recent.innerHTML='<div class="empty-recent">Your study sets will show up here.</div>';return;}
    recent.innerHTML=state.sets.slice(0,5).map(s=>`<button class="recent-item" data-open="${escapeHtml(s.id)}"><span class="recent-file">▤</span><span>${escapeHtml(s.name)}</span></button>`).join('');
    recent.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openSet(b.dataset.open)));
  }
  function renderLibrary() {
    const grid=$('#library-grid');
    if(!state.sets.length){grid.innerHTML='<div class="library-empty"><div style="font-size:22px;color:#91ad83">✳</div><b>Your next great study session starts here.</b><span>Upload a PDF from class and we’ll make your first study set.</span></div>';return;}
    grid.innerHTML=state.sets.map(s=>`<article class="material-card" data-open="${escapeHtml(s.id)}"><div class="file-mark">▤</div><h3 title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</h3><p>${s.pageCount||1} page${s.pageCount===1?'':'s'} · ${s.questions?.length||0} practice questions</p><div class="card-bottom"><span>${escapeHtml(s.subject||'Study set')}</span><span>Study →</span></div></article>`).join('');
    grid.querySelectorAll('[data-open]').forEach(c=>c.addEventListener('click',()=>openSet(c.dataset.open)));
  }
  function switchView(view) {
    const home=view==='home';$('#home-view').classList.toggle('hidden',!home);$('#library-view').classList.toggle('hidden',home);$('#crumb-current').textContent=home?'Overview':'My materials';
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if(!home)renderLibrary();
  }
  function normalizeText(text) { return text.replace(/\s+/g,' ').replace(/([a-z])-\s+([a-z])/gi,'$1$2').trim(); }
  function extractPdf(file) {
    if(!window.pdfjsLib) return Promise.reject(new Error('The PDF reader did not load. Check your connection and try again.'));
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    return file.arrayBuffer().then(data=>pdfjsLib.getDocument({data}).promise).then(async pdf=>{
      const pages=[];
      for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();pages.push(content.items.map(item=>item.str).join(' '));}
      return {text:normalizeText(pages.join('\n')),pageCount:pdf.numPages};
    });
  }
  function localStudy(text, fileName) {
    const clean=normalizeText(text);
    let sentences=clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[];
    sentences=sentences.map(s=>s.trim()).filter(s=>s.length>45&&s.length<380&&!/^(page\s+\d+|https?:\/\/)/i.test(s));
    const unique=[];for(const s of sentences){if(!unique.some(x=>x.toLowerCase()===s.toLowerCase()))unique.push(s);}
    const picked=unique.slice(0,18);
    const words=clean.toLowerCase().match(/[a-z][a-z'-]{4,}/g)||[];
    const stop=new Set('about after again against also among because before being between could does during each from have into itself more most other over should their there these they this through under until very what when where which while with would your that then than them some such only using used use like page chapter figure table'.split(' '));
    const freq={};words.forEach(w=>{if(!stop.has(w))freq[w]=(freq[w]||0)+1;});
    const terms=Object.entries(freq).filter(([,n])=>n>1).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([word])=>word);
    const shortName=fileName.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ');
    const concepts=terms.slice(0,5).map(t=>t[0].toUpperCase()+t.slice(1));
    const questions=[];
    const statements=picked.filter(s=>s.split(/\s+/).length>8);
    for(let i=0;i<Math.min(6,statements.length);i++){
      const sentence=statements[i];
      const term=terms.find(w=>new RegExp(`\\b${w}\\b`,'i').test(sentence));
      const answer=sentence.length>190?sentence.slice(0,187).trimEnd()+'…':sentence;
      const otherPool=statements.filter(s=>s!==sentence).map(s=>s.length>150?s.slice(0,147).trimEnd()+'…':s);
      const options=[answer,...otherPool.slice(i, i+3)];
      while(options.length<4)options.push(`This idea is not explained in the uploaded notes.`);
      const shuffled=options.slice(0,4).map((value,j)=>({value,correct:j===0})).sort((a,b)=>a.value.localeCompare(b.value));
      questions.push({prompt:term?`Which statement best describes ${term}?`:`Which statement is supported by your notes?`,options:shuffled.map(o=>o.value),correct:shuffled.findIndex(o=>o.correct),explanation:`Your notes say: “${sentence}” ${term?`This is one of the ideas connected to ${term}.`:''}`});
    }
    if(!questions.length){
      const fallback=clean.slice(0,600);
      questions.push({prompt:'What is the best next step when studying new material?',options:['Try to recall the main idea before checking your notes.','Read the same page over and over without a break.','Skip anything that feels challenging.','Memorize every sentence word for word.'],correct:0,explanation:'Active recall strengthens memory. This starter question is here because the PDF has too little selectable text to make content based questions.'});
    }
    const keyFacts=statements.slice(0,4);
    const lesson=keyFacts.length?keyFacts.slice(0,3).join(' '):clean.slice(0,500);
    return {title:shortName||'Your study set',subject:concepts.slice(0,2).join(' · ')||'Class notes',concepts,lesson,questions:questions.slice(0,6),source:'local',note:questions.length===1&&clean.length<250?'This PDF has very little selectable text. It may be scanned; add a text based PDF or connect Gemini for stronger explanations.':''};
  }
  async function generateStudy(text, fileName) {
    const local=localStudy(text,fileName);
    try {
      const response=await fetch('/api/study',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text.slice(0,60000),fileName})});
      if(!response.ok)return local;
      const data=await response.json();
      if(!data.questions?.length)return local;
      return {...local,...data,source:'ai'};
    } catch { return local; }
  }
  function showProcessing(title, message) {
    $('#modal-content').innerHTML=`<div class="processing"><div class="spinner"></div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><div class="pdf-note">Your file stays in this browser. Goodkid only sends extracted text to the study generator.</div></div>`;
    $('#study-modal').classList.remove('hidden');
  }
  async function handleFile(file) {
    if(!file)return;
    if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){toast('Please choose a PDF file.',true);return;}
    if(file.size>20*1024*1024){toast('That PDF is over 20 MB. Try a smaller file.',true);return;}
    showProcessing('Reading your notes…','Finding the useful ideas in your PDF.');
    try {
      const {text,pageCount}=await extractPdf(file);
      if(text.length<40)throw new Error('There is not enough selectable text in this PDF. Scanned pages are not supported yet.');
      $('#modal-content').querySelector('h2').textContent='Making your study set…';
      $('#modal-content').querySelector('p').textContent='Building a quick lesson and practice questions from your notes.';
      const generated=await generateStudy(text,file.name);
      const existing=state.sets.find(s=>s.name===file.name);
      const set={...generated,id:existing?.id||crypto.randomUUID(),name:file.name,pageCount,createdAt:existing?.createdAt||Date.now(),lastStudied:Date.now()};
      state.sets=[set,...state.sets.filter(s=>s.id!==set.id)];save();showLesson(set);
    } catch(err){$('#study-modal').classList.add('hidden');toast(err.message||'Something went wrong reading that PDF.',true);}
    $('#pdf-input').value='';
  }
  function openSet(id) { const set=state.sets.find(s=>s.id===id);if(!set)return;set.lastStudied=Date.now();activeSet=set;showLesson(set); }
  function showLesson(set) {
    activeSet=set;
    const concepts=(set.concepts||[]).length?`<div class="concept-chips">${set.concepts.slice(0,6).map(t=>`<span class="concept-chip">${escapeHtml(t)}</span>`).join('')}</div>`:'';
    $('#modal-content').innerHTML=`<div class="modal-kicker">${escapeHtml(set.subject||'YOUR STUDY SET')}</div><h2 id="study-title">Let’s make this make sense.</h2><p class="modal-subtitle">A quick lesson first. Then you’ll practice remembering what matters.</p><div class="lesson-box"><h3>The big picture</h3><p>${escapeHtml(set.lesson||'Start with the key ideas from your notes, then try to explain them in your own words.')}</p></div>${concepts}<div class="quiz-actions"><button id="start-quiz">I’m ready to practice →</button></div>${set.note?`<div class="pdf-note">${escapeHtml(set.note)}</div>`:''}`;
    $('#study-modal').classList.remove('hidden');$('#start-quiz').addEventListener('click',()=>startQuiz(set));
  }
  function startQuiz(set) {activeSet=set;activeQuestion=0;answers=[];renderQuestion();}
  function renderQuestion() {
    const q=activeSet.questions[activeQuestion];if(!q){finishQuiz();return;}
    const chosen=answers[activeQuestion];
    const options=q.options.map((option,i)=>{
      let cls='';if(chosen){if(i===q.correct)cls='correct';else if(i===chosen.index)cls='incorrect';}
      return `<button class="answer-option ${cls}" data-answer="${i}" ${chosen?'disabled':''}>${escapeHtml(option)}</button>`;
    }).join('');
    const feedback=chosen?`<div class="feedback-box ${chosen.correct?'good':'try-again'}"><strong>${chosen.correct?'That’s it!':'Not quite yet.'}</strong> ${escapeHtml(q.explanation||'Take a look back at the key idea, then try it again next time.')}</div>`:'';
    $('#modal-content').innerHTML=`<div class="modal-kicker">${escapeHtml(activeSet.subject||'PRACTICE')}</div><h2 id="study-title">Quick recall builds strong memories.</h2><div class="quiz-topline"><span class="quiz-progress-label">Question ${activeQuestion+1} of ${activeSet.questions.length}</span><div class="quiz-progress"><span style="width:${(activeQuestion/activeSet.questions.length)*100}%"></span></div><span class="quiz-progress-label">${Math.round(activeQuestion/activeSet.questions.length*100)}%</span></div><div class="quiz-card"><div class="question-tag">THINK IT THROUGH</div><h3>${escapeHtml(q.prompt)}</h3><div class="answer-list">${options}</div>${feedback}<div class="quiz-actions"><button id="next-question" ${chosen?'':'disabled'}>${activeQuestion===activeSet.questions.length-1?'See my results':'Next question →'}</button></div></div>`;
    $('#modal-content').querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',()=>selectAnswer(Number(b.dataset.answer))));
    $('#next-question').addEventListener('click',()=>{if(answers[activeQuestion]){activeQuestion++;renderQuestion();}});
  }
  function selectAnswer(index) {const q=activeSet.questions[activeQuestion];answers[activeQuestion]={index,correct:index===q.correct};renderQuestion();}
  function finishQuiz() {
    const correct=answers.filter(a=>a?.correct).length;const total=activeSet.questions.length;const pct=Math.round(correct/total*100);
    state.scores.push(pct);state.minutes=(state.minutes||0)+Math.max(1,Math.round((Date.now()-startTime)/60000));state.weeklyDays=[...new Set([...(state.weeklyDays||[]),dateKey()])];activeSet.lastStudied=Date.now();save();
    const misses=activeSet.questions.map((q,i)=>({q,a:answers[i]})).filter(x=>!x.a?.correct);
    const review=misses.length?`<div class="review-list"><b>Ideas to revisit</b>${misses.map(x=>`<div class="review-item"><span>↗</span> ${escapeHtml(x.q.prompt)} — ${escapeHtml(x.q.explanation)}</div>`).join('')}</div>`:'<div class="review-list"><b>You got every question.</b><div class="review-item">Try again tomorrow to help these ideas stick for longer.</div></div>';
    $('#modal-content').innerHTML=`<div class="complete-box"><div class="complete-icon">${pct>=70?'✦':'↗'}</div><div class="modal-kicker">SESSION COMPLETE</div><h2>Look at you, putting in the work.</h2><div class="score-big">${correct} / ${total}</div><p>${pct>=80?'You’ve got a strong start on this material. A quick review later will help it stick.':pct>=50?'You’re building it. Take another look at the tricky ideas below and come back for a rematch.':'That was useful practice. Learning starts with finding what to review next.'}</p>${review}<button class="primary-btn" id="finish-done">Back to my study room</button></div>`;
    $('#finish-done').addEventListener('click',()=>{$('#study-modal').classList.add('hidden');switchView('home');});
  }
  function closeModal(){$('#study-modal').classList.add('hidden');}

  $('#today-label').textContent=dayLabel();
  document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $('#pdf-input').addEventListener('change',e=>handleFile(e.target.files[0]));
  $('#upload-cta').addEventListener('click',()=>$('#pdf-input').click());
  $('#library-upload').addEventListener('click',()=>$('#pdf-input').click());
  const drop=$('#drop-zone');
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover');}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover');}));
  drop.addEventListener('drop',e=>handleFile(e.dataTransfer.files[0]));
  $('#modal-close').addEventListener('click',closeModal);$('#study-modal').addEventListener('click',e=>{if(e.target.id==='study-modal')closeModal();});
  $('#help-button').addEventListener('click',()=>$('#help-modal').classList.remove('hidden'));$('#help-close').addEventListener('click',()=>$('#help-modal').classList.add('hidden'));$('#help-done').addEventListener('click',()=>$('#help-modal').classList.add('hidden'));$('#help-modal').addEventListener('click',e=>{if(e.target.id==='help-modal')$('#help-modal').classList.add('hidden');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();$('#help-modal').classList.add('hidden');}});
  const originalStartQuiz=startQuiz;startQuiz=(set)=>{startTime=Date.now();originalStartQuiz(set);};
  renderStats();renderRecent();
})();

