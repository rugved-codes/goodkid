(() => {
  const $ = (selector) => document.querySelector(selector);
  const storageKey = 'goodkid-study-v2';
  let state = loadState();
  let activeSet = null;
  let activeQuestions = [];
  let activeQuestion = 0;
  let answers = [];
  let sessionStartedAt = 0;
  let flashcards = [];
  let flashcardIndex = 0;
  let flashcardRevealed = false;
  let toastTimer;

  function loadState() {
    try { return { sets: [], minutes: 0, weeklyDays: [], scores: [], sessions: [], ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; }
    catch { return { sets: [], minutes: 0, weeklyDays: [], scores: [], sessions: [] }; }
  }
  function save() { localStorage.setItem(storageKey, JSON.stringify(state)); renderStats(); renderRecent(); }
  function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
  function toast(message, error = false) { const el=$('#toast');el.textContent=message;el.classList.toggle('error',error);el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3000); }
  function dateKey(d = new Date()) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
  function dayLabel() { return new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric'}).format(new Date()); }
  function weekStart() { const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return d; }
  function dateFromKey(value) { const [year,month,day]=String(value).split('-').map(Number);return new Date(year,month-1,day); }
  function formatDuration(seconds) { return seconds<60?`${seconds}s`:`${Math.round(seconds/60)} min`; }
  function renderStats() {
    const sessions=state.sessions||[];const totalSeconds=(Number(state.minutes)||0)*60+sessions.reduce((sum,session)=>sum+(Number(session.seconds)||0),0);
    const totalMinutes=Math.floor(totalSeconds/60);$('#stat-minutes').innerHTML=`${totalMinutes===0&&totalSeconds>0?'<1':totalMinutes}<span> min</span>`;
    $('#stat-sets').innerHTML=`${state.sets.length}<span> ${state.sets.length===1?'set':'sets'}</span>`;
    $('#material-count').textContent=state.sets.length;$('#material-bubble').textContent=state.sets.length;
    const scores=state.scores||[];
    if(scores.length){$('#stat-recall').innerHTML=`${Math.round(scores.reduce((a,b)=>a+b,0)/scores.length)}<span>%</span>`;$('#recall-trend').textContent=`Across ${scores.length} ${scores.length===1?'session':'sessions'}`;$('#recall-detail').textContent='Average score from your completed quizzes.';}
    else {$('#stat-recall').innerHTML='—<span></span>';$('#recall-trend').textContent='Complete a focus session to start';$('#recall-detail').textContent='Your completed quiz sessions appear here.';}
    const start=weekStart();const dates=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return d;});
    const dayKeys=dates.map(dateKey);const daySeconds=Object.fromEntries(dayKeys.map(k=>[k,0]));
    sessions.forEach(s=>{if(Object.hasOwn(daySeconds,s.day))daySeconds[s.day]+=Number(s.seconds)||0;});
    const maxSeconds=Math.max(0,...Object.values(daySeconds));
    $('#weekly-chart').innerHTML=dates.map(d=>{const key=dateKey(d),seconds=daySeconds[key],height=maxSeconds?Math.max(7,seconds/maxSeconds*100):4;const today=key===dateKey();return `<i class="${today?'today-bar':''}" style="height:${height}%" title="${d.toLocaleDateString(undefined,{weekday:'long'})}: ${formatDuration(seconds)}"></i>`;}).join('');
    $('#chart-days').innerHTML=dates.map(d=>`<span class="${dateKey(d)===dateKey()?'today':''}">${new Intl.DateTimeFormat(undefined,{weekday:'narrow'}).format(d)}</span>`).join('');
    const weekSessions=sessions.filter(s=>dayKeys.includes(s.day));$('#time-trend').textContent=weekSessions.length?`${weekSessions.length} ${weekSessions.length===1?'session':'sessions'} this week`:'Your weekly study time';
    const weekDays=new Set([...(state.weeklyDays||[]),...sessions.map(s=>s.day)].filter(d=>{const parsed=dateFromKey(d);return !Number.isNaN(parsed.getTime())&&parsed>=start;}));
    $('#weekly-progress').textContent=`${Math.min(weekDays.size,5)} / 5 days`;$('.focus-progress span').style.width=`${Math.min(weekDays.size*20,100)}%`;
    $('#week-label').textContent=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(weekStart());
    const days=new Set([...(state.weeklyDays||[]),...sessions.map(s=>s.day)]);let d=new Date(),streak=0;if(!days.has(dateKey(d)))d.setDate(d.getDate()-1);while(days.has(dateKey(d))){streak++;d.setDate(d.getDate()-1);}$('#streak-days').textContent=`${streak} day streak`;
  }
  function renderRecent() {
    const recent=$('#recent-list');
    if(!state.sets.length){recent.innerHTML='<div class="empty-recent">Your study sets will show up here.</div>';return;}
    recent.innerHTML=state.sets.slice(0,5).map(s=>`<button class="recent-item" data-open="${escapeHtml(s.id)}"><span class="recent-file">▤</span><span>${escapeHtml(s.name)}</span></button>`).join('');
    recent.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openSet(b.dataset.open)));
  }
  function renderLibrary() {
    const grid=$('#library-grid');
    if(!state.sets.length){grid.innerHTML='<div class="library-empty"><div style="font-size:22px;color:#91ad83">✳</div><b>Your next great study session starts here.</b><span>Upload a class PDF and Goodkid will pull out the topics worth your time.</span></div>';return;}
    grid.innerHTML=state.sets.map(s=>`<article class="material-card" data-open="${escapeHtml(s.id)}"><div class="file-mark">▤</div><h3 title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</h3><p>${s.pageCount||1} pages · ${s.topics?.length||0} priority topics</p><div class="card-bottom"><span>${escapeHtml(s.subject||'Study set')}</span><span>Open map →</span></div></article>`).join('');
    grid.querySelectorAll('[data-open]').forEach(c=>c.addEventListener('click',()=>openSet(c.dataset.open)));
  }
  function switchView(view) {
    const home=view==='home';$('#home-view').classList.toggle('hidden',!home);$('#library-view').classList.toggle('hidden',home);$('#crumb-current').textContent=home?'Overview':'My materials';
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if(!home)renderLibrary();
  }
  function normalizeText(text) { return text.replace(/\s+/g,' ').replace(/([a-z])[-\u00ad]\s+([a-z])/gi,'$1$2').trim(); }
  async function extractPdf(file) {
    if(!window.pdfjsLib)throw new Error('The PDF reader did not load. Check your connection and try again.');
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;const pages=[];
    for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();pages.push(normalizeText(content.items.map(item=>item.str).join(' ')));}
    return {pages,pageCount:pdf.numPages};
  }
  function pageSamples(pages,budget=56000) {
    const total=pages.reduce((n,p)=>n+p.length,0);if(total<=budget)return pages.map((text,i)=>`[Page ${i+1}] ${text}`);
    const perPage=Math.max(180,Math.floor(budget/pages.length));
    return pages.map((text,i)=>{
      if(text.length<=perPage)return `[Page ${i+1}] ${text}`;
      const chunk=Math.floor((perPage-18)/3),middle=Math.floor(text.length/2);
      const start=text.slice(0,chunk),center=text.slice(Math.max(chunk,middle-Math.floor(chunk/2)),middle+Math.ceil(chunk/2)),end=text.slice(-chunk);
      return `[Page ${i+1}] ${start} … ${center} … ${end}`;
    });
  }
  function sentencesFromPages(pages) {
    const result=[];
    pages.forEach((page,index)=>{
      const parts=(page.match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[]).map(s=>s.trim()).filter(s=>s.length>=45&&s.length<=420);
      parts.forEach(text=>result.push({text,page:index+1}));
    });
    return result;
  }
  function makeFallback(pages,fileName,focus,minutes) {
    const stop=new Set('about above after again against along also among another around because before being below between both could does doing during each either enough every from further have having into itself just made make many may might more most much other over same should since some such than that their them then there these they this those through under until very what when where which while will with would your you into page pages chapter figure table using used use'.split(' '));
    const candidates=sentencesFromPages(pages),freq={};
    candidates.forEach(({text})=>new Set(text.toLowerCase().match(/[a-z][a-z'-]{3,}/g)||[]).forEach(w=>{if(!stop.has(w))freq[w]=(freq[w]||0)+1;}));
    const focusWords=(focus.toLowerCase().match(/[a-z][a-z'-]{2,}/g)||[]).filter(w=>!stop.has(w));
    const cue=/\b(is defined as|refers to|means that|because|therefore|as a result|in contrast|important|function of|process of|causes|leads to|is called)\b/i;
    const score=entry=>{
      const words=(entry.text.toLowerCase().match(/[a-z][a-z'-]{3,}/g)||[]).filter(w=>!stop.has(w));
      const distinct=new Set(words);let value=[...distinct].reduce((sum,w)=>sum+Math.min(freq[w]||0,5),0)/Math.sqrt(Math.max(distinct.size,1));
      if(cue.test(entry.text))value+=2.4;
      value+=focusWords.filter(w=>entry.text.toLowerCase().includes(w)).length*4;
      if(/\b(for example|figure|table|copyright|references|contents)\b/i.test(entry.text))value-=3;
      return value;
    };
    const ranked=candidates.map(entry=>({...entry,score:score(entry)})).sort((a,b)=>b.score-a.score);
    const terms=Object.entries(freq).filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([word])=>word);
    const used=new Set();const topics=[];
    for(const term of terms){
      const evidence=ranked.filter(e=>!used.has(e.text)&&new RegExp(`\\b${term}\\b`,'i').test(e.text)).slice(0,2);
      if(!evidence.length)continue;
      evidence.forEach(e=>used.add(e.text));
      const name=term.charAt(0).toUpperCase()+term.slice(1);
      topics.push({title:name,importance:Math.min(5,Math.max(2,Math.round(freq[term]/Math.max(1,candidates.length/10))+2)),why:`This idea appears across the notes. Start here, then check the supporting detail on page ${evidence[0].page}.`,sourcePages:[...new Set(evidence.map(e=>e.page))],teach:evidence.map(e=>e.text).join(' '),flashcards:evidence.map(e=>({front:`What should you remember about ${name}?`,back:e.text,sourcePage:e.page})),_evidence:evidence});
      if(topics.length>=8)break;
    }
    if(!topics.length&&ranked.length){const e=ranked[0];topics.push({title:'Main idea',importance:4,why:'This is one of the clearest complete ideas in the document.',sourcePages:[e.page],teach:e.text,flashcards:[{front:'What is the main idea?',back:e.text,sourcePage:e.page}],_evidence:[e]});}
    topics.sort((a,b)=>b.importance-a.importance||a.title.localeCompare(b.title));
    const evidencePool=ranked.slice(0,Math.max(topics.length,5));
    topics.forEach((topic,i)=>{
      const target=topic._evidence[0];
      const other=evidencePool.filter(e=>e.text!==target.text).map(e=>e.text.slice(0,230));
      const opts=[target.text.slice(0,230),...other.slice(i,i+3)];while(opts.length<4)opts.push('This detail is not stated in the uploaded PDF.');
      const shuffled=opts.slice(0,4).map((text,j)=>({text,correct:j===0})).sort(()=>Math.random()-.5);
      topic.questions=[{prompt:`Which statement best explains ${topic.title}, according to your PDF?`,options:shuffled.map(x=>x.text),correct:shuffled.findIndex(x=>x.correct),explanation:`The notes say: “${target.text}” Review page ${target.page} for the original context.`,sourcePage:target.page}];
      delete topic._evidence;
    });
    const limited=topics.slice(0,6);
    return {title:fileName.replace(/\.pdf$/i,'').replace(/[_-]+/g,' ')||'Your study set',subject:focus||'Your PDF',overview:'Here are the ideas that repeat or carry the most meaning in your notes. Start with the first few; they are ranked to help you spend your study time well.',topics:limited,minutes,source:'local',note:'AI isn’t connected yet, so this is a quick on-device topic sort. Add GEMINI_API_KEY in Vercel for AI-ranked topics, teaching, and stronger practice questions.'};
  }
  async function generateStudy(pages,fileName,focus,minutes) {
    const sample=pageSamples(pages);const local=makeFallback(pages,fileName,focus,minutes);
    try{
      const response=await fetch('/api/study',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pages:sample,fileName,focus,minutes})});
      if(!response.ok){local.note=response.status===503?'AI study generation is not enabled on this deployment. Confirm GEMINI_API_KEY is set for Production in Vercel, then redeploy.':'AI could not finish this study map. Check the Vercel function logs and confirm GEMINI_API_KEY is valid; Goodkid made a quick local topic sort instead.';return local;}
      const data=await response.json();if(!Array.isArray(data.topics)||!data.topics.length){local.note='AI returned an incomplete study map, so Goodkid made a quick local topic sort instead. Check the Vercel function logs.';return local;}
      return {...local,...data,source:'ai'};
    }catch{local.note='Goodkid could not reach its AI study service. Check the Vercel deployment, then try uploading this PDF again. A quick local topic sort is ready in the meantime.';return local;}
  }
  function showProcessing(title,message){$('#modal-content').innerHTML=`<div class="processing"><div class="spinner"></div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><div class="pdf-note">Goodkid reads your PDF and samples pages across the whole document.</div></div>`;$('#study-modal').classList.remove('hidden');}
  async function handleFile(file){
    if(!file)return;
    if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf')){toast('Please choose a PDF file.',true);return;}
    if(file.size>20*1024*1024){toast('That PDF is over 20 MB. Try a smaller file.',true);return;}
    showProcessing('Finding the important ideas…','Scanning across your notes, not just the first few pages.');
    try{
      const {pages,pageCount}=await extractPdf(file);if(pages.join(' ').length<100)throw new Error('This PDF has too little selectable text. Scanned pages are not supported yet.');
      $('#modal-content').querySelector('h2').textContent='Building your focus plan…';$('#modal-content').querySelector('p').textContent='Ranking topics and building practice from your PDF.';
      const focus=$('#exam-focus').value.trim();const minutes=Number($('#study-time').value);const generated=await generateStudy(pages,file.name,focus,minutes);
      const existing=state.sets.find(s=>s.name===file.name);const set={...generated,id:existing?.id||crypto.randomUUID(),name:file.name,pageCount,createdAt:existing?.createdAt||Date.now(),lastStudied:Date.now()};
      state.sets=[set,...state.sets.filter(s=>s.id!==set.id)];save();showTopicMap(set);
    }catch(err){$('#study-modal').classList.add('hidden');toast(err.message||'Something went wrong reading that PDF.',true);}
    $('#pdf-input').value='';
  }
  function normalizeSet(set){
    if(!Array.isArray(set.topics)||!set.topics.length)set.topics=[{title:set.subject||'Main idea',importance:4,why:'Review this study set.',sourcePages:[],teach:set.lesson||'',questions:set.questions||[],flashcards:[]}];
    set.topics.sort((a,b)=>(b.importance||0)-(a.importance||0));return set;
  }
  function openSet(id){const set=state.sets.find(s=>s.id===id);if(!set)return;normalizeSet(set);set.lastStudied=Date.now();showTopicMap(set);}
  function showTopicMap(set){
    activeSet=normalizeSet(set);
    const topics=set.topics.map((topic,index)=>`<article class="topic-card"><div class="topic-rank">${String(index+1).padStart(2,'0')}</div><div class="topic-main"><div class="topic-title-row"><h3>${escapeHtml(topic.title)}</h3><span class="priority-label">${index===0?'START HERE':index<3?'HIGH VALUE':'NEXT UP'}</span></div><p class="topic-why">${escapeHtml(topic.why||'A key idea from your PDF.')}</p><details class="topic-lesson"><summary>Teach me this idea</summary><p>${escapeHtml(topic.teach||'Review the supporting passage in your notes.')}</p></details><div class="topic-meta"><span class="importance-dots">${'●'.repeat(Math.min(5,Math.max(1,topic.importance||3)))}${'○'.repeat(5-Math.min(5,Math.max(1,topic.importance||3)))}</span><span>${topic.sourcePages?.length?`PDF page${topic.sourcePages.length===1?'':'s'} ${topic.sourcePages.slice(0,4).join(', ')}`:'From your PDF'}</span></div><div class="topic-actions"><button class="topic-study" data-study-topic="${index}">Practice this topic →</button>${topic.flashcards?.length?`<button class="topic-cards" data-cards-topic="${index}">Study flashcards</button>`:''}</div></div></article>`).join('');
    const modeLabel=set.source==='ai'?'AI topic map':'QUICK TOPIC SORT';
    $('#modal-content').innerHTML=`<div class="study-map-head"><div class="map-badge">✳ &nbsp; ${modeLabel}</div><h2 id="study-title">Your ${escapeHtml(set.minutes||20)}-minute focus plan.</h2><p class="modal-subtitle">${escapeHtml(set.overview||'Start with the ideas most worth your time. Topics are ranked by importance, not page order.')}</p><div class="map-stats"><span>✳ &nbsp; ${set.topics.length} priority topics</span><span>▤ &nbsp; ${set.pageCount} PDF pages scanned</span><span>◷ &nbsp; ${set.minutes||20} min</span></div></div><div class="topic-list">${topics}</div><div class="map-footer">${set.note?`<p class="source-note">${escapeHtml(set.note)}</p>`:''}<button class="map-start" id="start-focus">Start my ${escapeHtml(set.minutes||20)}-minute focus session <span>→</span></button></div>`;
    $('#study-modal').classList.remove('hidden');
    $('#start-focus').addEventListener('click',()=>startSession(set));
    $('#modal-content').querySelectorAll('[data-study-topic]').forEach(b=>b.addEventListener('click',()=>startSession(set,Number(b.dataset.studyTopic))));
    $('#modal-content').querySelectorAll('[data-cards-topic]').forEach(b=>b.addEventListener('click',()=>startFlashcards(set.topics[Number(b.dataset.cardsTopic)])));
  }
  function startSession(set,onlyIndex=null){
    activeSet=set;sessionStartedAt=Date.now();
    const count=onlyIndex===null?(set.minutes<=10?3:set.minutes<=20?5:7):1;
    const chosen=onlyIndex===null?set.topics.slice(0,count):[set.topics[onlyIndex]];
    const queue=[];const max=Math.max(...chosen.map(t=>(t.questions||[]).length),0);
    for(let n=0;n<max;n++)chosen.forEach(topic=>(topic.questions||[])[n]&&queue.push({...topic.questions[n],topicTitle:topic.title,importance:topic.importance}));
    activeQuestions=queue.length?queue:chosen.map(t=>({prompt:`What is the most important idea about ${t.title}?`,options:[t.teach,'This idea does not appear in the uploaded PDF.','The notes give no information about it.','This is unrelated to the topic.'],correct:0,explanation:t.teach,topicTitle:t.title}));
    activeQuestion=0;answers=[];renderQuestion();
  }
  function renderQuestion(){
    const q=activeQuestions[activeQuestion];if(!q){finishQuiz();return;}const chosen=answers[activeQuestion];
    const options=q.options.map((option,i)=>{let cls='';if(chosen){if(i===q.correct)cls='correct';else if(i===chosen.index)cls='incorrect';}return `<button class="answer-option ${cls}" data-answer="${i}" ${chosen?'disabled':''}>${escapeHtml(option)}</button>`;}).join('');
    const feedback=chosen?`<div class="feedback-box ${chosen.correct?'good':'try-again'}"><strong>${chosen.correct?'That’s right.':'Not quite — here’s why.'}</strong><div class="answer-key"><b>Correct answer</b><span>${escapeHtml(q.options[q.correct])}</span></div><p>${escapeHtml(q.explanation||'Review the matching topic in your PDF and say the idea in your own words.')}</p>${q.sourcePage?` <span class="answer-source">From PDF page ${q.sourcePage}</span>`:''}</div>`:'';
    $('#modal-content').innerHTML=`<div class="quiz-head"><div><div class="modal-kicker">${escapeHtml(q.topicTitle||'FOCUSED PRACTICE')}</div><h2 id="study-title">One idea at a time.</h2></div><button class="text-button" id="exit-session">Exit</button></div><div class="quiz-topline"><span class="quiz-progress-label">${activeQuestion+1} / ${activeQuestions.length}</span><div class="quiz-progress"><span style="width:${((activeQuestion+1)/activeQuestions.length)*100}%"></span></div><span class="quiz-progress-label">FOCUS</span></div><div class="quiz-card"><div class="question-tag">TRY FROM MEMORY</div><h3>${escapeHtml(q.prompt)}</h3><div class="answer-list">${options}</div>${feedback}<div class="quiz-actions"><button id="next-question" ${chosen?'':'disabled'}>${activeQuestion===activeQuestions.length-1?'See what to review':'Next idea →'}</button></div></div>`;
    $('#modal-content').querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',()=>{answers[activeQuestion]={index:Number(b.dataset.answer),correct:Number(b.dataset.answer)===q.correct,topicTitle:q.topicTitle};renderQuestion();}));
    $('#next-question').addEventListener('click',()=>{if(answers[activeQuestion]){activeQuestion++;renderQuestion();}});$('#exit-session').addEventListener('click',()=>showTopicMap(setForActive()));
  }
  function setForActive(){return activeSet;}
  function finishQuiz(){
    const correct=answers.filter(a=>a?.correct).length,total=activeQuestions.length,pct=Math.round(correct/total*100);
    recordSession({kind:'quiz',correct,total,topics:[...new Set(activeQuestions.map(q=>q.topicTitle).filter(Boolean))]});
    const misses=answers.map((a,i)=>({a,q:activeQuestions[i]})).filter(x=>!x.a?.correct);
    const rows=misses.length?misses.map(x=>`<div class="review-item"><span>↗</span> <b>${escapeHtml(x.q.topicTitle)}</b><div class="review-answer">Correct answer: ${escapeHtml(x.q.options[x.q.correct])}</div><p>${escapeHtml(x.q.explanation||x.q.prompt)}</p></div>`).join(''):'<div class="review-item">You got every question. A short review tomorrow will help these ideas stick.</div>';
    $('#modal-content').innerHTML=`<div class="complete-box"><div class="complete-icon">${pct>=70?'✦':'↗'}</div><div class="modal-kicker">FOCUS SESSION COMPLETE</div><h2>${pct>=70?'That’s real progress.':'You found what to work on next.'}</h2><div class="score-big">${correct} / ${total}</div><p>${pct>=70?'You recalled most of the high-value ideas. Come back later for a short spaced review.':'Spend a couple more minutes on the topics below, then give them another try.'}</p><div class="review-list"><b>${misses.length?'Review these high-value ideas':'Keep it fresh'}</b>${rows}</div><div class="complete-actions"><button class="secondary-btn" id="back-to-map">Topic map</button><button class="primary-btn" id="finish-done">Done</button></div></div>`;
    $('#back-to-map').addEventListener('click',()=>showTopicMap(activeSet));$('#finish-done').addEventListener('click',()=>{$('#study-modal').classList.add('hidden');switchView('home');});
  }
  function recordSession({kind,correct=0,total=0,topics=[]}){
    const seconds=Math.max(1,Math.round((Date.now()-sessionStartedAt)/1000));const day=dateKey();
    state.sessions=state.sessions||[];state.sessions.push({id:crypto.randomUUID(),kind,day,seconds,correct,total,topics});
    state.weeklyDays=[...new Set([...(state.weeklyDays||[]),day])];if(total>0)state.scores=[...(state.scores||[]),Math.round(correct/total*100)];save();
  }
  function startFlashcards(topic){flashcards=topic.flashcards||[];flashcardIndex=0;flashcardRevealed=false;sessionStartedAt=Date.now();renderFlashcard(topic);}
  function renderFlashcard(topic){
    const card=flashcards[flashcardIndex];if(!card){recordSession({kind:'flashcards',topics:[topic.title]});showTopicMap(activeSet);return;}
    $('#modal-content').innerHTML=`<div class="quiz-head"><div><div class="modal-kicker">${escapeHtml(topic.title)} · QUICK CARDS</div><h2 id="study-title">${flashcardIndex+1} of ${flashcards.length}</h2></div><button class="text-button" id="cards-back">Topic map</button></div><div class="flashcard" role="button" tabindex="0" id="flashcard"><div class="question-tag">${flashcardRevealed?'REMEMBER THIS':'TRY TO RECALL'}</div><p>${escapeHtml(flashcardRevealed?card.back:card.front)}</p>${card.sourcePage?`<small>PDF page ${card.sourcePage}</small>`:''}<span class="flash-hint">${flashcardRevealed?'Tap next when you’re ready':'Think first, then reveal'}</span></div><div class="quiz-actions"><button id="flip-card">${flashcardRevealed?(flashcardIndex===flashcards.length-1?'Back to topics':'Next card →'):'Show answer'}</button></div>`;
    $('#cards-back').addEventListener('click',()=>showTopicMap(activeSet));$('#flip-card').addEventListener('click',()=>{if(!flashcardRevealed)flashcardRevealed=true;else{flashcardIndex++;flashcardRevealed=false;}renderFlashcard(topic);});$('#flashcard').addEventListener('click',()=>{if(!flashcardRevealed){flashcardRevealed=true;renderFlashcard(topic);}});
  }
  function closeModal(){$('#study-modal').classList.add('hidden');}

  $('#today-label').textContent=dayLabel();document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $('#pdf-input').addEventListener('change',e=>handleFile(e.target.files[0]));$('#upload-cta').addEventListener('click',()=>$('#pdf-input').click());$('#library-upload').addEventListener('click',()=>$('#pdf-input').click());
  const drop=$('#drop-zone');['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('dragover');}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('dragover');}));drop.addEventListener('drop',e=>handleFile(e.dataTransfer.files[0]));
  $('#modal-close').addEventListener('click',closeModal);$('#study-modal').addEventListener('click',e=>{if(e.target.id==='study-modal')closeModal();});
  $('#help-button').addEventListener('click',()=>$('#help-modal').classList.remove('hidden'));$('#help-close').addEventListener('click',()=>$('#help-modal').classList.add('hidden'));$('#help-done').addEventListener('click',()=>$('#help-modal').classList.add('hidden'));$('#help-modal').addEventListener('click',e=>{if(e.target.id==='help-modal')$('#help-modal').classList.add('hidden');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();$('#help-modal').classList.add('hidden');}});
  renderStats();renderRecent();
})();

