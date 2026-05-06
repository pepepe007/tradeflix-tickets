# TradeFlix Middleman Bot

Bot de **Middleman profissional** da loja **TradeFlix**, com sistema completo de:
- Painel de solicitação com botão único e visual premium
- Gerenciamento por staff (claim/desclaim, fechamento controlado)
- Registro automático de middlemans concluídos como prova social
- Logs de transcript em HTML em canal separado

## 🚀 Como usar

1. Clone o repositório
2. Rode `npm install`
3. Copie `config.example.json` para `config.json` e preencha seus dados
4. Rode `npm start`

## ⚙️ Comandos

- `/setup-categoria` — Define categoria onde os middlemans serão criados
- `/setup-cargo-staff` — Define cargo da staff
- `/setup-log-tickets` — Define canal de logs gerais (transcripts)
- `/setup-log-intermediacao` — Define canal de prova social pública
- `/setup-painel` — Envia painel de Middleman no canal escolhido

## 🛠️ Stack
- Node.js 20+
- discord.js v14
- discord-html-transcripts

## 📦 Hospedagem
- Discloud (plano pago)
