(() => {
  'use strict';
  const D = window.LHPDomain;
  const KEY = 'lhp_v2';

  const COACH_QUOTA_KEY = 'lhp_gemini_free_usage_v1';
  const FREE_REFERENCE_RPD = 500;
  function pacificDay(date=new Date()) {
    return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  }
  function quotaResetLabel() {
    const now=new Date(), day=pacificDay(now);
    let next=new Date(now.getTime()+60*60*1000);
    while(pacificDay(next)===day) next=new Date(next.getTime()+60*60*1000);
    return next.toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'});
  }
  function coachUsage() {
    try { const saved=JSON.parse(localStorage.getItem(COACH_QUOTA_KEY)||'null'); if(saved&&saved.day===pacificDay()&&Number.isFinite(saved.count)) return saved; } catch {}
    return {day:pacificDay(),count:0};
  }
  function recordCoachRequest() {
    const usage=coachUsage(); usage.count++;
    try { localStorage.setItem(COACH_QUOTA_KEY,JSON.stringify(usage)); } catch {}
  }
  function coachQuotaMarkup() {
    const usage=coachUsage(), remaining=Math.max(0,FREE_REFERENCE_RPD-usage.count), percent=Math.min(100,usage.count/FREE_REFERENCE_RPD*100);
    const warning=percent>=90?'ใกล้ถึงเพดานอ้างอิงแล้ว':percent>=75?'เริ่มใช้โควต้าค่อนข้างมาก':'ยังอยู่ในช่วงใช้งานปกติ';
    return '<div class="gemini-quota"><div class="quota-heading"><b>Gemini · Free Tier</b><span>'+warning+'</span></div><div class="quota-numbers"><strong>'+usage.count.toLocaleString('th-TH')+'</strong><span>คำขอจากเบราว์เซอร์นี้วันนี้</span><strong>'+remaining.toLocaleString('th-TH')+'</strong><span>คงเหลือโดยประมาณ*</span></div><div class="quota-track"><i style="width:'+percent+'%"></i></div><small>*เทียบกับตัวเลขอ้างอิง 500 คำขอ/วัน ไม่ใช่ยอดคงเหลือจริงของ Google โควต้าจริงขึ้นกับโมเดลและการใช้งานทั้งโปรเจกต์</small><small>รีเซ็ตตามเวลาเที่ยงคืนแปซิฟิก · เวลาไทยโดยประมาณ: '+esc(quotaResetLabel())+'</small><small class="quota-safety">Free Tier ไม่มีค่าใช้จ่ายตามโควต้าฟรี หากเกินขีดจำกัดจะได้รับข้อผิดพลาดและต้องรอรีเซ็ต ระบบไม่สลับไปใช้แพ็กเกจเสียเงิน</small></div>';
  }
  function renderCoachQuotaOnly(){const node=$('.gemini-quota');if(node)node.outerHTML=coachQuotaMarkup();}

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const today = () => D.localDate();
  const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmtDate = value => value ? new Intl.DateTimeFormat('th-TH',{dateStyle:'medium'}).format(D.parseDate(value)) : '—';
  const fmtHours = mins => (Number(mins || 0) / 60).toLocaleString('th-TH',{maximumFractionDigits:1}) + ' ชม.';
  const defaultData = () => ({
    version: 2, activities: [], timeLogs: [], meals: [], workouts: [], measurements: [], coachMessages: [], workoutPlans: [], readinessLogs: [],
    trainingProfile: { age: 22, sex: '', goal: 'เพิ่มกล้ามเนื้อและสร้างรูปร่าง', experience: 'มือใหม่', equipment: 'ไม่มีอุปกรณ์', daysPerWeek: 3, sessionMinutes: 40, limitations: '', preferences: '', shareWithGemini: true },
    targets: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    preferences: { timezone: 'Asia/Bangkok', weekStartsOn: 1, units: 'metric' }
  });
  function normalizeData(saved) {
    return saved && saved.version === 2 ? { ...defaultData(), ...saved } : defaultData();
  }
  let data = defaultData();
  let page = 'overview';
  let selectedDate = today();
  let reportPeriod = 'week';
  let editingActivity = null;
  let editingTimeLog = null;
  let editingMeal = null;
  let editingMeasurement = null;
  let editingReadiness = null;
  let notice = '';
  const legacyCount = ['lhp_activities','lhp_logs','lhp_foods','lhp_body'].reduce((count,key) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return count + (Array.isArray(value) ? value.length : value && typeof value === 'object' ? 1 : 0); } catch { return count; }
  },0);
  let saveQueue = Promise.resolve();
  function save(message = 'บันทึกข้อมูลแล้ว') {
    notice = 'กำลังบันทึกข้อมูล…';
    render();
    const snapshot = JSON.parse(JSON.stringify(data));
    saveQueue = saveQueue.catch(() => {}).then(() => window.LHPStorage.save(snapshot)).then(result => {
      notice = result && result.fallback ? message + ' (โหมดสำรองของเบราว์เซอร์)' : message;
      render();
    }).catch(error => {
      console.error('บันทึกข้อมูลไม่สำเร็จ', error);
      notice = 'บันทึกไม่สำเร็จ กรุณาส่งออกข้อมูลสำรองและตรวจสอบพื้นที่จัดเก็บ';
      render();
      alert('บันทึกไม่สำเร็จ ข้อมูลที่แก้ไขครั้งนี้ยังไม่ยืนยันว่าถูกจัดเก็บ กรุณาส่งออกข้อมูลสำรองและลองใหม่');
    });
  }
  function nav() {
    const items = [['overview','ภาพรวม','layout-dashboard'],['schedule','ตารางชีวิต','calendar-days'],['time','บันทึกเวลา','clock'],['exercise','ออกกำลังกาย','dumbbell'],['nutrition','โภชนาการ','utensils'],['body','ข้อมูลร่างกาย','activity'],['reports','รายงาน','chart-no-axes-combined'],['settings','ตั้งค่า','settings']];
    $('#nav').innerHTML = items.map(([id,label]) => '<button type="button" class="nav-item '+(page===id?'active':'')+'" data-page="'+id+'">'+label+'</button>').join('');
  }
  function header() {
    $('#today-label') && ($('#today-label').textContent = fmtDate(selectedDate));
    $('#global-date').value = selectedDate;
    $('#status').textContent = 'บันทึกในอุปกรณ์นี้';
    $('#notice').textContent = notice;
  }
  function activityList(date) {
    return data.activities.filter(a => a.date === date).sort((a,b) => a.start.localeCompare(b.start));
  }
  function dateInput(value, name='date') {
    return '<label>วันที่<input type="date" name="'+name+'" value="'+esc(value || selectedDate)+'" required></label>';
  }
  function categoryOptions(value) {
    return D.CATEGORIES.map(c => '<option '+(c===value?'selected':'')+' value="'+esc(c)+'">'+esc(c)+'</option>').join('');
  }
  function card(title, body, extra='') { return '<section class="panel '+extra+'"><div class="panel-heading"><h2>'+title+'</h2></div>'+body+'</section>'; }
  function stat(label,value,sub='') { return '<article class="stat-card"><span>'+label+'</span><strong>'+value+'</strong><small>'+sub+'</small></article>'; }
  function formField(label, input) { return '<label>'+label+input+'</label>'; }
  function renderOverview() {
    const acts = activityList(selectedDate);
    const logs = D.sumTimeLogs(data.timeLogs,{start:selectedDate,end:selectedDate});
    const nutrition = D.sumNutrition(data.meals,selectedDate);
    const latest = data.measurements.filter(x=>x.date<=selectedDate).sort((a,b)=>b.date.localeCompare(a.date))[0];
    const done = acts.filter(a=>a.status==='completed').length;
    const recentWorkouts = data.workouts.filter(x=>x.date===selectedDate).length;
    const oldDataNotice = legacyCount ? '<div class="notice">พบข้อมูลจากต้นแบบเดิม '+legacyCount+' รายการ ข้อมูลเดิมยังไม่ถูกลบและยังอยู่ในเบราว์เซอร์ แต่ยังไม่ย้ายเข้าระบบใหม่นี้อัตโนมัติ เพื่อไม่กำหนดวันที่ให้ข้อมูลเก่าแทนคุณ</div>' : '';
    const upcoming = acts.filter(a=>a.status!=='completed' && a.status!=='skipped').slice(0,5);
    return '<div class="page-title"><div><p class="eyebrow">LIFE & HEALTH PLANNER</p><h1>ภาพรวมวันนี้</h1><p class="muted">วางแผนให้พอดีกับชีวิตจริง แล้วค่อย ๆ ดูความเปลี่ยนแปลงจากข้อมูลของคุณ</p></div><div class="date-control"><input type="date" id="overview-date" value="'+selectedDate+'"></div></div>'+oldDataNotice+
      '<div class="stats-grid">'+stat('กิจกรรมวันนี้',acts.length+' รายการ',done+' รายการเสร็จแล้ว')+stat('เวลาที่บันทึก',fmtHours(logs.minutes),logs.count+' รายการ')+stat('พลังงานที่บันทึก',Math.round(nutrition.calories)+' kcal',nutrition.count+' มื้อ / รายการ')+stat('การฝึกวันนี้',recentWorkouts+' ครั้ง',latest?'น้ำหนักล่าสุด '+latest.weight+' kg':'ยังไม่มีข้อมูลร่างกาย')+'</div>'+
      '<div class="content-grid">'+card('แผนวันนี้',upcoming.length?'<div class="timeline">'+upcoming.map(a=>'<div class="timeline-item"><time>'+esc(a.start)+' – '+esc(a.end)+'</time><div><b>'+esc(a.title)+'</b><small>'+esc(a.category)+' · '+esc(a.status==='completed'?'เสร็จแล้ว':a.status==='skipped'?'ข้าม':'ตามแผน')+'</small></div></div>').join('')+'</div>':'<div class="empty-state">วันนี้ยังไม่มีแผนกิจกรรม <button class="text-button" data-go="schedule">เพิ่มกิจกรรม</button></div>')+
      card('สรุปที่ควรรู้','<div class="summary-line"><span>กิจกรรมที่เสร็จแล้ว</span><b>'+done+' / '+acts.length+'</b></div><div class="progress"><i style="width:'+(acts.length?done/acts.length*100:0)+'%"></i></div><div class="summary-line"><span>โปรตีนที่บันทึก</span><b>'+Math.round(nutrition.protein)+' g</b></div><div class="summary-line"><span>เวลาจริงที่บันทึก</span><b>'+fmtHours(logs.minutes)+'</b></div><p class="muted small-text">ตัวเลขจะแสดงตามข้อมูลที่คุณบันทึกเท่านั้น ไม่เติมข้อมูลที่ขาดหาย</p>')+'</div>';
  }
  function renderSchedule() {
    const list = activityList(selectedDate);
    const rows = list.map(a => '<article class="activity-row"><div class="activity-time">'+esc(a.start)+'<span>ถึง</span>'+esc(a.end)+'</div><div class="activity-main"><b>'+esc(a.title)+'</b><small>'+esc(a.category)+(a.notes?' · '+esc(a.notes):'')+'</small><span class="status '+esc(a.status)+'">'+({planned:'ตามแผน',completed:'เสร็จแล้ว',skipped:'ข้าม',rescheduled:'เลื่อน'}[a.status]||'ตามแผน')+'</span></div><div class="row-actions"><button data-status="'+a.id+'" title="เปลี่ยนสถานะ">สถานะ</button><button data-edit-activity="'+a.id+'">แก้ไข</button><button class="danger-link" data-delete-activity="'+a.id+'">ลบ</button></div></article>').join('');
    return '<div class="page-title"><div><p class="eyebrow">PLAN YOUR DAY</p><h1>ตารางชีวิต</h1><p class="muted">เพิ่มกิจกรรมตามเวลาจริง ระบบจะแจ้งเตือนเมื่อช่วงเวลาทับซ้อนกัน</p></div><div class="date-control"><input type="date" id="schedule-date" value="'+selectedDate+'"></div></div>'+
      card('กิจกรรมวันที่ '+fmtDate(selectedDate),'<div class="activity-list">'+(rows||'<div class="empty-state">ยังไม่มีกิจกรรมในวันนี้ ลองเพิ่มกิจกรรมแรกของคุณ</div>')+'</div><button class="primary-button" id="add-activity">＋ เพิ่มกิจกรรม</button>')+
      '<div id="activity-editor"></div>';
  }
  function activityForm(a={}) {
    return card(editingActivity?'แก้ไขกิจกรรม':'เพิ่มกิจกรรม','<form id="activity-form" class="form-grid">'+formField('ชื่อกิจกรรม','<input name="title" required maxlength="90" value="'+esc(a.title||'')+'" placeholder="เช่น ออกกำลังกาย">')+dateInput(a.date||selectedDate)+formField('เวลาเริ่ม','<input type="time" name="start" required value="'+esc(a.start||'19:20')+'">')+formField('เวลาสิ้นสุด','<input type="time" name="end" required value="'+esc(a.end||'20:10')+'">')+formField('หมวดหมู่','<select name="category">'+categoryOptions(a.category||'ชีวิตประจำวัน')+'</select>')+formField('สถานะ','<select name="status">'+[['planned','ตามแผน'],['completed','เสร็จแล้ว'],['skipped','ข้าม'],['rescheduled','เลื่อน']].map(([v,l])=>'<option value="'+v+'" '+((a.status||'planned')===v?'selected':'')+'>'+l+'</option>').join('')+'</select>')+formField('หมายเหตุ (ไม่บังคับ)','<input name="notes" maxlength="200" value="'+esc(a.notes||'')+'" placeholder="รายละเอียดเพิ่มเติม">')+'<div class="form-actions"><button class="primary-button">บันทึกกิจกรรม</button><button type="button" class="secondary-button" id="cancel-activity">ยกเลิก</button></div></form>');
  }
  function renderTime() {
    const logs = data.timeLogs.filter(x=>x.date===selectedDate).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const total = D.sumTimeLogs(data.timeLogs,{start:selectedDate,end:selectedDate});
    return '<div class="page-title"><div><p class="eyebrow">ACTUAL TIME</p><h1>บันทึกเวลาที่ใช้จริง</h1><p class="muted">บันทึกเวลาที่ทำจริง แยกจากตารางที่วางแผนไว้</p></div><div class="date-control"><input type="date" id="time-date" value="'+selectedDate+'"></div></div>'+card('เพิ่มบันทึกเวลา','<form id="time-form" class="form-grid">'+dateInput(selectedDate)+formField('กิจกรรม','<input name="title" required maxlength="90" placeholder="เช่น ทำงาน / อ่านหนังสือ">')+formField('หมวดหมู่','<select name="category">'+categoryOptions('งาน')+'</select>')+formField('ระยะเวลา (นาที)','<input name="durationMinutes" type="number" min="1" max="1440" required placeholder="60">')+formField('หมายเหตุ','<input name="notes" maxlength="200" placeholder="ไม่บังคับ">')+'<div class="form-actions"><button class="primary-button">บันทึกเวลา</button></div></form>')+card('สรุปวันที่เลือก','<div class="summary-line"><span>เวลารวมที่บันทึก</span><b>'+fmtHours(total.minutes)+'</b></div><div class="summary-line"><span>จำนวนรายการ</span><b>'+total.count+'</b></div>')+card('รายการบันทึก',logs.length?logs.map(x=>'<div class="list-row"><div><b>'+esc(x.title)+'</b><small>'+esc(x.category)+' · '+esc(x.notes||'ไม่มีหมายเหตุ')+'</small></div><b>'+fmtHours(x.durationMinutes)+'</b><button class="text-button" data-edit-log="'+x.id+'">แก้ไข</button><button class="danger-link" data-delete-log="'+x.id+'">ลบ</button></div>').join(''):'<div class="empty-state">ยังไม่มีบันทึกเวลาสำหรับวันนี้</div>');
  }
  const exerciseLibrary = [
    {name:'วิดพื้นแบบพิงกำแพง',target:'อก แขน และหัวไหล่',level:'เริ่มต้น',sets:'2',reps:'8–12',rest:'60–90 วินาที',steps:'ยืนหันหน้าเข้ากำแพง วางมือระดับอก ก้าวเท้าถอยเล็กน้อย งอศอกพาลำตัวเข้าหากำแพง แล้วดันกลับ',caution:'เกร็งลำตัว ไม่แอ่นหลัง และหยุดหากเจ็บข้อมือหรือหัวไหล่'},
    {name:'สควอตแตะเก้าอี้',target:'ต้นขาและสะโพก',level:'เริ่มต้น',sets:'2',reps:'8–12',rest:'60–90 วินาที',steps:'ยืนหน้าเก้าอี้ วางเท้ากว้างประมาณหัวไหล่ ดันสะโพกไปด้านหลัง งอเข่าลงแตะเก้าอี้เบา ๆ แล้วลุกขึ้น',caution:'เข่าหันไปทิศเดียวกับปลายเท้า ไม่ฝืนช่วงการเคลื่อนไหว'},
    {name:'กลูตบริดจ์',target:'สะโพกและแกนกลางลำตัว',level:'เริ่มต้น',sets:'2',reps:'10–15',rest:'60 วินาที',steps:'นอนหงาย ชันเข่า วางเท้าราบกับพื้น เกร็งหน้าท้องและบีบก้น ยกสะโพกขึ้นจนลำตัวเป็นแนวเดียว แล้วลดลงช้า ๆ',caution:'ไม่แอ่นหลังส่วนล่างเพื่อยกให้สูงเกินไป'},
    {name:'เบิร์ดด็อก',target:'แกนกลางลำตัวและหลัง',level:'เริ่มต้น',sets:'2',reps:'6–10 ต่อข้าง',rest:'45–60 วินาที',steps:'ตั้งท่าคลาน ยกแขนข้างหนึ่งไปด้านหน้าและขาตรงข้ามไปด้านหลัง ค้างสั้น ๆ แล้วสลับข้าง',caution:'รักษาสะโพกให้นิ่ง ไม่บิดลำตัว'}
  ];
  function exerciseDiagram(item) {
    const name=String(item.exercise||'').toLowerCase();
    let pose='<circle cx="42" cy="20" r="8"/><path d="M42 29 L42 57 M42 37 L25 48 M42 37 L58 48 M42 57 L29 78 M42 57 L55 78"/>';
    if(/squat|สควอต|squat/.test(name)) pose='<circle cx="42" cy="16" r="8"/><path d="M42 25 L42 45 L27 55 L20 74 M42 45 L57 55 L64 74 M42 32 L25 40 M42 32 L59 40"/>';
    else if(/push|วิดพื้น|พิงกำแพง/.test(name)) pose='<circle cx="19" cy="43" r="7"/><path d="M27 46 L57 51 L72 70 M40 49 L35 70 M57 51 L65 32 L78 30 M40 49 L25 60"/>';
    else if(/bridge|บริดจ์/.test(name)) pose='<circle cx="16" cy="57" r="7"/><path d="M24 58 L42 38 L62 53 L73 73 M42 38 L48 67 M62 53 L67 73"/>';
    else if(/bird|เบิร์ด/.test(name)) pose='<circle cx="30" cy="30" r="7"/><path d="M37 36 L58 47 L75 40 M48 42 L30 57 L15 57 M58 47 L62 69 M58 47 L78 60"/>';
    return '<div class="exercise-visual" role="img" aria-label="ภาพแผนผังท่าฝึก '+esc(item.exercise)+'"><svg viewBox="0 0 90 90" aria-hidden="true"><path class="ground" d="M7 80 H83"/><g class="figure" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'+pose+'</g></svg><span>ภาพแผนผังท่าฝึก</span></div>';
  }

  const exerciseMediaCache = new Map();
  function loadExerciseMedia(root=document) {
    root.querySelectorAll('[data-exercise-media]').forEach(async node=>{
      const exercise=node.dataset.exerciseMedia;
      if(!exercise||node.dataset.loaded==='1') return;
      node.dataset.loaded='1';
      try {
        let media=exerciseMediaCache.get(exercise);
        if(!media) {
          const response=await fetch('/api/exercise-media?q='+encodeURIComponent(exercise));
          if(!response.ok) throw new Error('media lookup failed');
          media=await response.json(); exerciseMediaCache.set(exercise,media);
        }
        if(!node.isConnected) return;
        const images=(media.images||[]).slice(0,2);
        node.innerHTML=(images.length?'<div class="exercise-photo-grid">'+images.map(img=>'<a href="'+esc(img.pageUrl)+'" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="'+esc(img.thumbnail)+'" alt="'+esc(img.title)+'"><small>'+esc(img.title)+' · '+esc(img.license||'Wikimedia Commons')+'</small></a>').join('')+'</div>':'<p class="muted small-text">ยังไม่พบภาพที่ตรงกับท่านี้</p>')+'<a class="exercise-video-link" href="'+esc(media.youtubeSearchUrl)+'" target="_blank" rel="noopener noreferrer">▶ ค้นหาวิดีโอสาธิตบน YouTube</a><small class="media-source">ภาพจาก Wikimedia Commons · วิดีโอเปิดจาก YouTube</small>';
      } catch { if(node.isConnected) node.innerHTML='<a class="exercise-video-link" href="https://www.youtube.com/results?search_query='+encodeURIComponent(exercise+' exercise tutorial')+'" target="_blank" rel="noopener noreferrer">▶ ค้นหาวิดีโอสาธิตบน YouTube</a><small class="media-source">โหลดภาพประกอบไม่สำเร็จ</small>'; }
    });
  }

  function renderEvidenceLinks(sources,label='แหล่งอ้างอิง') {
    if(!Array.isArray(sources)||!sources.length) return '';
    const links=sources.map(source=>'<li><a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.title)+' ('+esc(source.year)+')</a> · '+esc(source.organization)+'<small>'+esc(source.evidenceType||'')+(source.limitations?' · ขอบเขต/ข้อจำกัด: '+esc(source.limitations):'')+'</small></li>').join('');
    return '<div class="evidence-links"><b>'+esc(label)+'</b><ul>'+links+'</ul></div>';
  }
  function renderEvidencePanel(plan) {
    const summary=plan?.evidenceSummary?'<p>'+esc(plan.evidenceSummary)+'</p>':'';
    const links=renderEvidenceLinks(plan?.evidence,'หลักฐานระดับการวางแผน');
    if(!summary&&!links) return '';
    const version=plan?.evidenceLibraryVersion?'<small>ฐานความรู้รุ่น '+esc(plan.evidenceLibraryVersion)+'</small>':'';
    return '<section class="evidence-panel"><b>ฐานความรู้ที่ใช้ประกอบแผน</b>'+version+summary+links+'<small>แหล่งอ้างอิงสนับสนุนหลักการหรือคำแนะนำตามขอบเขตที่ระบุ ไม่ได้ยืนยันว่าทุกท่าจะเหมาะกับทุกคน</small></section>';
  }
  function renderPlanTable(plan) {
    const evidencePanel=renderEvidencePanel(plan);
    if(plan.restDay) return '<div class="notice subtle">วันนี้เป็นวันพักหรือฟื้นตัว</div>'+evidencePanel;
    const rows=(plan.items||[]).map((item,i)=>{
      const details='<div class="plan-detail-layout">'+exerciseDiagram(item)+'<div class="exercise-media" data-exercise-media="'+esc(item.exercise)+'"><span class="muted small-text">กำลังค้นหาภาพและคลิปประกอบ…</span></div><div class="exercise-instructions"><p><b>เหตุผลที่เลือก:</b> '+esc(item.rationale||'เลือกจากความเหมาะสมกับระดับและอุปกรณ์ที่ระบุ')+'</p><p><b>เตรียมท่า:</b> '+esc(item.setup||'จัดท่าให้มั่นคงและเคลื่อนไหวในช่วงที่ควบคุมได้')+'</p><p><b>ขั้นตอน:</b></p><ol>'+((item.steps||[]).map(step=>'<li>'+esc(step)+'</li>').join('')||'<li>'+esc(item.note||'ทำช้า ๆ และควบคุมการเคลื่อนไหว')+'</li>')+'</ol><p><b>การหายใจ:</b> '+esc(item.breathing||'หายใจต่อเนื่อง ไม่กลั้นหายใจ')+'</p><p><b>ข้อผิดพลาดที่พบบ่อย:</b> '+esc(item.commonMistakes||'อย่ารีบทำหรือฝืนช่วงการเคลื่อนไหว')+'</p><p><b>ข้อควรระวัง:</b> '+esc(item.caution||item.note||'หยุดทันทีหากเจ็บผิดปกติ')+'</p>'+renderEvidenceLinks(item.evidence,'หลักฐาน/คู่มือที่เกี่ยวข้องกับท่า')+'</div></div>';
      return '<tr><td class="plan-index">'+(i+1)+'</td><td><b>'+esc(item.exercise)+'</b></td><td>'+esc(item.targetMuscles||'—')+'</td><td>'+esc(item.sets)+'</td><td>'+esc(item.reps)+'</td><td>'+esc(item.restSeconds)+' วินาที</td></tr><tr class="instruction-row"><td colspan="6"><details><summary>ดูเหตุผล วิธีทำ รูปภาพ และแหล่งอ้างอิง</summary>'+details+'</details></td></tr>';
    }).join('');
    return evidencePanel+'<div class="table-scroll"><table class="workout-plan-table"><thead><tr><th>ลำดับ</th><th>ท่าออกกำลังกาย</th><th>กล้ามเนื้อเป้าหมาย</th><th>เซ็ต</th><th>ครั้ง / เซ็ต</th><th>เวลาพัก</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function renderCoachConversation() {
    const messages=(data.coachMessages||[]).slice(-8);
    if(!messages.length) return '<div class="coach-empty">เล่าว่าวันนี้หรือเมื่อวานทำอะไรไปบ้าง เช่น “เมื่อวานวิดพื้น 2 เซ็ต วันนี้รู้สึกตึงแขนเล็กน้อย” ผู้ช่วยจะนำไปเทียบกับประวัติการฝึกที่บันทึกไว้</div>';
    return messages.map(message=>{
      if(message.role==='user') return '<div class="coach-message user"><b>คุณ</b><p>'+esc(message.text)+'</p></div>';
      const result=message.result||{}, plan=result.hasPlan?result.plan:null;
      const planMarkup=plan?'<div class="ai-plan"><b>'+esc(plan.title||'แผนฝึก')+'</b><p>'+esc(plan.reason||'')+'</p>'+renderPlanTable(plan)+'<button type="button" class="secondary-button" data-apply-plan="'+(data.coachMessages||[]).indexOf(message)+'">ยืนยันใช้แผนนี้</button></div>':'';
      return '<div class="coach-message assistant"><b>Gemini · โค้ชออกกำลังกาย</b><p>'+esc(result.reply||'')+'</p>'+renderEvidenceLinks(result.evidence,'แหล่งอ้างอิงประกอบคำตอบ')+planMarkup+'</div>';
    }).join('');
  }
  async function askWorkoutCoach(text) {
    const form=$('#coach-form'), submit=form.querySelector('button[type="submit"]');
    const prior=(data.coachMessages||[]).filter(message=>message.date===selectedDate).slice(-6).map(message=>({role:message.role==='user'?'user':'assistant',text:message.role==='user'?message.text:(message.result?.reply||'')}));
    const history=data.workouts.filter(item=>item.date<=selectedDate).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12).map(item=>({date:item.date,exercise:item.exercise,sets:item.sets,reps:item.reps,effort:item.effort,notes:item.notes}));
    const recentMeasurements=data.measurements.filter(item=>item.date<=selectedDate).slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(item=>({date:item.date,weight:item.weight,height:item.height,waist:item.waist,sleep:item.sleep,water:item.water,restingHeartRate:item.restingHeartRate,energy:item.energy,soreness:item.soreness,pain:item.pain}));
    const recentReadiness=(data.readinessLogs||[]).filter(item=>item.date<=selectedDate).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7).map(item=>({date:item.date,sleep:item.sleep,daytimeRestMinutes:item.daytimeRestMinutes,trainingMinutes:item.trainingMinutes,energy:item.energy,soreness:item.soreness,stress:item.stress,pain:item.pain}));
    const payload={date:selectedDate,message:text||'จากประวัติที่บันทึกไว้ ช่วยประเมินว่าควรฝึกหรือพักวันนี้',conversation:prior,workouts:history,trainingProfile:data.trainingProfile||{},bodyHistory:data.trainingProfile?.shareWithGemini===false?[]:recentMeasurements,readinessHistory:data.trainingProfile?.shareWithGemini===false?[]:recentReadiness,trainingProfile:data.trainingProfile?.shareWithGemini===false?{}:(data.trainingProfile||{}),existingPlan:(data.workoutPlans||[]).filter(plan=>plan.date===selectedDate).slice(-1)[0]||null};
    if(text){data.coachMessages.push({role:'user',text,date:selectedDate,createdAt:new Date().toISOString()});data.coachMessages=data.coachMessages.slice(-16);renderCoachMessagesOnly();}
    submit.disabled=true;submit.textContent='กำลังคิดแผน…';
    recordCoachRequest(); renderCoachQuotaOnly();
    try {
      const response=await fetch('/api/workout-coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body.error||'เชื่อมต่อผู้ช่วยไม่สำเร็จ');
      if(body.hasPlan&&(!body.plan||!Array.isArray(body.plan.items)||(!body.plan.restDay&&!body.plan.items.length))) throw new Error('AI ส่งแผนมาไม่ครบ จึงยังสร้างตารางไม่ได้ กรุณาลองขอแผนอีกครั้ง');
      data.coachMessages.push({role:'assistant',result:body,date:selectedDate,createdAt:new Date().toISOString()});
      data.coachMessages=data.coachMessages.slice(-16);
      save('ได้รับคำแนะนำจาก Gemini แล้ว');
    } catch(error) {
      data.coachMessages.push({role:'assistant',result:{reply:'ยังเชื่อมต่อ Gemini ไม่สำเร็จ: '+error.message,hasPlan:false},date:selectedDate,createdAt:new Date().toISOString()});
      data.coachMessages=data.coachMessages.slice(-16);
      save('ส่งข้อความไม่สำเร็จ');
    } finally {
      const current=$('#coach-form button[type="submit"]');
      if(current){current.disabled=false;current.textContent='ส่งข้อความ';}
    }
  }
  function renderCoachMessagesOnly(){const target=$('.coach-conversation');if(target){target.innerHTML=renderCoachConversation();loadExerciseMedia(target);}}
  function clearCoachHistory() {
    if (!(data.coachMessages || []).length) {
      alert('ไม่มีประวัติแชทให้ล้าง');
      return;
    }
    if (!confirm('ต้องการล้างประวัติแชท AI ทั้งหมดใช่ไหม?\n\nการล้างนี้จะไม่ลบแผนฝึกที่ยืนยันแล้ว ประวัติการออกกำลังกาย หรือข้อมูลสุขภาพอื่น ๆ')) return;
    data.coachMessages = [];
    save('ล้างประวัติแชท AI แล้ว');
  }

  function applyWorkoutPlan(index) {
    const message=data.coachMessages[index], plan=message?.result?.plan;
    if(!plan)return;
    if(!confirm('ยืนยันนำแผนนี้ไปใช้กับตารางฝึกวันที่ '+fmtDate(plan.date||selectedDate)+' หรือไม่?'))return;
    data.workoutPlans=data.workoutPlans||[];
    const saved={...plan,id:uid(),date:plan.date||selectedDate,acceptedAt:new Date().toISOString()};
    data.workoutPlans=data.workoutPlans.filter(item=>item.date!==saved.date);
    data.workoutPlans.push(saved);
    save('เพิ่มแผนฝึกลงในเว็บไซต์แล้ว');
  }

  function renderAiPlanWorkspace() {
    const messages=(data.coachMessages||[]).map((message,index)=>({message,index})).filter(x=>x.message.role==='assistant'&&x.message.result?.hasPlan&&x.message.result?.plan);
    const latest=messages[messages.length-1], accepted=(data.workoutPlans||[]).find(item=>item.date===selectedDate);
    const pending=latest&&latest.message.result.plan.date===selectedDate&&(!accepted||accepted.acceptedAt!==latest.message.createdAt);
    let html='<section class="ai-plan-workspace"><p class="eyebrow">AI WORKOUT BUILDER</p><h2>ตารางฝึกจาก AI</h2><p class="muted small-text">พื้นที่แยกสำหรับตรวจสอบและนำแผนจาก Gemini ไปบันทึกในตารางฝึก</p>';
    if(pending){const p=latest.message.result.plan;html+='<div class="ai-workspace-card"><div class="workspace-status">แผนใหม่ · ยังไม่บันทึก</div><h3>'+esc(p.title||'แผนฝึก')+'</h3><p>'+esc(p.reason||'')+'</p>'+renderPlanTable(p)+'<button type="button" class="primary-button" data-apply-plan="'+latest.index+'">ยืนยันและใส่ตารางฝึก</button></div>';}
    else if(accepted){html+='<div class="ai-workspace-card"><div class="workspace-status saved">บันทึกในตารางแล้ว</div><h3>'+esc(accepted.title||'แผนฝึก')+'</h3><p>'+esc(accepted.reason||'')+'</p>'+renderPlanTable(accepted)+'</div>';}
    else html+='<div class="ai-workspace-empty">เมื่อ Gemini สร้างแผนฝึกและส่งกลับมา ตารางจะปรากฏที่ส่วนนี้โดยอัตโนมัติ จากนั้นกดยืนยันเพื่อบันทึกแผน</div>';
    return html+'</section>';
  }
  function renderExercise() {
    const sessions=data.workouts.filter(x=>x.date===selectedDate).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const activePlan=(data.workoutPlans||[]).find(item=>item.date===selectedDate);
    const planCard=activePlan?card('แผนฝึกที่ยืนยันแล้ว','<p><b>'+esc(activePlan.title)+'</b></p><p class="muted small-text">'+esc(activePlan.reason||'')+'</p>'+renderPlanTable(activePlan)+'<p class="muted small-text">ยืนยันเมื่อ '+new Date(activePlan.acceptedAt).toLocaleString('th-TH')+'</p>'):'';
    const coach=card('โค้ชออกกำลังกาย AI','<p class="muted small-text">คุยภาษาไทยได้ตามปกติ เล่าการฝึก ความล้า หรือถามเรื่องท่าและการพัก โค้ชจะพิจารณาประวัติที่บันทึกในเว็บไซต์และเสนอแผนให้คุณยืนยันก่อนใช้งาน</p>'+coachQuotaMarkup()+'<div class="coach-conversation">'+renderCoachConversation()+'</div><form id="coach-form" class="coach-form"><textarea id="coach-input" name="message" rows="3" maxlength="1200" placeholder="เช่น เมื่อวานวิดพื้น 2 เซ็ต วันนี้รู้สึกตึงแขนเล็กน้อย ควรฝึกอะไรดี?"></textarea><div class="button-row"><button class="primary-button" type="submit">ส่งข้อความ</button><button class="secondary-button" type="button" id="coach-history">วิเคราะห์จากประวัติที่บันทึก</button><button class="text-button" type="button" id="coach-clear" title="ล้างเฉพาะประวัติข้อความแชท ไม่ลบแผนฝึกหรือบันทึกการออกกำลังกาย">ล้างประวัติแชท</button></div></form><p class="muted small-text">ใช้ Gemini API Free Tier ผ่านเซิร์ฟเวอร์ เมื่อเปิดอนุญาตในโปรไฟล์ จะส่งข้อมูลพื้นฐานการฝึก ประวัติร่างกาย/ความพร้อมล่าสุดที่จำเป็น ประวัติฝึกที่เกี่ยวข้อง และข้อความที่คุณส่ง ไม่ส่งข้อมูลโภชนาการหรือข้อมูลกิจกรรมอื่น</p>','coach-panel');
    return '<div class="page-title"><div><p class="eyebrow">MOVE & RECOVER</p><h1>ออกกำลังกาย</h1><p class="muted">บันทึกผลและใช้ผู้ช่วยวางแผนจากสิ่งที่ทำจริง</p></div><div class="date-control"><input type="date" id="exercise-date" value="'+selectedDate+'"></div></div>'+
      coach+renderAiPlanWorkspace()+planCard+
      card('คลังท่าฝึกพื้นฐาน',exerciseLibrary.map((x,i)=>'<details class="exercise-item"><summary><span><b>'+x.name+'</b><small>'+x.target+' · '+x.level+'</small></span><span class="pill">'+x.sets+' เซ็ต · '+x.reps+'</span></summary><p>'+x.steps+'</p><p class="muted small-text">ข้อควรระวัง: '+x.caution+'</p><button data-log-exercise="'+i+'" class="secondary-button">บันทึกการฝึกท่านี้</button></details>').join(''))+
      card('บันทึกผลวันนี้',sessions.length?sessions.map(x=>'<div class="list-row"><div><b>'+esc(x.exercise)+'</b><small>'+x.sets+' เซ็ต · '+x.reps+' ครั้ง/เซ็ต · พัก '+x.rest+' วินาที</small>'+(x.notes?'<small>'+esc(x.notes)+'</small>':'')+'</div><button class="danger-link" data-delete-workout="'+x.id+'">ลบ</button></div>').join(''):'<div class="empty-state">ยังไม่มีบันทึกการฝึกในวันนี้</div>')+
      '<div id="exercise-editor"></div><div class="notice subtle">หากเจ็บแปลบ เวียนศีรษะ เจ็บข้อ หรือมีอาการผิดปกติ ให้หยุดฝึกทันที การบันทึกนี้ไม่ใช่การวินิจฉัยหรือแผนรักษา</div>';
  }
  function workoutForm(index) {
    const ex=exerciseLibrary[index];
    return card('บันทึก '+ex.name,'<form id="workout-form" class="form-grid">'+dateInput(selectedDate)+formField('จำนวนเซ็ต','<input type="number" name="sets" min="1" max="20" value="'+ex.sets+'" required>')+formField('จำนวนครั้งต่อเซ็ต','<input name="reps" required value="'+esc(ex.reps)+'">')+formField('เวลาพัก (วินาที)','<input type="number" name="rest" min="0" max="600" value="60">')+formField('ความรู้สึกหลังฝึก','<select name="effort"><option>สบาย</option><option>พอดี</option><option>หนัก</option><option>เหนื่อยมาก</option></select>')+formField('หมายเหตุ (ไม่บังคับ)','<input name="notes" maxlength="200" placeholder="เช่น ทำได้ไม่ครบ / รู้สึกตึง">')+'<div class="form-actions"><button class="primary-button">บันทึกผล</button><button type="button" class="secondary-button" id="cancel-exercise">ยกเลิก</button></div></form>');
  }
  function renderNutrition() {
    const totals=D.sumNutrition(data.meals,selectedDate), meals=data.meals.filter(x=>x.date===selectedDate).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const macros=[['พลังงาน','calories','kcal'],['โปรตีน','protein','g'],['คาร์โบไฮเดรต','carbs','g'],['ไขมัน','fat','g']];
    return '<div class="page-title"><div><p class="eyebrow">EAT & NOURISH</p><h1>โภชนาการ</h1><p class="muted">บันทึกอาหารและปริมาณที่รับประทาน ตัวเลขเป็นค่าประมาณตามข้อมูลที่กรอก</p></div><div class="date-control"><input type="date" id="nutrition-date" value="'+selectedDate+'"></div></div>'+
      '<div class="stats-grid">'+macros.map(([label,key,unit])=>stat(label,Math.round(totals[key])+' '+unit,data.targets[key]?'เป้าหมาย '+data.targets[key]+' '+unit:'ยังไม่ได้ตั้งเป้าหมาย')).join('')+'</div>'+
      card('เพิ่มอาหารที่รับประทาน','<form id="meal-form" class="form-grid">'+dateInput(selectedDate)+formField('ชื่ออาหาร','<input name="title" required maxlength="100" placeholder="เช่น ข้าวไข่เจียว 1 จาน">')+formField('มื้ออาหาร','<select name="meal"><option>เช้า</option><option>กลางวัน</option><option>เย็น</option><option>ของว่าง</option></select>')+formField('ปริมาณ / หน่วยบริโภค','<input name="serving" maxlength="60" placeholder="เช่น 1 จาน / 2 ฟอง">')+formField('พลังงาน (kcal)','<input type="number" name="calories" min="0" step="1" value="0">')+formField('โปรตีน (g)','<input type="number" name="protein" min="0" step=".1" value="0">')+formField('คาร์โบไฮเดรต (g)','<input type="number" name="carbs" min="0" step=".1" value="0">')+formField('ไขมัน (g)','<input type="number" name="fat" min="0" step=".1" value="0">')+formField('แหล่งข้อมูล','<select name="source"><option>ผู้ใช้กรอกเอง</option><option>ฉลากโภชนาการ</option><option>ค่าประมาณ</option></select>')+'<div class="form-actions"><button class="primary-button">บันทึกอาหาร</button></div></form>')+
      card('รายการอาหาร',meals.length?meals.map(x=>'<div class="list-row"><div><b>'+esc(x.title)+'</b><small>'+esc(x.meal)+' · '+esc(x.serving||'ไม่ระบุปริมาณ')+' · '+esc(x.source)+'</small><small>'+x.calories+' kcal · โปรตีน '+x.protein+' g · คาร์บ '+x.carbs+' g · ไขมัน '+x.fat+' g</small></div><button class="text-button" data-edit-meal="'+x.id+'">แก้ไข</button><button class="danger-link" data-delete-meal="'+x.id+'">ลบ</button></div>').join(''):'<div class="empty-state">ยังไม่มีรายการอาหารวันนี้</div>');
  }
  function renderBody() {
    const list=data.measurements.slice().sort((a,b)=>b.date.localeCompare(a.date));
    const latest=list[0], profile=data.trainingProfile||{};
    const profileForm='<form id="training-profile-form" class="form-grid">'+
      formField('อายุ (ปี)','<input type="number" name="age" min="13" max="100" value="'+esc(profile.age??'')+'">')+
      formField('เพศ (ไม่บังคับ)','<select name="sex"><option value="">ไม่ระบุ</option><option value="ชาย" '+(profile.sex==='ชาย'?'selected':'')+'>ชาย</option><option value="หญิง" '+(profile.sex==='หญิง'?'selected':'')+'>หญิง</option><option value="อื่น ๆ" '+(profile.sex==='อื่น ๆ'?'selected':'')+'>อื่น ๆ</option></select>')+
      formField('เป้าหมายหลัก','<select name="goal">'+['เพิ่มกล้ามเนื้อและสร้างรูปร่าง','เพิ่มความแข็งแรง','เพิ่มความฟิตและความทนทาน','ลดไขมัน','รักษาสุขภาพและความสม่ำเสมอ'].map(x=>'<option '+(profile.goal===x?'selected':'')+'>'+x+'</option>').join('')+'</select>')+
      formField('ประสบการณ์ฝึก','<select name="experience">'+['มือใหม่','ฝึกมาบ้างแล้ว','ระดับกลาง','มีประสบการณ์มาก'].map(x=>'<option '+(profile.experience===x?'selected':'')+'>'+x+'</option>').join('')+'</select>')+
      formField('อุปกรณ์ที่มี','<select name="equipment">'+['ไม่มีอุปกรณ์','ดัมเบล','ยางยืด','อุปกรณ์หลายชนิด','ฟิตเนส / ยิม'].map(x=>'<option '+(profile.equipment===x?'selected':'')+'>'+x+'</option>').join('')+'</select>')+
      formField('วันที่สะดวกฝึกต่อสัปดาห์','<input type="number" name="daysPerWeek" min="1" max="7" value="'+esc(profile.daysPerWeek??3)+'">')+
      formField('เวลาฝึกต่อครั้ง (นาที)','<input type="number" name="sessionMinutes" min="10" max="180" value="'+esc(profile.sessionMinutes??40)+'">')+
      formField('ข้อจำกัดหรืออาการที่ควรระวัง (ไม่บังคับ)','<textarea name="limitations" maxlength="500" rows="2" placeholder="เช่น เจ็บข้อมือเมื่อวิดพื้น หรือไม่มี">'+esc(profile.limitations||'')+'</textarea>')+
      formField('ความชอบในการฝึก (ไม่บังคับ)','<textarea name="preferences" maxlength="500" rows="2" placeholder="เช่น ชอบฝึกที่บ้าน ไม่ชอบกระโดด">'+esc(profile.preferences||'')+'</textarea>')+
      '<label class="check-field"><input type="checkbox" name="shareWithGemini" '+(profile.shareWithGemini!==false?'checked':'')+'> อนุญาตให้ส่งโปรไฟล์และประวัติร่างกาย/ความพร้อมล่าสุดที่จำเป็นไปให้ Gemini เพื่อช่วยวางแผนฝึก</label> '+
      '<div class="form-actions"><button class="primary-button">บันทึกข้อมูลโปรไฟล์การฝึก</button></div></form>';
    const measurementForm='<form id="body-form" class="form-grid">'+dateInput(selectedDate)+formField('น้ำหนัก (kg)','<input type="number" name="weight" min=".1" max="500" step=".1" required>')+formField('ส่วนสูง (cm)','<input type="number" name="height" min="30" max="250" step=".1">')+formField('รอบเอว (cm)','<input type="number" name="waist" min="1" max="300" step=".1">')+formField('เวลานอนเมื่อคืน (ชั่วโมง)','<input type="number" name="sleep" min="0" max="24" step=".1">')+formField('ชีพจรขณะพัก (ครั้ง/นาที · ไม่บังคับ)','<input type="number" name="restingHeartRate" min="30" max="220">')+formField('พลังงานวันนี้ (1–5)','<select name="energy"><option value="">ไม่ระบุ</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'">'+n+'</option>').join('')+'</select>')+formField('ความล้าของกล้ามเนื้อ (1–5)','<select name="soreness"><option value="">ไม่ระบุ</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'">'+n+'</option>').join('')+'</select>')+formField('อาการเจ็บหรือไม่สบาย (ไม่บังคับ)','<input name="pain" maxlength="240" placeholder="เช่น ไม่มี / เจ็บเข่าซ้ายเล็กน้อย">')+formField('น้ำดื่ม (ลิตร)','<input type="number" name="water" min="0" max="20" step=".1">')+formField('หมายเหตุ','<input name="notes" maxlength="300" placeholder="ไม่บังคับ">')+'<div class="form-actions"><button class="primary-button">บันทึกประวัติร่างกาย</button></div></form>';
    const readinessList=(data.readinessLogs||[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
    const readinessForm='<form id="readiness-form" class="form-grid">'+dateInput(selectedDate)+
      formField('เวลานอนเมื่อคืน (ชั่วโมง)','<input type="number" name="sleep" min="0" max="24" step=".1" placeholder="เช่น 7.5">')+
      formField('เวลาพักระหว่างวัน (นาที)','<input type="number" name="daytimeRestMinutes" min="0" max="1440" step="5" placeholder="เช่น 30">')+
      formField('เวลาออกกำลังกายรวมวันนี้ (นาที)','<input type="number" name="trainingMinutes" min="0" max="600" step="5" placeholder="เช่น 45">')+
      formField('พลังงานวันนี้ (1–5)','<select name="energy"><option value="">ไม่ระบุ</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'">'+n+'</option>').join('')+'</select>')+
      formField('ความล้ากล้ามเนื้อ (1–5)','<select name="soreness"><option value="">ไม่ระบุ</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'">'+n+'</option>').join('')+'</select>')+
      formField('ความเครียด (1–5)','<select name="stress"><option value="">ไม่ระบุ</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'">'+n+'</option>').join('')+'</select>')+
      formField('อาการเจ็บ / ไม่สบาย','<input name="pain" maxlength="240" placeholder="เช่น ไม่มี หรือเจ็บหัวไหล่">')+
      formField('หมายเหตุ','<input name="notes" maxlength="300" placeholder="เช่น วันนี้เดินเยอะ รู้สึกเพลีย">')+
      '<div class="form-actions"><button class="primary-button">บันทึกข้อมูลประจำวัน</button></div></form>';
    return '<div class="page-title"><div><p class="eyebrow">BODY & RECOVERY</p><h1>ข้อมูลร่างกายและโปรไฟล์การฝึก</h1><p class="muted">ข้อมูลพื้นฐานและประวัติรายวันที่ใช้ประกอบการวางแผนฝึก</p></div></div>'+
      card('โปรไฟล์การฝึก (แก้ไขได้)', '<p class="muted small-text">ข้อมูลพื้นฐานที่เปลี่ยนไม่บ่อย ใช้กำหนดเป้าหมายและข้อจำกัดในการออกแบบโปรแกรม</p>'+profileForm)+
      card('บันทึกข้อมูลร่างกายและความพร้อมรายวัน', '<p class="muted small-text">บันทึกตามวันที่จริงเพื่อให้เห็นแนวโน้มและประเมินการฟื้นตัว ข้อมูลที่ไม่สะดวกกรอกสามารถเว้นว่างได้</p>'+measurementForm)+
      card('บันทึกการฝึกและการพักรายวัน','<p class="muted small-text">บันทึกเวลาฝึก เวลาพักระหว่างวัน การนอน และความพร้อม เพื่อให้โค้ชประเมินการฟื้นตัวได้ดีขึ้น</p>'+readinessForm)+
      card('ประวัติการฝึกและการพัก',readinessList.length?readinessList.map(x=>'<article class="history-entry"><div class="list-row"><div><b>'+fmtDate(x.date)+'</b><small>'+(x.trainingMinutes!=null?'ออกกำลังกาย '+x.trainingMinutes+' นาที · ':'')+(x.daytimeRestMinutes!=null?'พักระหว่างวัน '+x.daytimeRestMinutes+' นาที · ':'')+(x.sleep!=null?'นอน '+x.sleep+' ชม.':'')+'</small><small>'+(x.energy?'พลังงาน '+x.energy+'/5 · ':'')+(x.soreness?'ล้า '+x.soreness+'/5 · ':'')+(x.stress?'เครียด '+x.stress+'/5':'')+(x.pain?' · อาการ: '+esc(x.pain):'')+'</small>'+(x.notes?'<small>'+esc(x.notes)+'</small>':'')+'</div><div class="row-actions"><button class="text-button" data-edit-readiness="'+x.id+'">แก้ไข</button><button class="danger-link" data-delete-readiness="'+x.id+'">ลบ</button></div></div></article>').join(''):'<div class="empty-state">ยังไม่มีประวัติการฝึกและการพัก</div>')+
      card('ประวัติย้อนหลัง',list.length?list.map(x=>'<article class="history-entry"><div class="list-row"><div><b>'+fmtDate(x.date)+' · '+x.weight+' kg</b><small>'+(x.height?'ส่วนสูง '+x.height+' cm':'')+(x.waist?' · รอบเอว '+x.waist+' cm':'')+(x.sleep?' · นอน '+x.sleep+' ชม.':'')+(x.restingHeartRate?' · ชีพจรพัก '+x.restingHeartRate:'')+'</small><small>'+(x.energy?'พลังงาน '+x.energy+'/5 · ':'')+(x.soreness?'ล้า '+x.soreness+'/5 · ':'')+(x.pain?'อาการ: '+esc(x.pain):'')+'</small>'+(x.notes?'<small>'+esc(x.notes)+'</small>':'')+'</div><div class="row-actions"><button class="text-button" data-edit-measurement="'+x.id+'">แก้ไข</button><button class="danger-link" data-delete-measurement="'+x.id+'">ลบ</button></div></div></article>').join(''):'<div class="empty-state">ยังไม่มีข้อมูลร่างกาย</div>')+
      (latest&&latest.height?'<div class="notice subtle">BMI ล่าสุด '+D.bmi(latest.weight,latest.height).toFixed(1)+' · เป็นเพียงตัวชี้วัดคัดกรอง ไม่ได้บอกมวลกล้ามเนื้อหรือวินิจฉัยสุขภาพ</div>':'');
  }
  function renderReports() {
    const range=D.dateRange(selectedDate,reportPeriod), time=D.sumTimeLogs(data.timeLogs,range), foods=data.meals.filter(x=>D.inRange(x.date,range));
    const totalCalories=foods.reduce((s,x)=>s+(Number(x.calories)||0),0), byCategory=Object.entries(time.byCategory).sort((a,b)=>b[1]-a[1]);
    const max=Math.max(1,...byCategory.map(x=>x[1]));
    return '<div class="page-title"><div><p class="eyebrow">YOUR TRENDS</p><h1>รายงาน</h1><p class="muted">ช่วงข้อมูล '+fmtDate(range.start)+' ถึง '+fmtDate(range.end)+'</p></div><div class="date-control"><input type="date" id="report-date" value="'+selectedDate+'"></div></div>'+
      '<div class="segmented">'+[['week','สัปดาห์'],['month','เดือน'],['year','ปี']].map(([v,l])=>'<button class="'+(reportPeriod===v?'active':'')+'" data-period="'+v+'">'+l+'</button>').join('')+'</div>'+
      '<div class="stats-grid">'+stat('เวลาที่บันทึก',fmtHours(time.minutes),time.count+' รายการ')+stat('อาหารที่บันทึก',foods.length+' รายการ',new Set(foods.map(x=>x.date)).size+' วันที่มีข้อมูล')+stat('พลังงานรวม',Math.round(totalCalories)+' kcal','เฉพาะรายการที่บันทึก')+stat('การฝึก',data.workouts.filter(x=>D.inRange(x.date,range)).length+' ครั้ง','ในช่วงที่เลือก')+'</div>'+
      card('เวลาที่ใช้แยกตามหมวดหมู่',byCategory.length?byCategory.map(([name,value])=>'<div class="bar-row"><div><span>'+esc(name)+'</span><b>'+fmtHours(value)+'</b></div><div class="progress"><i style="width:'+(value/max*100)+'%"></i></div></div>').join(''):'<div class="empty-state">ยังไม่มีข้อมูลเวลาในช่วงนี้</div>')+
      card('โภชนาการในช่วงที่เลือก','<div class="summary-line"><span>พลังงานรวม</span><b>'+Math.round(totalCalories)+' kcal</b></div><div class="summary-line"><span>โปรตีนรวม</span><b>'+Math.round(foods.reduce((s,x)=>s+(Number(x.protein)||0),0))+' g</b></div><div class="summary-line"><span>จำนวนวันที่มีข้อมูลอาหาร</span><b>'+new Set(foods.map(x=>x.date)).size+' วัน</b></div><p class="muted small-text">รายงานนี้รวมเฉพาะรายการที่มีการบันทึก ไม่ถือว่าวันที่ไม่มีข้อมูลเป็นศูนย์</p>');
  }
  function renderSettings() {
    const oldKeys=['lhp_activities','lhp_logs','lhp_foods','lhp_body'];
    return '<div class="page-title"><div><p class="eyebrow">PREFERENCES & DATA</p><h1>ตั้งค่า</h1><p class="muted">จัดการข้อมูลและการตั้งค่าพื้นฐานของเว็บ</p></div></div>'+
      card('เป้าหมายโภชนาการ (ตั้งค่าเอง)','<form id="targets-form" class="form-grid">'+formField('พลังงาน (kcal / วัน)','<input type="number" name="calories" min="0" value="'+data.targets.calories+'">')+formField('โปรตีน (g / วัน)','<input type="number" name="protein" min="0" value="'+data.targets.protein+'">')+formField('คาร์โบไฮเดรต (g / วัน)','<input type="number" name="carbs" min="0" value="'+data.targets.carbs+'">')+formField('ไขมัน (g / วัน)','<input type="number" name="fat" min="0" value="'+data.targets.fat+'">')+'<div class="form-actions"><button class="primary-button">บันทึกเป้าหมาย</button></div></form><p class="muted small-text">ค่าเริ่มต้นเว้นว่างไว้ เพราะเป้าหมายควรเหมาะกับแต่ละบุคคล</p>')+
      card('สำรองและย้ายข้อมูล','<p>ข้อมูลใหม่เก็บไว้ใน LocalStorage ของเบราว์เซอร์และอุปกรณ์นี้เท่านั้น</p><div class="button-row"><button class="primary-button" id="export-data">ส่งออกข้อมูล JSON</button><label class="secondary-button file-button">นำเข้าไฟล์ JSON<input type="file" id="import-data" accept="application/json" hidden></label></div><p class="muted small-text">การนำเข้าจะรวมรายการจากไฟล์เข้ากับข้อมูลปัจจุบัน ไม่ลบข้อมูลเดิม</p>')+
      card('ข้อมูลจากต้นแบบเดิม',legacyCount?'<p>พบข้อมูลเดิม '+legacyCount+' รายการในคีย์จัดเก็บเก่า ข้อมูลเหล่านี้ยังคงอยู่ ไม่ได้ถูกลบหรือเขียนทับ</p><p class="muted small-text">ยังไม่นำเข้าข้อมูลอัตโนมัติ เพราะบันทึกเดิมบางรายการไม่มีวันที่จริง การกำหนดวันที่แทนอาจทำให้รายงานคลาดเคลื่อน</p>':'<p>ไม่พบข้อมูลจากต้นแบบเดิม')+
      card('ความเป็นส่วนตัว','<p>ข้อมูลทั่วไปของเว็บไซต์เก็บในเบราว์เซอร์นี้ เมื่อเปิดอนุญาตในโปรไฟล์การฝึก ฟีเจอร์โค้ชจะส่งเฉพาะโปรไฟล์การฝึก ประวัติร่างกายและความพร้อมล่าสุดที่จำเป็น ข้อความสนทนา และประวัติการฝึกที่เกี่ยวข้องไปยัง Google Gemini API เพื่อสร้างคำแนะนำ โดยไม่ส่งข้อมูลโภชนาการหรือกิจกรรมชีวิตอื่น</p><p class="muted small-text">Gemini API Free Tier อาจนำเนื้อหาที่ส่งไปใช้ปรับปรุงผลิตภัณฑ์ของ Google โปรดหลีกเลี่ยงข้อมูลระบุตัวตนและข้อมูลสุขภาพที่ละเอียดอ่อน ข้อมูลร่างกายและโภชนาการจะไม่ถูกส่งโดยอัตโนมัติ</p><p class="muted small-text">API Key เก็บใน Environment Variable ฝั่งเซิร์ฟเวอร์ ไม่อยู่ในโค้ดหน้าเว็บ</p><button class="danger-button" id="clear-data">ลบข้อมูลในเว็บนี้ทั้งหมด</button>');
  }
  function render() {
    nav(); header();
    const pages={overview:renderOverview,schedule:renderSchedule,time:renderTime,exercise:renderExercise,nutrition:renderNutrition,body:renderBody,reports:renderReports,settings:renderSettings};
    $('#view').innerHTML=(pages[page]||renderOverview)();
    if(page==='exercise') loadExerciseMedia($('#view'));
    if (page==='schedule') bindSchedule();
    if (page==='time') bindTime();
    if (page==='exercise') bindExercise();
    if (page==='nutrition') bindNutrition();
    if (page==='body') bindBody();
    if (page==='reports') bindReports();
    if (page==='settings') bindSettings();
    if (page==='overview') $('#overview-date')?.addEventListener('change',e=>{selectedDate=e.target.value;render()});
  }
  function bindSchedule() {
    $('#schedule-date').addEventListener('change',e=>{selectedDate=e.target.value;render()});
    $('#add-activity').addEventListener('click',()=>{editingActivity=null;$('#activity-editor').innerHTML=activityForm();bindActivityForm()});
    $$('[data-edit-activity]').forEach(b=>b.addEventListener('click',()=>{editingActivity=data.activities.find(x=>x.id===b.dataset.editActivity);$('#activity-editor').innerHTML=activityForm(editingActivity);bindActivityForm()}));
    $$('[data-delete-activity]').forEach(b=>b.addEventListener('click',()=>{if(confirm('ยืนยันลบกิจกรรมนี้หรือไม่?')){data.activities=data.activities.filter(x=>x.id!==b.dataset.deleteActivity);save()}}));
    $$('[data-status]').forEach(b=>b.addEventListener('click',()=>{const a=data.activities.find(x=>x.id===b.dataset.status);const options=['planned','completed','skipped','rescheduled'];a.status=options[(options.indexOf(a.status)+1)%options.length];save('เปลี่ยนสถานะแล้ว')}));
    $('#add-template')?.addEventListener('click',()=>{const template=[['06:30','07:00','ตื่นนอนและเตรียมตัว','ชีวิตประจำวัน'],['08:00','18:00','ทำงาน','งาน'],['18:00','18:40','ซื้ออาหารและกินข้าว','ชีวิตประจำวัน'],['18:40','19:20','อาบน้ำและพัก','ชีวิตประจำวัน'],['19:20','20:10','ออกกำลังกายหรือฟื้นตัว','ออกกำลังกาย'],['20:20','21:05','เรียน / ศึกษาด้วยตนเอง','เรียน'],['21:05','21:50','เล่นเกม / เวลาส่วนตัว','พักผ่อน'],['21:50','22:00','เตรียมตัวนอน','ชีวิตประจำวัน'],['22:00','06:30','นอนหลับ','พักผ่อน']];if(activityList(selectedDate).length&&!confirm('วันนี้มีกิจกรรมอยู่แล้ว ต้องการเพิ่มตารางตัวอย่างเข้าไปด้วยหรือไม่?'))return;data.activities.push(...template.map(([start,end,title,category])=>({id:uid(),date:selectedDate,start,end,title,category,status:'planned',notes:'ตารางเริ่มต้น ปรับเปลี่ยนได้ตามต้องการ'})));save('เพิ่มตารางตัวอย่างแล้ว คุณสามารถแก้ไขได้ตามต้องการ')});
  }
  function bindActivityForm() {
    $('#cancel-activity').addEventListener('click',()=>{$('#activity-editor').innerHTML='';editingActivity=null});
    $('#activity-form').addEventListener('submit',e=>{
      e.preventDefault();const f=new FormData(e.currentTarget), item={id:editingActivity?.id||uid(),title:f.get('title'),date:f.get('date'),start:f.get('start'),end:f.get('end'),category:f.get('category'),status:f.get('status'),notes:f.get('notes')};
      try { const valid=D.validateActivity(item);const overlaps=D.findOverlaps(valid,data.activities,editingActivity?.id);if(overlaps.length&&!confirm('เวลานี้ทับซ้อนกับ '+overlaps.map(x=>x.title).join(', ')+' ต้องการบันทึกต่อหรือไม่?'))return;
        if(editingActivity)data.activities=data.activities.map(x=>x.id===item.id?valid:x);else data.activities.push(valid);editingActivity=null;save('บันทึกกิจกรรมแล้ว');
      } catch(err){alert(err.message)}
    });
  }
  function bindTime() {
    $('#time-date').addEventListener('change',e=>{selectedDate=e.target.value;render()});
    $('#time-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);const duration=Number(f.get('durationMinutes'));if(!Number.isInteger(duration)||duration<1||duration>1440)return alert('ระยะเวลาต้องเป็น 1–1440 นาที');const item={id:editingTimeLog?.id||uid(),date:f.get('date'),title:f.get('title'),category:f.get('category'),durationMinutes:duration,notes:f.get('notes'),createdAt:editingTimeLog?.createdAt||new Date().toISOString()};if(editingTimeLog)data.timeLogs=data.timeLogs.map(x=>x.id===item.id?item:x);else data.timeLogs.push(item);editingTimeLog=null;save('บันทึกเวลาแล้ว')});
    $$('[data-edit-log]').forEach(b=>b.addEventListener('click',()=>{editingTimeLog=data.timeLogs.find(x=>x.id===b.dataset.editLog);const form=$('#time-form');for(const [key,value] of Object.entries(editingTimeLog))if(form.elements[key])form.elements[key].value=value;form.querySelector('button[type="submit"],button:not([type])').textContent='บันทึกการแก้ไข';form.scrollIntoView({behavior:'smooth',block:'center'})}));
    $$('[data-delete-log]').forEach(b=>b.addEventListener('click',()=>{if(confirm('ลบบันทึกเวลานี้หรือไม่?')){data.timeLogs=data.timeLogs.filter(x=>x.id!==b.dataset.deleteLog);save()}}));
  }
  function bindExercise() {
    $('#exercise-date').addEventListener('change',e=>{selectedDate=e.target.value;render()});
    $('#coach-form').addEventListener('submit',e=>{e.preventDefault();const text=$('#coach-input').value.trim();if(!text)return alert('กรุณาพิมพ์ข้อความก่อนส่ง');$('#coach-input').value='';askWorkoutCoach(text)});
    $('#coach-history').addEventListener('click',()=>askWorkoutCoach(''));
    $('#coach-clear').addEventListener('click',clearCoachHistory);
    $$('[data-apply-plan]').forEach(b=>b.addEventListener('click',()=>applyWorkoutPlan(Number(b.dataset.applyPlan))));
    $$('[data-log-exercise]').forEach(b=>b.addEventListener('click',()=>{$('#exercise-editor').innerHTML=workoutForm(Number(b.dataset.logExercise));bindWorkoutForm(Number(b.dataset.logExercise))}));
    $$('[data-delete-workout]').forEach(b=>b.addEventListener('click',()=>{if(confirm('ลบบันทึกการฝึกนี้หรือไม่?')){data.workouts=data.workouts.filter(x=>x.id!==b.dataset.deleteWorkout);save()}}));
  }
  function bindWorkoutForm(index) {
    $('#cancel-exercise').addEventListener('click',()=>$('#exercise-editor').innerHTML='');
    $('#workout-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget),ex=exerciseLibrary[index];data.workouts.push({id:uid(),date:f.get('date'),exercise:ex.name,sets:Number(f.get('sets')),reps:f.get('reps'),rest:Number(f.get('rest')),effort:f.get('effort'),notes:f.get('notes'),createdAt:new Date().toISOString()});save('บันทึกผลการฝึกแล้ว')});
  }
  function bindNutrition() {
    $('#nutrition-date').addEventListener('change',e=>{selectedDate=e.target.value;render()});
    $('#meal-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget),entry={id:editingMeal?.id||uid(),date:f.get('date'),title:f.get('title'),meal:f.get('meal'),serving:f.get('serving'),calories:Number(f.get('calories')),protein:Number(f.get('protein')),carbs:Number(f.get('carbs')),fat:Number(f.get('fat')),source:f.get('source'),confidence:'estimated',createdAt:editingMeal?.createdAt||new Date().toISOString()};if(Object.values(entry).some(v=>typeof v==='number'&&(!Number.isFinite(v)||v<0)))return alert('กรุณาตรวจสอบตัวเลขโภชนาการ');if(editingMeal)data.meals=data.meals.map(x=>x.id===entry.id?entry:x);else data.meals.push(entry);editingMeal=null;save('บันทึกอาหารแล้ว')});
    $$('[data-edit-meal]').forEach(b=>b.addEventListener('click',()=>{editingMeal=data.meals.find(x=>x.id===b.dataset.editMeal);const form=$('#meal-form');for(const [key,value] of Object.entries(editingMeal))if(form.elements[key])form.elements[key].value=value;form.scrollIntoView({behavior:'smooth',block:'center'})}));
    $$('[data-delete-meal]').forEach(b=>b.addEventListener('click',()=>{if(confirm('ลบรายการอาหารนี้หรือไม่?')){data.meals=data.meals.filter(x=>x.id!==b.dataset.deleteMeal);save()}}));
  }
  function bindBody() {
    $('#training-profile-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);data.trainingProfile={age:f.get('age')===''?null:Number(f.get('age')),sex:f.get('sex'),goal:f.get('goal'),experience:f.get('experience'),equipment:f.get('equipment'),daysPerWeek:Number(f.get('daysPerWeek')),sessionMinutes:Number(f.get('sessionMinutes')),limitations:f.get('limitations').trim(),preferences:f.get('preferences').trim(),shareWithGemini:f.get('shareWithGemini')==='on',updatedAt:new Date().toISOString()};save('บันทึกโปรไฟล์การฝึกแล้ว')});
    $('#body-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget),weight=Number(f.get('weight'));if(!(weight>0))return alert('กรุณากรอกน้ำหนักให้ถูกต้อง');const optional=k=>f.get(k)===''?null:Number(f.get(k));const entry={id:editingMeasurement?.id||uid(),date:f.get('date'),weight,height:optional('height'),waist:optional('waist'),sleep:optional('sleep'),restingHeartRate:optional('restingHeartRate'),energy:optional('energy'),soreness:optional('soreness'),pain:f.get('pain').trim(),water:optional('water'),notes:f.get('notes'),createdAt:editingMeasurement?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};if(editingMeasurement)data.measurements=data.measurements.map(x=>x.id===entry.id?entry:x);else data.measurements.push(entry);editingMeasurement=null;save('บันทึกประวัติร่างกายแล้ว')});
    $$('[data-edit-measurement]').forEach(b=>b.addEventListener('click',()=>{editingMeasurement=data.measurements.find(x=>x.id===b.dataset.editMeasurement);const form=$('#body-form');for(const [key,value] of Object.entries(editingMeasurement))if(form.elements[key]&&value!==null&&value!==undefined)form.elements[key].value=value;form.scrollIntoView({behavior:'smooth',block:'center'})}));
    $('[data-delete-measurement]').forEach(b=>b.addEventListener('click',()=>{if(confirm('ลบข้อมูลร่างกายรายการนี้หรือไม่?')){data.measurements=data.measurements.filter(x=>x.id!==b.dataset.deleteMeasurement);save()}}));
    $('#readiness-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget),optional=k=>f.get(k)===''?null:Number(f.get(k));const entry={id:editingReadiness?.id||uid(),date:f.get('date'),sleep:optional('sleep'),daytimeRestMinutes:optional('daytimeRestMinutes'),trainingMinutes:optional('trainingMinutes'),energy:optional('energy'),soreness:optional('soreness'),stress:optional('stress'),pain:f.get('pain').trim(),notes:f.get('notes').trim(),createdAt:editingReadiness?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};if(Object.values(entry).some(v=>typeof v==='number'&&(!Number.isFinite(v)||v<0)))return alert('กรุณาตรวจสอบตัวเลข');if(editingReadiness)data.readinessLogs=data.readinessLogs.map(x=>x.id===entry.id?entry:x);else data.readinessLogs.push(entry);editingReadiness=null;save('บันทึกข้อมูลการฝึกและการพักแล้ว')});
    $('[data-edit-readiness]').forEach(b=>b.addEventListener('click',()=>{editingReadiness=data.readinessLogs.find(x=>x.id===b.dataset.editReadiness);const form=$('#readiness-form');for(const [key,value] of Object.entries(editingReadiness))if(form.elements[key]&&value!==null&&value!==undefined)form.elements[key].value=value;form.scrollIntoView({behavior:'smooth',block:'center'});form.querySelector('button[type="submit"],button:not([type])').textContent='บันทึกการแก้ไข'}));
    $('[data-delete-readiness]').forEach(b=>b.addEventListener('click',()=>{if(confirm('ลบประวัติการฝึกและการพักรายการนี้หรือไม่?')){data.readinessLogs=data.readinessLogs.filter(x=>x.id!==b.dataset.deleteReadiness);save()}}));
  }
  function bindReports() {
    $('#report-date').addEventListener('change',e=>{selectedDate=e.target.value;render()});
    $$('[data-period]').forEach(b=>b.addEventListener('click',()=>{reportPeriod=b.dataset.period;render()}));
  }
  function bindSettings() {
    $('#targets-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);data.targets={calories:Number(f.get('calories'))||0,protein:Number(f.get('protein'))||0,carbs:Number(f.get('carbs'))||0,fat:Number(f.get('fat'))||0};save('บันทึกเป้าหมายแล้ว')});
    $('#export-data').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='life-health-planner-'+today()+'.json';a.click();URL.revokeObjectURL(url)});
    $('#import-data').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(parsed.version!==2||!Array.isArray(parsed.activities)||!Array.isArray(parsed.timeLogs)||!Array.isArray(parsed.meals)||!Array.isArray(parsed.workouts)||!Array.isArray(parsed.measurements))throw new Error('รูปแบบไฟล์ไม่ตรงกับข้อมูลของ Life & Health Planner');for(const key of ['activities','timeLogs','meals','workouts','measurements','readinessLogs'])data[key].push(...(Array.isArray(parsed[key])?parsed[key]:[]).map(x=>({...x,id:uid()})));save('นำเข้าข้อมูลแล้ว');}catch(err){alert('นำเข้าข้อมูลไม่สำเร็จ: '+err.message)}e.target.value=''});
    $('#clear-data').addEventListener('click',()=>{if(confirm('ลบข้อมูลใหม่ทั้งหมดในเว็บนี้หรือไม่? การดำเนินการย้อนกลับไม่ได้ หากต้องการเก็บข้อมูลให้ส่งออกก่อน')){data=defaultData();save('ลบข้อมูลในเว็บนี้แล้ว')}});
  }
  $('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b){page=b.dataset.page;notice='';render()}});
  $('#view').addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b){page=b.dataset.go;render()}});
  $('#global-date').addEventListener('change',e=>{selectedDate=e.target.value;render()});
  $('#global-date').value=selectedDate;
  async function initializeStorage() {
    try {
      const loaded = await window.LHPStorage.load(KEY);
      data = normalizeData(loaded.data);
      notice = loaded.migrated ? 'ย้ายข้อมูลเดิมไปยังระบบจัดเก็บใหม่แล้ว (เก็บต้นฉบับเดิมไว้)' : '';
      render();
    } catch (error) {
      console.error('เปิดระบบจัดเก็บข้อมูลไม่สำเร็จ', error);
      notice = 'เปิด IndexedDB ไม่สำเร็จ กำลังใช้พื้นที่จัดเก็บสำรองของเบราว์เซอร์';
      try {
        const saved = JSON.parse(localStorage.getItem(KEY));
        data = normalizeData(saved);
      } catch { data = defaultData(); }
      render();
    }
  }
  initializeStorage();
})();
