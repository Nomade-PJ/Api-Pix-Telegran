// api/login.js — Nexus Panel Login
module.exports = function handler(req, res) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nexus Panel — Login</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#07070f;--surface:#0e0e1a;--surface2:#141424;--border:#ffffff0a;--border2:#ffffff18;
  --purple:#a855f7;--purple2:#c084fc;--purple-glow:#a855f730;--pink:#ec4899;
  --text:#f1f0ff;--text2:#9090b0;--muted:#4a4a6a;--danger:#f43f5e;
  --grad:linear-gradient(135deg,#a855f7,#ec4899);
}
body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden}

/* BG */
body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse 70% 60% at 20% 10%,#a855f712,transparent 60%),radial-gradient(ellipse 60% 50% at 80% 90%,#ec489910,transparent 60%);pointer-events:none}

/* GRID */
.bg-grid{position:fixed;inset:0;background-image:linear-gradient(#ffffff05 1px,transparent 1px),linear-gradient(90deg,#ffffff05 1px,transparent 1px);background-size:40px 40px;mask-image:radial-gradient(ellipse 80% 80% at 50% 50%,black 30%,transparent 100%);pointer-events:none}

/* GLOW ORB */
.orb{position:fixed;width:500px;height:500px;background:radial-gradient(circle,#a855f718 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;animation:breathe 5s ease-in-out infinite}
@keyframes breathe{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.6}50%{transform:translate(-50%,-50%) scale(1.15);opacity:1}}

.wrap{position:relative;z-index:1;width:100%;max-width:400px;padding:16px}

/* CARD */
.card{background:var(--surface);border:1px solid var(--border2);border-radius:20px;padding:40px;box-shadow:0 0 60px #a855f710,0 32px 80px #00000050;animation:slideUp .5s cubic-bezier(.16,1,.3,1) both}
@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}

/* LOGO */
.logo{text-align:center;margin-bottom:32px}
.logo-icon{width:56px;height:56px;background:var(--grad);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 14px;box-shadow:0 0 30px var(--purple-glow);animation:float 3s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.logo-title{font-size:22px;font-weight:700;letter-spacing:-.5px}
.logo-title span{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.logo-sub{font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-top:5px;letter-spacing:1px}

/* FORM */
.field{margin-bottom:18px}
.field label{display:block;font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px}
.field input{width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:11px;padding:13px 16px;color:var(--text);font-family:'JetBrains Mono',monospace;font-size:14px;outline:none;transition:all .2s}
.field input:focus{border-color:var(--purple);box-shadow:0 0 0 3px var(--purple-glow)}
.field input::placeholder{color:var(--muted)}

.btn-login{width:100%;background:var(--grad);border:none;border-radius:11px;padding:15px;color:#fff;font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;margin-top:6px;box-shadow:0 4px 24px var(--purple-glow);letter-spacing:.3px}
.btn-login:hover{opacity:.92;transform:translateY(-2px);box-shadow:0 8px 32px var(--purple-glow)}
.btn-login:active{transform:translateY(0)}
.btn-login:disabled{opacity:.5;cursor:not-allowed;transform:none}

.err{background:#f43f5e12;border:1px solid #f43f5e35;border-radius:10px;padding:11px 16px;font-size:13px;color:var(--danger);margin-top:14px;display:none;animation:fadeIn .2s ease}
.err.show{display:block}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}

/* FOOTER */
.card-footer{text-align:center;margin-top:20px}
.card-footer p{font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace}
</style>
</head>
<body>
<div class="bg-grid"></div>
<div class="orb"></div>

<div class="wrap">
  <div class="card">
    <div class="logo">
      <div class="logo-icon">⬡</div>
      <div class="logo-title"><span>Nexus</span> Panel</div>
      <div class="logo-sub">// sistema de gestão</div>
    </div>

    <div class="field">
      <label>E-mail</label>
      <input type="email" id="email" placeholder="seu@email.com" autocomplete="email">
    </div>

    <div class="field">
      <label>Senha</label>
      <input type="password" id="password" placeholder="••••••••••" autocomplete="current-password">
    </div>

    <button class="btn-login" id="btnLogin" onclick="login()">Entrar no Sistema</button>
    <div class="err" id="errMsg"></div>

    <div class="card-footer">
      <p>acesso restrito // autorizado apenas</p>
    </div>
  </div>
</div>

<script>
document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

async function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn = document.getElementById('btnLogin');
  const err = document.getElementById('errMsg');
  err.classList.remove('show');
  if (!email || !password) { err.textContent = 'Preencha e-mail e senha.'; err.classList.add('show'); return; }
  btn.disabled = true; btn.textContent = 'Autenticando...';
  try {
    const r = await fetch('/api/panel/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
    const d = await r.json();
    if (d.ok && d.token) {
      localStorage.setItem('panel_token', d.token);
      localStorage.setItem('panel_user', JSON.stringify({ name: d.name, email: d.email }));
      window.location.href = '/painel';
    } else {
      err.textContent = d.error || 'Credenciais inválidas.';
      err.classList.add('show');
      btn.disabled = false; btn.textContent = 'Entrar no Sistema';
    }
  } catch(e) {
    err.textContent = 'Erro de conexão. Tente novamente.';
    err.classList.add('show');
    btn.disabled = false; btn.textContent = 'Entrar no Sistema';
  }
}
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
