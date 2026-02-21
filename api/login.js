// api/login.js — serve o HTML de login (HTML embutido)
module.exports = function handler(req, res) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Login — Painel VIPs da Val</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0f;
    --surface: #111118;
    --surface2: #1a1a24;
    --border: #ffffff0f;
    --accent: #f97316;
    --accent2: #fb923c;
    --text: #f0f0f5;
    --muted: #6b6b7e;
    --danger: #ef4444;
    --success: #22c55e;
  }

  body {
    font-family: 'Syne', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .bg-grid {
    position: fixed; inset: 0; z-index: 0;
    background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
    background-size: 40px 40px;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
  }

  .glow {
    position: fixed;
    width: 600px; height: 600px;
    background: radial-gradient(circle, #f9731620 0%, transparent 70%);
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none; z-index: 0;
    animation: pulse 4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
    50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
  }

  .login-card {
    position: relative; z-index: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 48px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 0 80px #f9731610, 0 32px 64px #00000060;
    animation: slideUp .5s cubic-bezier(.16,1,.3,1) both;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .logo {
    text-align: center;
    margin-bottom: 36px;
  }

  .logo-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 12px;
    animation: bounce 2s ease-in-out infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-6px); }
  }

  .logo h1 {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: var(--text);
  }

  .logo span {
    color: var(--accent);
  }

  .logo p {
    font-size: 13px;
    color: var(--muted);
    margin-top: 4px;
    font-family: 'JetBrains Mono', monospace;
  }

  .form-group {
    margin-bottom: 20px;
  }

  label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }

  input {
    width: 100%;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 16px;
    color: var(--text);
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    outline: none;
    transition: all .2s;
  }

  input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px #f9731615;
  }

  input::placeholder { color: var(--muted); }

  .btn-login {
    width: 100%;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    border: none;
    border-radius: 10px;
    padding: 16px;
    color: #fff;
    font-family: 'Syne', sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: all .2s;
    margin-top: 8px;
    letter-spacing: 0.5px;
  }

  .btn-login:hover { transform: translateY(-2px); box-shadow: 0 8px 24px #f9731640; }
  .btn-login:active { transform: translateY(0); }
  .btn-login:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  .error-msg {
    background: #ef444415;
    border: 1px solid #ef444440;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    color: var(--danger);
    margin-top: 16px;
    display: none;
  }

  .error-msg.show { display: block; }
</style>
</head>
<body>
<div class="bg-grid"></div>
<div class="glow"></div>

<div class="login-card">
  <div class="logo">
    <span class="logo-icon">🔥</span>
    <h1>VIPs da <span>Val</span></h1>
    <p>// painel de controle</p>
  </div>

  <div class="form-group">
    <label>E-mail</label>
    <input type="email" id="email" placeholder="seu@email.com" autocomplete="email">
  </div>

  <div class="form-group">
    <label>Senha</label>
    <input type="password" id="password" placeholder="••••••••••" autocomplete="current-password">
  </div>

  <button class="btn-login" id="btnLogin" onclick="login()">Entrar no Painel</button>

  <div class="error-msg" id="errorMsg"></div>
</div>

<script>
  const BASE = '';

  document.getElementById('password').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });

  async function login() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('btnLogin');
    const err = document.getElementById('errorMsg');

    if (!email || !password) {
      err.textContent = 'Preencha e-mail e senha.';
      err.classList.add('show');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando...';
    err.classList.remove('show');

    try {
      const res = await fetch('/api/panel/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (data.ok && data.token) {
        localStorage.setItem('panel_token', data.token);
        localStorage.setItem('panel_user', JSON.stringify({ name: data.name, email: data.email }));
        window.location.href = '/painel';
      } else {
        err.textContent = data.error || 'Erro ao fazer login.';
        err.classList.add('show');
        btn.disabled = false;
        btn.textContent = 'Entrar no Painel';
      }
    } catch (e) {
      err.textContent = 'Erro de conexão. Tente novamente.';
      err.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Entrar no Painel';
    }
  }
</script>
</body>
</html>
`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
