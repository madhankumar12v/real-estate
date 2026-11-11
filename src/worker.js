const API_VERSION = "v25.0";
const json = (body, status=200) => new Response(JSON.stringify(body), {status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
class HttpError extends Error { constructor(message,status=400){super(message);this.status=status;} }
function requiredEnv(env){
  for(const key of ["SUPABASE_URL","SUPABASE_ANON_KEY"]){
    if(!env[key]) throw new HttpError("Worker configuration is missing "+key+".",503);
  }
}
function bearer(request){
  const value=request.headers.get("Authorization")||"";
  if(!value.startsWith("Bearer ")) throw new HttpError("Please sign in to continue.",401);
  return value.slice(7);
}
async function supabaseRequest(env,token,path,options={}){
  const response=await fetch(env.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/"+path,{
    method:options.method||"GET",
    headers:{"apikey":env.SUPABASE_ANON_KEY,"Authorization":"Bearer "+token,"Content-Type":"application/json","Accept":"application/json",...(options.prefer?{"Prefer":options.prefer}:{})},
    body:options.body?JSON.stringify(options.body):undefined
  });
  const text=await response.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!response.ok) throw new HttpError(data?.message||data?.hint||"Supabase request failed.",response.status);
  return data;
}

async function serviceRequest(env,path,options={}){
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured in Cloudflare Worker secrets.");
  const response=await fetch(env.SUPABASE_URL.replace(/\/$/,"")+"/rest/v1/"+path,{
    method:options.method||"GET",
    headers:{"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Accept":"application/json",...(options.prefer?{"Prefer":options.prefer}:{})},
    body:options.body?JSON.stringify(options.body):undefined
  });
  const text=await response.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!response.ok) throw new Error(data?.message||data?.hint||"Supabase automation queue request failed.");
  return data;
}

async function requireAdmin(request,env){
  requiredEnv(env);
  const token=bearer(request);
  const userResponse=await fetch(env.SUPABASE_URL.replace(/\/$/,"")+"/auth/v1/user",{headers:{"apikey":env.SUPABASE_ANON_KEY,"Authorization":"Bearer "+token}});
  if(!userResponse.ok) throw new HttpError("Your login session is invalid or expired.",401);
  const user=await userResponse.json();
  const profiles=await supabaseRequest(env,token,"profiles?select=id,role&id=eq."+encodeURIComponent(user.id)+"&limit=1");
  if(!profiles?.length||profiles[0].role!=="admin") throw new HttpError("Administrator access is required.",403);
  return {token,user};
}
async function graphPost(url,params){
  const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:params.toString()});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.error) throw new Error(data.error?.message||"Meta Graph API request failed.");
  return data;
}
async function publishInstagram(env,post){
  if(!env.INSTAGRAM_ACCESS_TOKEN||!env.INSTAGRAM_ACCOUNT_ID) throw new Error("Instagram publishing is not configured. Add INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID as Cloudflare secrets/variables.");
  const imageUrl=new URL(post.image_url);
  if(imageUrl.protocol!=="https:") throw new Error("Instagram requires a publicly accessible HTTPS image URL.");
  const imageCheck=await fetch(imageUrl.toString(),{method:"HEAD"});
  if(!imageCheck.ok) throw new Error("Instagram could not access the property image. Check that the image URL is public.");
  const contentType=(imageCheck.headers.get("content-type")||"").toLowerCase();
  if(!contentType.startsWith("image/jpeg")) throw new Error("Instagram API image publishing requires a JPEG photo. This listing's first photo is "+(contentType||"an unknown format")+". Upload a JPG/JPEG photo and create a new draft.");
  const base="https://graph.facebook.com/"+(env.INSTAGRAM_GRAPH_API_VERSION||API_VERSION);
  const createParams=new URLSearchParams({image_url:post.image_url,caption:post.caption,access_token:env.INSTAGRAM_ACCESS_TOKEN});
  const container=await graphPost(base+"/"+env.INSTAGRAM_ACCOUNT_ID+"/media",createParams);
  if(!container.id) throw new Error("Meta did not return a media container ID.");
  let ready=false;
  for(let attempt=0;attempt<5;attempt++){
    const statusUrl=new URL(base+"/"+container.id);
    statusUrl.searchParams.set("fields","status_code");
    statusUrl.searchParams.set("access_token",env.INSTAGRAM_ACCESS_TOKEN);
    const statusResponse=await fetch(statusUrl.toString());
    const statusData=await statusResponse.json().catch(()=>({}));
    if(!statusResponse.ok||statusData.error) throw new Error(statusData.error?.message||"Could not check Instagram media status.");
    if(statusData.status_code==="FINISHED"||!statusData.status_code){ready=true;break;}
    if(statusData.status_code==="ERROR"||statusData.status_code==="EXPIRED") throw new Error("Instagram media processing status: "+statusData.status_code+".");
    await new Promise(resolve=>setTimeout(resolve,1200));
  }
  if(!ready) throw new Error("Instagram is still processing the image. Please try publishing again shortly.");
  const publishParams=new URLSearchParams({creation_id:container.id,access_token:env.INSTAGRAM_ACCESS_TOKEN});
  const published=await graphPost(base+"/"+env.INSTAGRAM_ACCOUNT_ID+"/media_publish",publishParams);
  if(!published.id) throw new Error("Meta did not return the published media ID.");
  let permalink=null;
  try{
    const mediaUrl=new URL(base+"/"+published.id);
    mediaUrl.searchParams.set("fields","permalink");
    mediaUrl.searchParams.set("access_token",env.INSTAGRAM_ACCESS_TOKEN);
    const mediaResponse=await fetch(mediaUrl.toString());
    const mediaData=await mediaResponse.json();
    if(mediaResponse.ok) permalink=mediaData.permalink||null;
  }catch{}
  return {containerId:container.id,mediaId:published.id,permalink};
}

async function publishFacebook(env,post){
  const missing=[];
  if(!String(env.FACEBOOK_PAGE_ACCESS_TOKEN||"").trim()) missing.push("FACEBOOK_PAGE_ACCESS_TOKEN");
  if(!String(env.FACEBOOK_PAGE_ID||"").trim()) missing.push("FACEBOOK_PAGE_ID");
  if(missing.length) throw new Error("The deployed Worker cannot read: "+missing.join(", ")+". Re-save the missing value under mrsa → Production → Settings → Variables and Secrets, then redeploy.");
  const imageUrl=new URL(post.image_url);
  if(imageUrl.protocol!=="https:") throw new Error("Facebook requires a publicly accessible HTTPS image URL.");
  const imageCheck=await fetch(imageUrl.toString(),{method:"HEAD"});
  if(!imageCheck.ok) throw new Error("Facebook could not access the property image. Check that the image URL is public.");
  const contentType=(imageCheck.headers.get("content-type")||"").toLowerCase();
  if(!contentType.startsWith("image/jpeg")&&!contentType.startsWith("image/png")) throw new Error("Facebook photo publishing requires a JPG/JPEG or PNG image. This listing image is "+(contentType||"an unknown format")+".");
  const base="https://graph.facebook.com/"+(env.FACEBOOK_GRAPH_API_VERSION||API_VERSION);
  const params=new URLSearchParams({url:post.image_url,caption:post.caption,access_token:env.FACEBOOK_PAGE_ACCESS_TOKEN});
  const published=await graphPost(base+"/"+env.FACEBOOK_PAGE_ID+"/photos",params);
  const mediaId=published.id||null;
  const postId=published.post_id||mediaId;
  if(!postId) throw new Error("Meta did not return a Facebook post ID.");
  let permalink=null;
  try{
    const postUrl=new URL(base+"/"+postId);
    postUrl.searchParams.set("fields","permalink_url");
    postUrl.searchParams.set("access_token",env.FACEBOOK_PAGE_ACCESS_TOKEN);
    const response=await fetch(postUrl.toString());
    const data=await response.json();
    if(response.ok) permalink=data.permalink_url||null;
  }catch{}
  return {mediaId,postId,permalink};
}


async function runSocialAutomation(env){
  if(!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  const settings=await serviceRequest(env,"social_automation_settings?select=enabled&id=eq.1&limit=1");
  if(!settings?.[0]?.enabled) return {paused:true,processed:0};
  let processed=0;
  const now=new Date().toISOString();
  for(const [table,platform] of [["facebook_posts","facebook"],["instagram_posts","instagram"]]){
    const due=await serviceRequest(env,table+"?select=id,listing_id,caption,image_url,attempt_count&auto_generated=eq.true&status=eq.approved&next_attempt_at=lte."+encodeURIComponent(now)+"&order=created_at.asc&limit=5");
    for(const post of due||[]){
      const latest=await serviceRequest(env,"social_automation_settings?select=enabled&id=eq.1&limit=1");
      if(!latest?.[0]?.enabled) return {paused:true,processed};
      const attempt=(Number(post.attempt_count)||0)+1;
      const claim=await serviceRequest(env,table+"?id=eq."+encodeURIComponent(post.id)+"&status=eq.approved&auto_generated=eq.true",{
        method:"PATCH",prefer:"return=representation",
        body:{status:"publishing",attempt_count:attempt,last_attempt_at:new Date().toISOString(),processing_started_at:new Date().toISOString(),last_error:null}
      });
      if(!claim?.length) continue;
      processed++;
      let result;
      try{
        const listing=await serviceRequest(env,"listings?select=id,status&id=eq."+encodeURIComponent(post.listing_id)+"&status=eq.approved&limit=1");
        if(!listing?.length) throw new Error("Property is no longer approved. Automatic publishing was blocked.");
        result=platform==="facebook"?await publishFacebook(env,post):await publishInstagram(env,post);
      }catch(error){
        const message=String(error?.message||"Automatic publishing failed.").slice(0,1000);
        const permanent=/requires a JPEG|permission|not configured|invalid access token|unsupported post|no longer approved|deprecated/i.test(message);
        const retryMinutes=[5,15,60,180];
        const exhausted=attempt>=5||permanent;
        const nextAttempt=new Date(Date.now()+(retryMinutes[Math.min(attempt-1,retryMinutes.length-1)]||180)*60000).toISOString();
        await serviceRequest(env,table+"?id=eq."+encodeURIComponent(post.id)+"&status=eq.publishing",{
          method:"PATCH",
          body:{status:exhausted?"failed":"approved",last_error:message,next_attempt_at:nextAttempt,processing_started_at:null}
        }).catch(()=>{});
        continue;
      }
      const fields=platform==="facebook"
        ? {status:"published",fb_media_id:result.mediaId,fb_post_id:result.postId,permalink:result.permalink,published_at:new Date().toISOString(),last_error:null,processing_started_at:null}
        : {status:"published",ig_container_id:result.containerId,ig_media_id:result.mediaId,permalink:result.permalink,published_at:new Date().toISOString(),last_error:null,processing_started_at:null};
      // If Meta accepted the post but this database write fails, leave it in "publishing"
      // for manual reconciliation rather than automatically sending a duplicate.
      try{
        await serviceRequest(env,table+"?id=eq."+encodeURIComponent(post.id)+"&status=eq.publishing",{method:"PATCH",body:fields});
      }catch(saveError){
        console.error("Published externally but could not save "+platform+" status for "+post.id+":",saveError?.message||saveError);
      }
    }
  }
  return {paused:false,processed};
}

async function handleApi(request,env){
  const url=new URL(request.url);
  const path=url.pathname;
  const {token,user}=await requireAdmin(request,env);
  if(request.method==="GET"&&path==="/api/social-automation/property-history"){
    const [facebook,instagram]=await Promise.all([
      supabaseRequest(env,token,"facebook_posts?select=id,listing_id,fb_post_id,permalink,published_at,listing:listings(title,city)&status=eq.published&order=published_at.desc&limit=1000"),
      supabaseRequest(env,token,"instagram_posts?select=id,listing_id,ig_media_id,permalink,published_at,listing:listings(title,city)&status=eq.published&order=published_at.desc&limit=1000")
    ]);
    return json({facebook:facebook||[],instagram:instagram||[]});
  }
  if(request.method==="GET"&&path==="/api/social-automation/status"){
    return json({
      serviceRoleConfigured:Boolean(String(env.SUPABASE_SERVICE_ROLE_KEY||"").trim()),
      facebookConfigured:Boolean(String(env.FACEBOOK_PAGE_ID||"").trim()&&String(env.FACEBOOK_PAGE_ACCESS_TOKEN||"").trim()),
      instagramConfigured:Boolean(String(env.INSTAGRAM_ACCOUNT_ID||"").trim()&&String(env.INSTAGRAM_ACCESS_TOKEN||"").trim())
    });
  }
  if(request.method==="GET"&&path==="/api/instagram/listings"){
    const listings=await supabaseRequest(env,token,"listings?select=id,title,city,district,locality,property_type,price_per_sqft,description,images:listing_images(url)&status=eq.approved&order=created_at.desc&limit=100");
    return json({listings:listings||[]});
  }
  if(request.method==="GET"&&path==="/api/instagram/posts"){
    const posts=await supabaseRequest(env,token,"instagram_posts?select=id,listing_id,caption,image_url,status,ig_media_id,permalink,last_error,created_at,published_at,auto_generated,attempt_count,next_attempt_at,listing:listings(title,city,district,status)&order=created_at.desc&limit=50");
    return json({posts:posts||[]});
  }
  if(request.method==="POST"&&path==="/api/instagram/posts"){
    const body=await request.json().catch(()=>null);
    if(!body?.listing_id||!String(body.caption||"").trim()||!body.image_url) throw new HttpError("Choose an approved property, photo and caption.");
    if(String(body.caption).length>2200) throw new HttpError("Instagram captions cannot exceed 2,200 characters.");
    const listingRows=await supabaseRequest(env,token,"listings?select=id,status&id=eq."+encodeURIComponent(body.listing_id)+"&limit=1");
    if(!listingRows?.length||listingRows[0].status!=="approved") throw new HttpError("Only currently approved property listings can be posted.",409);
    const imageRows=await supabaseRequest(env,token,"listing_images?select=id&listing_id=eq."+encodeURIComponent(body.listing_id)+"&url=eq."+encodeURIComponent(String(body.image_url))+"&limit=1");
    if(!imageRows?.length) throw new HttpError("Choose a photo attached to the selected property listing.",409);
    const created=await supabaseRequest(env,token,"instagram_posts",{method:"POST",prefer:"return=representation",body:{listing_id:body.listing_id,caption:String(body.caption).trim(),image_url:String(body.image_url),status:"draft",created_by:user.id}});
    return json({post:created?.[0]||null},201);
  }
  const approveMatch=path.match(/^\/api\/instagram\/posts\/([0-9a-f-]+)\/approve$/i);
  if(request.method==="POST"&&approveMatch){
    const updated=await supabaseRequest(env,token,"instagram_posts?id=eq."+encodeURIComponent(approveMatch[1])+"&status=eq.draft",{method:"PATCH",prefer:"return=representation",body:{status:"approved",approved_by:user.id,approved_at:new Date().toISOString(),next_attempt_at:new Date().toISOString(),last_error:null}});
    if(!updated?.length) throw new HttpError("Draft not found or it has already been reviewed.",409);
    return json({post:updated[0]});
  }
  const instagramRejectMatch=path.match(/^\/api\/instagram\/posts\/([0-9a-f-]+)\/reject$/i);
  if(request.method==="POST"&&instagramRejectMatch){
    const id=encodeURIComponent(instagramRejectMatch[1]);
    const rows=await supabaseRequest(env,token,"instagram_posts?select=id,status&id=eq."+id+"&limit=1");
    const post=rows?.[0];
    if(!post) throw new HttpError("Instagram queue item not found.",404);
    if(["published","publishing"].includes(post.status)) throw new HttpError("Published or currently publishing posts cannot be rejected.",409);
    const updated=await supabaseRequest(env,token,"instagram_posts?id=eq."+id+"&status=in.(draft,approved,failed,rejected)",{method:"PATCH",prefer:"return=representation",body:{status:"rejected",last_error:null,next_attempt_at:null,processing_started_at:null}});
    if(!updated?.length) throw new HttpError("This Instagram item can no longer be rejected.",409);
    return json({post:updated[0]});
  }
  const instagramDeleteMatch=path.match(/^\/api\/instagram\/posts\/([0-9a-f-]+)\/delete$/i);
  if(request.method==="POST"&&instagramDeleteMatch){
    const id=encodeURIComponent(instagramDeleteMatch[1]);
    const rows=await supabaseRequest(env,token,"instagram_posts?select=id,status&id=eq."+id+"&limit=1");
    const post=rows?.[0];
    if(!post) throw new HttpError("Instagram queue item not found.",404);
    if(["published","publishing"].includes(post.status)) throw new HttpError("Published or currently publishing posts cannot be deleted. Keep the publishing history.",409);
    const deleted=await supabaseRequest(env,token,"instagram_posts?id=eq."+id+"&status=in.(draft,approved,failed,rejected)",{method:"DELETE",prefer:"return=representation"});
    if(!deleted?.length) throw new HttpError("This Instagram item could not be deleted.",409);
    return json({success:true});
  }
  const publishMatch=path.match(/^\/api\/instagram\/posts\/([0-9a-f-]+)\/publish$/i);
  if(request.method==="POST"&&publishMatch){
    const rows=await supabaseRequest(env,token,"instagram_posts?select=id,listing_id,caption,image_url,status&id=eq."+encodeURIComponent(publishMatch[1])+"&limit=1");
    const post=rows?.[0];
    if(!post) throw new HttpError("Instagram draft not found.",404);
    if(post.status!=="approved") throw new HttpError("Only an approved post can be published.",409);
    const listingRows=await supabaseRequest(env,token,"listings?select=id,status&id=eq."+encodeURIComponent(post.listing_id)+"&limit=1");
    if(!listingRows?.length||listingRows[0].status!=="approved") throw new HttpError("This property is no longer approved. Publishing has been blocked.",409);
    const claimed=await supabaseRequest(env,token,"instagram_posts?id=eq."+encodeURIComponent(post.id)+"&status=eq.approved",{method:"PATCH",prefer:"return=representation",body:{status:"publishing",last_error:null}});
    if(!claimed?.length) throw new HttpError("This post is already being processed or is no longer approved.",409);
    try{
      const result=await publishInstagram(env,post);
      const saved=await supabaseRequest(env,token,"instagram_posts?id=eq."+encodeURIComponent(post.id),{method:"PATCH",prefer:"return=representation",body:{status:"published",ig_container_id:result.containerId,ig_media_id:result.mediaId,permalink:result.permalink,published_at:new Date().toISOString(),last_error:null}});
      return json({success:true,post:saved?.[0]||null,permalink:result.permalink});
    }catch(error){
      const message=String(error?.message||"Instagram publishing failed.").slice(0,1000);
      await supabaseRequest(env,token,"instagram_posts?id=eq."+encodeURIComponent(post.id),{method:"PATCH",body:{status:"failed",last_error:message}}).catch(()=>{});
      throw new HttpError(message,502);
    }
  }

  if(request.method==="GET"&&path==="/api/facebook/config"){
    return json({facebookPageIdConfigured:Boolean(String(env.FACEBOOK_PAGE_ID||"").trim()),facebookPageAccessTokenConfigured:Boolean(String(env.FACEBOOK_PAGE_ACCESS_TOKEN||"").trim())});
  }
  if(request.method==="GET"&&path==="/api/facebook/listings"){
    const listings=await supabaseRequest(env,token,"listings?select=id,title,city,district,locality,property_type,price_per_sqft,description,images:listing_images(url)&status=eq.approved&order=created_at.desc&limit=100");
    return json({listings:listings||[]});
  }
  if(request.method==="GET"&&path==="/api/facebook/posts"){
    const posts=await supabaseRequest(env,token,"facebook_posts?select=id,listing_id,caption,image_url,status,fb_media_id,fb_post_id,permalink,last_error,created_at,published_at,auto_generated,attempt_count,next_attempt_at,listing:listings(title,city,district,status)&order=created_at.desc&limit=50");
    return json({posts:posts||[]});
  }
  if(request.method==="POST"&&path==="/api/facebook/posts"){
    const body=await request.json().catch(()=>null);
    if(!body?.listing_id||!String(body.caption||"").trim()||!body.image_url) throw new HttpError("Choose an approved property, photo and caption.");
    if(String(body.caption).length>5000) throw new HttpError("Facebook post text cannot exceed 5,000 characters.");
    const listingRows=await supabaseRequest(env,token,"listings?select=id,status&id=eq."+encodeURIComponent(body.listing_id)+"&limit=1");
    if(!listingRows?.length||listingRows[0].status!=="approved") throw new HttpError("Only currently approved property listings can be posted.",409);
    const imageRows=await supabaseRequest(env,token,"listing_images?select=id&listing_id=eq."+encodeURIComponent(body.listing_id)+"&url=eq."+encodeURIComponent(String(body.image_url))+"&limit=1");
    if(!imageRows?.length) throw new HttpError("Choose a photo attached to the selected property listing.",409);
    const created=await supabaseRequest(env,token,"facebook_posts",{method:"POST",prefer:"return=representation",body:{listing_id:body.listing_id,caption:String(body.caption).trim(),image_url:String(body.image_url),status:"draft",created_by:user.id}});
    return json({post:created?.[0]||null},201);
  }
  const fbApproveMatch=path.match(/^\/api\/facebook\/posts\/([0-9a-f-]+)\/approve$/i);
  if(request.method==="POST"&&fbApproveMatch){
    const updated=await supabaseRequest(env,token,"facebook_posts?id=eq."+encodeURIComponent(fbApproveMatch[1])+"&status=eq.draft",{method:"PATCH",prefer:"return=representation",body:{status:"approved",approved_by:user.id,approved_at:new Date().toISOString(),next_attempt_at:new Date().toISOString(),last_error:null}});
    if(!updated?.length) throw new HttpError("Draft not found or it has already been reviewed.",409);
    return json({post:updated[0]});
  }
  const fbRejectMatch=path.match(/^\/api\/facebook\/posts\/([0-9a-f-]+)\/reject$/i);
  if(request.method==="POST"&&fbRejectMatch){
    const id=encodeURIComponent(fbRejectMatch[1]);
    const rows=await supabaseRequest(env,token,"facebook_posts?select=id,status&id=eq."+id+"&limit=1");
    const post=rows?.[0];
    if(!post) throw new HttpError("Facebook queue item not found.",404);
    if(["published","publishing"].includes(post.status)) throw new HttpError("Published or currently publishing posts cannot be rejected.",409);
    const updated=await supabaseRequest(env,token,"facebook_posts?id=eq."+id+"&status=in.(draft,approved,failed,rejected)",{method:"PATCH",prefer:"return=representation",body:{status:"rejected",last_error:null,next_attempt_at:null,processing_started_at:null}});
    if(!updated?.length) throw new HttpError("This Facebook item can no longer be rejected.",409);
    return json({post:updated[0]});
  }
  const fbDeleteMatch=path.match(/^\/api\/facebook\/posts\/([0-9a-f-]+)\/delete$/i);
  if(request.method==="POST"&&fbDeleteMatch){
    const id=encodeURIComponent(fbDeleteMatch[1]);
    const rows=await supabaseRequest(env,token,"facebook_posts?select=id,status&id=eq."+id+"&limit=1");
    const post=rows?.[0];
    if(!post) throw new HttpError("Facebook queue item not found.",404);
    if(["published","publishing"].includes(post.status)) throw new HttpError("Published or currently publishing posts cannot be deleted. Keep the publishing history.",409);
    const deleted=await supabaseRequest(env,token,"facebook_posts?id=eq."+id+"&status=in.(draft,approved,failed,rejected)",{method:"DELETE",prefer:"return=representation"});
    if(!deleted?.length) throw new HttpError("This Facebook item could not be deleted.",409);
    return json({success:true});
  }
  const fbPublishMatch=path.match(/^\/api\/facebook\/posts\/([0-9a-f-]+)\/publish$/i);
  if(request.method==="POST"&&fbPublishMatch){
    const rows=await supabaseRequest(env,token,"facebook_posts?select=id,listing_id,caption,image_url,status&id=eq."+encodeURIComponent(fbPublishMatch[1])+"&limit=1");
    const post=rows?.[0];
    if(!post) throw new HttpError("Facebook draft not found.",404);
    if(post.status!=="approved") throw new HttpError("Only an approved post can be published.",409);
    const listingRows=await supabaseRequest(env,token,"listings?select=id,status&id=eq."+encodeURIComponent(post.listing_id)+"&limit=1");
    if(!listingRows?.length||listingRows[0].status!=="approved") throw new HttpError("This property is no longer approved. Publishing has been blocked.",409);
    const claimed=await supabaseRequest(env,token,"facebook_posts?id=eq."+encodeURIComponent(post.id)+"&status=eq.approved",{method:"PATCH",prefer:"return=representation",body:{status:"publishing",last_error:null}});
    if(!claimed?.length) throw new HttpError("This post is already being processed or is no longer approved.",409);
    try{
      const result=await publishFacebook(env,post);
      const saved=await supabaseRequest(env,token,"facebook_posts?id=eq."+encodeURIComponent(post.id),{method:"PATCH",prefer:"return=representation",body:{status:"published",fb_media_id:result.mediaId,fb_post_id:result.postId,permalink:result.permalink,published_at:new Date().toISOString(),last_error:null}});
      return json({success:true,post:saved?.[0]||null,permalink:result.permalink});
    }catch(error){
      const message=String(error?.message||"Facebook publishing failed.").slice(0,1000);
      await supabaseRequest(env,token,"facebook_posts?id=eq."+encodeURIComponent(post.id),{method:"PATCH",body:{status:"failed",last_error:message}}).catch(()=>{});
      throw new HttpError(message,502);
    }
  }

  throw new HttpError("Social publishing API route not found.",404);
}
export default {
  async scheduled(controller,env,ctx){
    ctx.waitUntil(runSocialAutomation(env).catch(error=>console.error("MrSa social automation:",error?.message||error)));
  },
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname.startsWith("/api/instagram/")||url.pathname.startsWith("/api/facebook/")||url.pathname.startsWith("/api/social-automation/")){
      if(request.method==="OPTIONS") return new Response(null,{status:204,headers:{"Allow":"GET, POST, OPTIONS"}});
      try{return await handleApi(request,env);}
      catch(error){return json({error:error?.message||"Unexpected server error."},error instanceof HttpError?error.status:500);}
    }
    return env.ASSETS.fetch(request);
  }
};
