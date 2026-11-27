// Search Wikimedia Commons for relevant exercise and health reference images.
function json(res,status,body){res.setHeader("Cache-Control","public, s-maxage=86400, stale-while-revalidate=604800");return res.status(status).json(body);}
module.exports=async function exerciseMedia(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return json(res,405,{error:"Method not allowed"});}
  const q=typeof req.query?.q==="string"?req.query.q.trim().slice(0,100):"";
  const kind=req.query?.kind==="general"?"general":"exercise";
  if(!q)return json(res,400,{error:"กรุณาระบุหัวข้อภาพประกอบ"});
  try{
    const sourceQ=q.toLowerCase();
    const normalize=value=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
    const raw=normalize(q);
    const exerciseMap=[
      {match:/sit to stand|chair stand|ลุกนั่งจากเก้าอี้|สควอตแตะเก้าอี้/,terms:["sit to stand exercise","chair stand exercise","sit to stand test"]},
      {match:/knee push|kneeling push|วิดพื้นเข่า/,terms:["knee push up exercise","kneeling push up","modified push up"]},
      {match:/wall push|วิดพื้น.*กำแพง|พิงกำแพง/,terms:["wall push up exercise"]},
      {match:/push up|วิดพื้น/,terms:["push up exercise"]},
      {match:/squat|สควอต/,terms:["bodyweight squat exercise"]},
      {match:/glute bridge|สะพานโค้ง|กลูตบริดจ์/,terms:["glute bridge exercise"]},
      {match:/bird dog|เบิร์ดด็อก/,terms:["bird dog exercise"]},
      {match:/calf raise|เขย่งปลายเท้า/,terms:["calf raise exercise"]},
      {match:/side leg raise|ยกขาด้านข้าง/,terms:["side lying leg raise exercise"]},
      {match:/standing hip extension|เหยียดสะโพก/,terms:["standing hip extension exercise"]}
    ];
    let terms=[];
    if(kind==="exercise"){
      const matched=exerciseMap.find(item=>item.match.test(sourceQ)||item.match.test(raw));
      if(matched) terms=matched.terms;
      else {
        const words=raw.split(" ").filter(word=>word.length>2);
        if(words.length>=2) terms=[words.slice(-5).join(" ")+" exercise"];
      }
    } else {
      const allowed=["exercise","fitness","muscle","anatomy","nutrition","food","protein","stretch","squat","push","bodyweight","chicken","egg","tofu","fish"];
      if(!raw.split(" ").some(word=>allowed.includes(word))) return json(res,200,{images:[],youtubeSearchUrl:null});
      terms=[raw];
    }
    if(!terms.length) return json(res,200,{images:[],youtubeSearchUrl:kind==="exercise"?"https://www.youtube.com/results?search_query="+encodeURIComponent(q+" exercise tutorial"):null});
    const imageMap=new Map();
    for(const term of terms){
      const url="https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch="+encodeURIComponent('"'+term+'"')+"&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&format=json&origin=*";
      const upstream=await fetch(url,{headers:{"User-Agent":"LifeHealthPlanner/1.0 (exercise reference images)"}});
      if(!upstream.ok) continue;
      const data=await upstream.json();
      for(const page of Object.values(data?.query?.pages||{})){
        const title=String(page.title||"").replace(/^File:/,"");
        const normalizedTitle=normalize(title);
        const tokens=normalize(term).split(" ").filter(word=>word.length>2&&!["exercise","fitness","bodyweight"].includes(word));
        const matches=tokens.filter(word=>normalizedTitle.includes(word)).length;
        const required=kind==="exercise"?Math.max(1,Math.ceil(tokens.length*0.5)):Math.max(1,Math.ceil(tokens.length*0.35));
        if(matches<required) continue;
        const info=page.imageinfo?.[0],meta=info?.extmetadata||{};
        const strip=value=>String(value?.value||"").replace(/<[^>]*>/g,"").slice(0,180);
        if(info?.thumburl&&!imageMap.has(page.pageid)) imageMap.set(page.pageid,{title,thumbnail:info.thumburl,pageUrl:info.descriptionurl,license:strip(meta.LicenseShortName)||"ตรวจสอบสัญญาอนุญาตที่ต้นทาง",relevance:matches});
      }
    }
    const images=[...imageMap.values()].sort((a,b)=>b.relevance-a.relevance).slice(0,4).map(({relevance,...image})=>image);
    return json(res,200,{images,youtubeSearchUrl:kind==="exercise"?"https://www.youtube.com/results?search_query="+encodeURIComponent(terms[0]+" tutorial"):null});
  }catch{return json(res,502,{error:"ค้นหาภาพประกอบไม่สำเร็จ"});}
};
