// Vercel Serverless Function - Eletro IA
// Required environment variables: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const json = (res, status, body) => res.status(status).setHeader('Content-Type','application/json; charset=utf-8').json(body);
const clean = v => String(v ?? '').trim();

module.exports = async (req, res) => {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return json(res,405,{error:'Método não permitido.'});
  const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(res,500,{error:'Configure OPENAI_API_KEY, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel.'});
  const username=clean(req.body?.username), password=clean(req.body?.password), question=clean(req.body?.question);
  if (!username || !password || !question || question.length>1200) return json(res,400,{error:'Informe usuário, senha e uma pergunta de até 1200 caracteres.'});
  const sb=SUPABASE_URL.replace(/\/$/,'');
  const headers={apikey:SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`};
  try {
    // Validar usuário e senha no servidor; nunca confiar no objeto currentUser do navegador.
    const u=await fetch(`${sb}/rest/v1/erp_team_users?select=id,username,email,password,role&or=(username.ilike.${encodeURIComponent(username)},email.ilike.${encodeURIComponent(username)})&limit=10`,{headers});
    if(!u.ok) throw new Error('Falha ao validar funcionário no Supabase.');
    const users=await u.json();
    const user=users.find(x => (clean(x.username).toLowerCase()===username.toLowerCase() || clean(x.email).toLowerCase()===username.toLowerCase()) && clean(x.password)===password);
    if(!user) return json(res,401,{error:'Autenticação inválida. Faça login novamente no ERP.'});
    const role=clean(user.role).toLowerCase();
    if (!['master admin','gerente','gerente de loja','operador de caixa'].includes(role)) return json(res,403,{error:'Seu perfil não possui acesso à Eletro IA.'});

    // Recupera o catálogo no banco, sem aceitar produtos enviados pelo navegador.
    const stateRes=await fetch(`${sb}/rest/v1/erp_store_state?select=payload&id=eq.main_store&limit=1`,{headers});
    if(!stateRes.ok) throw new Error('Não foi possível consultar os dados da loja.');
    const rows=await stateRes.json();
    const payload=rows?.[0]?.payload||{};
    const products=Array.isArray(payload.products)?payload.products:[];
    const catalog=products.slice(0,500).map(p=>({
      nome:clean(p.name), codigo:clean(p.sku||p.id), categoria:clean(p.group),
      preco:Number(p.price||0), estoque:Number(p.stock||0), descricao:clean(p.description||p.details||p.specifications)
    }));
    const storeName=clean(payload.store?.name)||'Eletro Shop';
    const instructions=`Você é a Eletro IA, assistente técnico e comercial interna da loja ${storeName}. Responda em português brasileiro, de forma clara e prática para funcionários. Use o catálogo fornecido como fonte prioritária para nome, preço e estoque. Nunca invente características, compatibilidade, certificações, garantia ou disponibilidade. Se a informação técnica não estiver no catálogo, deixe claro que precisa ser confirmada no manual/fabricante. Para preço e estoque, informe somente os valores do cadastro e sinalize que podem mudar. Não revele custo, margem, dados pessoais, dados de clientes, credenciais ou informações administrativas. Não execute operações no ERP. Você pode usar pesquisa web para esclarecer informações técnicas gerais, mas diferencie informação do fabricante de suposição e cite links/fontes quando disponíveis. Se houver produtos semelhantes no catálogo, sugira-os pelo nome. Catálogo atual (JSON): ${JSON.stringify(catalog)}`;
    const history=Array.isArray(req.body?.history)?req.body.history.slice(-8).filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string').map(m=>({role:m.role,content:m.content.slice(0,1500)})):[];
    const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL || 'gpt-6-astra',instructions,input:[...history,{role:'user',content:question}],tools:[{type:'web_search'}],tool_choice:'auto',max_output_tokens:900})});
    const result=await ai.json();
    if(!ai.ok) return json(res,502,{error:result.error?.message||'Erro ao consultar a inteligência artificial.'});
    const answer=(result.output||[]).flatMap(item=>item.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n').trim();
    return json(res,200,{answer:answer||'Não encontrei informações suficientes para responder com segurança.'});
  } catch(err) { return json(res,500,{error:err.message||'Erro interno da Eletro IA.'}); }
};
