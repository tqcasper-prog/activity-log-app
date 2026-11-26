// Vercel serverless endpoint for the exercise coach.
// The Gemini key is read only from server-side environment variables.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15;
const requestCounts = new Map();
const responseSchema = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    hasPlan: { type: "BOOLEAN" },
    plan: { type: "OBJECT", properties: {
      date: { type: "STRING" }, title: { type: "STRING" }, reason: { type: "STRING" }, restDay: { type: "BOOLEAN" },
      items: { type: "ARRAY", items: { type: "OBJECT", properties: {
        exercise: { type: "STRING" }, sets: { type: "INTEGER" }, reps: { type: "STRING" },
        restSeconds: { type: "INTEGER" }, targetMuscles: { type: "STRING" }, note: { type: "STRING" }
      }, required: ["exercise","sets","reps","restSeconds","targetMuscles","note"] } }
    }, required: ["date","title","reason","restDay","items"] }
  }, required: ["reply","hasPlan","plan"]
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
  const existingPlan=body.existingPlan&&typeof body.existingPlan==="object"?{
    title:cleanText(body.existingPlan.title,100),restDay:Boolean(body.existingPlan.restDay),
    items:Array.isArray(body.existingPlan.items)?body.existingPlan.items.slice(0,8).map(item=>({exercise:cleanText(item?.exercise,100),sets:Number(item?.sets)||0,reps:cleanText(item?.reps,40)})):[]
  }:null;
  const systemInstruction=`คุณคือโค้ชออกกำลังกายสำหรับผู้เริ่มต้น ตอบภาษาไทยเป็นหลัก สุภาพ เป็นกันเอง และอธิบายเหตุผล
วางแผนอย่างค่อยเป็นค่อยไป โดยใช้เฉพาะข้อความและประวัติที่ได้รับ ห้ามอ้างว่ารู้ข้อมูลที่ไม่ได้รับ
ความปลอดภัย: ห้ามวินิจฉัยโรคหรือการบาดเจ็บ หากมีอาการเจ็บแปลบ เจ็บข้อ เจ็บหน้าอก หายใจลำบาก เวียนศีรษะ หน้ามืด มีไข้ หรืออาการผิดปกติ ให้แนะนำหยุดฝึกและพิจารณาขอความช่วยเหลือทางการแพทย์ ห้ามสร้างแผนฝืนฝึก อย่าเพิ่มความหนักหากล้ามาก นอนน้อย หรือฟื้นตัวไม่ดี และให้มีวันพัก
สร้างแผนเมื่อข้อมูลพอและไม่มีสัญญาณเตือน เลือกท่าพื้นฐานที่เหมาะสม ระบุเซ็ต ครั้ง/ระยะเวลา เวลาพักและกล้ามเนื้อเป้าหมาย หลีกเลี่ยงฝึกกล้ามเนื้อเดิมหนักซ้ำติดกัน
หากควรพัก ให้ restDay=true และ items=[] หากข้อมูลไม่พอให้ถามเพิ่มและ hasPlan=false แผนเป็นเพียงข้อเสนอ ผู้ใช้ต้องยืนยันก่อนบันทึก
ส่งคำตอบเป็น JSON ตาม schema เท่านั้น โดย reply เป็นข้อความสนทนา และ hasPlan/plan เป็นข้อมูลแผน`;
  const userContext={date,currentMessage:message||"ช่วยประเมินจากประวัติการฝึกที่บันทึกไว้สำหรับวันนี้",recentTrainingHistory:workouts,previousConversation:conversation,currentAcceptedPlan:existingPlan};
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
    let parsed; try{parsed=JSON.parse(raw)}catch{return json(res,502,{error:"รูปแบบคำตอบจาก Gemini ไม่ถูกต้อง กรุณาส่งอีกครั้ง"})}
    const plan=parsed.plan&&typeof parsed.plan==="object"?parsed.plan:{};
    const safePlan={date,title:cleanText(plan.title,100)||"แผนฝึกที่แนะนำ",reason:cleanText(plan.reason,500),restDay:Boolean(plan.restDay),
      items:Array.isArray(plan.items)?plan.items.slice(0,8).map(item=>({exercise:cleanText(item?.exercise,100),sets:Math.min(20,Math.max(0,Number(item?.sets)||0)),reps:cleanText(item?.reps,40),restSeconds:Math.min(600,Math.max(0,Number(item?.restSeconds)||0)),targetMuscles:cleanText(item?.targetMuscles,100),note:cleanText(item?.note,180)})).filter(item=>item.exercise&&item.sets>0&&item.reps):[]};
    if(safePlan.restDay)safePlan.items=[];
    const hasPlan=Boolean(parsed.hasPlan)&&(safePlan.restDay||safePlan.items.length>0);
    return json(res,200,{reply:cleanText(parsed.reply,1800)||"ได้รับข้อมูลแล้ว แต่ยังไม่มีคำแนะนำเพิ่มเติม",hasPlan,plan:safePlan});
  } catch { return json(res,502,{error:"เชื่อมต่อ Gemini ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่"}); }
};
