(() => {
  'use strict';
  const D = window.LHPDomain;
  const KEY = 'lhp_v2';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const today = () => D.localDate();
  const uid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmtDate = value => value ? new Intl.DateTimeFormat('th-TH',{dateStyle:'medium'}).format(D.parseDate(value)) : '—';
  const fmtHours = mins => (Number(mins || 0) / 60).toLocaleString('th-TH',{maximumFractionDigits:1}) + ' ชม.';
  const defaultData = () => ({
    version: 2, activities: [], timeLogs: [], meals: [], workouts: [], measurements: [], coachMessages: [], workoutPlans: [],
    targets: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    preferences: { timezone: 'Asia/Bangkok', weekStartsOn: 1, units: 'metric' }
  });
  function readData() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (saved && saved.version === 2) return { ...defaultData(), ...saved };
    } catch (error) { console.warn('อ่านข้อมูลที่บันทึกไว้ไม่ได้', error); }
    return defaultData();
  }
  let data = readData();
  let page = 'overview';
  let selectedDate = today();
  let reportPeriod = 'week';
  let editingActivity = null;
  let editingTimeLog = null;
  let editingMeal = null;
  let editingMeasurement = null;
  let notice = '';
  const legacyCount = ['lhp_activities','lhp_logs','lhp_foods','lhp_body'].reduce((count,key) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return count + (Array.isArray(value) ? value.length : value && typeof value === 'object' ? 1 : 0); } catch { return count; }
  },0);
  function save(message = 'บันทึกข้อมูลแล้ว') {
    try { localStorage.setItem(KEY, JSON.stringify(data)); notice = message; render(); }
    catch { alert('บันทึกไม่สำเร็จ พื้นที่จัดเก็บของเบราว์เซอร์อาจเต็ม'); }
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
  function renderCoachConversation() {
    const messages=(data.coachMessages||[]).slice(-8);
    if(!messages.length) return '<div class="coach-empty">เล่าว่าวันนี้หรือเมื่อวานทำอะไรไปบ้าง เช่น “เมื่อวานวิดพื้น 2 เซ็ต วันนี้เดินเยอะและรู้สึกล้า” ผู้ช่วยจะนำไปเทียบกับประวัติการฝึกที่บันทึกไว้</div>';
    return messages.map(message=>{
      if(message.role==='user') return '<div class="coach-message user"><b>คุณ</b><p>'+esc(message.text)+'</p></div>';
      const result=message.result||{};
      const plan=result.plan;
      const planMarkup=plan?'<div class="ai-plan"><b>'+esc(plan.title||'แผนฝึก')+'</b><p>'+esc(plan.reason||'')+'</p>'+(plan.restDay?'<p>วันนี้เป็นวันพักหรือฟื้นตัว</p>':'<ul>'+(plan.items||[]).map(item=>'<li><b>'+esc(item.exercise)+'</b> · '+esc(item.sets)+' เซ็ต × '+esc(item.reps)+' · พัก '+esc(item.restSeconds)+' วินาที'+(item.targetMuscles?' · '+esc(item.targetMuscles):'')+'</li>').join('')+'</ul>')+'<button type="button" class="secondary-button" data-apply-plan="'+(data.coachMessages||[]).indexOf(message)+'">ยืนยันใช้แผนนี้</button></div>':'';
      return '<div class="coach-message assistant"><b>Gemini · โค้ชออกกำลังกาย</b><p>'+esc(result.reply||'')+'</p>'+planMarkup+'</div>';
    }).join('');
  }
  async function askWorkoutCoach(text) {
    const form=$('#coach-form'), submit=form.querySelector('button[type="submit"]');
    const prior=(data.coachMessages||[]).filter(message=>message.date===selectedDate).slice(-6).map(message=>({role:message.role==='user'?'user':'assistant',text:message.role==='user'?message.text:(message.result?.reply||'')}));
    const history=data.workouts.filter(item=>item.date<=selectedDate).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12).map(item=>({date:item.date,exercise:item.exercise,sets:item.sets,reps:item.reps,effort:item.effort,notes:item.notes}));
    const payload={date:selectedDate,message:text||'จากประวัติที่บันทึกไว้ ช่วยประเมินว่าควรฝึกหรือพักวันนี้',conversation:prior,workouts:history,existingPlan:(data.workoutPlans||[]).filter(plan=>plan.date===selectedDate).slice(-1)[0]||null};
    if(text){data.coachMessages.push({role:'user',text,date:selectedDate,createdAt:new Date().toISOString()});data.coachMessages=data.coachMessages.slice(-16);renderCoachMessagesOnly();}
    submit.disabled=true;submit.textContent='กำลังคิดแผน…';
    try {
      const response=await fetch('/api/workout-coach',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body.error||'เชื่อมต่อผู้ช่วยไม่สำเร็จ');
      data.coachMessages.push({role:'assistant',result:body,date:selectedDate,createdAt:new Date().toISOString()});
      data.coachMessages=data.coachMessages.slice(-16);
      save('ได้รับคำแนะนำจาก Gemini แล้ว');
    } catch(error) {
      if(text)data.coachMessages=data.coachMessages.filter((message,index)=>!(message.role==='user'&&message.text===text&&index===data.coachMessages.length-1));
      notice='';render();
      alert(error.message+' หากยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Vercel ให้เพิ่มคีย์ก่อนใช้งาน');
    } finally {
      const current=$('#coach-form button[type="submit"]');
      if(current){current.disabled=false;current.textContent='ส่งข้อความ';}
    }
  }
  function renderCoachMessagesOnly(){const target=$('.coach-conversation');if(target)target.innerHTML=renderCoachConversation();}
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
  function renderExercise() {
    const sessions=data.workouts.filter(x=>x.date===selectedDate).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const activePlan=(data.workoutPlans||[]).find(item=>item.date===selectedDate);
    const planCard=activePlan?card('แผนฝึกที่ยืนยันแล้ว','<p><b>'+esc(activePlan.title)+'</b></p><p class="muted small-text">'+esc(activePlan.reason||'')+'</p>'+(activePlan.restDay?'<div class="notice subtle">วันนี้เป็นวันพักหรือฟื้นตัว</div>':'<ol class="ai-plan-list">'+(activePlan.items||[]).map(item=>'<li><b>'+esc(item.exercise)+'</b><br>'+esc(item.sets)+' เซ็ต × '+esc(item.reps)+' · พัก '+esc(item.restSeconds)+' วินาที<br><small>'+esc(item.targetMuscles||'')+'</small></li>').join('')+'</ol>')+'<p class="muted small-text">ยืนยันเมื่อ '+new Date(activePlan.acceptedAt).toLocaleString('th-TH')+'</p>'):'';
    const coach=card('โค้ชออกกำลังกาย AI','<p class="muted small-text">คุยภาษาไทยได้ตามปกติ เล่าการฝึก ความล้า หรือถามเรื่องท่าและการพัก โค้ชจะพิจารณาประวัติที่บันทึกในเว็บไซต์และเสนอแผนให้คุณยืนยันก่อนใช้งาน</p><div class="coach-conversation">'+renderCoachConversation()+'</div><form id="coach-form" class="coach-form"><textarea id="coach-input" name="message" rows="3" maxlength="1200" placeholder="เช่น เมื่อวานวิดพื้น 2 เซ็ต วันนี้รู้สึกตึงแขนเล็กน้อย ควรฝึกอะไรดี?"></textarea><div class="button-row"><button class="primary-button" type="submit">ส่งข้อความ</button><button class="secondary-button" type="button" id="coach-history">วิเคราะห์จากประวัติที่บันทึก</button><button class="text-button" type="button" id="coach-clear">ล้างบทสนทนา</button></div></form><p class="muted small-text">ใช้ Gemini API Free Tier ผ่านเซิร์ฟเวอร์ ข้อมูลที่ส่งมีเฉพาะข้อความ ประวัติฝึกที่เกี่ยวข้อง และแผนฝึกปัจจุบัน ไม่ส่งข้อมูลร่างกายหรือโภชนาการโดยอัตโนมัติ</p>','coach-panel');
    return '<div class="page-title"><div><p class="eyebrow">MOVE & RECOVER</p><h1>ออกกำลังกาย</h1><p class="muted">บันทึกผลและใช้ผู้ช่วยวางแผนจากสิ่งที่ทำจริง</p></div><div class="date-control"><input type="date" id="exercise-date" value="'+selectedDate+'"></div></div>'+
      coach+planCard+
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
    const latest=list[0];
    return '<div class="page-title"><div><p class="eyebrow">BODY & RECOVERY</p><h1>ข้อมูลร่างกาย</h1><p class="muted">บันทึกเป็นประวัติรายวัน ไม่เขียนทับค่าครั้งก่อน</p></div></div>'+
      card('เพิ่มข้อมูลร่างกาย','<form id="body-form" class="form-grid">'+dateInput(selectedDate)+formField('น้ำหนัก (kg)','<input type="number" name="weight" min=".1" max="500" step=".1" required>')+formField('ส่วนสูง (cm)','<input type="number" name="height" min="30" max="250" step=".1">')+formField('รอบเอว (cm)','<input type="number" name="waist" min="1" max="300" step=".1">')+formField('เวลานอน (ชั่วโมง)','<input type="number" name="sleep" min="0" max="24" step=".1">')+formField('น้ำดื่ม (ลิตร)','<input type="number" name="water" min="0" max="20" step=".1">')+formField('หมายเหตุ','<input name="notes" maxlength="200" placeholder="ไม่บังคับ">')+'<div class="form-actions"><button class="primary-button">บันทึกข้อมูล</button></div></form>')+
      card('ประวัติข้อมูล',list.length?list.map(x=>'<div class="list-row"><div><b>'+fmtDate(x.date)+' · '+x.weight+' kg</b><small>'+(x.height?'ส่วนสูง '+x.height+' cm':'')+(x.waist?' · รอบเอว '+x.waist+' cm':'')+(x.sleep?' · นอน '+x.sleep+' ชม.':'')+(x.water?' · น้ำ '+x.water+' ลิตร':'')+'</small>'+(x.notes?'<small>'+esc(x.notes)+'</small>':'')+'</div><button class="danger-link" data-delete-measurement="'+x.id+'">ลบ</button></div>').join(''):'<div class="empty-state">ยังไม่มีข้อมูลร่างกาย</div>')+
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
      card('ความเป็นส่วนตัว','<p>ข้อมูลทั่วไปของเว็บไซต์ยังเก็บในเบราว์เซอร์นี้ ส่วนฟีเจอร์โค้ชออกกำลังกายจะส่งเฉพาะข้อความที่คุณส่ง ประวัติการฝึกที่เกี่ยวข้อง และแผนฝึกปัจจุบันไปยัง Google Gemini API เพื่อสร้างคำแนะนำ</p><p class="muted small-text">Gemini API Free Tier อาจนำเนื้อหาที่ส่งไปใช้ปรับปรุงผลิตภัณฑ์ของ Google โปรดหลีกเลี่ยงข้อมูลระบุตัวตนและข้อมูลสุขภาพที่ละเอียดอ่อน ข้อมูลร่างกายและโภชนาการจะไม่ถูกส่งโดยอัตโนมัติ</p><p class="muted small-text">API Key เก็บใน Environment Variable ฝั่งเซิร์ฟเวอร์ ไม่อยู่ในโค้ดหน้าเว็บ</p><button class="danger-button" id="clear-data">ลบข้อมูลในเว็บนี้ทั้งหมด</button>');
  }
  function render() {
    nav(); header();
    const pages={overview:renderOverview,schedule:renderSchedule,time:renderTime,exercise:renderExercise,nutrition:renderNutrition,body:renderBody,reports:renderReports,settings:renderSettings};
    $('#view').innerHTML=(pages[page]||renderOverview)();
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
    $('[data-status]').forEach(b=>b.addEventListener('click',()=>{const a=data.activities.find(x=>x.id===b.dataset.status);const options=['planned','completed','skipped','rescheduled'];a.status=options[(options.indexOf(a.status)+1)%options.length];save('เปลี่ยนสถานะแล้ว')}));
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
    $('[data-edit-log]').forEach(b=>b.addEventListener('click',()=>{editingTimeLog=data.timeLogs.find(x=>x.id===b.dataset.editLog);const form=$('#time-form');for(const [key,value] of Object.entries(editingTimeLog))if(form.elements[key])form.elements[key].value=value;form.querySelector('button[type="submit"],button:not([type])').textContent='บันทึกการแก้ไข';form.scrollIntoView({behavior:'smooth',block:'center'})}));
    $('[data-delete-log]').forEach(b=>b.addEventListener('click',()=>{if(confirm('ลบบันทึกเวลานี้หรือไม่?')){data.timeLogs=data.timeLogs.filter(x=>x.id!==b.dataset.deleteLog);save()}}));
  }
  function bindExercise() {
    $('#exercise-date').addEventListener('change',e=>{selectedDate=e.target.value;render()});
    $('#coach-form').addEventListener('submit',e=>{e.preventDefault();const text=$('#coach-input').value.trim();if(!text)return alert('กรุณาพิมพ์ข้อความก่อนส่ง');$('#coach-input').value='';askWorkoutCoach(text)});
    $('#coach-history').addEventListener('click',()=>askWorkoutCoach(''));
    $('#coach-clear').addEventListener('click',()=>{if(confirm('ล้างบทสนทนากับผู้ช่วยออกจากอุปกรณ์นี้หรือไม่?')){data.coachMessages=[];save('ล้างบทสนทนาแล้ว')}});
    $('[data-apply-plan]').forEach(b=>b.addEventListener('click',()=>applyWorkoutPlan(Number(b.dataset.applyPlan))));
    $('[data-log-exercise]').forEach(b=>b.addEventListener('click',()=>{$('#exercise-editor').innerHTML=workoutForm(Number(b.dataset.logExercise));bindWorkoutForm(Number(b.dataset.logExercise))}));
    $('[data-delete-workout]').forEach(b=>b.addEventListener('click',()=>{if(confirm('ลบบันทึกการฝึกนี้หรือไม่?')){data.workouts=data.workouts.filter(x=>x.id!==b.dataset.deleteWorkout);save()}}));
  }
  function bindWorkoutForm(index) {
    $('#cancel-exercise').addEventListener('click',()=>$('#exercise-editor').innerHTML='');
    $('#workout-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget),ex=exerciseLibrary[index];data.workouts.push({id:uid(),date:f.get('date'),exercise:ex.name,sets:Number(f.get('sets')),reps:f.get('reps'),rest:Number(f.get('rest')),effort:f.get('effort'),notes:f.get('notes'),createdAt:new Date().toISOString()});save('บันทึกผลการฝึกแล้ว')});
  }
  function bindNutrition() {
    $('#nutrition-date').addEventListener('change',e=>{selectedDate=e.target.value;render()});
    $('#meal-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget),entry={id:editingMeal?.id||uid(),date:f.get('date'),title:f.get('title'),meal:f.get('meal'),serving:f.get('serving'),calories:Number(f.get('calories')),protein:Number(f.get('protein')),carbs:Number(f.get('carbs')),fat:Number(f.get('fat')),source:f.get('source'),confidence:'estimated',createdAt:editingMeal?.createdAt||new Date().toISOString()};if(Object.values(entry).some(v=>typeof v==='number'&&(!Number.isFinite(v)||v<0)))return alert('กรุณาตรวจสอบตัวเลขโภชนาการ');if(editingMeal)data.meals=data.meals.map(x=>x.id===entry.id?entry:x);else data.meals.push(entry);editingMeal=null;save('บันทึกอาหารแล้ว')});
    $('[data-edit-meal]').forEach(b=>b.addEventListener('click',()=>{editingMeal=data.meals.find(x=>x.id===b.dataset.editMeal);const form=$('#meal-form');for(const [key,value] of Object.entries(editingMeal))if(form.elements[key])form.elements[key].value=value;form.scrollIntoView({behavior:'smooth',block:'center'})}));
    $('[data-delete-meal]').forEach(b=>b.addEventListener('click',()=>{if(confirm('ลบรายการอาหารนี้หรือไม่?')){data.meals=data.meals.filter(x=>x.id!==b.dataset.deleteMeal);save()}}));
  }
  function bindBody() {
    $('#body-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget),weight=Number(f.get('weight'));if(!(weight>0))return alert('กรุณากรอกน้ำหนักให้ถูกต้อง');const optional=k=>f.get(k)===''?null:Number(f.get(k));data.measurements.push({id:uid(),date:f.get('date'),weight,height:optional('height'),waist:optional('waist'),sleep:optional('sleep'),water:optional('water'),notes:f.get('notes'),createdAt:new Date().toISOString()});save('บันทึกข้อมูลร่างกายแล้ว')});
    $$('[data-delete-measurement]').forEach(b=>b.addEventListener('click',()=>{if(confirm('ลบข้อมูลร่างกายรายการนี้หรือไม่?')){data.measurements=data.measurements.filter(x=>x.id!==b.dataset.deleteMeasurement);save()}}));
  }
  function bindReports() {
    $('#report-date').addEventListener('change',e=>{selectedDate=e.target.value;render()});
    $$('[data-period]').forEach(b=>b.addEventListener('click',()=>{reportPeriod=b.dataset.period;render()}));
  }
  function bindSettings() {
    $('#targets-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);data.targets={calories:Number(f.get('calories'))||0,protein:Number(f.get('protein'))||0,carbs:Number(f.get('carbs'))||0,fat:Number(f.get('fat'))||0};save('บันทึกเป้าหมายแล้ว')});
    $('#export-data').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='life-health-planner-'+today()+'.json';a.click();URL.revokeObjectURL(url)});
    $('#import-data').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(parsed.version!==2||!Array.isArray(parsed.activities)||!Array.isArray(parsed.timeLogs)||!Array.isArray(parsed.meals)||!Array.isArray(parsed.workouts)||!Array.isArray(parsed.measurements))throw new Error('รูปแบบไฟล์ไม่ตรงกับข้อมูลของ Life & Health Planner');for(const key of ['activities','timeLogs','meals','workouts','measurements'])data[key].push(...parsed[key].map(x=>({...x,id:uid()})));save('นำเข้าข้อมูลแล้ว');}catch(err){alert('นำเข้าข้อมูลไม่สำเร็จ: '+err.message)}e.target.value=''});
    $('#clear-data').addEventListener('click',()=>{if(confirm('ลบข้อมูลใหม่ทั้งหมดในเว็บนี้หรือไม่? การดำเนินการย้อนกลับไม่ได้ หากต้องการเก็บข้อมูลให้ส่งออกก่อน')){data=defaultData();save('ลบข้อมูลในเว็บนี้แล้ว')}});
  }
  $('#nav').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b){page=b.dataset.page;notice='';render()}});
  $('#view').addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b){page=b.dataset.go;render()}});
  $('#global-date').addEventListener('change',e=>{selectedDate=e.target.value;render()});
  $('#global-date').value=selectedDate;
  render();
})();
