// Vercel serverless endpoint for the exercise coach.
// The Gemini key is read only from server-side environment variables.
const evidenceLibrary = require("../data/exercise-evidence.json");
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15;
const requestCounts = new Map();
const responseSchema = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    hasPlan: { type: "BOOLEAN" },
    evidenceIds: { type: "ARRAY", items: { type: "STRING" } },
    plan: { type: "OBJECT", properties: {
      date: { type: "STRING" }, title: { type: "STRING" }, reason: { type: "STRING" }, restDay: { type: "BOOLEAN" },
      evidenceSummary: { type: "STRING" }, evidenceIds: { type: "ARRAY", items: { type: "STRING" } },
      items: { type: "ARRAY", items: { type: "OBJECT", properties: {
        exerciseId: { type: "STRING" }, rationale: { type: "STRING" }, evidenceIds: { type: "ARRAY", items: { type: "STRING" } },
        exercise: { type: "STRING" }, sets: { type: "INTEGER" }, reps: { type: "STRING" },
        restSeconds: { type: "INTEGER" }, targetMuscles: { type: "STRING" }, note: { type: "STRING" },
        setup: { type: "STRING" }, steps: { type: "ARRAY", items: { type: "STRING" } },
        breathing: { type: "STRING" }, commonMistakes: { type: "STRING" }, caution: { type: "STRING" }
      }, required: ["exerciseId","rationale","evidenceIds","exercise","sets","reps","restSeconds","targetMuscles","note","setup","steps","breathing","commonMistakes","caution"] } }
    }, required: ["date","title","reason","restDay","evidenceSummary","evidenceIds","items"] }
  }, required: ["reply","hasPlan","evidenceIds","plan"]
};
function cleanText(value, max=500) { return typeof value==="string" ? value.trim().slice(0,max) : ""; }
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
  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey) return json(res,503,{error:"ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Vercel"});
  const body=typeof req.body==="string" ? (()=>{try{return JSON.parse(req.body)}catch{return null}})() : req.body;
  if(!body||typeof body!=="object"||Array.isArray(body)) return json(res,400,{error:"รูปแบบคำขอไม่ถูกต้อง"});
  if(Buffer.byteLength(JSON.stringify(body),"utf8")>24000) return json(res,413,{error:"ข้อมูลที่ส่งมีขนาดใหญ่เกินไป"});
  const date=cleanText(body.date,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(res,400,{error:"วันที่ไม่ถูกต้อง"});
  const message=cleanText(body.message,1200);
  const conversation=Array.isArray(body.conversation)?body.conversation.slice(-6).map(item=>({role:item?.role==="assistant"?"assistant":"user",text:cleanText(item?.text,1000)})).filter(item=>item.text):[];
  const workouts=Array.isArray(body.workouts)?body.workouts.slice(0,12).map(item=>({
    date:cleanText(item?.date,10),exercise:cleanText(item?.exercise,100),
    sets:Number.isInteger(Number(item?.sets))?Math.min(20,Math.max(0,Number(item.sets))):null,
    reps:cleanText(item?.reps,40),effort:cleanText(item?.effort,40),notes:cleanText(item?.notes,160)
  })):[];
  const profile=body.trainingProfile&&typeof body.trainingProfile==="object"?{
    age:Number.isFinite(Number(body.trainingProfile.age))?Math.min(100,Math.max(13,Number(body.trainingProfile.age))):null,
    sex:cleanText(body.trainingProfile.sex,20),goal:cleanText(body.trainingProfile.goal,100),
    experience:cleanText(body.trainingProfile.experience,50),equipment:cleanText(body.trainingProfile.equipment,100),
    daysPerWeek:Number.isFinite(Number(body.trainingProfile.daysPerWeek))?Math.min(7,Math.max(1,Number(body.trainingProfile.daysPerWeek))):null,
    sessionMinutes:Number.isFinite(Number(body.trainingProfile.sessionMinutes))?Math.min(180,Math.max(10,Number(body.trainingProfile.sessionMinutes))):null,
    limitations:cleanText(body.trainingProfile.limitations,500),preferences:cleanText(body.trainingProfile.preferences,500)
  }:null;
  const bodyHistory=Array.isArray(body.bodyHistory)?body.bodyHistory.slice(0,5).map(item=>({
    date:cleanText(item?.date,10),weight:Number.isFinite(Number(item?.weight))?Number(item.weight):null,
    height:Number.isFinite(Number(item?.height))?Number(item.height):null,waist:Number.isFinite(Number(item?.waist))?Number(item.waist):null,
    sleep:Number.isFinite(Number(item?.sleep))?Number(item.sleep):null,
    restingHeartRate:Number.isFinite(Number(item?.restingHeartRate))?Number(item.restingHeartRate):null,
    energy:Number.isFinite(Number(item?.energy))?Number(item.energy):null,soreness:Number.isFinite(Number(item?.soreness))?Number(item.soreness):null,
    pain:cleanText(item?.pain,240)
  })): [];
  const readinessHistory=Array.isArray(body.readinessHistory)?body.readinessHistory.slice(0,7).map(item=>({
    date:cleanText(item?.date,10),sleep:item?.sleep==null||item.sleep===""?null:Math.min(24,Math.max(0,Number(item.sleep))),
    daytimeRestMinutes:item?.daytimeRestMinutes==null||item.daytimeRestMinutes===""?null:Math.min(1440,Math.max(0,Number(item.daytimeRestMinutes))),
    trainingMinutes:item?.trainingMinutes==null||item.trainingMinutes===""?null:Math.min(600,Math.max(0,Number(item.trainingMinutes))),
    energy:item?.energy==null||item.energy===""?null:Math.min(5,Math.max(1,Number(item.energy))),soreness:item?.soreness==null||item.soreness===""?null:Math.min(5,Math.max(1,Number(item.soreness))),stress:item?.stress==null||item.stress===""?null:Math.min(5,Math.max(1,Number(item.stress))),
    pain:cleanText(item?.pain,240)
  })): [];
  const existingPlan=body.existingPlan&&typeof body.existingPlan==="object"?{
    title:cleanText(body.existingPlan.title,100),restDay:Boolean(body.existingPlan.restDay),
    items:Array.isArray(body.existingPlan.items)?body.existingPlan.items.slice(0,8).map(item=>({exercise:cleanText(item?.exercise,100),sets:Number(item?.sets)||0,reps:cleanText(item?.reps,40)})):[]
  }:null;
  const sourceById = new Map(evidenceLibrary.sources.map(source => [source.id, source]));
  const exerciseById = new Map(evidenceLibrary.exercises.map(exercise => [exercise.id, exercise]));
  const cleanEvidenceIds = value => Array.isArray(value)
    ? [...new Set(value.filter(id => typeof id === "string" && sourceById.has(id)))].slice(0, 8)
    : [];
  const publicSource = id => {
    const source = sourceById.get(id);
    return source ? { id:source.id, title:source.title, organization:source.organization, year:source.year, evidenceType:source.evidenceType, url:source.url, limitations:source.limitations } : null;
  };
  const evidenceContext = {
    version: evidenceLibrary.version,
    principles: evidenceLibrary.principles.map(({id,title,summary,application,sourceIds,evidenceStrengthNote,limitations}) => ({id,title,summary,application,sourceIds,evidenceStrengthNote,limitations})),
    exercises: evidenceLibrary.exercises.filter(exercise => exercise.equipment.includes("ไม่มีอุปกรณ์")).map(({id,name,movementPattern,targetMuscles,equipment,level,sourceIds,steps,breathing,caution,progression,evidenceNote}) => ({id,name,movementPattern,targetMuscles,equipment,level,sourceIds,steps,breathing,caution,progression,evidenceNote})),
    sources: evidenceLibrary.sources.map(({id,title,organization,year,evidenceType,summary,limitations,url}) => ({id,title,organization,year,evidenceType,summary,limitations,url})),
    coverageLimitations: evidenceLibrary.coverageLimitations
  };
  const systemInstruction=`คุณคือโค้ชออกกำลังกายสำหรับผู้ใหญ่สุขภาพดีที่เพิ่งเริ่มฝึก ตอบภาษาไทยเป็นหลัก สุภาพ เป็นกันเอง และอธิบายเหตุผล
คุณได้รับฐานความรู้ที่คัดเลือกไว้ใน evidenceBase ซึ่งมีหลักการฝึก แค็ตตาล็อกท่าที่อนุมัติ และแหล่งอ้างอิง ห้ามอ้างว่าค้นเว็บหรือฐานข้อมูลอื่นในคำขอนี้ เพราะระบบไม่ได้เปิดการค้นเว็บ
ใช้หลักฐานจาก evidenceBase เป็นหลักในการตัดสินใจ แยกให้ชัดระหว่าง (1) หลักฐานสนับสนุนหลักการจัดโปรแกรม (2) คำแนะนำเทคนิคของท่าจากคู่มือ และ (3) การประยุกต์ตามข้อมูลผู้ใช้ ห้ามอ้างว่างานวิจัยทดสอบท่าใดโดยตรง หากแหล่งข้อมูลไม่ได้ระบุเช่นนั้น
เลือกท่าได้เฉพาะ exerciseId ที่อยู่ใน evidenceBase.exercises เท่านั้น ห้ามแต่งชื่อท่าใหม่หรืออ้าง exerciseId ที่ไม่มีอยู่ ระบุ rationale ว่าเลือกท่านั้นเพราะอะไรเมื่อเทียบกับเป้าหมาย ประสบการณ์ อุปกรณ์ และความพร้อม
อ้างอิงได้เฉพาะ source id ที่มีอยู่ใน evidenceBase.sources เท่านั้น หากไม่พบหลักฐานตรง ให้บอกข้อจำกัด ห้ามสร้างชื่อแหล่ง ปี DOI หรือลิงก์ขึ้นเอง
สำหรับผู้เริ่มต้นให้เน้นความสม่ำเสมอ การควบคุมท่า และการเพิ่มระดับทีละน้อย ไม่บังคับให้เริ่มด้วยปริมาณสูงประมาณ 10 เซ็ตต่อกลุ่มกล้ามเนื้อต่อสัปดาห์ ตัวเลขดังกล่าวเป็นข้อมูลประกอบการเพิ่มปริมาณในอนาคต ไม่ใช่เกณฑ์เริ่มต้นสำหรับทุกคน ไม่จำเป็นต้องฝึกจนหมดแรงทุกเซ็ต
พิจารณาความถี่รายสัปดาห์ ปริมาณฝึก การพัก และการกระจายกล้ามเนื้อ ห้ามฝึกกล้ามเนื้อเดิมหนักซ้ำติดกัน หากอุปกรณ์ที่มีไม่สามารถฝึกกล้ามเนื้อบางกลุ่มได้เพียงพอ ให้บอกตรง ๆ โดยเฉพาะข้อจำกัดเรื่องท่าดึง/กล้ามเนื้อหลังในคลังท่าไม่มีอุปกรณ์ ห้ามใช้ท่าที่ไม่ใช่ท่าดึงมาอ้างว่าทดแทนได้
ใช้โปรไฟล์การฝึก ข้อมูลร่างกายย้อนหลัง ความพร้อมรายวัน ข้อความ และประวัติการฝึกที่ได้รับ ห้ามอ้างว่ารู้ข้อมูลที่ไม่ได้รับ พิจารณาน้ำหนัก/ส่วนสูงเป็นแนวโน้ม ไม่ใช้ BMI ตัดสินความสามารถฝึก ตรวจสอบการนอน พลังงาน ความล้ากล้ามเนื้อ และอาการเจ็บก่อนเพิ่มความหนัก หากข้อมูลขัดแย้งหรือไม่พอให้ถามก่อน ไม่คาดเดาค่าที่หายไป
ความปลอดภัย: ห้ามวินิจฉัยโรคหรือการบาดเจ็บ หากมีอาการเจ็บแปลบ เจ็บข้อ เจ็บหน้าอก หายใจลำบาก เวียนศีรษะ หน้ามืด มีไข้ หรืออาการผิดปกติ ให้แนะนำหยุดฝึกและพิจารณาขอความช่วยเหลือทางการแพทย์ ห้ามสร้างแผนฝืนฝึก อย่าเพิ่มความหนักหากล้ามาก นอนน้อย หรือฟื้นตัวไม่ดี และให้มีวันพัก
สร้างแผนเมื่อข้อมูลพอและไม่มีสัญญาณเตือน ระบุเซ็ต ครั้ง/ระยะเวลา เวลาพักและกล้ามเนื้อเป้าหมาย พร้อมวิธีเตรียมท่า ขั้นตอน 3-6 ข้อ การหายใจ ข้อผิดพลาดที่พบบ่อย และข้อควรระวัง
หากควรพัก ให้ restDay=true และ items=[] หากข้อมูลไม่พอให้ถามเพิ่มและ hasPlan=false แผนเป็นเพียงข้อเสนอ ผู้ใช้ต้องยืนยันก่อนบันทึก
ส่ง JSON ตาม schema เท่านั้น ต้องส่ง evidenceIds ระดับคำตอบ, evidenceSummary/evidenceIds ระดับแผน และ rationale/evidenceIds ต่อท่า โดยใช้เฉพาะ ID ที่มีอยู่ในฐานความรู้`;
  const userContext={date,currentMessage:message||"ช่วยประเมินจากประวัติการฝึกและข้อมูลร่างกายที่บันทึกไว้สำหรับวันนี้",trainingProfile:profile,bodyMeasurementHistory:bodyHistory,dailyReadinessHistory:readinessHistory,recentTrainingHistory:workouts,previousConversation:conversation,currentAcceptedPlan:existingPlan,evidenceBase:evidenceContext};
  try {
    const model=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
    const upstream=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
      method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
      body:JSON.stringify({systemInstruction:{parts:[{text:systemInstruction}]},contents:[{role:"user",parts:[{text:JSON.stringify(userContext)}]}],
        generationConfig:{responseMimeType:"application/json",responseSchema,temperature:0.35,maxOutputTokens:1400}})
    });
    const result=await upstream.json().catch(()=>({}));
    if(!upstream.ok) {
      const detail=result?.error?.message||"Gemini API ไม่สามารถตอบคำขอได้";
      return json(res,upstream.status===429?429:502,{error:upstream.status===429?"โควต้าหรือจำนวนคำขอ Gemini Free Tier ถึงขีดจำกัดแล้ว กรุณาลองใหม่ภายหลัง":detail.slice(0,220)});
    }
    const raw=result?.candidates?.[0]?.content?.parts?.map(part=>part.text||"").join("");
    if(!raw) return json(res,502,{error:"Gemini ไม่ได้ส่งข้อความตอบกลับ กรุณาลองใหม่"});
    let parsed; try{parsed=JSON.parse(raw)}catch{const match=raw.match(/\\{[\\s\\S]*\\}/);try{if(!match)throw new Error("no JSON");parsed=JSON.parse(match[0])}catch{return json(res,502,{error:"รูปแบบคำตอบจาก Gemini ไม่ถูกต้อง กรุณาส่งอีกครั้ง"})}}
    const plan=parsed.plan&&typeof parsed.plan==="object"?parsed.plan:{};
    const planEvidenceIds=cleanEvidenceIds(plan.evidenceIds);
    const safeItems=Array.isArray(plan.items)?plan.items.slice(0,8).map(item=>{
      const exerciseId=cleanText(item?.exerciseId,80);
      const catalog=exerciseById.get(exerciseId);
      if(!catalog) return null;
      const evidenceIds=cleanEvidenceIds(item?.evidenceIds).filter(id=>catalog.sourceIds.includes(id));
      const resolvedEvidenceIds=evidenceIds.length?evidenceIds:catalog.sourceIds.filter(id=>sourceById.has(id));
      return {
        exerciseId,exercise:catalog.name,sets:Math.min(3,Math.max(0,Number(item?.sets)||0)),
        reps:cleanText(item?.reps,40),restSeconds:Math.min(600,Math.max(0,Number(item?.restSeconds)||0)),
        targetMuscles:catalog.targetMuscles,note:cleanText(item?.note,180),rationale:cleanText(item?.rationale,500),
        setup:cleanText(item?.setup,300)||"จัดพื้นที่ให้โล่ง ใช้เก้าอี้หรือจุดพยุงที่มั่นคง และเตรียมท่าให้พร้อมก่อนเริ่ม",
        steps:catalog.steps,breathing:catalog.breathing,
        commonMistakes:cleanText(item?.commonMistakes,260)||"หลีกเลี่ยงการเหวี่ยงตัว เร่งจังหวะ หรือฝืนช่วงการเคลื่อนไหว",
        caution:catalog.caution,evidenceIds:resolvedEvidenceIds,
        evidence:resolvedEvidenceIds.map(publicSource).filter(Boolean)
      };
    }).filter(item=>item&&item.exercise&&item.sets>0&&item.reps):[];
    const itemEvidenceIds=plan.restDay?[]:[...new Set(safeItems.flatMap(item=>item.evidenceIds))];
    const resolvedPlanEvidenceIds=[...new Set([...planEvidenceIds,...itemEvidenceIds])].slice(0,8);
    const safePlan={
      date,title:cleanText(plan.title,100)||"แผนฝึกที่แนะนำ",reason:cleanText(plan.reason,500),
      restDay:Boolean(plan.restDay),evidenceSummary:cleanText(plan.evidenceSummary,700),
      evidenceLibraryVersion:evidenceLibrary.version,evidenceIds:resolvedPlanEvidenceIds,evidence:resolvedPlanEvidenceIds.map(publicSource).filter(Boolean),
      items:safeItems
    };
    if(safePlan.restDay) safePlan.items=[];
    const hasPlan=Boolean(parsed.hasPlan)&&(safePlan.restDay||safePlan.items.length>0);
    const responseEvidenceIds=cleanEvidenceIds(parsed.evidenceIds);
    const responseEvidence=responseEvidenceIds.map(publicSource).filter(Boolean);
    const usage=result?.usageMetadata||{};
    return json(res,200,{reply:cleanText(parsed.reply,1800)||"ได้รับข้อมูลแล้ว แต่ยังไม่มีคำแนะนำเพิ่มเติม",hasPlan,evidence:responseEvidence,evidenceLibraryVersion:evidenceLibrary.version,plan:safePlan,usage:{promptTokens:Number(usage.promptTokenCount)||0,candidateTokens:Number(usage.candidatesTokenCount)||0,totalTokens:Number(usage.totalTokenCount)||0}});
  } catch { return json(res,502,{error:"เชื่อมต่อ Gemini ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่"}); }
};
