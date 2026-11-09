export const onRequestGet=({env})=>Response.json({
  registrationOpen:env.REGISTRATION_ENABLED==='true'&&env.LEGAL_DOCS_APPROVED==='true'&&Boolean(env.TURNSTILE_SITE_KEY),
  turnstileSiteKey:env.REGISTRATION_ENABLED==='true'&&env.LEGAL_DOCS_APPROVED==='true'?(env.TURNSTILE_SITE_KEY||null):null
},{headers:{'cache-control':'no-store','content-type':'application/json'}});