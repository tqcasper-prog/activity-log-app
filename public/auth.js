(() => {
  'use strict';
  const CONFIG_URL = '/api/config';
  const $ = (selector, root=document) => root.querySelector(selector);
  let client = null;
  let currentUser = null;
  let profile = null;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  let resolveUser;
  const userReady = new Promise(resolve => { resolveUser = resolve; });

  function styleAndGate() {
    const shell = $('.app-shell');
    if (shell) shell.style.display = 'none';
    if ($('#lhp-auth-gate')) return;
    const gate = document.createElement('main');
    gate.id = 'lhp-auth-gate';
    gate.innerHTML = '<section class="lhp-auth-card"><div class="lhp-auth-brand">LHP</div><h1>Life &amp; Health Planner</h1><p class="lhp-auth-muted">เข้าสู่ระบบเพื่อเก็บข้อมูลสุขภาพและแผนของคุณอย่างเป็นส่วนตัว</p><form id="lhp-auth-form"><label id="lhp-name-label" hidden>ชื่อผู้ใช้<input name="display_name" type="text" autocomplete="nickname" maxlength="60" placeholder="ชื่อที่ต้องการให้แสดง"></label><label>อีเมล<input name="email" type="email" autocomplete="username" required maxlength="254" placeholder="name@example.com"></label><label>รหัสผ่าน<div class="lhp-password-wrap"><input id="lhp-password" name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="128" placeholder="อย่างน้อย 8 ตัวอักษร"><button type="button" id="lhp-toggle-password" aria-label="แสดงรหัสผ่าน" aria-pressed="false">แสดง</button></div></label><label class="lhp-remember"><input type="checkbox" id="lhp-remember" checked> จดจำการเข้าสู่ระบบในอุปกรณ์นี้</label><div class="lhp-auth-actions"><button class="lhp-auth-primary" type="submit" id="lhp-login">เข้าสู่ระบบ</button><button class="lhp-auth-secondary" type="button" id="lhp-signup">สร้างบัญชีใหม่</button></div></form><button class="lhp-auth-link" type="button" id="lhp-forgot">ลืมรหัสผ่าน?</button><p id="lhp-auth-message" role="status" aria-live="polite"></p><small>บัญชีแต่ละบัญชีจะเห็นเฉพาะข้อมูลของตนเอง</small></section>';
    const style = document.createElement('style');
    style.textContent = '#lhp-auth-gate{min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f7f5;color:#20342b;font-family:Tahoma,Arial,sans-serif}#lhp-auth-gate .lhp-auth-card{width:min(100%,430px);background:#fff;border:1px solid #e1e9e4;border-radius:22px;padding:30px;box-shadow:0 18px 55px rgba(30,65,48,.09)}.lhp-auth-brand{width:46px;height:46px;display:grid;place-items:center;background:#24765d;color:#fff;border-radius:14px;font-weight:800;margin-bottom:18px}#lhp-auth-gate h1{font-size:23px;margin:0 0 8px}#lhp-auth-gate .lhp-auth-muted,#lhp-auth-gate small{color:#718078;font-size:13px;line-height:1.6}#lhp-auth-form{display:grid;gap:14px;margin-top:22px}#lhp-auth-form label{display:grid;gap:6px;font-size:13px;font-weight:700}#lhp-auth-form input{padding:12px;border:1px solid #dce6df;border-radius:10px;font:inherit}.lhp-password-wrap{display:flex;gap:7px}.lhp-password-wrap input{min-width:0;flex:1}.lhp-password-wrap button{border:1px solid #dce6df;background:#f6faf7;border-radius:9px;padding:0 12px;color:#24765d;cursor:pointer}.lhp-remember{display:flex!important;grid-template-columns:18px 1fr;align-items:center;gap:8px!important;font-weight:400!important}.lhp-remember input{width:16px;height:16px;padding:0}#lhp-auth-form input:focus{outline:2px solid #cde6d9;border-color:#24765d}.lhp-auth-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}.lhp-auth-primary,.lhp-auth-secondary{border:0;border-radius:10px;padding:12px;font-weight:700;cursor:pointer}.lhp-auth-primary{background:#24765d;color:white}.lhp-auth-secondary{background:#e8f3ee;color:#24765d}.lhp-auth-link{margin-top:14px;background:none;border:0;color:#24765d;cursor:pointer}#lhp-auth-message{min-height:22px;color:#9b4b38;font-size:12px;line-height:1.6}#lhp-auth-gate small{display:block}#lhp-user-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#lhp-user-actions button{border:1px solid #dce6df;background:#fff;border-radius:9px;padding:7px 10px;color:#24765d;font-size:12px;cursor:pointer}#lhp-admin-modal{position:fixed;inset:0;z-index:9999;background:rgba(18,35,27,.55);display:none;place-items:center;padding:18px}#lhp-admin-modal.open{display:grid}#lhp-admin-modal .panel{background:#fff;width:min(100%,980px);max-height:90vh;overflow:auto;border-radius:16px;padding:20px;color:#20342b}#lhp-admin-modal table{width:100%;border-collapse:collapse;font-size:12px}#lhp-admin-modal th,#lhp-admin-modal td{padding:9px;border-bottom:1px solid #e5ece7;text-align:left;vertical-align:middle}#lhp-admin-modal input{width:74px;padding:6px;border:1px solid #dce6df;border-radius:7px}#lhp-admin-modal button{cursor:pointer}#lhp-admin-modal .admin-actions{display:flex;gap:8px;justify-content:flex-end;margin-bottom:12px}#lhp-admin-modal .admin-note{color:#718078;font-size:12px}';
    document.head.appendChild(style);
    document.body.appendChild(gate);
  }

  function message(text, ok=false) {
    const node = $('#lhp-auth-message');
    if (node) { node.textContent = text; node.style.color = ok ? '#24765d' : '#9b4b38'; }
  }
  function loadScript(src) {
    return new Promise((resolve,reject) => {
      const script=document.createElement('script'); script.src=src; script.async=true;
      script.onload=resolve; script.onerror=()=>reject(new Error('โหลดไลบรารีล็อกอินไม่สำเร็จ'));
      document.head.appendChild(script);
    });
  }
  async function setUser(user) {
    currentUser = user || null;
    profile = null;
    if (currentUser) {
      const {data,error}=await client.from('profiles').select('email,display_name,role,account_status').eq('id',currentUser.id).maybeSingle();
      if (error) throw error;
      profile=data;
      if (!profile || profile.account_status !== 'active') {
        await client.auth.signOut();
        currentUser=null; profile=null;
        message('บัญชีนี้ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
        return;
      }
      const gate=$('#lhp-auth-gate'); if(gate) gate.remove();
      const shell=$('.app-shell'); if(shell) shell.style.display='';
      addUserActions();
      resolveUser(currentUser);
      resolveReady({client,user:currentUser,profile});
      return;
    }
    const shell=$('.app-shell'); if(shell) shell.style.display='none';
    styleAndGate();
  }
  async function recordLoginEvent(eventType) {
    if (!currentUser) return;
    const {error}=await client.from('user_login_history').insert({
      user_id:currentUser.id,event_type:eventType,
      user_agent:String(navigator.userAgent||'').slice(0,500)
    });
    if(error) console.warn('บันทึกประวัติการเข้าสู่ระบบไม่สำเร็จ',error.message);
  }
  function addUserActions() {
    let wrap=$('#lhp-user-actions');
    if(!wrap){wrap=document.createElement('div');wrap.id='lhp-user-actions';$('.top-actions')?.appendChild(wrap);}
    const label=profile?.display_name||currentUser.email;
    wrap.innerHTML='<span style="font-size:11px;color:#718078;max-width:180px;overflow-wrap:anywhere">'+label.replace(/[&<>"]/g,'')+'</span><button type="button" id="lhp-login-history-open">ประวัติการเข้าสู่ระบบ</button>'+(profile?.role==='admin'?'<button type="button" id="lhp-admin-open">จัดการสมาชิก</button>':'')+'<button type="button" id="lhp-logout">ออกจากระบบ</button>';
    $('#lhp-logout')?.addEventListener('click',async()=>{await recordLoginEvent('sign_out');await client.auth.signOut();location.reload();});
    $('#lhp-login-history-open')?.addEventListener('click',openLoginHistory);
    $('#lhp-admin-open')?.addEventListener('click',openAdmin);
  }
  async function signup(email,password,displayName) {
    const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin,data:{display_name:displayName}}});
    if(error) throw error;
    if(data.session) await setUser(data.user);
    else message('สร้างบัญชีแล้ว กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ',true);
  }
  async function login(email,password) {
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error) throw error;
    await setUser(data.user);
    await recordLoginEvent('sign_in');
  }
  async function forgot(email) {
    if(!email) throw new Error('กรุณากรอกอีเมลก่อน');
    const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin});
    if(error) throw error;
    message('ส่งลิงก์ตั้งรหัสผ่านไปยังอีเมลแล้ว หากไม่พบให้ตรวจสอบจดหมายขยะ',true);
  }
  function showRecoveryForm() {
    const gate=$('#lhp-auth-gate');if(!gate)return;
    gate.innerHTML='<section class="lhp-auth-card"><div class="lhp-auth-brand">LHP</div><h1>ตั้งรหัสผ่านใหม่</h1><p class="lhp-auth-muted">กำหนดรหัสผ่านใหม่สำหรับบัญชีของคุณ</p><form id="lhp-recovery-form"><label>รหัสผ่านใหม่<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label>ยืนยันรหัสผ่านใหม่<input name="confirm" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><button class="lhp-auth-primary" type="submit">บันทึกรหัสผ่านใหม่</button></form><p id="lhp-auth-message" role="status" aria-live="polite"></p></section>';
    $('#lhp-recovery-form').addEventListener('submit',async event=>{
      event.preventDefault();const form=new FormData(event.currentTarget),password=String(form.get('password')||''),confirmPassword=String(form.get('confirm')||'');
      if(password.length<8){message('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');return;}
      if(password!==confirmPassword){message('รหัสผ่านทั้งสองช่องไม่ตรงกัน');return;}
      const button=event.currentTarget.querySelector('button');button.disabled=true;message('กำลังบันทึกรหัสผ่าน…',true);
      const {error}=await client.auth.updateUser({password});
      if(error){message(error.message);button.disabled=false;return;}
      message('เปลี่ยนรหัสผ่านสำเร็จ กำลังกลับไปหน้าเข้าสู่ระบบ',true);
      await client.auth.signOut();location.hash='';location.reload();
    });
  }
  function bindAuthForm() {
    $('#lhp-auth-form')?.addEventListener('submit',async e=>{
      e.preventDefault(); const form=new FormData(e.currentTarget);
      const email=String(form.get('email')||'').trim().toLowerCase(), password=String(form.get('password')||'');
      const button=$('#lhp-login'); button.disabled=true; message('กำลังเข้าสู่ระบบ…',true);
      try { await login(email,password); }
      catch(error){message(error.message||'เข้าสู่ระบบไม่สำเร็จ');}
      finally{button.disabled=false;}
    });
    $('#lhp-signup')?.addEventListener('click',async()=>{
      const form=new FormData($('#lhp-auth-form'));
      const email=String(form.get('email')||'').trim().toLowerCase(),password=String(form.get('password')||''),displayName=String(form.get('display_name')||'').trim();
      if(!displayName){$('#lhp-name-label').hidden=false;message('กรุณากรอกชื่อผู้ใช้ก่อนสร้างบัญชี');$('#lhp-name-label input').focus();return;}
      if(!email||password.length<8){message('กรอกอีเมลและรหัสผ่านอย่างน้อย 8 ตัวอักษร');return;}
      const button=$('#lhp-signup');button.disabled=true;message('กำลังสร้างบัญชี…',true);
      try{await signup(email,password,displayName);}catch(error){message(error.message||'สร้างบัญชีไม่สำเร็จ');}
      finally{button.disabled=false;}
    });
    $('#lhp-toggle-password')?.addEventListener('click',()=>{
      const field=$('#lhp-password'),show=field.type==='password';field.type=show?'text':'password';
      $('#lhp-toggle-password').textContent=show?'ซ่อน':'แสดง';
      $('#lhp-toggle-password').setAttribute('aria-pressed',String(show));
      $('#lhp-toggle-password').setAttribute('aria-label',show?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน');
    });
    
    $('#lhp-forgot')?.addEventListener('click',async()=>{
      const email=String(new FormData($('#lhp-auth-form')).get('email')||'').trim().toLowerCase();
      try{await forgot(email);}catch(error){message(error.message||'ส่งลิงก์ไม่สำเร็จ');}
    });
  }
  async function openLoginHistory() {
    let modal=$('#lhp-login-history-modal');
    if(!modal){
      modal=document.createElement('div');modal.id='lhp-admin-modal';modal.innerHTML='<section class="panel"><div class="admin-actions"><button id="lhp-history-refresh">รีเฟรช</button><button id="lhp-history-close">ปิด</button></div><h2>ประวัติการเข้าสู่ระบบ</h2><p class="admin-note">แสดงรายการเข้าสู่ระบบและออกจากระบบล่าสุดของบัญชีนี้ โดยไม่เก็บรหัสผ่าน</p><div id="lhp-history-content">กำลังโหลด…</div></section>';
      modal.id='lhp-login-history-modal';document.body.appendChild(modal);
      $('#lhp-history-close').addEventListener('click',()=>modal.classList.remove('open'));
      $('#lhp-history-refresh').addEventListener('click',renderLoginHistory);
      modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open');});
    }
    modal.classList.add('open');await renderLoginHistory();
  }
  async function renderLoginHistory() {
    const target=$('#lhp-history-content');if(!target)return;
    target.textContent='กำลังโหลดประวัติ…';
    const {data,error}=await client.from('user_login_history').select('event_type,user_agent,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(30);
    if(error){target.textContent='โหลดประวัติไม่สำเร็จ: '+error.message;return;}
    if(!data?.length){target.textContent='ยังไม่มีประวัติการเข้าสู่ระบบ';return;}
    const escape=value=>String(value||'').replace(/[&<>"]/g,'');
    target.innerHTML='<div style="overflow:auto"><table><thead><tr><th>กิจกรรม</th><th>วันและเวลา</th><th>อุปกรณ์/เบราว์เซอร์</th></tr></thead><tbody>'+data.map(item=>'<tr><td>'+ (item.event_type==='sign_in'?'เข้าสู่ระบบ':'ออกจากระบบ')+'</td><td>'+new Date(item.created_at).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'})+'</td><td>'+escape(item.user_agent||'ไม่ทราบ')+'</td></tr>').join('')+'</tbody></table></div>';
  }
  async function openAdmin() {
    if(profile?.role!=='admin') return;
    let modal=$('#lhp-admin-modal');
    if(!modal){modal=document.createElement('div');modal.id='lhp-admin-modal';modal.innerHTML='<section class="panel"><div class="admin-actions"><button id="lhp-admin-refresh">รีเฟรช</button><button id="lhp-admin-close">ปิด</button></div><h2>จัดการสมาชิกและโควต้า Gemini</h2><p class="admin-note">กำหนดจำนวนคำขอสูงสุดต่อวันและต่อเดือนให้สมาชิกแต่ละบัญชี การตั้งค่า 0 หมายถึงไม่อนุญาตให้ใช้</p><div id="lhp-admin-content">กำลังโหลด…</div></section>';document.body.appendChild(modal);
      $('#lhp-admin-close').addEventListener('click',()=>modal.classList.remove('open'));
      $('#lhp-admin-refresh').addEventListener('click',renderAdmin);
      modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open');});
    }
    modal.classList.add('open'); await renderAdmin();
  }
  async function renderAdmin() {
    const target=$('#lhp-admin-content'); if(!target)return;
    target.textContent='กำลังโหลดข้อมูลสมาชิก…';
    const {data,error}=await client.rpc('admin_list_users');
    if(error){target.textContent='โหลดข้อมูลไม่สำเร็จ: '+error.message;return;}
    target.innerHTML='<div style="overflow:auto"><table><thead><tr><th>สมาชิก</th><th>สิทธิ์/สถานะ</th><th>ใช้วันนี้</th><th>ใช้เดือนนี้</th><th>โควต้ารายวัน</th><th>โควต้ารายเดือน</th><th>เปิดใช้</th><th>บันทึก</th></tr></thead><tbody>'+data.map(u=>'<tr data-user="'+u.user_id+'"><td>'+String(u.email||'').replace(/[&<>"]/g,'')+'</td><td>'+u.role+' / '+u.account_status+'</td><td>'+u.daily_used+'</td><td>'+u.monthly_used+'</td><td><input type="number" min="0" max="100000" data-daily value="'+u.daily_limit+'"></td><td><input type="number" min="0" max="1000000" data-monthly value="'+u.monthly_limit+'"></td><td><input type="checkbox" data-enabled '+(u.enabled?'checked':'')+'></td><td><button data-save-quota>บันทึกโควต้า</button>'+(u.user_id!==currentUser.id?'<button data-toggle-status="'+(u.account_status==='active'?'suspended':'active')+'">'+(u.account_status==='active'?'ระงับ':'เปิดใช้งาน')+'</button>':'')+'</td></tr>').join('')+'</tbody></table></div><p class="admin-note" id="lhp-admin-status"></p>';
    target.querySelectorAll('[data-save-quota]').forEach(button=>button.addEventListener('click',async()=>{
      const row=button.closest('tr'),daily=Number(row.querySelector('[data-daily]').value),monthly=Number(row.querySelector('[data-monthly]').value),enabled=row.querySelector('[data-enabled]').checked;
      if(!Number.isInteger(daily)||!Number.isInteger(monthly)||daily<0||monthly<0){$('#lhp-admin-status').textContent='โควต้าต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป';return;}
      button.disabled=true;
      const {error}=await client.rpc('admin_set_user_quota',{p_user_id:row.dataset.user,p_daily_limit:daily,p_monthly_limit:monthly,p_enabled:enabled});
      $('#lhp-admin-status').textContent=error?'บันทึกไม่สำเร็จ: '+error.message:'บันทึกโควต้าสำเร็จ';
      button.disabled=false; if(!error)await renderAdmin();
    }));
    target.querySelectorAll('[data-toggle-status]').forEach(button=>button.addEventListener('click',async()=>{
      const row=button.closest('tr');button.disabled=true;
      const {error}=await client.rpc('admin_set_user_status',{p_user_id:row.dataset.user,p_status:button.dataset.toggleStatus});
      $('#lhp-admin-status').textContent=error?'เปลี่ยนสถานะไม่สำเร็จ: '+error.message:'เปลี่ยนสถานะสมาชิกแล้ว';
      if(!error)await renderAdmin();else button.disabled=false;
    }));
  }

  async function initialize() {
    styleAndGate();
    try {
      const response=await fetch(CONFIG_URL,{cache:'no-store'});
      const config=await response.json();
      if(!response.ok||!config.url||!config.publishableKey)throw new Error(config.error||'ยังไม่ได้ตั้งค่า Supabase ในระบบ');
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/dist/umd/supabase.js');
      const remember=$('#lhp-remember');
      if(remember) remember.checked=localStorage.getItem('lhp_remember_login')!=='false';
      remember?.addEventListener('change',()=>localStorage.setItem('lhp_remember_login',String(remember.checked)));
      const storage={
        getItem:key=>(remember?.checked?localStorage:sessionStorage).getItem(key),
        setItem:(key,value)=>(remember?.checked?localStorage:sessionStorage).setItem(key,value),
        removeItem:key=>{localStorage.removeItem(key);sessionStorage.removeItem(key);}
      };
      client=window.supabase.createClient(config.url,config.publishableKey,{auth:{storage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      bindAuthForm();
      const {data,error}=await client.auth.getSession();
      if(error)throw error;
      if(data.session)await setUser(data.session.user);else setUser(null);
      client.auth.onAuthStateChange(async(event,session)=>{
        if(event==='SIGNED_IN'&&session?.user){try{await setUser(session.user);}catch(error){message(error.message);}}
        if(event==='PASSWORD_RECOVERY'){showRecoveryForm();}
        if(event==='SIGNED_OUT'){currentUser=null;profile=null;}
      });
      resolveReady({client,user:currentUser,profile});
    } catch(error) {
      styleAndGate(); message(error.message||'เริ่มระบบสมาชิกไม่สำเร็จ');
      resolveReady({error});
    }
  }

  function originalStorage() { return window.LHPStorage; }
  async function loadCloudData(key) {
    await ready;
    const user=await userReady;
    const {data,error}=await client.from('user_app_data').select('data,schema_version').eq('user_id',user.id).maybeSingle();
    if(error)throw error;
    if(data?.data)return {data:data.data,source:'supabase',migrated:false};
    let local=null;
    try { local=await originalStorage().load(key); } catch {}
    let initial=local?.data||null;
    if(initial && confirm('พบข้อมูลเดิมในอุปกรณ์นี้ ต้องการนำเข้าข้อมูลเดิมเข้าบัญชีนี้หรือไม่? ต้นฉบับในอุปกรณ์จะไม่ถูกลบ')) {
      const {error:saveError}=await client.from('user_app_data').upsert({user_id:user.id,data:initial,schema_version:2,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      if(saveError)throw saveError;
      return {data:initial,source:'supabase',migrated:true};
    }
    return {data:null,source:'supabase',migrated:false};
  }
  async function saveCloudData(snapshot) {
    await ready;
    const user=await userReady;
    try { localStorage.setItem('lhp_backup_user_'+user.id,JSON.stringify(snapshot)); } catch {}
    const {error}=await client.from('user_app_data').upsert({user_id:user.id,data:snapshot,schema_version:2,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(error)throw error;
    return {source:'supabase',fallback:false};
  }

  const authApi={
    ready,
    waitForUser:()=>userReady,
    getClient:()=>client,
    getUser:()=>currentUser,
    getProfile:()=>profile,
    loadData:loadCloudData,
    saveData:saveCloudData,
    signOut:async()=>client?.auth.signOut()
  };
  window.LHPAuth=authApi;
  initialize();
})();