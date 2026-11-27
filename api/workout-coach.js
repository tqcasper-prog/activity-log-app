// Vercel serverless endpoint for the exercise coach.
// The Gemini key is read only from server-side environment variables.
const evidenceLibrary = require("../data/exercise-evidence.json");
const { randomUUID } = require("crypto");
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15;
const requestCounts = new Map();
let exerciseCatalogCache = null;
let exerciseCatalogCacheAt = 0;
const EXERCISE_CATALOG_CACHE_MS = 15 * 60 * 1000;
const responseSchema = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    hasPlan: { type: "BOOLEAN" },
    evidenceIds: { type: "ARRAY", items: { type: "STRING" } },
    nutritionAdvice: { type: "ARRAY", items: { type: "STRING" } },
    plan: { type: "OBJECT", properties: {
      date: { type: "STRING" }, title: { type: "STRING" }, reason: { type: "STRING" }, restDay: { type: "BOOLEAN" },
      evidenceSummary: { type: "STRING" }, evidenceIds: { type: "ARRAY", items: { type: "STRING" } },
      items: { type: "ARRAY", items: { type: "OBJECT", properties: {
        exerciseId: { type: "STRING" }, rationale: { type: "STRING" }, evidenceIds: { type: "ARRAY", items: { type: "STRING" } },
        exercise: { type: "STRING" }, sets: { type: "INTEGER" }, reps: { type: "STRING" },
        restSeconds: { type: "INTEGER" }, targetMuscles: { type: "STRING" }, note: { type: "STRING" },
      }, required: ["exerciseId","rationale","evidenceIds","exercise","sets","reps","restSeconds","targetMuscles","note"] } }
    }, required: ["date","title","reason","restDay","evidenceSummary","evidenceIds","items"] }
  }, required: ["reply","hasPlan","evidenceIds","nutritionAdvice","plan"]
};
function cleanText(value, max=500) { return typeof value==="string" ? value.trim().slice(0,max) : ""; }
const TOPIC_LABELS={nutrition:"โภชนาการและอาหาร",exercise_plan:"วางแผนการฝึก",exercise_technique:"เทคนิคท่าออกกำลังกาย",equipment_location:"สถานที่และอุปกรณ์",recovery:"การพักฟื้นและความพร้อม",general:"คำถามทั่วไป"};
function classifyTopics(message) {
  const value=String(message||"").toLowerCase();
  const rules=[
    ["nutrition",/อาหาร|โภชนาการ|กิน|รับประทาน|แคลอรี|แคลอรี่|โปรตีน|คาร์โบไฮเดรต|ไขมัน|มื้อ|เมนู|ข้าว|นม|ไข่|อาหารเสริม/],
    ["exercise_plan",/ตาราง|โปรแกรม|แผนฝึก|แผน.*ออกกำลังกาย|ออกกำลังกาย.*แผน|ช่วยคิดแผน|วันนี้.*ฝึก|วันนี้.*ออกกำลังกาย|ออกกำลังกายวันนี้|อยากออกกำลังกาย|อยากออกหนัก|ช่วย.*จัด.*โปรแกรม|จัด.*ฝึก|เซ็ต|จำนวนครั้ง/],
    ["exercise_technique",/ท่า|วิธีทำ|ทำอย่างไร|ท่าทาง|ฟอร์ม|วิดพื้น|สควอต|แพลงก์|ดึงข้อ/],
    ["equipment_location",/อุปกรณ์|เครื่องเล่น|เครื่องออกกำลัง|ดัมเบล|ยางยืด|ฟิตเนส|ยิม|สถานที่|ที่บ้าน|ที่ทำงาน|สวนสาธารณะ/],
    ["recovery",/พัก|ฟื้นตัว|ปวด|เจ็บ|ล้า|เหนื่อย|นอน|เมื่อย|ตึง|เวียนหัว|ความพร้อม/]
  ];
  const found=rules.filter(([,pattern])=>pattern.test(value)).map(([key])=>key);
  return found.length?found.slice(0,4):["general"];
}
function buildWarmupCooldown(items) {
  const muscles=(items||[]).map(item=>String(item.targetMuscles||"")).join(" ").toLowerCase();
  const warmup=[
    {exercise:"เดินอยู่กับที่หรือเดินเบา ๆ",duration:"2 นาที",instruction:"เริ่มช้า ๆ แล้วเพิ่มจังหวะเล็กน้อย ให้หายใจสะดวก"},
    {exercise:"หมุนหัวไหล่และแกว่งแขนเบา ๆ",duration:"1 นาที",instruction:"เคลื่อนไหวเป็นวงเล็กถึงกลาง ไม่เหวี่ยงหรือฝืนข้อ"},
    {exercise:"เคลื่อนไหวสะโพกและข้อเท้า",duration:"1 นาที",instruction:"หมุนข้อต่ออย่างนุ่มนวลและอยู่ในช่วงที่ไม่เจ็บ"},
    {exercise:"ซ้อมท่าหลักด้วยแรงเบา",duration:"1–2 นาที",instruction:"ทดลองการเคลื่อนไหวของท่าฝึกแรกโดยไม่ฝืนและยังไม่ใช้ความหนักเต็ม"}
  ];
  const cooldown=[{exercise:"เดินช้า ๆ ผ่อนแรง",duration:"1–2 นาที",instruction:"ลดความเร็วทีละน้อยจนการหายใจกลับมาสบาย"}];
  if(/อก|หน้าอก|ไหล่|แขน|triceps|biceps/.test(muscles)) cooldown.push({exercise:"ยืดอกและหัวไหล่เบา ๆ",duration:"20–30 วินาทีต่อข้าง",instruction:"เปิดอกอย่างนุ่มนวล ไม่ดึงแขนจนเจ็บ"});
  if(/หลัง|lat|สะบัก/.test(muscles)) cooldown.push({exercise:"ยืดหลังส่วนบนแบบโอบแขน",duration:"20–30 วินาที",instruction:"ยื่นแขนไปข้างหน้า โอบไหล่เบา ๆ และหายใจสม่ำเสมอ"});
  if(/ขา|ต้นขา|น่อง|quadriceps|hamstring/.test(muscles)) cooldown.push({exercise:"ยืดต้นขาด้านหน้าและน่อง",duration:"20–30 วินาทีต่อข้าง",instruction:"จับพยุงเพื่อการทรงตัว ยืดเพียงระดับตึงสบาย"});
  if(/สะโพก|ก้น|glute/.test(muscles)) cooldown.push({exercise:"ยืดสะโพกในท่านั่ง",duration:"20–30 วินาทีต่อข้าง",instruction:"นั่งในท่าที่มั่นคงและหยุดหากมีอาการเจ็บข้อ"});
  if(cooldown.length===1) cooldown.push({exercise:"ยืดกล้ามเนื้อที่ใช้งานอย่างนุ่มนวล",duration:"20–30 วินาที",instruction:"เลือกบริเวณที่รู้สึกตึง ยืดแค่ระดับสบาย ไม่เด้งหรือฝืน"});
  cooldown.push({exercise:"หายใจช้า ๆ",duration:"1 นาที",instruction:"หายใจเข้าและออกตามธรรมชาติ ไม่กลั้นหายใจ"});
  return {warmup,cooldown:cooldown.slice(0,5)};
}
function json(res,status,body) { res.setHeader("Cache-Control","no-store"); return res.status(status).json(body); }
function allowRequest(ip) {
  const now=Date.now(), current=requestCounts.get(ip);
  if(!current || now-current.start>=WINDOW_MS) { requestCounts.set(ip,{start:now,count:1}); return true; }
  current.count++; return current.count<=MAX_REQUESTS_PER_WINDOW;
}
module.exports = async function workoutCoach(req,res) {
  if(req.method!=="POST") { res.setHeader("Allow","POST"); return json(res,405,{error:"รองรับเฉพาะการส่งข้อความแบบ POST"}); }
  const origin=req.headers.origin, host=req.headers.host;
  if(origin&&host) { try { if(new URL(origin).host!==host) return json(res,403,{error:"คำขอมาจากเว็บไซต์ที่ไม่ได้รับอนุญาต"}); } catch { return json(res,403,{error:"ไม่สามารถตรวจสอบแหล่งที่มาของคำขอได้"}); } }
  const ip=String(req.headers["x-forwarded-for"]||req.socket?.remoteAddress||"unknown").split(",")[0].trim();
  if(!allowRequest(ip)) return json(res,429,{error:"ส่งข้อความถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"});
  const supabaseUrl=process.env.SUPABASE_URL, publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY;
  if(!supabaseUrl||!publishableKey) return json(res,503,{error:"ยังไม่ได้ตั้งค่า Supabase สำหรับระบบสมาชิก"});
  const authorization=String(req.headers.authorization||"");
  const token=authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token) return json(res,401,{error:"กรุณาเข้าสู่ระบบก่อนใช้โค้ชออกกำลังกาย"});
  let authenticatedUser;
  try {
    const authResponse=await fetch(supabaseUrl+"/auth/v1/user",{headers:{apikey:publishableKey,Authorization:"Bearer "+token}});
    if(!authResponse.ok) return json(res,401,{error:"เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่"});
    authenticatedUser=await authResponse.json();
    if(!authenticatedUser?.id) return json(res,401,{error:"ไม่สามารถยืนยันบัญชีผู้ใช้ได้"});
  } catch { return json(res,503,{error:"ตรวจสอบบัญชีผู้ใช้ไม่สำเร็จ กรุณาลองใหม่"}); }
  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey) return json(res,503,{error:"ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Vercel"});
  const body=typeof req.body==="string" ? (()=>{try{return JSON.parse(req.body)}catch{return null}})() : req.body;
  if(!body||typeof body!=="object"||Array.isArray(body)) return json(res,400,{error:"รูปแบบคำขอไม่ถูกต้อง"});
  if(Buffer.byteLength(JSON.stringify(body),"utf8")>24000) return json(res,413,{error:"ข้อมูลที่ส่งมีขนาดใหญ่เกินไป"});
  const date=cleanText(body.date,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(res,400,{error:"วันที่ไม่ถูกต้อง"});
  const message=cleanText(body.message,1200);
  const conversation=Array.isArray(body.conversation)?body.conversation.slice(-4).map(item=>({role:item?.role==="assistant"?"assistant":"user",text:cleanText(item?.text,600)})).filter(item=>item.text):[];
  const workouts=Array.isArray(body.workouts)?body.workouts.slice(0,8).map(item=>({
    date:cleanText(item?.date,10),exercise:cleanText(item?.exercise,100),
    sets:Number.isInteger(Number(item?.sets))?Math.min(20,Math.max(0,Number(item.sets))):null,
    reps:cleanText(item?.reps,40),effort:cleanText(item?.effort,40),notes:cleanText(item?.notes,160)
  })):[];
  const profile=body.trainingProfile&&typeof body.trainingProfile==="object"?{
    age:Number.isFinite(Number(body.trainingProfile.age))?Math.min(100,Math.max(13,Number(body.trainingProfile.age))):null,
    sex:cleanText(body.trainingProfile.sex,20),goal:cleanText(body.trainingProfile.goal,100),
    experience:cleanText(body.trainingProfile.experience,50),equipment:cleanText(body.trainingProfile.equipment,160),
    equipmentStatus:["none","known","unknown"].includes(body.trainingProfile.equipmentStatus)?body.trainingProfile.equipmentStatus:(body.trainingProfile.equipment==="ไม่มีอุปกรณ์"?"none":(body.trainingProfile.equipment&& !["มีอุปกรณ์แต่ไม่ทราบชนิด","อุปกรณ์หลายชนิด","ฟิตเนส / ยิม"].includes(body.trainingProfile.equipment)?"known":"unknown")),
    equipmentDetails:cleanText(body.trainingProfile.equipmentDetails,300),trainingLocation:cleanText(body.trainingProfile.trainingLocation,30),trainingLocationDetails:cleanText(body.trainingProfile.trainingLocationDetails,160),
    daysPerWeek:Number.isFinite(Number(body.trainingProfile.daysPerWeek))?Math.min(7,Math.max(1,Number(body.trainingProfile.daysPerWeek))):null,
    sessionMinutes:Number.isFinite(Number(body.trainingProfile.sessionMinutes))?Math.min(180,Math.max(10,Number(body.trainingProfile.sessionMinutes))):null,
    limitations:cleanText(body.trainingProfile.limitations,500),preferences:cleanText(body.trainingProfile.preferences,500)
  }:null;
  const bodyHistory=Array.isArray(body.bodyHistory)?body.bodyHistory.slice(0,3).map(item=>({
    date:cleanText(item?.date,10),weight:Number.isFinite(Number(item?.weight))?Number(item.weight):null,
    height:Number.isFinite(Number(item?.height))?Number(item.height):null,waist:Number.isFinite(Number(item?.waist))?Number(item.waist):null,
    sleep:Number.isFinite(Number(item?.sleep))?Number(item.sleep):null,
    restingHeartRate:Number.isFinite(Number(item?.restingHeartRate))?Number(item.restingHeartRate):null,
    energy:Number.isFinite(Number(item?.energy))?Number(item.energy):null,soreness:Number.isFinite(Number(item?.soreness))?Number(item.soreness):null,
    pain:cleanText(item?.pain,240)
  })): [];
  const readinessHistory=Array.isArray(body.readinessHistory)?body.readinessHistory.slice(0,5).map(item=>({
    date:cleanText(item?.date,10),sleep:item?.sleep==null||item.sleep===""?null:Math.min(24,Math.max(0,Number(item.sleep))),
    daytimeRestMinutes:item?.daytimeRestMinutes==null||item.daytimeRestMinutes===""?null:Math.min(1440,Math.max(0,Number(item.daytimeRestMinutes))),
    trainingMinutes:item?.trainingMinutes==null||item.trainingMinutes===""?null:Math.min(600,Math.max(0,Number(item.trainingMinutes))),
    energy:item?.energy==null||item.energy===""?null:Math.min(5,Math.max(1,Number(item.energy))),soreness:item?.soreness==null||item.soreness===""?null:Math.min(5,Math.max(1,Number(item.soreness))),stress:item?.stress==null||item.stress===""?null:Math.min(5,Math.max(1,Number(item.stress))),
    pain:cleanText(item?.pain,240)
  })): [];
  const nutritionHistory=Array.isArray(body.nutritionHistory)?body.nutritionHistory.slice(0,10).map(item=>({
    date:cleanText(item?.date,10),meal:cleanText(item?.meal,30),title:cleanText(item?.title,100),serving:cleanText(item?.serving,60),
    calories:Number.isFinite(Number(item?.calories))?Math.max(0,Math.min(10000,Number(item.calories))):null,
    protein:Number.isFinite(Number(item?.protein))?Math.max(0,Math.min(1000,Number(item.protein))):null,
    carbs:Number.isFinite(Number(item?.carbs))?Math.max(0,Math.min(1000,Number(item.carbs))):null,
    fat:Number.isFinite(Number(item?.fat))?Math.max(0,Math.min(1000,Number(item.fat))):null,source:cleanText(item?.source,40)
  })):[];
  const nutritionTargets=body.nutritionTargets&&typeof body.nutritionTargets==="object"?{
    calories:Number.isFinite(Number(body.nutritionTargets.calories))?Math.max(0,Math.min(10000,Number(body.nutritionTargets.calories))):0,
    protein:Number.isFinite(Number(body.nutritionTargets.protein))?Math.max(0,Math.min(1000,Number(body.nutritionTargets.protein))):0,
    carbs:Number.isFinite(Number(body.nutritionTargets.carbs))?Math.max(0,Math.min(1000,Number(body.nutritionTargets.carbs))):0,
    fat:Number.isFinite(Number(body.nutritionTargets.fat))?Math.max(0,Math.min(1000,Number(body.nutritionTargets.fat))):0
  }:{calories:0,protein:0,carbs:0,fat:0};
  const topics=classifyTopics(message||conversation.map(item=>item.text).join(" "));
  const topicLabels=topics.map(topic=>TOPIC_LABELS[topic]);
  const existingPlan=body.existingPlan&&typeof body.existingPlan==="object"?{
    title:cleanText(body.existingPlan.title,100),restDay:Boolean(body.existingPlan.restDay),
    items:Array.isArray(body.existingPlan.items)?body.existingPlan.items.slice(0,6).map(item=>({exercise:cleanText(item?.exercise,100),sets:Number(item?.sets)||0,reps:cleanText(item?.reps,40)})):[]
  }:null;
  const sourceById = new Map(evidenceLibrary.sources.map(source => [source.id, source]));
  const cleanEvidenceIds = value => Array.isArray(value)
    ? [...new Set(value.filter(id => typeof id === "string" && sourceById.has(id)))].slice(0, 8)
    : [];
  const publicSource = id => {
    const source = sourceById.get(id);
    return source ? { id:source.id, title:source.title, organization:source.organization, year:source.year, evidenceType:source.evidenceType, url:source.url, limitations:source.limitations } : null;
  };
  const needsExerciseCatalog=topics.some(topic=>["exercise_plan","exercise_technique","equipment_location"].includes(topic));
  let catalogRows=[];
  if(needsExerciseCatalog) {
    if(exerciseCatalogCache && Date.now()-exerciseCatalogCacheAt<EXERCISE_CATALOG_CACHE_MS) {
      catalogRows=exerciseCatalogCache;
    } else {
      try {
        const catalogResponse=await fetch(supabaseUrl+"/rest/v1/exercise_catalog?select=id,name_th,name_en,category,movement_pattern,primary_muscles,secondary_muscles,equipment,level,exercise_type,setup,steps,breathing,common_mistakes,cautions,progressions,regressions,source_ids,evidence_note&is_active=eq.true&order=category.asc&limit=200",{
          headers:{apikey:publishableKey,Authorization:"Bearer "+token}
        });
        if(!catalogResponse.ok)return json(res,502,{error:"โหลดคลังท่าฝึกไม่สำเร็จ กรุณาลองใหม่"});
        catalogRows=await catalogResponse.json();
        exerciseCatalogCache=Array.isArray(catalogRows)?catalogRows:null;
        exerciseCatalogCacheAt=Date.now();
      } catch { return json(res,503,{error:"เชื่อมต่อฐานข้อมูลท่าฝึกไม่สำเร็จ"}); }
    }
  }
  const catalogExercises=catalogRows.map(row=>({
    id:row.id,name:row.name_th+" ("+row.name_en+")",movementPattern:row.movement_pattern,
    targetMuscles:[...(row.primary_muscles||[]),...(row.secondary_muscles||[])].join(", "),
    equipment:row.equipment||[],level:row.level,sourceIds:row.source_ids||[],
    steps:Array.isArray(row.steps)?row.steps:[],breathing:row.breathing,
    caution:(row.cautions||[]).join(" "),progression:(row.progressions||[]).join(" "),
    setup:row.setup,commonMistakes:row.common_mistakes||[],evidenceNote:row.evidence_note
  }));
  const exerciseById=new Map(catalogExercises.map(exercise=>[exercise.id,exercise]));
  const equipmentStatus=profile?.equipmentStatus||"unknown";
  const equipmentText=[profile?.equipmentDetails,profile?.equipment].filter(Boolean).join(" ").toLowerCase();
  const optionalSupport=["เสื่อออกกำลังกาย","พื้นที่เดิน","เก้าอี้มั่นคง"];
  const compatibleExercises=catalogExercises.filter(exercise=>{
    const required=(Array.isArray(exercise.equipment)?exercise.equipment:[]).filter(item=>!optionalSupport.includes(String(item)));
    if(equipmentStatus==="none")return required.length===0||required.every(item=>item==="ไม่มีอุปกรณ์");
    if(equipmentStatus!=="known"||!equipmentText.trim())return required.length===0||required.every(item=>item==="ไม่มีอุปกรณ์");
    return required.every(item=>equipmentText.includes(String(item).toLowerCase()));
  });
  const levelRank=level=>profile?.experience==="มือใหม่"?({"เริ่มต้น":0,"ปานกลาง":1,"สูง":2}[level]??3):profile?.experience==="ระดับกลาง"||profile?.experience==="มีประสบการณ์มาก"?({"ปานกลาง":0,"เริ่มต้น":1,"สูง":2}[level]??3):({"เริ่มต้น":0,"ปานกลาง":1,"สูง":2}[level]??3);
  const queryText=message.toLowerCase();
  const orderedCandidates=compatibleExercises.slice().sort((a,b)=>{
    const aMatch=queryText.includes(a.name.toLowerCase())?0:1,bMatch=queryText.includes(b.name.toLowerCase())?0:1;
    return aMatch-bMatch||levelRank(a.level)-levelRank(b.level)||a.movementPattern.localeCompare(b.movementPattern,"th")||a.name.localeCompare(b.name,"th");
  });
  // Keep at most two useful progressions per movement pattern; preserve distinct regressions and equipment variants in the master catalog.
  const patternCounts=new Map(),modelExercises=[];
  for(const exercise of orderedCandidates) {
    const pattern=exercise.movementPattern||exercise.id,count=patternCounts.get(pattern)||0;
    if(count>=2)continue;
    modelExercises.push(exercise);patternCounts.set(pattern,count+1);
    if(modelExercises.length>=18)break;
  }
  const requestId=randomUUID();
  let quotaReservation=null;
  try {
    const quotaResponse=await fetch(supabaseUrl+"/rest/v1/rpc/consume_gemini_quota",{
      method:"POST",headers:{apikey:publishableKey,Authorization:"Bearer "+token,"Content-Type":"application/json"},
      body:JSON.stringify({p_request_id:requestId})
    });
    if(!quotaResponse.ok) return json(res,502,{error:"ตรวจสอบโควต้าบัญชีไม่สำเร็จ กรุณาลองใหม่"});
    quotaReservation=await quotaResponse.json();
  } catch { return json(res,503,{error:"เชื่อมต่อระบบโควต้าสมาชิกไม่สำเร็จ"}); }
  if(!quotaReservation?.allowed) {
    const reason=quotaReservation?.reason;
    const text=reason==="quota_disabled"?"บัญชีนี้ยังไม่ได้รับโควต้าการใช้ Gemini จากผู้ดูแลระบบ":
      reason==="quota_exceeded"?"คุณใช้โควต้าการถาม Gemini ถึงขีดจำกัดแล้ว":
      reason==="account_unavailable"?"บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ":
      "คำขอนี้ไม่สามารถใช้โควต้าได้ กรุณาลองใหม่";
    return json(res,reason==="quota_exceeded"||reason==="quota_disabled"?429:403,{error:text,quota:quotaReservation});
  }
  const refundQuota=async()=>{try{await fetch(supabaseUrl+"/rest/v1/rpc/refund_gemini_quota",{method:"POST",headers:{apikey:publishableKey,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({p_request_id:requestId})});}catch{}};
  const includeExerciseEvidence=topics.some(topic=>topic!=="nutrition");
  const includeNutritionEvidence=topics.includes("nutrition")||topics.includes("exercise_plan");
  const relevantPrinciples=evidenceLibrary.principles.filter(principle=>principle.domain==="nutrition"?includeNutritionEvidence:includeExerciseEvidence);
  const usedSourceIds=new Set(relevantPrinciples.flatMap(principle=>principle.sourceIds||[]));
  const evidenceContext={
    version:evidenceLibrary.version,
    principles:relevantPrinciples.map(({id,title,summary,application,sourceIds,limitations})=>({id,title,summary,application,sourceIds,limitations})),
    exercises:modelExercises.map(({id,name,movementPattern,targetMuscles,equipment,level,sourceIds})=>({id,name,movementPattern,targetMuscles,equipment,level,sourceIds})),
    sources:evidenceLibrary.sources.filter(source=>usedSourceIds.has(source.id)).map(({id,title,organization,year,evidenceType,url})=>({id,title,organization,year,evidenceType,url})),
    coverageLimitations:needsExerciseCatalog?evidenceLibrary.coverageLimitations:[]
  };
  const systemInstruction=`คุณคือโค้ชสุขภาพและการฝึกสำหรับผู้ใหญ่ ตอบภาษาไทยเป็นหลัก กระชับ ชัดเจน และอิงข้อมูลที่ได้รับ
ใช้เฉพาะหลักฐานใน evidenceBase; อ้างอิงได้เฉพาะ source ID ที่มีอยู่ ห้ามสร้างงานวิจัย ปี DOI หรือลิงก์ ห้ามอ้างว่าค้นเว็บ
หากสร้างแผน ให้เลือกเฉพาะ exerciseId ใน evidenceBase.exercises และไม่เกิน 6 ท่า ระบุเหตุผล เซ็ต ครั้ง/เวลา เวลาพัก กล้ามเนื้อเป้าหมาย และข้อควรระวัง เทคนิคเฉพาะท่าต้องยึดข้อมูลจากคลังที่เชื่อถือได้ แยกหลักฐานระดับโปรแกรมออกจากคำอธิบายเทคนิคของท่า
ปรับแผนตามเป้าหมาย ประสบการณ์ สถานที่ อุปกรณ์ ประวัติฝึก การนอน ความล้า และอาการเจ็บ ห้ามเดาข้อมูลที่ไม่มี หากไม่มีอุปกรณ์ให้เลือกท่าที่ไม่ต้องใช้อุปกรณ์ โดยอาจใช้เฟอร์นิเจอร์ในบ้านที่มั่นคง เช่น เก้าอี้เพื่อพยุงตัวได้เมื่อคลังระบุไว้ และต้องแจ้งผู้ใช้ให้ตรวจความมั่นคงก่อนใช้ หากไม่ทราบชนิดอุปกรณ์ห้ามเดา
หลักการฝึก: เน้นความสม่ำเสมอและ progressive resistance กระจายกล้ามเนื้อและวันพัก ไม่บังคับมือใหม่ให้เริ่มที่ 10 เซ็ตต่อกล้ามเนื้อต่อสัปดาห์ และไม่จำเป็นต้องฝึกจนหมดแรงทุกเซ็ต
ความปลอดภัย: ไม่วินิจฉัยโรค หากเจ็บแปลบ เจ็บข้อ เจ็บหน้าอก หายใจลำบาก เวียนศีรษะ หน้ามืด มีไข้ หรืออาการผิดปกติ ให้หยุดฝึกและพิจารณาขอความช่วยเหลือทางการแพทย์ ห้ามสร้างแผนฝืนฝึก
โภชนาการ: เมื่อสร้างแผนให้คำแนะนำ 2–3 ข้อ; เมื่อถามอาหารโดยตรงให้ตอบเป็นหมวดและยกตัวอย่างอาหารไทย ใช้หลักฐานโปรตีนเฉพาะเมื่ออยู่ใน evidenceBase และย้ำว่าใช้กับผู้ใหญ่สุขภาพดีที่ออกกำลังกาย ไม่กำหนดแคลอรีหรือปริมาณที่ไม่มีข้อมูล
ถ้าข้อมูลไม่พอหรือมีสัญญาณเสี่ยง ให้ถามเพิ่มหรือแนะนำพัก โดย hasPlan=false; ถ้าควรพักให้ restDay=true และ items=[]
ตอบ JSON ตาม schema เท่านั้น ใส่ evidenceIds ในระดับคำตอบ แผน และท่า โดยเลือกเฉพาะ ID ที่ได้รับ`;
  const userContext={date,currentMessage:message||"ช่วยประเมินจากประวัติการฝึกและข้อมูลร่างกายที่บันทึกไว้สำหรับวันนี้",topicCategories:topics.map(topic=>({id:topic,label:TOPIC_LABELS[topic]})),trainingProfile:profile,bodyMeasurementHistory:bodyHistory,dailyReadinessHistory:readinessHistory,recentTrainingHistory:workouts,recentNutritionHistory:nutritionHistory,nutritionTargets,previousConversation:conversation,currentAcceptedPlan:existingPlan,evidenceBase:evidenceContext};
  try {
    const model=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
    const upstream=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
      method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({systemInstruction:{parts:[{text:systemInstruction}]},contents:[{role:"user",parts:[{text:JSON.stringify(userContext)}]}],
        generationConfig:{responseMimeType:"application/json",responseSchema,temperature:0.2,maxOutputTokens:1200,thinkingConfig:{thinkingLevel:"MINIMAL"}}})
    });
    const result=await upstream.json().catch(()=>({}));
    if(!upstream.ok) {
      await refundQuota();
      const detail=result?.error?.message||"Gemini API ไม่สามารถตอบคำขอได้";
      return json(res,upstream.status===429?429:502,{error:upstream.status===429?"โควต้าหรือจำนวนคำขอ Gemini Free Tier ถึงขีดจำกัดแล้ว กรุณาลองใหม่ภายหลัง":detail.slice(0,220)});
    }
    const raw=result?.candidates?.[0]?.content?.parts?.map(part=>part.text||"").join("");
    if(!raw) { await refundQuota(); return json(res,502,{error:"Gemini ไม่ได้ส่งข้อความตอบกลับ กรุณาลองใหม่"}); }
    let parsed; try{parsed=JSON.parse(raw)}catch{const match=raw.match(/\\{[\\s\\S]*\\}/);try{if(!match)throw new Error("no JSON");parsed=JSON.parse(match[0])}catch{await refundQuota();return json(res,502,{error:"รูปแบบคำตอบจาก Gemini ไม่ถูกต้อง กรุณาส่งอีกครั้ง"})}}
    const plan=parsed.plan&&typeof parsed.plan==="object"?parsed.plan:{};
    const planEvidenceIds=cleanEvidenceIds(plan.evidenceIds);
    const safeItems=Array.isArray(plan.items)?plan.items.slice(0,6).map(item=>{
      const exerciseId=cleanText(item?.exerciseId,80);
      const catalog=exerciseById.get(exerciseId);
      if(!catalog) return null;
      const evidenceIds=cleanEvidenceIds(item?.evidenceIds).filter(id=>catalog.sourceIds.includes(id));
      const resolvedEvidenceIds=evidenceIds.length?evidenceIds:catalog.sourceIds.filter(id=>sourceById.has(id));
      return {
        exerciseId,exercise:catalog.name,sets:Math.min(3,Math.max(0,Number(item?.sets)||0)),
        reps:cleanText(item?.reps,40),restSeconds:Math.min(600,Math.max(0,Number(item?.restSeconds)||0)),
        targetMuscles:catalog.targetMuscles,note:cleanText(item?.note,180),rationale:cleanText(item?.rationale,500),
        setup:catalog.setup||cleanText(item?.setup,300)||"เตรียมอุปกรณ์และพื้นที่ให้มั่นคงก่อนเริ่ม",
        steps:catalog.steps,breathing:catalog.breathing,
        commonMistakes:catalog.commonMistakes.join(" · ")||cleanText(item?.commonMistakes,260)||"หลีกเลี่ยงการเหวี่ยงตัว เร่งจังหวะ หรือฝืนช่วงการเคลื่อนไหว",
        caution:catalog.caution,evidenceIds:resolvedEvidenceIds,
        evidence:resolvedEvidenceIds.map(publicSource).filter(Boolean)
      };
    }).filter(item=>item&&item.exercise&&item.sets>0&&item.reps):[];
    const itemEvidenceIds=plan.restDay?[]:[...new Set(safeItems.flatMap(item=>item.evidenceIds))];
    const resolvedPlanEvidenceIds=[...new Set([...planEvidenceIds,...itemEvidenceIds])].slice(0,8);
    const routine=buildWarmupCooldown(safeItems);
    const safePlan={
      date,title:cleanText(plan.title,100)||"แผนฝึกที่แนะนำ",reason:cleanText(plan.reason,500),
      restDay:Boolean(plan.restDay),warmup:Boolean(plan.restDay)?[]:routine.warmup,cooldown:Boolean(plan.restDay)?[]:routine.cooldown,evidenceSummary:cleanText(plan.evidenceSummary,700),
      evidenceLibraryVersion:evidenceLibrary.version,evidenceIds:resolvedPlanEvidenceIds,evidence:resolvedPlanEvidenceIds.map(publicSource).filter(Boolean),
      items:safeItems
    };
    if(safePlan.restDay) safePlan.items=[];
    const hasPlan=Boolean(parsed.hasPlan)&&(safePlan.restDay||safePlan.items.length>0);
    const responseEvidenceIds=cleanEvidenceIds(parsed.evidenceIds);
    const responseEvidence=responseEvidenceIds.map(publicSource).filter(Boolean);
    const nutritionAdvice=Array.isArray(parsed.nutritionAdvice)?parsed.nutritionAdvice.slice(0,5).map(item=>cleanText(item,240)).filter(Boolean):[];
    const usage=result?.usageMetadata||{};
    try { await fetch(supabaseUrl+"/rest/v1/rpc/complete_gemini_quota",{method:"POST",headers:{apikey:publishableKey,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({p_request_id:requestId})}); } catch(error) { console.warn("Gemini quota completion could not be recorded",error?.message||"unknown"); }
    return json(res,200,{reply:cleanText(parsed.reply,1800)||"ได้รับข้อมูลแล้ว แต่ยังไม่มีคำแนะนำเพิ่มเติม",hasPlan,topics,topicLabels,nutritionAdvice,evidence:responseEvidence,evidenceLibraryVersion:evidenceLibrary.version,plan:safePlan,quota:quotaReservation,usage:{promptTokens:Number(usage.promptTokenCount)||0,candidateTokens:Number(usage.candidatesTokenCount)||0,totalTokens:Number(usage.totalTokenCount)||0}});
  } catch { await refundQuota(); return json(res,502,{error:"เชื่อมต่อ Gemini ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่"}); }
};
