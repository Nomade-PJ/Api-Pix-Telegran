// api/contrato.js
// Página de contrato para Valdirene Souza dos Santos

module.exports = (req, res) => {
  // Configurar headers para HTML
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  
  // Retornar HTML
  res.status(200).send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contrato de Prestação de Serviços - Bot Telegram PIX</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        .header h1 {
            font-size: 2em;
            margin-bottom: 10px;
        }

        .header p {
            font-size: 1.1em;
            opacity: 0.9;
        }

        .login-section {
            padding: 60px 40px;
            text-align: center;
        }

        .login-section h2 {
            color: #333;
            margin-bottom: 30px;
        }

        .login-form {
            max-width: 400px;
            margin: 0 auto;
        }

        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            color: #555;
            font-weight: 600;
        }

        .form-group input {
            width: 100%;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.3s;
        }

        .form-group input:focus {
            outline: none;
            border-color: #667eea;
        }

        .btn {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
        }

        .btn:hover {
            transform: translateY(-2px);
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .error {
            color: #e74c3c;
            margin-top: 10px;
            font-size: 14px;
        }

        .contract-content {
            display: none;
            padding: 40px;
        }

        .contract-content.active {
            display: block;
        }

        .contract-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #667eea;
        }

        .contract-header h2 {
            color: #333;
            font-size: 1.8em;
            margin-bottom: 10px;
        }

        .contract-header .subtitle {
            color: #666;
            font-size: 1.1em;
        }

        .contract-body {
            color: #333;
            line-height: 1.8;
            text-align: justify;
        }

        .contract-section {
            margin-bottom: 30px;
        }

        .contract-section h3 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.3em;
        }

        .contract-section h4 {
            color: #333;
            margin-bottom: 10px;
            margin-top: 15px;
        }

        .contract-section p {
            margin-bottom: 10px;
        }

        .contract-section ul {
            margin-left: 30px;
            margin-top: 10px;
        }

        .contract-section li {
            margin-bottom: 8px;
        }

        .highlight {
            background: #fff3cd;
            padding: 20px;
            border-left: 4px solid #ffc107;
            margin: 20px 0;
            border-radius: 4px;
        }

        .payment-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }

        .payment-table th,
        .payment-table td {
            padding: 12px;
            border: 1px solid #ddd;
            text-align: left;
        }

        .payment-table th {
            background: #667eea;
            color: white;
        }

        .payment-table tr:nth-child(even) {
            background: #f9f9f9;
        }

        .signature-section {
            margin-top: 40px;
            padding: 30px;
            background: #f8f9fa;
            border-radius: 8px;
        }

        .checkbox-group {
            margin-bottom: 20px;
        }

        .checkbox-group label {
            display: flex;
            align-items: center;
            cursor: pointer;
        }

        .checkbox-group input[type="checkbox"] {
            width: 20px;
            height: 20px;
            margin-right: 10px;
            cursor: pointer;
        }

        .signature-input {
            margin-top: 20px;
        }

        .success-message {
            display: none;
            text-align: center;
            padding: 60px 40px;
        }

        .success-message.active {
            display: block;
        }

        .success-icon {
            font-size: 80px;
            color: #28a745;
            margin-bottom: 20px;
        }

        .success-message h2 {
            color: #28a745;
            margin-bottom: 20px;
        }

        .whatsapp-btn {
            display: inline-block;
            padding: 15px 30px;
            background: #25D366;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin-top: 20px;
            transition: transform 0.2s;
        }

        .whatsapp-btn:hover {
            transform: translateY(-2px);
        }

        @media print {
            .header, .signature-section, .btn {
                display: none;
            }
            
            body {
                background: white;
            }
            
            .container {
                box-shadow: none;
            }
        }

        @media (max-width: 768px) {
            body {
                padding: 10px;
            }

            .container {
                border-radius: 10px;
            }

            .header {
                padding: 30px 20px;
            }

            .header h1 {
                font-size: 1.5em;
            }

            .login-section, .contract-content, .success-message {
                padding: 30px 20px;
            }

            .payment-table {
                font-size: 0.9em;
            }

            .payment-table th,
            .payment-table td {
                padding: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Contrato de Prestação de Serviços</h1>
            <p>Sistema Automatizado de Vendas via Telegram com PIX</p>
        </div>

        <!-- Seção de Login -->
        <div id="loginSection" class="login-section">
            <h2>🔒 Acesso Restrito ao Contrato</h2>
            <p style="color: #666; margin-bottom: 30px;">Por favor, insira a senha fornecida para visualizar o contrato.</p>
            
            <div class="login-form">
                <div class="form-group">
                    <label for="password">Senha de Acesso</label>
                    <input type="password" id="password" placeholder="Digite a senha" autocomplete="off">
                </div>
                <button class="btn" onclick="validatePassword()">Acessar Contrato</button>
                <div id="loginError" class="error"></div>
            </div>
        </div>

        <!-- Conteúdo do Contrato -->
        <div id="contractContent" class="contract-content">
            <div class="contract-header">
                <h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h2>
                <div class="subtitle">Sistema de Automação de Vendas via Telegram</div>
                <div style="margin-top: 10px; color: #999;">Contrato Nº 001/2025 - Versão 1.0</div>
            </div>

            <div class="contract-body">
                <!-- Qualificação das Partes -->
                <div class="contract-section">
                    <h3>1. QUALIFICAÇÃO DAS PARTES</h3>
                    <p><strong>CONTRATANTE:</strong></p>
                    <p><strong>Nome:</strong> VALDIRENE SOUZA DOS SANTOS</p>
                    <p><strong>Doravante denominado CONTRATANTE</strong></p>
                    
                    <p style="margin-top: 20px;"><strong>CONTRATADA:</strong></p>
                    <p><strong>Razão Social:</strong> Bot Telegram PIX - Sistema de Vendas Digitais</p>
                    <p><strong>Doravante denominada CONTRATADA</strong></p>
                </div>

                <!-- Objeto do Contrato -->
                <div class="contract-section">
                    <h3>2. OBJETO DO CONTRATO</h3>
                    <p>O presente contrato tem por objeto a prestação de serviços de desenvolvimento, implementação, manutenção e suporte técnico de um <strong>Sistema Automatizado de Vendas via Telegram com Pagamento PIX</strong>, conforme especificações técnicas detalhadas neste instrumento.</p>
                </div>

                <!-- Especificações Técnicas -->
                <div class="contract-section">
                    <h3>3. ESPECIFICAÇÕES TÉCNICAS E FUNCIONALIDADES</h3>
                    <p>O sistema entregue compreende as seguintes funcionalidades e recursos técnicos:</p>

                    <h4>3.1. SISTEMA DE PAGAMENTOS PIX</h4>
                    <ul>
                        <li>✅ Geração automática de QR Code PIX padrão BR Code</li>
                        <li>✅ Payload Cópia & Cola para pagamentos instantâneos</li>
                        <li>✅ Análise automática de comprovantes via OCR (Optical Character Recognition)</li>
                        <li>✅ Sistema de validação em três níveis de confiança:
                            <ul>
                                <li>≥70% - Aprovação automática imediata</li>
                                <li>40-69% - Validação manual pelo administrador</li>
                                <li>&lt;40% - Rejeição automática com notificação ao cliente</li>
                            </ul>
                        </li>
                        <li>✅ Expiração automática de transações após 30 minutos</li>
                        <li>✅ Cache inteligente de análises OCR para reprocessamento</li>
                        <li>✅ Suporte a comprovantes em imagem (JPG, PNG) e PDF</li>
                    </ul>

                    <h4>3.2. GESTÃO DE PRODUTOS DIGITAIS</h4>
                    <ul>
                        <li>✅ Cadastro ilimitado de produtos digitais</li>
                        <li>✅ Entrega automatizada via links ou arquivos ZIP</li>
                        <li>✅ Media Packs com entrega aleatória de fotos/vídeos</li>
                        <li>✅ Sistema de preços variáveis para media packs</li>
                        <li>✅ Controle de estoque de mídia</li>
                        <li>✅ Sistema de cupons de desconto (1-99% off)</li>
                        <li>✅ Broadcast inteligente associado a produtos</li>
                    </ul>

                    <h4>3.3. SISTEMA DE GRUPOS E ASSINATURAS</h4>
                    <ul>
                        <li>✅ Assinaturas mensais com controle automático de acesso</li>
                        <li>✅ Gestão automática de membros (adição/remoção)</li>
                        <li>✅ Lembretes automáticos de expiração de assinatura</li>
                        <li>✅ Sistema de renovação facilitada via comando /renovar</li>
                        <li>✅ Múltiplos grupos com preços e durações personalizadas</li>
                    </ul>

                    <h4>3.4. PAINÉIS ADMINISTRATIVOS</h4>
                    <ul>
                        <li><strong>Painel Administrativo Completo:</strong>
                            <ul>
                                <li>Gerenciamento total de produtos e grupos</li>
                                <li>Aprovação/rejeição de comprovantes</li>
                                <li>Estatísticas em tempo real</li>
                                <li>Sistema de broadcast de mensagens</li>
                                <li>Configuração de chave PIX</li>
                                <li>Bloqueio geográfico por DDD</li>
                                <li>Gerenciamento de cupons e campanhas</li>
                            </ul>
                        </li>
                        <li><strong>Painel do Criador (Seguro e Simplificado):</strong>
                            <ul>
                                <li>Estatísticas de vendas (apenas aprovadas)</li>
                                <li>Criação de cupons de desconto</li>
                                <li>Broadcast com produtos e cupons</li>
                                <li>Interface otimizada para criadores de conteúdo</li>
                            </ul>
                        </li>
                    </ul>

                    <h4>3.5. SISTEMA DE CUPONS E MARKETING</h4>
                    <ul>
                        <li>✅ Criação de cupons com códigos personalizados</li>
                        <li>✅ Descontos de 1% a 99%</li>
                        <li>✅ Limite de usos configurável</li>
                        <li>✅ Data de expiração opcional</li>
                        <li>✅ Aplicação automática no checkout</li>
                        <li>✅ Estatísticas de uso em tempo real</li>
                        <li>✅ Rastreamento de campanhas</li>
                    </ul>

                    <h4>3.6. BROADCAST AVANÇADO</h4>
                    <ul>
                        <li>✅ Broadcast simples para todos os usuários</li>
                        <li>✅ Broadcast associado a produtos específicos</li>
                        <li>✅ Broadcast com criação automática de cupons</li>
                        <li>✅ Botões interativos de compra direta</li>
                        <li>✅ Histórico completo de campanhas</li>
                        <li>✅ Estatísticas de envio (sucesso/falha)</li>
                    </ul>

                    <h4>3.7. SEGURANÇA E CONTROLE</h4>
                    <ul>
                        <li>✅ Webhook seguro com secret path único</li>
                        <li>✅ Validação de administradores via banco de dados</li>
                        <li>✅ Bloqueio geográfico por DDD (área de cobertura)</li>
                        <li>✅ Rate limiting e proteção contra spam</li>
                        <li>✅ Sanitização completa de todas as entradas</li>
                        <li>✅ Logs de auditoria de todas as operações</li>
                        <li>✅ Backup automático via Supabase</li>
                    </ul>

                    <h4>3.8. INFRAESTRUTURA TÉCNICA</h4>
                    <ul>
                        <li>🔧 Backend: Node.js + Telegraf (framework profissional)</li>
                        <li>🔧 Banco de Dados: Supabase PostgreSQL (escalável)</li>
                        <li>🔧 Hospedagem: Hostgator com Node.js (99.9% uptime)</li>
                        <li>🔧 OCR: OCR.space API (análise de comprovantes)</li>
                        <li>🔧 Pagamentos: PIX via BR Code (padrão Banco Central)</li>
                    </ul>
                </div>

                <!-- Prazo de Vigência -->
                <div class="contract-section">
                    <h3>4. PRAZO DE VIGÊNCIA</h3>
                    <p>O presente contrato terá vigência de <strong>3 (três) meses</strong>, com início em <strong>01 de dezembro de 2025</strong> e término em <strong>01 de março de 2026</strong>.</p>
                    <p>Ao término do prazo, o contrato poderá ser renovado mediante acordo entre as partes, com valores e condições a serem renegociados.</p>
                </div>

                <!-- Valores e Forma de Pagamento -->
                <div class="contract-section">
                    <h3>5. VALORES E FORMA DE PAGAMENTO</h3>
                    
                    <div class="highlight">
                        <strong>📊 RESUMO FINANCEIRO:</strong>
                        <p style="margin-top: 10px;">✅ <strong>Investimento Total:</strong> R$ 2.200,00 (dois mil e duzentos reais)</p>
                        <p>✅ <strong>Potencial de Retorno:</strong> + R$ 10.000,00 mensais</p>
                        <p>✅ <strong>ROI Estimado:</strong> 454% em 3 meses</p>
                    </div>

                    <h4>5.1. DETALHAMENTO DOS PAGAMENTOS:</h4>
                    
                    <table class="payment-table">
                        <thead>
                            <tr>
                                <th>Período</th>
                                <th>Descrição</th>
                                <th>Valor</th>
                                <th>Vencimento</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td><strong>Mês 1</strong></td>
                                <td>Desenvolvimento e Implementação<br>(Mão de obra inicial)</td>
                                <td><strong>R$ 600,00</strong></td>
                                <td>01/12/2025 a 01/01/2026</td>
                            </tr>
                            <tr>
                                <td><strong>Mês 2</strong></td>
                                <td>Manutenção, Suporte e Hospedagem</td>
                                <td><strong>R$ 800,00</strong></td>
                                <td>01/01/2026 a 01/02/2026</td>
                            </tr>
                            <tr>
                                <td><strong>Mês 3</strong></td>
                                <td>Manutenção, Suporte e Hospedagem</td>
                                <td><strong>R$ 800,00</strong></td>
                                <td>01/02/2026 a 01/03/2026</td>
                            </tr>
                            <tr style="background: #667eea; color: white; font-weight: bold;">
                                <td colspan="2">TOTAL DO CONTRATO (3 MESES)</td>
                                <td colspan="2">R$ 2.200,00</td>
                            </tr>
                        </tbody>
                    </table>

                    <h4>5.2. CONDIÇÕES DE PAGAMENTO:</h4>
                    <p>📅 Os pagamentos deverão ser efetuados até o dia <strong>05 (cinco)</strong> de cada mês via PIX, transferência bancária ou outra forma acordada entre as partes.</p>
                    <p>⚠️ Em caso de atraso superior a 10 (dez) dias, o sistema poderá ser temporariamente suspenso até a regularização do pagamento.</p>
                </div>

                <!-- Demais cláusulas continuam aqui... -->
                <div class="contract-section">
                    <h3>6. OBRIGAÇÕES DA CONTRATADA</h3>
                    <p>A CONTRATADA se obriga a:</p>
                    <ul>
                        <li><strong>6.1.</strong> Entregar o sistema completo e funcional conforme especificações técnicas descritas na Cláusula 3</li>
                        <li><strong>6.2.</strong> Fornecer treinamento inicial sobre o uso e administração do sistema</li>
                        <li><strong>6.3.</strong> Prestar suporte técnico via WhatsApp em horário comercial (9h às 18h, dias úteis)</li>
                        <li><strong>6.4.</strong> Corrigir bugs e erros identificados sem custo adicional</li>
                        <li><strong>6.5.</strong> Manter o sistema hospedado e operacional durante toda a vigência do contrato</li>
                        <li><strong>6.6.</strong> Realizar backup automático diário dos dados</li>
                        <li><strong>6.7.</strong> Garantir uptime mínimo de 99% (exceto manutenções programadas)</li>
                        <li><strong>6.8.</strong> Implementar melhorias e atualizações de segurança sem custo adicional</li>
                    </ul>
                </div>

                <div class="contract-section">
                    <h3>7. OBRIGAÇÕES DO CONTRATANTE</h3>
                    <p>O CONTRATANTE se obriga a:</p>
                    <ul>
                        <li><strong>7.1.</strong> Efetuar os pagamentos nas datas acordadas</li>
                        <li><strong>7.2.</strong> Fornecer todas as informações necessárias para implementação</li>
                        <li><strong>7.3.</strong> Utilizar o sistema de forma legal e ética</li>
                        <li><strong>7.4.</strong> Não revender ou sublicenciar o sistema</li>
                        <li><strong>7.5.</strong> Responsabilizar-se pelo conteúdo divulgado</li>
                        <li><strong>7.6.</strong> Manter confidencialidade das senhas</li>
                        <li><strong>7.7.</strong> Comunicar problemas imediatamente</li>
                    </ul>
                </div>

                <div class="contract-section">
                    <h3>8. PROPRIEDADE INTELECTUAL</h3>
                    <p><strong>8.1.</strong> O código-fonte permanece de propriedade da CONTRATADA.</p>
                    <p><strong>8.2.</strong> O CONTRATANTE recebe licença de uso durante a vigência do contrato.</p>
                </div>

                <!-- Aceitação -->
                <div class="highlight">
                    <strong>⚖️ VALIDADE JURÍDICA:</strong>
                    <p style="margin-top: 10px;">Este contrato possui validade jurídica conforme Art. 107 do Código Civil Brasileiro e Lei 14.063/2020 (assinaturas eletrônicas).</p>
                    <p>A assinatura eletrônica tem a mesma validade que a assinatura manuscrita, conforme Art. 10 da MP 2.200-2/2001.</p>
                </div>

                <div class="contract-section">
                    <p style="text-align: center; margin-top: 40px; font-size: 0.9em; color: #666;">
                        <strong>Data de emissão:</strong> 29 de novembro de 2025<br>
                        <strong>Versão do contrato:</strong> 1.0<br>
                        <strong>Código do documento:</strong> CONTRATO-001-2025
                    </p>
                </div>
            </div>

            <!-- Seção de Assinatura -->
            <div class="signature-section">
                <h3 style="text-align: center; margin-bottom: 20px;">✍️ Assinatura Digital do Contrato</h3>
                
                <div class="checkbox-group">
                    <label>
                        <input type="checkbox" id="acceptTerms">
                        <span>Declaro que li, compreendi e aceito todos os termos e condições deste contrato.</span>
                    </label>
                </div>

                <div class="signature-input">
                    <div class="form-group">
                        <label for="fullName">Nome Completo (conforme documento)</label>
                        <input type="text" id="fullName" placeholder="Digite seu nome completo" autocomplete="off">
                    </div>

                    <button class="btn" onclick="signContract()" id="signBtn" disabled>
                        ✍️ Assinar Contrato Digitalmente
                    </button>

                    <div id="signError" class="error"></div>
                </div>

                <p style="text-align: center; margin-top: 20px; font-size: 0.85em; color: #666;">
                    Ao clicar em "Assinar Contrato", você está concordando eletronicamente com todos os termos.<br>
                    Sua assinatura será registrada com data, hora e IP para fins legais.
                </p>
            </div>
        </div>

        <!-- Mensagem de Sucesso -->
        <div id="successMessage" class="success-message">
            <div class="success-icon">✅</div>
            <h2>Contrato Assinado com Sucesso!</h2>
            <p style="font-size: 1.2em; color: #666; margin: 20px 0;">
                <strong>VALDIRENE SOUZA DOS SANTOS</strong>, seu contrato foi assinado digitalmente e registrado em nosso banco de dados.
            </p>
            
            <div class="highlight">
                <p><strong>📋 Detalhes do Contrato:</strong></p>
                <p style="margin-top: 10px;">
                    ✅ <strong>Início:</strong> 01 de dezembro de 2025<br>
                    ✅ <strong>Término:</strong> 01 de março de 2026<br>
                    ✅ <strong>Vigência:</strong> 3 meses<br>
                    ✅ <strong>Investimento Total:</strong> R$ 2.200,00<br>
                    ✅ <strong>Status:</strong> <span style="color: #28a745;">ATIVO</span>
                </p>
            </div>

            <p style="margin-top: 30px; font-size: 1.1em;">
                🎉 <strong>Bem-vindo(a) ao nosso sistema!</strong><br>
                Em breve você receberá todas as informações de acesso via WhatsApp.
            </p>

            <a href="https://wa.me/5511999999999?text=Olá!%20Acabei%20de%20assinar%20o%20contrato%20do%20Bot%20Telegram%20PIX.%20Gostaria%20de%20iniciar%20a%20implementação." 
               class="whatsapp-btn" target="_blank">
                💬 Falar no WhatsApp
            </a>

            <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
                Uma cópia do contrato assinado foi salva em nosso banco de dados.<br>
                ID do Contrato: <strong id="contractId"></strong>
            </p>
        </div>
    </div>

    <script>
        // Validar senha junto com o servidor (a senha é checada de verdade no backend agora,
        // não mais só aqui no navegador — antes dava pra pular essa tela chamando a API direto)
        let CONTRACT_PASSWORD_CACHE = null;

        async function validatePassword() {
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('loginError');
            const btn = document.querySelector('.btn');

            btn.disabled = true;
            btn.textContent = '⏳ Verificando...';
            errorDiv.textContent = '';

            try {
                const response = await fetch('/api/check-contract', {
                    headers: { 'X-Contract-Password': password }
                });

                if (response.status === 401) {
                    errorDiv.innerHTML = '<span style="color:#e74c3c;">❌ Senha incorreta. Por favor, tente novamente.</span>';
                    btn.disabled = false;
                    btn.textContent = 'Acessar Contrato';
                    return;
                }

                CONTRACT_PASSWORD_CACHE = password;
                const data = await response.json();

                if (data.alreadySigned && data.isExpired) {
                    // Contrato expirou
                    errorDiv.innerHTML = '<div style="color:#856404;background:#fff3cd;padding:15px;border-radius:8px;margin-top:15px;">' +
                        '<strong>⚠️ Contrato Expirado</strong><br>' +
                        'Este contrato expirou em ' + new Date(data.contract.endDate).toLocaleDateString('pt-BR') + '.<br>' +
                        'Entre em contato para renovação.' +
                        '</div>';
                    btn.disabled = false;
                    btn.textContent = 'Acessar Contrato';
                    return;
                }

                if (data.alreadySigned && !data.isExpired) {
                    // ✅ Contrato já assinado e ativo — mostrar mensagem verde e depois entrar
                    const signedDate = new Date(data.contract.signedAt).toLocaleDateString('pt-BR');
                    const endDate   = new Date(data.contract.endDate).toLocaleDateString('pt-BR');

                    errorDiv.innerHTML =
                        '<div id="statusBox" style="color:#155724;background:#d4edda;padding:15px;border-radius:8px;margin-top:15px;text-align:center;">' +
                            '<strong>✅ Contrato já foi assinado!</strong><br>' +
                            'Este contrato foi assinado em ' + signedDate + '.<br>' +
                            'O contrato está ativo até ' + endDate + '.<br>' +
                            '<strong>ID do Contrato:</strong> ' + data.contract.id + '<br><br>' +
                            '<span id="countdownText" style="font-size:0.9em;">Abrindo o contrato em <strong id="countNum">3</strong>s...</span>' +
                            '<div style="margin-top:10px;height:6px;background:#c3e6cb;border-radius:3px;overflow:hidden;">' +
                                '<div id="progressBar" style="height:100%;width:0%;background:#28a745;border-radius:3px;transition:width 3s linear;"></div>' +
                            '</div>' +
                        '</div>';

                    // Iniciar barra de progresso
                    setTimeout(() => {
                        document.getElementById('progressBar').style.width = '100%';
                    }, 50);

                    // Countdown 3 → 2 → 1 → abre contrato
                    let count = 3;
                    const interval = setInterval(() => {
                        count--;
                        const el = document.getElementById('countNum');
                        if (el) el.textContent = count;
                        if (count <= 0) {
                            clearInterval(interval);
                            abrirContrato();
                        }
                    }, 1000);

                    return;
                }

                // Contrato disponível para assinatura (ainda não assinou)
                abrirContrato();

            } catch (error) {
                console.error('Erro ao verificar status do contrato:', error);
                errorDiv.innerHTML = '<span style="color:#e74c3c;">❌ Erro ao verificar. Tente novamente.</span>';
                btn.disabled = false;
                btn.textContent = 'Acessar Contrato';
            }
        }

        function abrirContrato() {
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('contractContent').classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Enter para validar senha
        document.getElementById('password').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                validatePassword();
            }
        });

        // Habilitar botão de assinar quando aceitar termos
        document.getElementById('acceptTerms').addEventListener('change', function() {
            const fullName = document.getElementById('fullName').value.trim();
            document.getElementById('signBtn').disabled = !this.checked || fullName === '';
        });

        document.getElementById('fullName').addEventListener('input', function() {
            const acceptTerms = document.getElementById('acceptTerms').checked;
            document.getElementById('signBtn').disabled = !acceptTerms || this.value.trim() === '';
        });

        // Assinar contrato
        async function signContract() {
            const fullName = document.getElementById('fullName').value.trim();
            const errorDiv = document.getElementById('signError');
            const signBtn = document.getElementById('signBtn');

            if (fullName === '') {
                errorDiv.textContent = '❌ Por favor, digite seu nome completo.';
                return;
            }

            if (fullName.split(' ').length < 2) {
                errorDiv.textContent = '❌ Por favor, digite seu nome completo (nome e sobrenome).';
                return;
            }

            signBtn.disabled = true;
            signBtn.textContent = '⏳ Assinando contrato...';
            errorDiv.textContent = '';

            try {
                // Enviar para API
                const response = await fetch('/api/sign-contract', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Contract-Password': CONTRACT_PASSWORD_CACHE || ''
                    },
                    body: JSON.stringify({
                        clientFullName: fullName
                    })
                });

                const data = await response.json();

                if (data.success) {
                    // Mostrar mensagem de sucesso
                    document.getElementById('contractContent').classList.remove('active');
                    document.getElementById('successMessage').classList.add('active');
                    document.getElementById('contractId').textContent = data.contractId;

                    // Scroll to top
                    window.scrollTo(0, 0);
                } else if (data.alreadySigned) {
                    // Contrato já foi assinado
                    errorDiv.innerHTML = '<div style="background: #fff3cd; color: #856404; padding: 15px; border-radius: 8px; margin-top: 10px;">' +
                        '<strong>⚠️ Contrato já foi assinado anteriormente!</strong><br>' +
                        'Assinado em: ' + new Date(data.signedAt).toLocaleDateString('pt-BR') + '<br>' +
                        'ID: ' + data.contractId +
                        '</div>';
                    signBtn.disabled = true;
                } else {
                    throw new Error(data.message || 'Erro ao assinar contrato');
                }
            } catch (error) {
                console.error('Erro ao assinar contrato:', error);
                errorDiv.textContent = '❌ Erro ao assinar contrato. Por favor, tente novamente.';
                signBtn.disabled = false;
                signBtn.textContent = '✍️ Assinar Contrato Digitalmente';
            }
        }
    </script>
</body>
</html>
  `);
};
