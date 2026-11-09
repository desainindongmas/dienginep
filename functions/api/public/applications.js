export async function onRequestPost({request,env}){
  const send=(status,code,message,data)=>Response.json(data?{success:true,data}:{success:false,error:{code,message}},{status,headers:{"cache-control":"no-store","content-type":"application/json"}});
  if(env.REGISTRATION_ENABLED!=="true"||env.LEGAL_DOCS_APPROVED!=="true") return send(503,"REGISTRATION_CLOSED","Pendaftaran publik belum dibuka.");
  if(!env.SUPABASE_URL||!env.SUPABASE_SECRET_KEY) return send(503,"SERVER_NOT_READY","Sistem belum siap menerima pendaftaran.");
  const idem=request.headers.get("idempotency-key");
  if(!idem||!/^[a-f0-9-]{36}$/i.test(idem))return send(422,"INVALID_REQUEST","Kode pengiriman tidak valid.");
  if(Number(request.headers.get("content-length")||0)>12000)return send(413,"TOO_LARGE","Data terlalu panjang.");
  let d;try{d=await request.json()}catch{return send(422,"INVALID_JSON","Data tidak valid.");}
  const cats=["homestay","jeep","souvenirs","agrotourism","local_guide"];
  const str=(x,max)=>typeof x==="string"&&x.trim().length>=2&&x.trim().length<=max;
  const count=x=>Number.isInteger(x)&&x>=1&&x<=10000;
  if(!d||!cats.includes(d.business_category)||!str(d.owner_name,120)||!str(d.business_name,150)||!str(d.village,160)||!str(d.address_landmark,500)||!/^08\d{8,11}$/.test(d.whatsapp||"")||d.address_landmark.trim().length<5||d.acknowledged_terms!==true||d.privacy_notice_acknowledged!==true||d.terms_version!=="v1.2"||d.privacy_version!=="v1.2")
    return send(422,"VALIDATION_ERROR","Mohon periksa data dan persetujuan Anda.");
  if(d.business_category==="homestay"&&(!count(d.room_count)||!count(d.guest_capacity)))return send(422,"VALIDATION_ERROR","Isi jumlah kamar dan kapasitas tamu.");
  if(d.business_category==="jeep"&&(!count(d.vehicle_count)||!count(d.passenger_capacity)))return send(422,"VALIDATION_ERROR","Isi jumlah dan kapasitas jeep.");
  if(d.business_category==="souvenirs"&&!str(d.product_types,500))return send(422,"VALIDATION_ERROR","Isi jenis produk.");
  if(d.business_category==="agrotourism"&&(!str(d.experience_type,500)||!count(d.visit_capacity)))return send(422,"VALIDATION_ERROR","Isi detail agrowisata.");
  if(d.business_category==="local_guide"&&(!str(d.guiding_areas,500)||!count(d.group_capacity)))return send(422,"VALIDATION_ERROR","Isi detail pemandu.");
  // Cloudflare Turnstile is mandatory before collecting real personal data.
  if(!env.TURNSTILE_SECRET_KEY||!d.turnstile_token)return send(503,"ANTISPAM_NOT_READY","Perlindungan formulir belum diaktifkan.");
  let verification;
  try{const fd=new FormData();fd.append("secret",env.TURNSTILE_SECRET_KEY);fd.append("response",d.turnstile_token);fd.append("remoteip",request.headers.get("CF-Connecting-IP")||"");const v=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:fd});verification=await v.json();}catch{return send(503,"ANTISPAM_ERROR","Verifikasi keamanan sedang bermasalah.");}
  if(!verification?.success)return send(403,"BOT_CHECK_FAILED","Silakan ulangi verifikasi keamanan.");
  const payload={...d,whatsapp_e164:"+62"+d.whatsapp.slice(1)};
  delete payload.turnstile_token;
  try {
    const base=env.SUPABASE_URL.replace(/\/$/,"");
    const key=env.SUPABASE_SECRET_KEY;
    const headers={"apikey":key,"content-type":"application/json"};
    const response=await fetch(base+"/rest/v1/rpc/submit_partner_application",{
      method:"POST",headers:{...headers,"prefer":"return=representation"},
      body:JSON.stringify({p_payload:payload,p_idempotency_key:idem})
    });
    if(!response.ok) throw new Error("Database insert failed: "+response.status);
    const data=await response.json();
    const result=Array.isArray(data)?data[0]:data;
    if(!result?.public_code)throw new Error("Registration code missing");
    // Database trigger creates a private email-outbox row. Deliveries never alter registration success.
    const delivery=await notifyAdmin({env,base,headers,payload,code:result.public_code});
    if(delivery==="failed") console.error("FPRS admin email pending retry for code",result.public_code);
    return send(201,null,null,result);
  } catch (error) {
    console.error("FPRS registration persistence error",error?.message);
    return send(500,"SERVER_ERROR","Data belum berhasil dikonfirmasi. Mohon coba lagi.");
  }
}

function emailText(data,code) {
  const fields=[
    ["Nomor pendaftaran",code],
    ["Status","Pendaftaran baru — perlu pemeriksaan"],
    ["Jenis usaha",data.business_category],
    ["Nama pemilik",data.owner_name],
    ["Nama usaha",data.business_name],
    ["WhatsApp",data.whatsapp_e164],
    ["Desa / area",data.village],
    ["Alamat / patokan",data.address_landmark],
    ["Kode referral",data.referral_code],
    ["Jumlah kamar",data.room_count],
    ["Kapasitas tamu",data.guest_capacity],
    ["Jumlah kendaraan",data.vehicle_count],
    ["Kapasitas penumpang",data.passenger_capacity],
    ["Produk utama",data.product_types],
    ["Jenis pengalaman",data.experience_type],
    ["Kapasitas pengunjung",data.visit_capacity],
    ["Wilayah pemanduan",data.guiding_areas],
    ["Kapasitas rombongan",data.group_capacity],
    ["Versi ketentuan",data.terms_version],
    ["Versi privasi",data.privacy_version]
  ];
  return "DIENGINEP - BERKAS PENDAFTARAN FOUNDING PARTNER\n\n"
    +fields.filter(([,value])=>value!==undefined&&value!==null&&String(value)!=="").map(([name,value])=>name+": "+String(value)).join("\n")
    +"\n\nPendaftaran awal GRATIS. Jangan meminta kontribusi sebelum lulus seleksi, verifikasi dan perjanjian.";
}

async function notifyAdmin({env,base,headers,payload,code}) {
  // The email sender needs a provider-verified domain. Without it, keep the outbox pending.
  if(!env.RESEND_API_KEY||!env.EMAIL_FROM)return "pending";
  let id;
  try{
    const lookup=await fetch(base+"/rest/v1/partner_applications?select=id&public_code=eq."+encodeURIComponent(code)+"&limit=1",{
      headers:{...headers,"cache-control":"no-store"}
    });
    if(!lookup.ok)throw new Error("Application lookup failed");
    const rows=await lookup.json();id=rows?.[0]?.id;
    if(!id)throw new Error("Application ID missing");
    const previous=await fetch(base+"/rest/v1/application_email_outbox?select=delivery_status&application_id=eq."+id,{
      headers:{...headers,"cache-control":"no-store"}
    });
    if(previous.ok&&(await previous.json())?.[0]?.delivery_status==="sent")return "sent";
    const body={
      from:env.EMAIL_FROM,
      to:["admin3@desainindongmas.my.id"],
      subject:"[DiengInep] Pendaftaran Founding Partner "+code+" — "+payload.business_name,
      text:emailText(payload,code)
    };
    const sent=await fetch("https://api.resend.com/emails",{
      method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":"fprs-"+code},
      body:JSON.stringify(body)
    });
    const reply=await sent.json().catch(()=>({}));
    const ok=sent.ok&&Boolean(reply.id);
    await fetch(base+"/rest/v1/application_email_outbox?application_id=eq."+id,{
      method:"PATCH",headers:{...headers,"prefer":"return=minimal"},
      body:JSON.stringify({
        delivery_status:ok?"sent":"failed",
        attempts:1,
        provider_message_id:ok?reply.id:null,
        sent_at:ok?new Date().toISOString():null,
        last_error:ok?null:("Resend HTTP "+sent.status),
        updated_at:new Date().toISOString()
      })
    });
    return ok?"sent":"failed";
  }catch(e){
    console.error("FPRS email notification error",e?.message);
    if(id) await fetch(base+"/rest/v1/application_email_outbox?application_id=eq."+id,{
      method:"PATCH",headers:{...headers,"prefer":"return=minimal"},
      body:JSON.stringify({delivery_status:"failed",attempts:1,last_error:"Notification delivery error",updated_at:new Date().toISOString()})
    }).catch(()=>{});
    return "failed";
  }
}
