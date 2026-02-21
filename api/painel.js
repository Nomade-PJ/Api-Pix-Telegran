// api/painel.js — Nexus Panel HTML
module.exports = function handler(req, res) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Nexus Panel</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#07070f;--surface:#0e0e1a;--surface2:#141424;--surface3:#1c1c30;
  --border:#ffffff0a;--border2:#ffffff15;--border3:#ffffff22;
  --purple:#a855f7;--purple2:#c084fc;--purple-dim:#a855f715;--purple-glow:#a855f730;
  --pink:#ec4899;--blue:#6366f1;--cyan:#06b6d4;
  --text:#f1f0ff;--text2:#9090b0;--muted:#4a4a6a;
  --danger:#f43f5e;--success:#10b981;--warning:#f59e0b;--info:#6366f1;
  --grad:linear-gradient(135deg,#a855f7,#ec4899);
  --grad2:linear-gradient(135deg,#6366f1,#a855f7);
  --sidebar:256px;
}
body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--text);display:flex;min-height:100vh;overflow-x:hidden}

/* BG EFFECT */
body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse 80% 50% at 20% 0%,#a855f710 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 100%,#6366f110 0%,transparent 60%);pointer-events:none;z-index:0}

/* SIDEBAR */
.sidebar{width:var(--sidebar);background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;z-index:100;transition:transform .3s}
.sidebar-header{padding:24px 20px;border-bottom:1px solid var(--border)}
.brand{display:flex;align-items:center;gap:10px}
.brand-icon{width:36px;height:36px;background:var(--grad);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 20px var(--purple-glow)}
.brand-name{font-size:17px;font-weight:700;letter-spacing:-.3px}
.brand-name span{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.brand-sub{font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-top:2px}

.nav{flex:1;padding:12px 10px;overflow-y:auto;scrollbar-width:none}
.nav::-webkit-scrollbar{display:none}
.nav-label{font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;padding:12px 10px 6px}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;cursor:pointer;transition:all .15s;color:var(--text2);font-size:13px;font-weight:500;margin-bottom:1px;border:1px solid transparent;position:relative}
.nav-item:hover{background:var(--surface2);color:var(--text)}
.nav-item.active{background:var(--purple-dim);color:var(--purple2);border-color:var(--purple-glow)}
.nav-item.active::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:60%;background:var(--grad);border-radius:0 3px 3px 0}
.nav-icon{font-size:16px;width:22px;text-align:center;flex-shrink:0}
.nav-badge{margin-left:auto;background:var(--danger);color:#fff;font-size:10px;padding:2px 7px;border-radius:20px;font-family:'JetBrains Mono',monospace;min-width:20px;text-align:center}
.nav-badge.purple{background:var(--purple)}

.sidebar-footer{padding:14px;border-top:1px solid var(--border)}
.user-pill{display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--surface2);border-radius:10px;border:1px solid var(--border)}
.user-av{width:32px;height:32px;background:var(--grad);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.user-name{font-size:12px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.btn-logout{background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:4px;border-radius:6px;transition:all .15s;flex-shrink:0}
.btn-logout:hover{color:var(--danger);background:#f43f5e15}

/* MAIN */
.main{margin-left:var(--sidebar);flex:1;display:flex;flex-direction:column;min-height:100vh;position:relative;z-index:1}
.topbar{background:var(--surface);border-bottom:1px solid var(--border);padding:0 28px;height:60px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;backdrop-filter:blur(10px)}
.page-title{font-size:16px;font-weight:700;display:flex;align-items:center;gap:10px}
.page-icon{font-size:20px}
.topbar-right{display:flex;align-items:center;gap:12px}
.status-pill{display:flex;align-items:center;gap:6px;background:var(--surface2);border:1px solid var(--border);border-radius:20px;padding:5px 12px;font-size:11px;color:var(--text2);font-family:'JetBrains Mono',monospace}
.dot-live{width:6px;height:6px;border-radius:50%;background:var(--success);animation:pulse2 2s infinite}
@keyframes pulse2{0%,100%{opacity:1;box-shadow:0 0 0 0 #10b98140}50%{opacity:.7;box-shadow:0 0 0 4px transparent}}

.content{padding:28px;flex:1}

/* STAT CARDS */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;margin-bottom:28px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px;position:relative;overflow:hidden;transition:all .2s;cursor:default}
.stat-card::after{content:'';position:absolute;top:0;right:0;width:80px;height:80px;border-radius:50%;opacity:.06;transform:translate(20px,-20px)}
.stat-card.purple::after{background:var(--purple)}
.stat-card.pink::after{background:var(--pink)}
.stat-card.blue::after{background:var(--blue)}
.stat-card.cyan::after{background:var(--cyan)}
.stat-card.success-c::after{background:var(--success)}
.stat-card.warning-c::after{background:var(--warning)}
.stat-card:hover{border-color:var(--border3);transform:translateY(-2px);box-shadow:0 8px 32px #00000040}
.stat-card.purple{border-color:#a855f720}
.stat-card.pink{border-color:#ec489920}
.stat-card.blue{border-color:#6366f120}
.stat-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px}
.stat-ic{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px}
.stat-ic.purple{background:#a855f720}
.stat-ic.pink{background:#ec489920}
.stat-ic.blue{background:#6366f120}
.stat-ic.cyan{background:#06b6d420}
.stat-ic.green{background:#10b98120}
.stat-ic.yellow{background:#f59e0b20}
.stat-ic.red{background:#f43f5e20}
.stat-val{font-size:26px;font-weight:700;font-family:'JetBrains Mono',monospace;letter-spacing:-1px}
.stat-val.purple{color:var(--purple)}
.stat-val.pink{color:var(--pink)}
.stat-val.blue{color:var(--blue)}
.stat-val.green{color:var(--success)}
.stat-val.yellow{color:var(--warning)}
.stat-val.red{color:var(--danger)}
.stat-lbl{font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-top:4px;font-weight:500}

/* TABLES */
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.card-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border)}
.card-title{font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px}
table{width:100%;border-collapse:collapse;font-size:13px}
thead tr{border-bottom:1px solid var(--border)}
thead th{padding:12px 16px;text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:600;white-space:nowrap}
tbody tr{border-bottom:1px solid var(--border);transition:background .12s}
tbody tr:last-child{border-bottom:none}
tbody tr:hover{background:var(--surface2)}
td{padding:13px 16px;color:var(--text2);vertical-align:middle}
td strong{color:var(--text);font-weight:600}
.mono{font-family:'JetBrains Mono',monospace;font-size:11px}

/* BADGES */
.badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;font-family:'JetBrains Mono',monospace;white-space:nowrap}
.b-pending{background:#f59e0b15;color:var(--warning);border:1px solid #f59e0b30}
.b-approved{background:#6366f115;color:var(--blue);border:1px solid #6366f130}
.b-delivered{background:#10b98115;color:var(--success);border:1px solid #10b98130}
.b-rejected{background:#f43f5e15;color:var(--danger);border:1px solid #f43f5e30}
.b-failed{background:#f43f5e15;color:var(--danger);border:1px solid #f43f5e30}
.b-blocked{background:#f43f5e15;color:var(--danger);border:1px solid #f43f5e30}
.b-active{background:#10b98115;color:var(--success);border:1px solid #10b98130}
.b-inactive{background:#4a4a6a20;color:var(--muted);border:1px solid #4a4a6a30}
.b-open{background:#6366f115;color:var(--blue);border:1px solid #6366f130}
.b-resolved{background:#10b98115;color:var(--success);border:1px solid #10b98130}
.b-closed{background:#4a4a6a20;color:var(--muted);border:1px solid #4a4a6a30}
.b-sending{background:#a855f715;color:var(--purple2);border:1px solid #a855f730}
.b-sent{background:#10b98115;color:var(--success);border:1px solid #10b98130}
.b-admin{background:#a855f715;color:var(--purple2);border:1px solid #a855f730}
.b-creator{background:#ec489915;color:var(--pink);border:1px solid #ec489930}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:9px;font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;border:1px solid transparent;white-space:nowrap}
.btn-primary{background:var(--grad);color:#fff;border:none;box-shadow:0 4px 16px var(--purple-glow)}
.btn-primary:hover{opacity:.9;transform:translateY(-1px);box-shadow:0 6px 20px var(--purple-glow)}
.btn-success{background:#10b98115;color:var(--success);border-color:#10b98130}
.btn-success:hover{background:#10b98125}
.btn-danger{background:#f43f5e15;color:var(--danger);border-color:#f43f5e30}
.btn-danger:hover{background:#f43f5e25}
.btn-ghost{background:var(--surface2);color:var(--text2);border-color:var(--border2)}
.btn-ghost:hover{background:var(--surface3);color:var(--text)}
.btn-purple{background:var(--purple-dim);color:var(--purple2);border-color:var(--purple-glow)}
.btn-purple:hover{background:#a855f725}
.btn-sm{padding:5px 10px;font-size:12px;border-radius:7px}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}

/* FILTERS */
.filters{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.fi{background:var(--surface);border:1px solid var(--border2);border-radius:9px;padding:8px 14px;color:var(--text);font-family:'Space Grotesk',sans-serif;font-size:13px;outline:none;transition:border-color .15s}
.fi:focus{border-color:var(--purple)}
.fi-search{min-width:220px}
.fi option{background:var(--surface2)}

/* PAGINATION */
.pagination{display:flex;align-items:center;gap:6px;margin-top:16px;justify-content:center}
.pg-btn{background:var(--surface);border:1px solid var(--border2);color:var(--text2);padding:6px 12px;border-radius:7px;cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:12px;transition:all .15s}
.pg-btn:hover{border-color:var(--purple);color:var(--purple2)}
.pg-btn.active{background:var(--grad);color:#fff;border:none}
.pg-btn:disabled{opacity:.4;cursor:default}
.pg-info{font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;padding:0 8px}

/* MODAL */
.overlay{position:fixed;inset:0;background:#00000085;z-index:300;display:none;align-items:center;justify-content:center;backdrop-filter:blur(6px)}
.overlay.show{display:flex}
.modal{background:var(--surface);border:1px solid var(--border3);border-radius:18px;padding:28px;width:100%;max-width:500px;max-height:85vh;overflow-y:auto;animation:mIn .2s cubic-bezier(.16,1,.3,1)}
.modal.wide{max-width:640px}
@keyframes mIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
.modal-title{font-size:17px;font-weight:700;margin-bottom:20px;display:flex;align-items:center;gap:8px}
.form-row{margin-bottom:15px}
.form-row label{display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600}
.form-row input,.form-row select,.form-row textarea{width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:9px;padding:10px 14px;color:var(--text);font-family:'JetBrains Mono',monospace;font-size:13px;outline:none;transition:border-color .15s}
.form-row input:focus,.form-row select:focus,.form-row textarea:focus{border-color:var(--purple)}
.form-row textarea{resize:vertical;min-height:80px}
.form-row select option{background:var(--surface2)}
.modal-footer{display:flex;gap:10px;justify-content:flex-end;margin-top:22px;padding-top:18px;border-top:1px solid var(--border)}

/* LOADING / EMPTY */
.loading{display:flex;align-items:center;justify-content:center;padding:60px;flex-direction:column;gap:14px}
.spinner{width:30px;height:30px;border:2px solid var(--border3);border-top-color:var(--purple);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.loading-text{font-size:12px;color:var(--muted);font-family:'JetBrains Mono',monospace}
.empty{text-align:center;padding:60px 20px;color:var(--muted)}
.empty-icon{font-size:44px;margin-bottom:12px;opacity:.5}
.empty-text{font-size:14px}

/* TOAST */
.toast-wrap{position:fixed;top:20px;right:20px;z-index:999;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.toast{background:var(--surface);border:1px solid var(--border3);border-radius:12px;padding:12px 18px;min-width:260px;font-size:13px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 40px #00000060;animation:tIn .3s cubic-bezier(.16,1,.3,1);pointer-events:auto}
@keyframes tIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
.toast.ok{border-color:#10b98130}
.toast.err{border-color:#f43f5e30}
.toast.warn{border-color:#f59e0b30}

/* SECTIONS */
.section{display:none}
.section.active{display:block;animation:fadeIn .25s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

/* DASHBOARD 2-col */
.dash2{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}
@media(max-width:900px){.dash2{grid-template-columns:1fr}}
.dash-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px}
.dash-card-title{font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px;display:flex;align-items:center;gap:8px}

/* BROADCAST CARD */
.bc-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:10px;display:flex;gap:14px;align-items:center}
.bc-icon{font-size:28px;flex-shrink:0}
.bc-body{flex:1;min-width:0}
.bc-name{font-weight:700;font-size:14px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bc-meta{font-size:12px;color:var(--text2)}
.progress{height:5px;background:var(--surface3);border-radius:3px;overflow:hidden;margin-top:8px}
.progress-fill{height:100%;background:var(--grad);border-radius:3px;transition:width .5s}

/* TICKET MSGS */
.msg-thread{max-height:320px;overflow-y:auto;padding:4px;display:flex;flex-direction:column;gap:8px}
.msg-bubble{padding:10px 14px;border-radius:12px;max-width:85%;font-size:13px;line-height:1.5}
.msg-bubble.user{background:var(--surface2);border:1px solid var(--border);align-self:flex-start}
.msg-bubble.admin{background:var(--purple-dim);border:1px solid var(--purple-glow);align-self:flex-end}
.msg-meta{font-size:10px;color:var(--muted);margin-top:4px;font-family:'JetBrains Mono',monospace}

/* SETTINGS CARD */
.set-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:520px;margin-bottom:18px}
.set-card-title{font-size:15px;font-weight:700;margin-bottom:4px}
.set-card-sub{font-size:12px;color:var(--text2);margin-bottom:18px}

/* CHART BARS */
.mini-chart{display:flex;align-items:flex-end;gap:3px;height:70px;padding-top:8px}
.mc-bar{flex:1;background:var(--grad);border-radius:3px 3px 0 0;opacity:.8;min-height:3px;transition:height .3s}
.mc-bar:hover{opacity:1}

/* USER DETAIL */
.user-detail-header{display:flex;align-items:center;gap:14px;margin-bottom:20px}
.user-big-av{width:56px;height:56px;background:var(--grad);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0}

@media(max-width:768px){.sidebar{transform:translateX(-100%)}.sidebar.open{transform:translateX(0)}.main{margin-left:0}.stats-grid{grid-template-columns:repeat(2,1fr)}}
</style>
</head>
<body>

<aside class="sidebar" id="sidebar">
  <div class="sidebar-header">
    <div class="brand">
      <div class="brand-icon">⬡</div>
      <div>
        <div class="brand-name"><span>Nexus</span> Panel</div>
        <div class="brand-sub">// sistema de gestão</div>
      </div>
    </div>
  </div>
  <nav class="nav">
    <div class="nav-label">Visão Geral</div>
    <div class="nav-item active" onclick="go('dashboard',this)"><span class="nav-icon">⊞</span>Dashboard</div>
    <div class="nav-item" onclick="go('stats',this)"><span class="nav-icon">📈</span>Estatísticas</div>

    <div class="nav-label">Financeiro</div>
    <div class="nav-item" onclick="go('transactions',this)"><span class="nav-icon">💳</span>Transações<span class="nav-badge" id="b-pendentes">0</span></div>
    <div class="nav-item" onclick="go('failures',this)"><span class="nav-icon">⚠️</span>Falhas de Entrega<span class="nav-badge" id="b-failures">0</span></div>

    <div class="nav-label">Catálogo</div>
    <div class="nav-item" onclick="go('products',this)"><span class="nav-icon">🛍️</span>Produtos</div>
    <div class="nav-item" onclick="go('groups',this)"><span class="nav-icon">👥</span>Grupos VIP</div>
    <div class="nav-item" onclick="go('coupons',this)"><span class="nav-icon">🏷️</span>Cupons</div>

    <div class="nav-label">Usuários</div>
    <div class="nav-item" onclick="go('users',this)"><span class="nav-icon">👤</span>Usuários</div>
    <div class="nav-item" onclick="go('trusted',this)"><span class="nav-icon">⭐</span>Usuários Confiáveis</div>
    <div class="nav-item" onclick="go('tickets',this)"><span class="nav-icon">🎫</span>Tickets<span class="nav-badge purple" id="b-tickets">0</span></div>

    <div class="nav-label">Marketing</div>
    <div class="nav-item" onclick="go('broadcast',this)"><span class="nav-icon">📢</span>CastCupom</div>
    <div class="nav-item" onclick="go('autoresponses',this)"><span class="nav-icon">🤖</span>Respostas Auto.</div>

    <div class="nav-label">Sistema</div>
    <div class="nav-item" onclick="go('settings',this)"><span class="nav-icon">⚙️</span>Configurações</div>
    <div class="nav-item" onclick="go('ddds',this)"><span class="nav-icon">📵</span>DDDs Bloqueados</div>
  </nav>
  <div class="sidebar-footer">
    <div class="user-pill">
      <div class="user-av">👑</div>
      <div class="user-name" id="uName">Admin</div>
      <button class="btn-logout" onclick="logout()" title="Sair">⏻</button>
    </div>
  </div>
</aside>

<div class="main">
  <div class="topbar">
    <div class="page-title"><span class="page-icon" id="pgIcon">⊞</span><span id="pgTitle">Dashboard</span></div>
    <div class="topbar-right">
      <div class="status-pill"><div class="dot-live"></div>sistema online</div>
    </div>
  </div>

  <div class="content">

    <!-- DASHBOARD -->
    <div id="s-dashboard" class="section active">
      <div class="stats-grid" id="dashStats"><div class="loading"><div class="spinner"></div></div></div>
      <div class="dash2">
        <div class="dash-card"><div class="dash-card-title">⏱ Últimas Transações</div><div id="recentTx"></div></div>
        <div class="dash-card"><div class="dash-card-title">🆕 Novos Usuários</div><div id="recentUsers"></div></div>
      </div>
    </div>

    <!-- STATS -->
    <div id="s-stats" class="section">
      <div class="dash2">
        <div class="dash-card"><div class="dash-card-title">💰 Receita Diária (30 dias)</div><div id="chartRevenue"></div></div>
        <div class="dash-card"><div class="dash-card-title">📊 Transações por Status</div><div id="chartStatus"></div></div>
      </div>
      <div class="dash2" style="margin-top:18px">
        <div class="dash-card"><div class="dash-card-title">👤 Novos Usuários (30 dias)</div><div id="chartUsers"></div></div>
      </div>
    </div>

    <!-- TRANSAÇÕES -->
    <div id="s-transactions" class="section">
      <div class="filters">
        <input class="fi fi-search" id="txQ" placeholder="🔍 TXID ou Telegram ID..." oninput="debounce(loadTx,400)()">
        <select class="fi" id="txSt" onchange="loadTx()">
          <option value="all">Todos status</option>
          <option value="pending">⏳ Pendentes</option>
          <option value="approved">✅ Aprovados</option>
          <option value="delivered">📦 Entregues</option>
          <option value="rejected">❌ Rejeitados</option>
          <option value="delivery_failed">⚠️ Falha Entrega</option>
          <option value="reversed">↩ Revertidos</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="loadTx()">↺ Atualizar</button>
      </div>
      <div class="card" id="txTable"><div class="loading"><div class="spinner"></div></div></div>
      <div class="pagination" id="txPag"></div>
    </div>

    <!-- FALHAS -->
    <div id="s-failures" class="section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:15px;font-weight:700">⚠️ Falhas de Entrega</div>
        <button class="btn btn-ghost btn-sm" onclick="loadFailures()">↺ Atualizar</button>
      </div>
      <div class="card" id="failTable"><div class="loading"><div class="spinner"></div></div></div>
    </div>

    <!-- PRODUTOS -->
    <div id="s-products" class="section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:15px;font-weight:700">🛍️ Produtos</div>
        <button class="btn btn-primary btn-sm" onclick="openModal('mProduct')">+ Novo Produto</button>
      </div>
      <div class="card" id="prodTable"><div class="loading"><div class="spinner"></div></div></div>
    </div>

    <!-- GRUPOS -->
    <div id="s-groups" class="section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:15px;font-weight:700">👥 Grupos VIP</div>
        <button class="btn btn-primary btn-sm" onclick="openModal('mGroup')">+ Novo Grupo</button>
      </div>
      <div class="card" id="groupTable"><div class="loading"><div class="spinner"></div></div></div>
    </div>

    <!-- CUPONS -->
    <div id="s-coupons" class="section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:15px;font-weight:700">🏷️ Cupons de Desconto</div>
        <button class="btn btn-primary btn-sm" onclick="openModal('mCoupon')">+ Novo Cupom</button>
      </div>
      <div class="card" id="couponTable"><div class="loading"><div class="spinner"></div></div></div>
    </div>

    <!-- USUÁRIOS -->
    <div id="s-users" class="section">
      <div class="filters">
        <input class="fi fi-search" id="userQ" placeholder="🔍 Nome, username ou ID..." oninput="debounce(loadUsers,400)()">
        <select class="fi" id="userBl" onchange="loadUsers()">
          <option value="">Todos</option>
          <option value="false">✅ Ativos</option>
          <option value="true">🚫 Bloqueados</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="loadUsers()">↺ Atualizar</button>
      </div>
      <div class="card" id="usersTable"><div class="loading"><div class="spinner"></div></div></div>
      <div class="pagination" id="usersPag"></div>
    </div>

    <!-- CONFIÁVEIS -->
    <div id="s-trusted" class="section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:15px;font-weight:700">⭐ Usuários Confiáveis</div>
        <button class="btn btn-ghost btn-sm" onclick="loadTrusted()">↺ Atualizar</button>
      </div>
      <div class="card" id="trustedTable"><div class="loading"><div class="spinner"></div></div></div>
    </div>

    <!-- TICKETS -->
    <div id="s-tickets" class="section">
      <div class="filters">
        <select class="fi" id="tickSt" onchange="loadTickets()">
          <option value="all">Todos</option>
          <option value="open">🔵 Abertos</option>
          <option value="resolved">✅ Resolvidos</option>
          <option value="closed">⬛ Fechados</option>
        </select>
        <button class="btn btn-ghost btn-sm" onclick="loadTickets()">↺ Atualizar</button>
      </div>
      <div class="card" id="tickTable"><div class="loading"><div class="spinner"></div></div></div>
      <div class="pagination" id="tickPag"></div>
    </div>

    <!-- BROADCAST -->
    <div id="s-broadcast" class="section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:15px;font-weight:700">📢 CastCupom — Campanhas</div>
        <button class="btn btn-ghost btn-sm" onclick="loadBroadcast()">↺ Atualizar</button>
      </div>
      <div id="bcList"><div class="loading"><div class="spinner"></div></div></div>
    </div>

    <!-- AUTO RESPONSES -->
    <div id="s-autoresponses" class="section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:15px;font-weight:700">🤖 Respostas Automáticas</div>
        <button class="btn btn-primary btn-sm" onclick="openModal('mAutoResp')">+ Nova Resposta</button>
      </div>
      <div class="card" id="arTable"><div class="loading"><div class="spinner"></div></div></div>
    </div>

    <!-- SETTINGS -->
    <div id="s-settings" class="section">
      <div style="font-size:15px;font-weight:700;margin-bottom:22px">⚙️ Configurações do Sistema</div>
      <div class="set-card">
        <div class="set-card-title">🔑 Chave PIX</div>
        <div class="set-card-sub">Chave utilizada para receber pagamentos via PIX</div>
        <div class="form-row"><label>Chave PIX</label><input type="text" id="pixKey" placeholder="Carregando..."></div>
        <button class="btn btn-primary btn-sm" onclick="saveSetting('pix_key', document.getElementById('pixKey').value, '✅ Chave PIX salva!')">💾 Salvar</button>
      </div>
      <div class="set-card">
        <div class="set-card-title">💬 Link de Suporte</div>
        <div class="set-card-sub">Link do Telegram para o canal de suporte</div>
        <div class="form-row"><label>Link (ex: https://t.me/usuario)</label><input type="text" id="supportLink" placeholder="Carregando..."></div>
        <button class="btn btn-primary btn-sm" onclick="saveSetting('support_contact', document.getElementById('supportLink').value, '✅ Suporte configurado!')">💾 Salvar</button>
      </div>
    </div>

    <!-- DDDs -->
    <div id="s-ddds" class="section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:15px;font-weight:700">📵 DDDs Bloqueados</div>
        <button class="btn btn-primary btn-sm" onclick="openModal('mDDD')">+ Bloquear DDD</button>
      </div>
      <div class="card" id="dddTable"><div class="loading"><div class="spinner"></div></div></div>
    </div>

  </div>
</div>

<!-- MODAIS -->
<div class="overlay" id="mProduct"><div class="modal">
  <div class="modal-title">🛍️ Novo Produto</div>
  <div class="form-row"><label>ID do Produto *</label><input id="p_id" placeholder="ex: pack_vip_01"></div>
  <div class="form-row"><label>Nome *</label><input id="p_name" placeholder="Nome do produto"></div>
  <div class="form-row"><label>Descrição</label><textarea id="p_desc" placeholder="Descrição..."></textarea></div>
  <div class="form-row"><label>Preço R$ *</label><input type="number" id="p_price" placeholder="29.90" step="0.01"></div>
  <div class="form-row"><label>Tipo de Entrega</label><select id="p_type"><option value="link">🔗 Link</option><option value="media_pack">📦 Pack de Mídia</option><option value="group">👥 Grupo</option></select></div>
  <div class="form-row"><label>URL de Entrega</label><input id="p_url" placeholder="https://..."></div>
  <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal('mProduct')">Cancelar</button><button class="btn btn-primary" onclick="saveProduct()">Criar Produto</button></div>
</div></div>

<div class="overlay" id="mGroup"><div class="modal">
  <div class="modal-title">👥 Novo Grupo VIP</div>
  <div class="form-row"><label>ID do Grupo (número negativo do Telegram)</label><input id="g_id" placeholder="-1001234567890"></div>
  <div class="form-row"><label>Nome do Grupo</label><input id="g_name" placeholder="VIP Gold"></div>
  <div class="form-row"><label>Link do Grupo</label><input id="g_link" placeholder="https://t.me/..."></div>
  <div class="form-row"><label>Preço R$</label><input type="number" id="g_price" placeholder="49.90" step="0.01"></div>
  <div class="form-row"><label>Dias de Acesso</label><input type="number" id="g_days" placeholder="30"></div>
  <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal('mGroup')">Cancelar</button><button class="btn btn-primary" onclick="saveGroup()">Criar Grupo</button></div>
</div></div>

<div class="overlay" id="mCoupon"><div class="modal">
  <div class="modal-title">🏷️ Novo Cupom</div>
  <div class="form-row"><label>Código *</label><input id="c_code" placeholder="PROMO20" style="text-transform:uppercase"></div>
  <div class="form-row"><label>Desconto % *</label><input type="number" id="c_disc" placeholder="20" min="1" max="100"></div>
  <div class="form-row"><label>Produto específico (opcional)</label><select id="c_prod"><option value="">Todos os produtos</option></select></div>
  <div class="form-row"><label>Máximo de usos (deixe vazio = ilimitado)</label><input type="number" id="c_uses" placeholder="100"></div>
  <div class="form-row"><label>Expira em (opcional)</label><input type="datetime-local" id="c_exp"></div>
  <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal('mCoupon')">Cancelar</button><button class="btn btn-primary" onclick="saveCoupon()">Criar Cupom</button></div>
</div></div>

<div class="overlay" id="mAutoResp"><div class="modal">
  <div class="modal-title">🤖 Nova Resposta Automática</div>
  <div class="form-row"><label>Palavra-chave *</label><input id="ar_kw" placeholder="ex: preço, quanto custa..."></div>
  <div class="form-row"><label>Resposta *</label><textarea id="ar_resp" placeholder="Resposta que será enviada..." style="min-height:120px"></textarea></div>
  <div class="form-row"><label>Prioridade (maior = mais prioritário)</label><input type="number" id="ar_pri" placeholder="0" value="0"></div>
  <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal('mAutoResp')">Cancelar</button><button class="btn btn-primary" onclick="saveAutoResp()">Criar Resposta</button></div>
</div></div>

<div class="overlay" id="mDDD"><div class="modal">
  <div class="modal-title">📵 Bloquear DDD</div>
  <div class="form-row"><label>DDD *</label><input id="ddd_code" placeholder="ex: 11" maxlength="2"></div>
  <div class="form-row"><label>Estado</label><input id="ddd_state" placeholder="ex: SP"></div>
  <div class="form-row"><label>Motivo</label><input id="ddd_reason" placeholder="ex: Alta taxa de fraude"></div>
  <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal('mDDD')">Cancelar</button><button class="btn btn-danger" onclick="addDDD()">Bloquear</button></div>
</div></div>

<div class="overlay" id="mTicket"><div class="modal wide">
  <div class="modal-title" id="mTicketTitle">🎫 Ticket</div>
  <div class="msg-thread" id="mTicketMsgs"></div>
  <div class="modal-footer">
    <button class="btn btn-ghost" onclick="closeModal('mTicket')">Fechar</button>
    <button class="btn btn-ghost btn-sm" id="btnCloseTicket">⬛ Fechar Ticket</button>
    <button class="btn btn-success btn-sm" id="btnResolveTicket">✓ Resolver</button>
  </div>
</div></div>

<div class="overlay" id="mUserDetail"><div class="modal">
  <div class="user-detail-header">
    <div class="user-big-av">👤</div>
    <div id="uDetailInfo"></div>
  </div>
  <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Últimas Transações</div>
  <div id="uDetailTx"></div>
  <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal('mUserDetail')">Fechar</button></div>
</div></div>

<div class="overlay" id="mReverse"><div class="modal">
  <div class="modal-title">↩ Reverter Transação</div>
  <div class="form-row"><label>Motivo</label><textarea id="reverseReason" placeholder="Motivo da reversão..."></textarea></div>
  <input type="hidden" id="reverseTxid">
  <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal('mReverse')">Cancelar</button><button class="btn btn-danger" onclick="doReverse()">Reverter</button></div>
</div></div>

<div class="toast-wrap" id="toasts"></div>

<script>
const API = '/api/panel/data';
let TOKEN = localStorage.getItem('panel_token') || '';
let pages = { tx:1, users:1, tick:1 };
let debTimers = {};

// AUTH
async function checkAuth() {
  if (!TOKEN) return location.href = '/login';
  const r = await fetch('/api/panel/auth', { headers: { Authorization: 'Bearer ' + TOKEN } });
  if (!r.ok) { localStorage.removeItem('panel_token'); location.href = '/login'; return; }
  const u = JSON.parse(localStorage.getItem('panel_user') || '{}');
  document.getElementById('uName').textContent = u.name || 'Admin';
}

function logout() { localStorage.clear(); location.href = '/login'; }

async function api(action, opts = {}) {
  const { method = 'GET', body, params = {} } = opts;
  const qs = new URLSearchParams({ action, ...params }).toString();
  const r = await fetch(API + '?' + qs, {
    method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
    body: body ? JSON.stringify(body) : undefined
  });
  return r.json();
}

function debounce(fn, ms) {
  return function(...args) {
    clearTimeout(debTimers[fn.name]);
    debTimers[fn.name] = setTimeout(() => fn(...args), ms);
  };
}

// NAV
const pgMeta = {
  dashboard:['⊞','Dashboard'], stats:['📈','Estatísticas'], transactions:['💳','Transações'],
  failures:['⚠️','Falhas de Entrega'], products:['🛍️','Produtos'], groups:['👥','Grupos VIP'],
  coupons:['🏷️','Cupons'], users:['👤','Usuários'], trusted:['⭐','Confiáveis'],
  tickets:['🎫','Tickets'], broadcast:['📢','CastCupom'], autoresponses:['🤖','Respostas Auto.'],
  settings:['⚙️','Configurações'], ddds:['📵','DDDs Bloqueados']
};
const loaders = { dashboard:loadDashboard, stats:loadStats, transactions:loadTx, failures:loadFailures, products:loadProducts, groups:loadGroups, coupons:loadCoupons, users:loadUsers, trusted:loadTrusted, tickets:loadTickets, broadcast:loadBroadcast, autoresponses:loadAutoResp, settings:loadSettings, ddds:loadDDDs };

function go(sec, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('s-' + sec).classList.add('active');
  if (el) el.classList.add('active');
  const [icon, title] = pgMeta[sec] || ['⊞', sec];
  document.getElementById('pgIcon').textContent = icon;
  document.getElementById('pgTitle').textContent = title;
  if (loaders[sec]) loaders[sec]();
}

// HELPERS
function fmt(v) { return parseFloat(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtD(d) { if (!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
function fmtDshort(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('pt-BR') + ' ' + new Date(d).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }

function badge(st) {
  const m = {
    pending:['b-pending','Pendente'], approved:['b-approved','Aprovado'], delivered:['b-delivered','Entregue'],
    rejected:['b-rejected','Rejeitado'], delivery_failed:['b-failed','Falha'], reversed:['b-failed','Revertido'],
    blocked:['b-blocked','Bloqueado'], active:['b-active','Ativo'], inactive:['b-inactive','Inativo'],
    open:['b-open','Aberto'], resolved:['b-resolved','Resolvido'], closed:['b-closed','Fechado'],
    sending:['b-sending','Enviando'], pending_broadcast:['b-sending','Pendente'], sent:['b-sent','Concluído'],
    cancelled:['b-inactive','Cancelado'], true:['b-active','Sim'], false:['b-inactive','Não']
  };
  const [cls,lbl] = m[st] || ['b-inactive', st];
  return '<span class="badge ' + cls + '">' + lbl + '</span>';
}

function miniItem(left, right) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--border)">' + left + right + '</div>';
}

function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('show'); }));

function renderPagination(id, cur, total, cb) {
  if (!total || total <= 1) { document.getElementById(id).innerHTML = ''; return; }
  let h = '<button class="pg-btn" onclick="' + cb + '(' + Math.max(1,cur-1) + ')" ' + (cur<=1?'disabled':'') + '>←</button>';
  for (let i = Math.max(1,cur-2); i <= Math.min(total,cur+2); i++)
    h += '<button class="pg-btn ' + (i===cur?'active':'') + '" onclick="' + cb + '(' + i + ')">' + i + '</button>';
  h += '<button class="pg-btn" onclick="' + cb + '(' + Math.min(total,cur+1) + ')" ' + (cur>=total?'disabled':'') + '>→</button>';
  h += '<span class="pg-info">Pág ' + cur + '/' + total + '</span>';
  document.getElementById(id).innerHTML = h;
}

// DASHBOARD
async function loadDashboard() {
  const d = await api('dashboard');
  document.getElementById('b-pendentes').textContent = d.pendentes || 0;
  document.getElementById('b-tickets').textContent = d.tickets || 0;
  document.getElementById('b-failures').textContent = d.failures || 0;

  document.getElementById('dashStats').innerHTML = \`
    <div class="stat-card purple"><div class="stat-top"><div class="stat-ic purple">💰</div></div><div class="stat-val purple">R$ \${fmt(d.totalSales)}</div><div class="stat-lbl">Receita Total</div></div>
    <div class="stat-card pink"><div class="stat-top"><div class="stat-ic pink">📈</div></div><div class="stat-val pink">R$ \${fmt(d.vendasHoje)}</div><div class="stat-lbl">Vendas Hoje</div></div>
    <div class="stat-card blue"><div class="stat-top"><div class="stat-ic blue">📅</div></div><div class="stat-val blue">R$ \${fmt(d.vendasSemana)}</div><div class="stat-lbl">Esta Semana</div></div>
    <div class="stat-card warning-c"><div class="stat-top"><div class="stat-ic yellow">⏳</div></div><div class="stat-val yellow">\${d.pendentes||0}</div><div class="stat-lbl">Pendentes</div></div>
    <div class="stat-card"><div class="stat-top"><div class="stat-ic purple">👥</div></div><div class="stat-val">\${(d.users||0).toLocaleString()}</div><div class="stat-lbl">Usuários</div></div>
    <div class="stat-card"><div class="stat-top"><div class="stat-ic blue">💳</div></div><div class="stat-val">\${(d.transactions||0).toLocaleString()}</div><div class="stat-lbl">Transações</div></div>
    <div class="stat-card"><div class="stat-top"><div class="stat-ic yellow">🎫</div></div><div class="stat-val yellow">\${d.tickets||0}</div><div class="stat-lbl">Tickets Abertos</div></div>
    <div class="stat-card"><div class="stat-top"><div class="stat-ic red">⚠️</div></div><div class="stat-val red">\${d.failures||0}</div><div class="stat-lbl">Falhas Entrega</div></div>
  \`;

  document.getElementById('recentTx').innerHTML = (d.recentTx||[]).map(t =>
    miniItem('<div><div class="mono" style="color:var(--text)">' + (t.txid||'').substring(0,15) + '...</div><div style="font-size:11px;color:var(--muted)">' + fmtD(t.created_at) + '</div></div>',
    '<div style="text-align:right"><div style="font-weight:700;color:var(--purple2)">R$ ' + fmt(t.amount) + '</div>' + badge(t.status) + '</div>')
  ).join('') || '<div class="empty" style="padding:20px"><div class="empty-icon">💳</div></div>';

  document.getElementById('recentUsers').innerHTML = (d.recentUsers||[]).map(u =>
    miniItem('<div><div style="font-weight:600;color:var(--text)">' + (u.first_name||'N/A') + '</div><div class="mono" style="font-size:11px;color:var(--muted)">@' + (u.username||u.telegram_id) + '</div></div>',
    '<div style="font-size:11px;color:var(--muted)">' + fmtD(u.created_at) + '</div>')
  ).join('') || '<div class="empty" style="padding:20px"><div class="empty-icon">👤</div></div>';
}

// STATS
async function loadStats() {
  const d = await api('stats');
  // Revenue chart
  const days = Object.keys(d.byDay||{}).sort().slice(-14);
  const maxR = Math.max(...days.map(k => d.byDay[k]), 1);
  document.getElementById('chartRevenue').innerHTML = '<div class="mini-chart">' +
    days.map(k => '<div class="mc-bar" style="height:' + Math.max(4,(d.byDay[k]/maxR)*66) + 'px" title="' + k + ': R$ ' + fmt(d.byDay[k]) + '"></div>').join('') +
    '</div><div style="font-size:12px;color:var(--text2);margin-top:10px">Total 14 dias: <strong style="color:var(--purple2)">R$ ' + fmt(days.reduce((a,k)=>a+(d.byDay[k]||0),0)) + '</strong></div>';

  // Status chart
  const sc = {'#f59e0b':'pending','#6366f1':'approved','#10b981':'delivered','#f43f5e':'rejected','#f43f5e':'delivery_failed'};
  document.getElementById('chartStatus').innerHTML = Object.entries(d.byStatus||{}).map(([st,cnt]) =>
    '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">' + badge(st) + '<span class="mono" style="color:var(--text)">' + cnt + '</span></div>'
  ).join('') || '<div class="empty-text">Sem dados</div>';

  // Users chart
  const udays = Object.keys(d.byDayUsers||{}).sort().slice(-14);
  const maxU = Math.max(...udays.map(k => d.byDayUsers[k]), 1);
  document.getElementById('chartUsers').innerHTML = '<div class="mini-chart">' +
    udays.map(k => '<div class="mc-bar" style="height:' + Math.max(4,(d.byDayUsers[k]/maxU)*66) + 'px;background:var(--grad2)" title="' + k + ': ' + d.byDayUsers[k] + ' usuários"></div>').join('') +
    '</div><div style="font-size:12px;color:var(--text2);margin-top:10px">Total 14 dias: <strong style="color:var(--purple2)">' + udays.reduce((a,k)=>a+(d.byDayUsers[k]||0),0) + ' usuários</strong></div>';
}

// TRANSAÇÕES
async function loadTx() {
  document.getElementById('txTable').innerHTML = '<div class="loading"><div class="spinner"></div><div class="loading-text">carregando...</div></div>';
  const d = await api('transactions', { params: { page: pages.tx, limit:20, status: document.getElementById('txSt').value, search: document.getElementById('txQ').value } });
  if (!d.data) { document.getElementById('txTable').innerHTML = '<div class="empty"><div class="empty-icon">💳</div><div class="empty-text">Erro ao carregar</div></div>'; return; }
  const rows = d.data.map(t => \`<tr>
    <td><span class="mono">\${(t.txid||'').substring(0,18)}...</span></td>
    <td><span class="mono">\${t.telegram_id}</span></td>
    <td><strong>R$ \${fmt(t.amount)}</strong></td>
    <td>\${badge(t.status)}</td>
    <td style="font-size:11px;color:var(--muted)">\${fmtD(t.created_at)}</td>
    <td>
      \${t.status==='pending'?\`<button class="btn btn-success btn-sm" onclick="approveTx('\${t.txid}')">✓</button> <button class="btn btn-danger btn-sm" onclick="rejectTx('\${t.txid}')">✗</button>\`:''}
      \${['approved','delivery_failed'].includes(t.status)?\`<button class="btn btn-purple btn-sm" onclick="deliverTx('\${t.txid}')">📦</button>\`:''}
      \${t.status==='delivered'?\`<button class="btn btn-danger btn-sm" onclick="openReverse('\${t.txid}')">↩</button>\`:''}
    </td>
  </tr>\`).join('');
  document.getElementById('txTable').innerHTML = \`<table><thead><tr><th>TXID</th><th>Telegram ID</th><th>Valor</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead><tbody>\${rows||'<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">Nenhuma transação encontrada</td></tr>'}</tbody></table>\`;
  renderPagination('txPag', d.page, d.pages, 'setTxPage');
}
function setTxPage(p) { pages.tx = p; loadTx(); }
async function approveTx(txid) { await api('approveTransaction', { method:'POST', body:{txid} }); toast('✅ Transação aprovada!'); loadTx(); loadDashboard(); }
async function rejectTx(txid) { await api('rejectTransaction', { method:'POST', body:{txid} }); toast('❌ Transação rejeitada.','err'); loadTx(); }
async function deliverTx(txid) { await api('deliverByTxid', { method:'POST', body:{txid} }); toast('📦 Marcado como entregue!'); loadTx(); }
function openReverse(txid) { document.getElementById('reverseTxid').value = txid; document.getElementById('reverseReason').value = ''; openModal('mReverse'); }
async function doReverse() { const txid = document.getElementById('reverseTxid').value; const reason = document.getElementById('reverseReason').value; await api('reverseTransaction', { method:'POST', body:{txid,reason} }); closeModal('mReverse'); toast('↩ Revertido!','warn'); loadTx(); }

// FALHAS
async function loadFailures() {
  const d = await api('deliveryFailures');
  if (!d.data?.length) { document.getElementById('failTable').innerHTML = '<div class="empty"><div class="empty-icon">✅</div><div class="empty-text">Nenhuma falha de entrega!</div></div>'; return; }
  const rows = d.data.map(f => \`<tr>
    <td><span class="mono">\${(f.txid||'').substring(0,16)}...</span></td>
    <td><span class="mono">\${f.telegram_id}</span></td>
    <td><strong>R$ \${fmt(f.amount)}</strong></td>
    <td>\${badge(f.delivery_error_type||'unknown')}</td>
    <td style="font-size:12px;color:var(--muted)">\${f.delivery_attempts||0}x</td>
    <td style="font-size:11px;color:var(--muted)">\${fmtD(f.last_delivery_attempt_at)}</td>
    <td><button class="btn btn-purple btn-sm" onclick="forceDelivered('\${f.txid}')">✓ Forçar Entrega</button></td>
  </tr>\`).join('');
  document.getElementById('failTable').innerHTML = \`<table><thead><tr><th>TXID</th><th>Telegram ID</th><th>Valor</th><th>Tipo Erro</th><th>Tentativas</th><th>Última Tentativa</th><th>Ação</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}
async function forceDelivered(txid) { await api('forceDelivered', { method:'POST', body:{txid} }); toast('✅ Marcado como entregue!'); loadFailures(); loadDashboard(); }

// PRODUTOS
async function loadProducts() {
  const d = await api('products');
  if (!d.data?.length) { document.getElementById('prodTable').innerHTML = '<div class="empty"><div class="empty-icon">🛍️</div><div class="empty-text">Nenhum produto cadastrado</div></div>'; return; }
  const rows = d.data.map(p => \`<tr>
    <td><strong>\${p.name}</strong></td>
    <td><span class="mono">\${p.product_id}</span></td>
    <td><strong style="color:var(--purple2)">R$ \${fmt(p.price)}</strong></td>
    <td style="color:var(--text2);font-size:12px">\${p.delivery_type}</td>
    <td>\${p.is_active ? badge('active') : badge('inactive')}</td>
    <td style="font-size:11px;color:var(--muted)">\${fmtD(p.created_at)}</td>
    <td>
      <button class="btn btn-ghost btn-sm" onclick="toggleProduct('\${p.product_id}',\${!p.is_active})">\${p.is_active?'⏸':'▶'}</button>
      <button class="btn btn-danger btn-sm" onclick="deleteProduct('\${p.product_id}')">🗑</button>
    </td>
  </tr>\`).join('');
  document.getElementById('prodTable').innerHTML = \`<table><thead><tr><th>Nome</th><th>ID</th><th>Preço</th><th>Tipo</th><th>Status</th><th>Criado</th><th>Ações</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}
async function saveProduct() {
  const body = { product_id:document.getElementById('p_id').value, name:document.getElementById('p_name').value, description:document.getElementById('p_desc').value, price:document.getElementById('p_price').value, delivery_type:document.getElementById('p_type').value, delivery_url:document.getElementById('p_url').value };
  const d = await api('createProduct', { method:'POST', body });
  if (d.ok) { closeModal('mProduct'); toast('✅ Produto criado!'); loadProducts(); }
  else toast('❌ ' + (d.error||'Erro'),'err');
}
async function toggleProduct(id, active) { await api('toggleProduct', { method:'POST', body:{product_id:id,is_active:active} }); toast(active?'▶ Ativado!':'⏸ Pausado.','warn'); loadProducts(); }
async function deleteProduct(id) { if (!confirm('Desativar produto ' + id + '?')) return; await api('deleteProduct', { method:'DELETE', params:{product_id:id} }); toast('🗑 Produto desativado.','warn'); loadProducts(); }

// GRUPOS
async function loadGroups() {
  const d = await api('groups');
  if (!d.data?.length) { document.getElementById('groupTable').innerHTML = '<div class="empty"><div class="empty-icon">👥</div><div class="empty-text">Nenhum grupo cadastrado</div></div>'; return; }
  const rows = d.data.map(g => \`<tr>
    <td><strong>\${g.group_name}</strong></td>
    <td><span class="mono" style="font-size:11px">\${g.group_id}</span></td>
    <td><strong style="color:var(--purple2)">R$ \${fmt(g.subscription_price)}</strong></td>
    <td style="color:var(--text2)">\${g.subscription_days} dias</td>
    <td>\${g.is_active ? badge('active') : badge('inactive')}</td>
    <td>
      <button class="btn btn-ghost btn-sm" onclick="toggleGroup('\${g.group_id}',\${!g.is_active})">\${g.is_active?'⏸ Pausar':'▶ Ativar'}</button>
      <button class="btn btn-danger btn-sm" onclick="deleteGroup('\${g.group_id}')">🗑</button>
    </td>
  </tr>\`).join('');
  document.getElementById('groupTable').innerHTML = \`<table><thead><tr><th>Nome</th><th>ID Telegram</th><th>Preço</th><th>Duração</th><th>Status</th><th>Ações</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}
async function saveGroup() {
  const body = { group_id:document.getElementById('g_id').value, group_name:document.getElementById('g_name').value, group_link:document.getElementById('g_link').value, subscription_price:document.getElementById('g_price').value, subscription_days:document.getElementById('g_days').value };
  const d = await api('createGroup', { method:'POST', body });
  if (d.ok) { closeModal('mGroup'); toast('✅ Grupo criado!'); loadGroups(); }
  else toast('❌ ' + (d.error||'Erro'),'err');
}
async function toggleGroup(id, active) { await api('toggleGroup', { method:'POST', body:{group_id:id,is_active:active} }); toast(active?'▶ Ativado!':'⏸ Pausado.','warn'); loadGroups(); }
async function deleteGroup(id) { if (!confirm('Deletar grupo ' + id + '?')) return; await api('deleteGroup', { method:'DELETE', params:{group_id:id} }); toast('🗑 Grupo removido.','warn'); loadGroups(); }

// CUPONS
async function loadCoupons() {
  const d = await api('coupons');
  if (!d.data?.length) { document.getElementById('couponTable').innerHTML = '<div class="empty"><div class="empty-icon">🏷️</div><div class="empty-text">Nenhum cupom criado</div></div>'; return; }
  const rows = d.data.map(c => \`<tr>
    <td><strong class="mono">\${c.code}</strong></td>
    <td><strong style="color:var(--purple2)">\${c.discount_percentage}% OFF</strong></td>
    <td style="color:var(--text2)">\${c.product_id || 'Todos'}</td>
    <td class="mono" style="font-size:12px">\${c.current_uses||0}/\${c.max_uses||'∞'}</td>
    <td>\${c.is_active ? badge('active') : badge('inactive')}</td>
    <td style="font-size:11px;color:var(--muted)">\${c.expires_at ? fmtD(c.expires_at) : 'Sem expiração'}</td>
    <td>
      <button class="btn btn-ghost btn-sm" onclick="toggleCoupon('\${c.id}',\${!c.is_active})">\${c.is_active?'⏸':'▶'}</button>
      <button class="btn btn-danger btn-sm" onclick="deleteCoupon('\${c.id}')">🗑</button>
    </td>
  </tr>\`).join('');
  document.getElementById('couponTable').innerHTML = \`<table><thead><tr><th>Código</th><th>Desconto</th><th>Produto</th><th>Usos</th><th>Status</th><th>Expira</th><th>Ações</th></tr></thead><tbody>\${rows}</tbody></table>\`;
  // preencher select de produtos no modal
  const pd = await api('products');
  const sel = document.getElementById('c_prod');
  sel.innerHTML = '<option value="">Todos os produtos</option>' + (pd.data||[]).map(p => \`<option value="\${p.product_id}">\${p.name}</option>\`).join('');
}
async function saveCoupon() {
  const body = { code:document.getElementById('c_code').value, discount_percentage:document.getElementById('c_disc').value, product_id:document.getElementById('c_prod').value||null, max_uses:document.getElementById('c_uses').value||null, expires_at:document.getElementById('c_exp').value||null };
  const d = await api('createCoupon', { method:'POST', body });
  if (d.ok) { closeModal('mCoupon'); toast('✅ Cupom criado!'); loadCoupons(); }
  else toast('❌ ' + (d.error||'Erro'),'err');
}
async function toggleCoupon(id, active) { await api('toggleCoupon', { method:'POST', body:{coupon_id:id,is_active:active} }); toast(active?'▶ Ativado!':'⏸ Pausado.','warn'); loadCoupons(); }
async function deleteCoupon(id) { if (!confirm('Deletar cupom?')) return; await api('deleteCoupon', { method:'DELETE', params:{coupon_id:id} }); toast('🗑 Cupom removido.','warn'); loadCoupons(); }

// USUÁRIOS
async function loadUsers() {
  document.getElementById('usersTable').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const d = await api('users', { params:{ page:pages.users, limit:25, search:document.getElementById('userQ').value, blocked:document.getElementById('userBl').value } });
  if (!d.data) return;
  const rows = d.data.map(u => \`<tr>
    <td><strong>\${u.first_name||'N/A'} \${u.last_name||''}</strong></td>
    <td><span class="mono">@\${u.username||'—'}</span></td>
    <td><span class="mono">\${u.telegram_id}</span></td>
    <td>
      \${u.is_blocked ? badge('blocked') : badge('active')}
      \${u.is_admin ? ' ' + badge('admin') : ''}
      \${u.is_creator ? ' ' + badge('creator') : ''}
    </td>
    <td style="font-size:11px;color:var(--muted)">\${fmtD(u.created_at)}</td>
    <td>
      <button class="btn btn-ghost btn-sm" onclick="viewUser(\${u.telegram_id})">👁</button>
      \${u.is_blocked
        ? '<button class="btn btn-success btn-sm" onclick="unblockUser(' + u.telegram_id + ')">🔓</button>'
        : '<button class="btn btn-danger btn-sm" onclick="blockUser(' + u.telegram_id + ')">🔒</button>'}
    </td>
  </tr>\`).join('');
  document.getElementById('usersTable').innerHTML = \`<table><thead><tr><th>Nome</th><th>Username</th><th>Telegram ID</th><th>Status</th><th>Cadastro</th><th>Ações</th></tr></thead><tbody>\${rows||'<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">Nenhum usuário</td></tr>'}</tbody></table>\`;
  renderPagination('usersPag', d.page, d.pages, 'setUsersPage');
}
function setUsersPage(p) { pages.users = p; loadUsers(); }
async function blockUser(tid) { await api('blockUser', { method:'POST', body:{telegram_id:tid} }); toast('🔒 Bloqueado.','warn'); loadUsers(); }
async function unblockUser(tid) { await api('unblockUser', { method:'POST', body:{telegram_id:tid} }); toast('🔓 Desbloqueado!'); loadUsers(); }
async function viewUser(tid) {
  const d = await api('userDetail', { params:{telegram_id:tid} });
  const u = d.user || {};
  document.getElementById('uDetailInfo').innerHTML = \`<div style="font-size:16px;font-weight:700">\${u.first_name||'N/A'} \${u.last_name||''}</div><div class="mono" style="font-size:12px;color:var(--muted)">@\${u.username||'sem username'}</div><div class="mono" style="font-size:12px;color:var(--text2);margin-top:4px">ID: \${u.telegram_id}</div><div style="margin-top:8px">\${u.is_blocked?badge('blocked'):badge('active')} \${u.is_admin?badge('admin'):''} \${u.is_creator?badge('creator'):''}</div>\`;
  document.getElementById('uDetailTx').innerHTML = (d.transactions||[]).map(t =>
    miniItem('<div><span class="mono">' + (t.txid||'').substring(0,14) + '...</span></div>', '<div style="text-align:right"><strong>R$ ' + fmt(t.amount) + '</strong> ' + badge(t.status) + '</div>')
  ).join('') || '<div style="color:var(--muted);font-size:13px;padding:10px">Sem transações</div>';
  openModal('mUserDetail');
}

// CONFIÁVEIS
async function loadTrusted() {
  const d = await api('trustedUsers');
  if (!d.data?.length) { document.getElementById('trustedTable').innerHTML = '<div class="empty"><div class="empty-icon">⭐</div><div class="empty-text">Nenhum usuário confiável</div></div>'; return; }
  const rows = d.data.map(t => \`<tr>
    <td><span class="mono">\${t.telegram_id}</span></td>
    <td><strong>\${t.score||0}</strong></td>
    <td>\${t.is_approved ? badge('active') : badge('pending')}</td>
    <td style="font-size:11px;color:var(--muted)">\${fmtD(t.created_at)}</td>
  </tr>\`).join('');
  document.getElementById('trustedTable').innerHTML = \`<table><thead><tr><th>Telegram ID</th><th>Score</th><th>Status</th><th>Criado</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}

// TICKETS
async function loadTickets() {
  document.getElementById('tickTable').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const d = await api('tickets', { params:{ page:pages.tick, limit:20, status:document.getElementById('tickSt').value } });
  if (!d.data) return;
  const rows = d.data.map(t => \`<tr>
    <td><strong>#\${t.ticket_number||t.id?.substring(0,8)}</strong></td>
    <td>\${t.user?.first_name||'N/A'} <span class="mono" style="font-size:11px;color:var(--muted)">@\${t.user?.username||t.telegram_id||''}</span></td>
    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${t.subject||'—'}</td>
    <td>\${badge(t.status)}</td>
    <td style="font-size:11px;color:var(--muted)">\${fmtD(t.created_at)}</td>
    <td>
      <button class="btn btn-ghost btn-sm" onclick="viewTicket('\${t.id}','\${(t.subject||'Ticket').replace(/'/g,"\\\\'")}','\${t.status}')">👁 Ver</button>
      \${t.status!=='resolved'?'<button class="btn btn-success btn-sm" onclick="resolveTicket(\\''+t.id+'\\')">✓</button>':''}
    </td>
  </tr>\`).join('');
  document.getElementById('tickTable').innerHTML = \`<table><thead><tr><th>#</th><th>Usuário</th><th>Assunto</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead><tbody>\${rows||'<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">Nenhum ticket</td></tr>'}</tbody></table>\`;
  renderPagination('tickPag', d.page, d.pages, 'setTickPage');
}
function setTickPage(p) { pages.tick = p; loadTickets(); }
async function viewTicket(id, subject, status) {
  document.getElementById('mTicketTitle').textContent = '🎫 ' + subject;
  document.getElementById('mTicketMsgs').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  document.getElementById('btnResolveTicket').onclick = () => { resolveTicket(id); closeModal('mTicket'); };
  document.getElementById('btnCloseTicket').onclick = () => { closeTicket(id); closeModal('mTicket'); };
  document.getElementById('btnResolveTicket').style.display = status==='resolved'?'none':'';
  openModal('mTicket');
  const d = await api('ticketMessages', { params:{ticket_id:id} });
  document.getElementById('mTicketMsgs').innerHTML = (d.data||[]).map(m =>
    '<div class="msg-bubble ' + (m.is_admin?'admin':'user') + '"><div>' + m.message + '</div><div class="msg-meta">' + (m.is_admin?'👑 Admin':'👤 Usuário') + ' · ' + fmtD(m.created_at) + '</div></div>'
  ).join('') || '<div style="text-align:center;color:var(--muted);padding:20px">Nenhuma mensagem</div>';
}
async function resolveTicket(id) { await api('resolveTicket', { method:'POST', body:{ticket_id:id} }); toast('✅ Ticket resolvido!'); loadTickets(); }
async function closeTicket(id) { await api('closeTicket', { method:'POST', body:{ticket_id:id} }); toast('⬛ Ticket fechado.','warn'); loadTickets(); }

// BROADCAST
async function loadBroadcast() {
  const d = await api('broadcasts');
  if (!d.data?.length) { document.getElementById('bcList').innerHTML = '<div class="empty"><div class="empty-icon">📢</div><div class="empty-text">Nenhuma campanha ainda.<br>Use o bot no Telegram para criar.</div></div>'; return; }
  document.getElementById('bcList').innerHTML = d.data.map(c => {
    const done = (c.success_count||0) + (c.failed_count||0);
    const pct = c.total_users > 0 ? Math.round(done / c.total_users * 100) : 0;
    const statusIcon = c.status==='sent'?'✅':c.status==='sending'||c.status==='pending'?'📡':'⚠️';
    return \`<div class="bc-card">
      <div class="bc-icon">\${statusIcon}</div>
      <div class="bc-body">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="bc-name">\${c.name||'Campanha'}</div>
          <div style="display:flex;gap:8px;align-items:center">\${badge(c.status)}
            \${(c.status==='pending'||c.status==='sending')?'<button class="btn btn-danger btn-sm" onclick="cancelBroadcast(\\''+c.id+'\\')">✗ Cancelar</button>':''}
          </div>
        </div>
        <div class="bc-meta">✅ \${c.success_count||0} enviados &nbsp;❌ \${c.failed_count||0} falhas &nbsp;👥 \${c.total_users||'?'} total</div>
        <div class="progress"><div class="progress-fill" style="width:\${pct}%"></div></div>
        <div style="font-size:10px;color:var(--muted);margin-top:4px">\${fmtD(c.created_at)} · \${pct}% concluído</div>
      </div>
    </div>\`;
  }).join('');
}
async function cancelBroadcast(id) { await api('cancelBroadcast', { method:'POST', body:{campaign_id:id} }); toast('⬛ Campanha cancelada.','warn'); loadBroadcast(); }

// AUTO RESPONSES
async function loadAutoResp() {
  const d = await api('autoResponses');
  if (!d.data?.length) { document.getElementById('arTable').innerHTML = '<div class="empty"><div class="empty-icon">🤖</div><div class="empty-text">Nenhuma resposta automática</div></div>'; return; }
  const rows = d.data.map(r => \`<tr>
    <td><strong class="mono">\${r.keyword}</strong></td>
    <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2)">\${r.response}</td>
    <td><span class="mono">\${r.priority}</span></td>
    <td>\${r.is_active ? badge('active') : badge('inactive')}</td>
    <td><span class="mono" style="font-size:12px">\${r.usage_count||0}x</span></td>
    <td><button class="btn btn-danger btn-sm" onclick="deleteAutoResp('\${r.id}')">🗑</button></td>
  </tr>\`).join('');
  document.getElementById('arTable').innerHTML = \`<table><thead><tr><th>Keyword</th><th>Resposta</th><th>Prioridade</th><th>Status</th><th>Usos</th><th>Ação</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}
async function saveAutoResp() {
  const body = { keyword:document.getElementById('ar_kw').value, response:document.getElementById('ar_resp').value, priority:document.getElementById('ar_pri').value };
  const d = await api('createAutoResponse', { method:'POST', body });
  if (d.ok) { closeModal('mAutoResp'); toast('✅ Resposta criada!'); loadAutoResp(); }
  else toast('❌ ' + (d.error||'Erro'),'err');
}
async function deleteAutoResp(id) { if (!confirm('Deletar resposta?')) return; await api('deleteAutoResponse', { method:'DELETE', params:{id} }); toast('🗑 Removida.','warn'); loadAutoResp(); }

// SETTINGS
async function loadSettings() {
  const d = await api('settings');
  const s = d.settings || {};
  document.getElementById('pixKey').value = s.pix_key || '';
  document.getElementById('supportLink').value = s.support_contact || '';
}
async function saveSetting(key, value, successMsg) {
  if (!value) { toast('❌ Valor não pode ser vazio','err'); return; }
  await api('saveSetting', { method:'POST', body:{key,value} });
  toast(successMsg || '✅ Salvo!');
}

// DDDs
async function loadDDDs() {
  const d = await api('blockedDDDs');
  if (!d.data?.length) { document.getElementById('dddTable').innerHTML = '<div class="empty"><div class="empty-icon">📵</div><div class="empty-text">Nenhum DDD bloqueado</div></div>'; return; }
  const rows = d.data.map(d => \`<tr>
    <td><strong class="mono">\${d.area_code}</strong></td>
    <td>\${d.state||'—'}</td>
    <td style="color:var(--text2)">\${d.reason||'—'}</td>
    <td><button class="btn btn-danger btn-sm" onclick="removeDDD('\${d.area_code}')">🗑 Remover</button></td>
  </tr>\`).join('');
  document.getElementById('dddTable').innerHTML = \`<table><thead><tr><th>DDD</th><th>Estado</th><th>Motivo</th><th>Ação</th></tr></thead><tbody>\${rows}</tbody></table>\`;
}
async function addDDD() {
  const body = { area_code:document.getElementById('ddd_code').value, state:document.getElementById('ddd_state').value, reason:document.getElementById('ddd_reason').value };
  const d = await api('addDDD', { method:'POST', body });
  if (d.ok) { closeModal('mDDD'); toast('🚫 DDD bloqueado!','warn'); loadDDDs(); }
  else toast('❌ ' + (d.error||'Erro'),'err');
}
async function removeDDD(code) { if (!confirm('Desbloquear DDD ' + code + '?')) return; await api('removeDDD', { method:'DELETE', params:{area_code:code} }); toast('✅ DDD desbloqueado!'); loadDDDs(); }

// INIT
checkAuth().then(() => { loadDashboard(); });
setInterval(() => { const a = document.querySelector('.section.active'); if (a?.id==='s-dashboard') loadDashboard(); }, 60000);
</script>
</body>
</html>
`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};
