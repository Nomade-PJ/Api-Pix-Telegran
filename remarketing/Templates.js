/**
 * templates.js — Copy + sequências de remarketing
 * Cada segmento tem N steps com headline, texto e variação de imagem
 */

// Produtos para linkar nos botões (o bot usa /start=PRODUTO)
const BOT_USERNAME = process.env.BOT_USERNAME || 'seubot'; // será sobrescrito

// ── COLD — nunca comprou ──────────────────────────────────────────────────
// 3 steps: a cada 6h, máx 3x/dia, para após step 5
const COLD = [
  {
    step: 0,
    headline: '🔥 Ei, você viu o que está rolando?',
    text: (nome) =>
`*${nome || 'Oi'}!* 😍

Temos conteúdo novo esperando por você!

✨ *Pack de Agora* — disponível agora
📸 Fotos exclusivas + 🎬 vídeos premium

👇 Garanta o seu antes que acabe:`,
    product: 'pack_premium',
  },
  {
    step: 1,
    headline: '💫 Mais de 455 clientes já tiveram acesso...',
    text: (nome) =>
`*${nome || 'Você'}*, você ainda não conhece o melhor! 👀

🔥 *Conteúdo que ninguém mais tem*

Mais de *455 pessoas* já compraram e adoraram.
É seu momento! 💎

👇 Escolha seu pacote:`,
    product: 'mixespecialmaisescol',
  },
  {
    step: 2,
    headline: '⚡ Última chance hoje!',
    text: (nome) =>
`*${nome || 'Ei'}!* ⚡

Não quero que você perca isso...

🎯 *Mix Especial* — o mais escolhido
💫 *Destaques da Semana* — mais recentes
🔥 *Conteúdo VIP* — o mais intenso

Por apenas *R$ 20,00* você já tem acesso!

👇 Clique e escolha agora:`,
    product: 'destaquesdasemana',
  },
  {
    step: 3,
    headline: '😏 Curiosidade te trouxe até aqui...',
    text: (nome) =>
`*${nome || 'Oi'}!* 😏

Você abriu o bot, viu que tem coisa boa...

Agora só falta um passo! 🚀

💎 Conteúdo 100% exclusivo
🔒 Acesso imediato após pagamento
💳 PIX — aprovação em segundos

*Não deixa pra depois!* 👇`,
    product: 'surpresapremium',
  },
  {
    step: 4,
    headline: '🎁 Oferta especial só pra você',
    text: (nome) =>
`*${nome || 'Você'}*, última mensagem, prometo! 😄

Tenho um conteúdo *especial* separado pra você 🎁

✅ Fotos e vídeos nunca antes vistos
✅ Acesso vitalício
✅ Entrega imediata no Telegram

*Por R$ 25,00 — o menor preço da semana!* 🔥

👇 Última chance:`,
    product: 'bastidoresexclusivos',
  },
];

// ── WARM — iniciou PIX mas não pagou ─────────────────────────────────────
// 3 steps: 2h, 8h, 24h após abandono
const WARM = [
  {
    step: 0,
    headline: '⏰ Seu pedido ainda está esperando!',
    text: (nome) =>
`*${nome || 'Ei'}!* 😮

Você iniciou um pedido mas não finalizou...

O conteúdo está *reservado pra você* por pouco tempo! ⏰

💡 Basta fazer o PIX e o acesso é imediato!

👇 Finalize agora:`,
    product: null, // produto baseado na tx aberta
    urgency: true,
  },
  {
    step: 1,
    headline: '🔔 Ainda dá tempo — seu pedido não expirou',
    text: (nome) =>
`*${nome || 'Oi'}!* 🔔

Seu pedido ainda está *ativo*!

Muita gente desiste e fica sem... não seja essa pessoa! 😅

✅ PIX rápido
✅ Entrega na hora
✅ Sem complicação

👇 Finalize em segundos:`,
    product: null,
    urgency: true,
  },
  {
    step: 2,
    headline: '💔 Quase te perdemos...',
    text: (nome) =>
`*${nome || 'Olá'}*, tudo bem? 💬

Percebi que você não concluiu sua compra...

Posso te ajudar com algo? Se tiver dúvida, é só responder aqui! 😊

Mas se quiser garantir seu conteúdo *agora mesmo*:

👇 Acesse aqui:`,
    product: null,
  },
];

// ── BUYER — já comprou, upsell ────────────────────────────────────────────
// 4 steps: 24h, 3d, 7d, 15d após última compra
const BUYER = [
  {
    step: 0,
    headline: '🌟 Exclusivo para quem já conhece a qualidade!',
    text: (nome, lastProduct) =>
`*${nome || 'Olá'}!* 🌟

Você já provou que tem bom gosto! 😉

Tenho novidades chegando e você, como cliente especial, fica sabendo primeiro!

🔥 Conteúdo novo disponível agora
💎 Acesso exclusivo para clientes

👇 Confira o que tem de novo:`,
    crossSell: true,
  },
  {
    step: 1,
    headline: '💎 Você merece o melhor — upgrade disponível',
    text: (nome) =>
`*${nome || 'Ei'}!* 💎

Clientes especiais merecem acesso especial! 🏆

🎯 *Pacote Completo* — tudo em um só lugar
✨ O conteúdo mais completo que temos

Pela fidelidade, vale muito a pena! 👇`,
    forcedProduct: 'pacotecompleto',
  },
  {
    step: 2,
    headline: '🎬 Conteúdo novo chegou — liberado para você!',
    text: (nome) =>
`*${nome || 'Olá'}!* 🎬

*Atualização semanal disponível!* ✨

Novos destaques, novos momentos exclusivos.
Conteúdo 100% fresco pra você! 🔥

👇 Garanta os Destaques desta semana:`,
    forcedProduct: 'destaquesdasemana',
  },
  {
    step: 3,
    headline: '🤫 Surpresa especial para clientes fiéis',
    text: (nome) =>
`*${nome || 'Você'}!* 🤫

Tenho algo especial guardado...

*Surpresa Premium* — seleção secreta
Uma experiência diferente de tudo que você já viu! 😏

👇 Descubra agora:`,
    forcedProduct: 'surpresapremium',
  },
];

module.exports = { COLD, WARM, BUYER };
