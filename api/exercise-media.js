// Search Wikimedia Commons for exercise reference images without an API key.
function json(res,status,body){res.setHeader("Cache-Control","public, s-maxage=86400, stale-while-revalidate=604800");return res.status(status).json(body);}
module.exports=async function exerciseMedia(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return json(res,405,{error:"Method not allowed"});}
  const q=typeof req.query?.q==="string"?req.query.q.trim().slice(0,100):"";
  const kind=req.query?.kind==="general"?"general":"exercise";
  if(!q)return json(res,400,{error:"กรุณาระบุหัวข้อภาพประกอบ"});
  try{
    const searchTerm=kind==="exercise"?q+" exercise":q;
    const url="https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch="+encodeURIComponent(searchTerm)+"&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&format=json&origin=*";
    const upstream=await fetch(url,{headers:{"User-Agent":"LifeHealthPlanner/1.0 (exercise reference images)"}});
    if(!upstream.ok)return json(res,502,{error:"Image source unavailable"});
    const data=await upstream.json();
    const pages=Object.values(data?.query?.pages||{});
    const images=pages.map(page=>{
      const info=page.imageinfo?.[0],meta=info?.extmetadata||{};
      const strip=value=>String(value?.value||"").replace(/<[^>]*>/g,"").slice(0,180);
      return info?.thumburl?{title:String(page.title||"").replace(/^File:/,""),thumbnail:info.thumburl,pageUrl:info.descriptionurl,license:strip(meta.LicenseShortName)||"ตรวจสอบสัญญาอนุญาตที่ต้นทาง"}:null;
    }).filter(Boolean).slice(0,4);
    return json(res,200,{images,youtubeSearchUrl:kind==="exercise"?"https://www.youtube.com/results?search_query="+encodeURIComponent(q+" exercise tutorial"):null});
  }catch{return json(res,502,{error:"ค้นหาภาพประกอบไม่สำเร็จ"});}
};
