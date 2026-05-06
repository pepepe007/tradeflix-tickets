const {
  Events, ChannelType, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const db = require('../utils/db');
const { gerarTranscript } = require('../utils/transcript');
const config = require('../../config.json');
const { isStaff, getStaffRoleIds } = require('../utils/permissions');
const { adicionarSaldo, aplicarCargoTier, parseValor, fmt } = require('../utils/tiersCliente');

// Prefixos de outros handlers — este arquivo IGNORA
const PREFIXOS_OUTROS_HANDLERS = ['eb_', 'atend_'];

// IDs e regras fixas por requisito do CEO
const CANAL_PROVA_ALTO_VALOR = '1499219753787719790';
const VALOR_MINIMO_PROVA_PREMIUM = 500; // R$ — vendas ≥ 500 vão pro canal premium

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      // ---------- FILTRO: ignora interações de outros handlers ----------
      if (
        (interaction.isButton() || interaction.isModalSubmit() || interaction.isAnySelectMenu?.()) &&
        interaction.customId &&
        PREFIXOS_OUTROS_HANDLERS.some(p => interaction.customId.startsWith(p))
      ) {
        return;
      }

      // ---------- SLASH COMMANDS ----------
      if (interaction.isChatInputCommand()) {
        const cmd = interaction.client.commands.get(interaction.commandName);
        if (!cmd) return;
        return cmd.execute(interaction);
      }

      // ---------- AUTOCOMPLETE ----------
      if (interaction.isAutocomplete()) {
        const cmd = interaction.client.commands.get(interaction.commandName);
        if (cmd && typeof cmd.autocomplete === 'function') return cmd.autocomplete(interaction);
        return;
      }

      // ---------- BOTÕES ANTIGOS / MORTOS ----------
      const botoesValidos = [
        'solicitar_middleman', 'claim_ticket', 'desclaim_ticket', 'fechar_ticket',
        'confirmar_middleman_sim', 'confirmar_middleman_nao', 'cancelar_fechamento'
      ];
      if (interaction.isButton() && !botoesValidos.includes(interaction.customId)) {
        return interaction.reply({
          content: '⚠️ Este botão é de um painel antigo e não funciona mais.',
          ephemeral: true
        }).catch(() => {});
      }

      // ---------- SOLICITAR MIDDLEMAN (abre modal de pré-cadastro) ----------
      if (interaction.isButton() && interaction.customId === 'solicitar_middleman') {
        const modal = new ModalBuilder()
          .setCustomId('modal_precadastro_middleman')
          .setTitle('🤝 Solicitar Middleman');

        const participanteInput = new TextInputBuilder()
          .setCustomId('outro_participante')
          .setLabel('Outro participante (ID ou @user)')
          .setPlaceholder('Ex: 123456789012345678')
          .setStyle(TextInputStyle.Short)
          .setMinLength(2).setMaxLength(100).setRequired(true);

        const itemInput = new TextInputBuilder()
          .setCustomId('item_negociado')
          .setLabel('Item negociado')
          .setPlaceholder('Ex: Conta Valorant Imortal / Skin AK Redline')
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(2).setMaxLength(500).setRequired(true);

        const valorInput = new TextInputBuilder()
          .setCustomId('valor_negociado')
          .setLabel('Valor negociado')
          .setPlaceholder('Ex: R$ 250,00')
          .setStyle(TextInputStyle.Short)
          .setMinLength(1).setMaxLength(50).setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(participanteInput),
          new ActionRowBuilder().addComponents(itemInput),
          new ActionRowBuilder().addComponents(valorInput)
        );
        return interaction.showModal(modal);
      }

      // ---------- PROCESSA PRÉ-CADASTRO E CRIA O CANAL ----------
      if (interaction.isModalSubmit() && interaction.customId === 'modal_precadastro_middleman') {
        await interaction.deferReply({ ephemeral: true });
        const data = db.read();
        const staffIds = getStaffRoleIds();

        if (!data.config.categoriaId || !staffIds.length) {
          return interaction.editReply({
            content: '❌ O bot não está configurado. Avise um administrador para rodar `/setup-categoria` e `/setup-cargos-staff adicionar`.'
          });
        }

        // verifica se o usuário já tem ticket aberto
        for (const [canalId, ticket] of Object.entries(data.tickets || {})) {
          if (ticket.userId === interaction.user.id && !ticket.fechado) {
            const canalExiste = await interaction.guild.channels.fetch(canalId).catch(() => null);
            if (canalExiste) {
              return interaction.editReply({ content: `❌ Você já tem um ticket aberto: ${canalExiste}` });
            } else {
              ticket.fechado = true;
              db.write(data);
            }
          }
        }

        const outroParticipanteRaw = interaction.fields.getTextInputValue('outro_participante').trim();
        const item = interaction.fields.getTextInputValue('item_negociado').trim();
        const valor = interaction.fields.getTextInputValue('valor_negociado').trim();

        const idMatch = outroParticipanteRaw.match(/\d{17,20}/);
        const outroParticipanteId = idMatch ? idMatch[0] : null;
        const outroParticipanteMencao = outroParticipanteId ? `<@${outroParticipanteId}>` : outroParticipanteRaw;

        let outroMember = null;
        if (outroParticipanteId) {
          outroMember = await interaction.guild.members.fetch(outroParticipanteId).catch(() => null);
          if (!outroMember) {
            return interaction.editReply({
              content: `⚠️ Não encontrei o usuário com ID \`${outroParticipanteId}\` no servidor. Verifique e tente novamente.`
            });
          }
          if (outroMember.id === interaction.user.id) {
            return interaction.editReply({ content: '❌ Você não pode abrir um middleman consigo mesmo.' });
          }
        }

        data.contadorTicket = (data.contadorTicket || 0) + 1;
        const numero = String(data.contadorTicket).padStart(4, '0');

        const overwrites = [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          },
          {
            id: interaction.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageMessages, PermissionFlagsBits.EmbedLinks
            ]
          }
        ];
        staffIds.forEach(rid => overwrites.push({
          id: rid,
          allow: [
            PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages
          ]
        }));
        if (outroMember) {
          overwrites.push({
            id: outroMember.id,
            allow: [
              PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks
            ]
          });
        }

        const canal = await interaction.guild.channels.create({
          name: `middleman-${numero}`,
          type: ChannelType.GuildText,
          parent: data.config.categoriaId,
          permissionOverwrites: overwrites
        });

        data.tickets[canal.id] = {
          numero, tipo: 'middleman',
          userId: interaction.user.id,
          outroParticipanteId: outroMember ? outroMember.id : null,
          outroParticipanteRaw, item, valor,
          criadoEm: Date.now(), fechado: false,
          claimedBy: null, intermediacaoRegistrada: false
        };
        db.write(data);

        const embed = new EmbedBuilder()
          .setColor(config.cor)
          .setAuthor({ name: `${config.nomeLoja} • Middleman #${numero}`, iconURL: config.logo })
          .setTitle('🤝 Solicitação de Middleman')
          .setDescription(
            `Olá ${interaction.user}! Sua solicitação foi registrada. Aguarde um membro da staff assumir o ticket.\n\n` +
            `O outro participante (${outroParticipanteMencao}) também foi adicionado ao canal.`
          )
          .addFields(
            { name: '👤 Solicitante', value: `${interaction.user}`, inline: true },
            { name: '👥 Outro participante', value: outroParticipanteMencao, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '📦 Item', value: `\`\`\`${item}\`\`\``, inline: false },
            { name: '💰 Valor negociado', value: `\`${valor}\``, inline: false }
          )
          .setThumbnail(config.logo)
          .setFooter({ text: `${config.nomeLoja} • Middleman Profissional` })
          .setTimestamp();

        const botoes = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('fechar_ticket').setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        const mencoesStaff = staffIds.map(id => `<@&${id}>`).join(' ');
        const mencoes = outroMember
          ? `${interaction.user} ${outroMember} ${mencoesStaff}`
          : `${interaction.user} ${mencoesStaff}`;

        await canal.send({ content: mencoes, embeds: [embed], components: [botoes] });
        return interaction.editReply({ content: `✅ Seu ticket de middleman foi criado: ${canal}` });
      }

      // ---------- CLAIM ----------
      if (interaction.isButton() && interaction.customId === 'claim_ticket') {
        const data = db.read();
        const ticket = data.tickets?.[interaction.channel.id];
        if (!ticket) return interaction.reply({ content: '❌ Ticket não encontrado no banco.', ephemeral: true });
        if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Apenas staff pode dar claim.', ephemeral: true });
        if (ticket.claimedBy) return interaction.reply({ content: `❌ Este ticket já foi assumido por <@${ticket.claimedBy}>.`, ephemeral: true });

        ticket.claimedBy = interaction.user.id;
        db.write(data);

        const staffIds = getStaffRoleIds();
        for (const rid of staffIds) {
          await interaction.channel.permissionOverwrites.edit(rid, { ViewChannel: false, SendMessages: false }).catch(() => {});
        }
        await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
          ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageMessages: true
        });

        const novosBotoes = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('desclaim_ticket').setLabel('Desclaim').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('fechar_ticket').setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        const msg = interaction.message;
        const embedAtual = EmbedBuilder.from(msg.embeds[0]);
        embedAtual.setDescription((embedAtual.data.description || '') + `\n\n**🙋 Em atendimento por:** ${interaction.user}`);
        await msg.edit({ embeds: [embedAtual], components: [novosBotoes] });

        return interaction.reply({ content: `✅ ${interaction.user} assumiu este ticket.` });
      }

      // ---------- DESCLAIM ----------
      if (interaction.isButton() && interaction.customId === 'desclaim_ticket') {
        const data = db.read();
        const ticket = data.tickets?.[interaction.channel.id];
        if (!ticket) return interaction.reply({ content: '❌ Ticket não encontrado no banco.', ephemeral: true });

        const isClaimer = ticket.claimedBy === interaction.user.id;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isClaimer && !isAdmin) {
          return interaction.reply({ content: '❌ Apenas quem assumiu o ticket (ou um admin) pode dar desclaim.', ephemeral: true });
        }

        ticket.claimedBy = null;
        db.write(data);

        const staffIds = getStaffRoleIds();
        for (const rid of staffIds) {
          await interaction.channel.permissionOverwrites.edit(rid, { ViewChannel: true, SendMessages: true }).catch(() => {});
        }
        await interaction.channel.permissionOverwrites.delete(interaction.user.id).catch(() => {});

        const novosBotoes = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('claim_ticket').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('fechar_ticket').setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        const msg = interaction.message;
        const embedAtual = EmbedBuilder.from(msg.embeds[0]);
        let desc = embedAtual.data.description || '';
        desc = desc.replace(/\n\n\*\*🙋 Em atendimento por:\*\* <@\d+>/g, '');
        embedAtual.setDescription(desc);
        await msg.edit({ embeds: [embedAtual], components: [novosBotoes] });

        return interaction.reply({ content: `🔓 ${interaction.user} liberou o ticket.` });
      }

      // ---------- FECHAR (STAFF ONLY) ----------
      if (interaction.isButton() && interaction.customId === 'fechar_ticket') {
        const data = db.read();
        const ticket = data.tickets?.[interaction.channel.id];
        if (!ticket) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });

        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: '❌ Apenas a **staff** pode encerrar tickets.', ephemeral: true });
        }
        if (ticket.claimedBy && ticket.claimedBy !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: `❌ Apenas <@${ticket.claimedBy}> ou um admin pode fechar este ticket.`, ephemeral: true });
        }

        const botoes = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('confirmar_middleman_sim').setLabel('Sim, registrar prova social').setEmoji('✅').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('confirmar_middleman_nao').setLabel('Não, fechar normal').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('cancelar_fechamento').setLabel('Cancelar').setEmoji('❌').setStyle(ButtonStyle.Danger)
        );

        return interaction.reply({
          content: '**O middleman foi concluído com sucesso?**\nSe sim, vou registrar a prova social no canal de logs e atualizar o cargo dos clientes.',
          components: [botoes]
        });
      }

      // ---------- FECHAR NORMAL ----------
      if (interaction.isButton() && interaction.customId === 'confirmar_middleman_nao') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Apenas staff.', ephemeral: true });
        return fecharTicket(interaction, false);
      }

      // ---------- CANCELAR FECHAMENTO ----------
      if (interaction.isButton() && interaction.customId === 'cancelar_fechamento') {
        return interaction.update({ content: '❌ Fechamento cancelado.', components: [] });
      }

      // ---------- CONFIRMAR MIDDLEMAN (modal de prova social) ----------
      if (interaction.isButton() && interaction.customId === 'confirmar_middleman_sim') {
        if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Apenas staff.', ephemeral: true });
        const data = db.read();
        const ticket = data.tickets?.[interaction.channel.id];
        if (!ticket) return interaction.reply({ content: '❌ Ticket não encontrado.', ephemeral: true });

        const modal = new ModalBuilder().setCustomId('modal_intermediacao').setTitle('✅ Registrar Prova Social');

        const valorInput = new TextInputBuilder()
          .setCustomId('valor').setLabel('Valor finalizado')
          .setPlaceholder(ticket.valor || 'Ex: R$ 250,00')
          .setValue(ticket.valor || '')
          .setStyle(TextInputStyle.Short).setRequired(true);

        const p1Input = new TextInputBuilder()
          .setCustomId('p1').setLabel('Participante 1 (ID ou @)')
          .setPlaceholder(ticket.userId)
          .setValue(ticket.userId)
          .setStyle(TextInputStyle.Short).setRequired(true);

        const p2Input = new TextInputBuilder()
          .setCustomId('p2').setLabel('Participante 2 (ID ou @)')
          .setPlaceholder(ticket.outroParticipanteId || 'ID do outro participante')
          .setValue(ticket.outroParticipanteId || '')
          .setStyle(TextInputStyle.Short).setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(valorInput),
          new ActionRowBuilder().addComponents(p1Input),
          new ActionRowBuilder().addComponents(p2Input)
        );
        return interaction.showModal(modal);
      }

      // ---------- SUBMISSÃO DA PROVA SOCIAL ----------
      if (interaction.isModalSubmit() && interaction.customId === 'modal_intermediacao') {
        await interaction.deferReply();
        const data = db.read();
        const ticket = data.tickets?.[interaction.channel.id];
        if (!ticket) return interaction.editReply({ content: '❌ Ticket não encontrado.' });

        const valor = interaction.fields.getTextInputValue('valor').trim();
        const p1Raw = interaction.fields.getTextInputValue('p1').trim();
        const p2Raw = interaction.fields.getTextInputValue('p2').trim();

        const p1Id = (p1Raw.match(/\d{17,20}/) || [])[0];
        const p2Id = (p2Raw.match(/\d{17,20}/) || [])[0];
        const p1Mencao = p1Id ? `<@${p1Id}>` : p1Raw;
        const p2Mencao = p2Id ? `<@${p2Id}>` : p2Raw;

        data.contadorIntermediacao = (data.contadorIntermediacao || 0) + 1;
        const numProva = String(data.contadorIntermediacao).padStart(4, '0');

        ticket.valor = valor;
        if (p1Id) ticket.userId = p1Id;
        if (p2Id) ticket.outroParticipanteId = p2Id;
        ticket.intermediacaoRegistrada = true;
        ticket.finalizadoEm = Date.now();
        db.write(data);

        // ----- ATUALIZA SALDO E CARGOS DOS CLIENTES -----
        const valorNum = parseValor(valor);
        const resultadosTier = [];
        if (valorNum > 0) {
          for (const uid of [p1Id, p2Id].filter(Boolean)) {
            try {
              const m = await interaction.guild.members.fetch(uid).catch(() => null);
              if (!m) continue;
              const novoTotal = adicionarSaldo(uid, valorNum);
              const res = await aplicarCargoTier(m, novoTotal);
              resultadosTier.push({ uid, novoTotal, ...res });
            } catch (e) {
              console.error(`⚠️ Falha ao atualizar tier do usuário ${uid}:`, e?.message || e);
            }
          }
        }

        // ----- EMBED DE PROVA SOCIAL (CANAL CONFIGURÁVEL VIA /setup-log-intermediacao) -----
        if (data.config.canalLogIntermediacao) {
          const canalLog = await interaction.guild.channels.fetch(data.config.canalLogIntermediacao).catch(() => null);
          if (canalLog) {
            const embedProva = new EmbedBuilder()
              .setColor(config.cor)
              .setAuthor({ name: `${config.nomeLoja} • Prova Social`, iconURL: config.logo })
              .setTitle(`✅ Middleman #${numProva} concluído`)
              .addFields(
                { name: '👥 Participantes', value: `${p1Mencao}\n${p2Mencao}`, inline: false },
                { name: '📦 Item', value: `\`\`\`${ticket.item || 'Não informado'}\`\`\``, inline: false },
                { name: '💰 Valor', value: `\`${valor}\``, inline: false },
                { name: '🙋 Mediado por', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Não atribuído', inline: false }
              )
              .setThumbnail(config.logo)
              .setImage(config.banner || null)
              .setFooter({ text: `${config.nomeLoja} • Confiança em primeiro lugar` })
              .setTimestamp();

            const subiram = resultadosTier.filter(r => r.subiu);
            if (subiram.length) {
              embedProva.addFields({
                name: '🏆 Atualização de cargos',
                value: subiram.map(r => `<@${r.uid}> agora é **${r.tierNovo?.nome || 'novo tier'}** (acumulado: ${fmt ? fmt(r.novoTotal) : `R$ ${r.novoTotal.toFixed(2)}`})`).join('\n'),
                inline: false
              });
            }

            await canalLog.send({ embeds: [embedProva] }).catch(() => {});
          }
        }

        // ===== PROVA SOCIAL AUTOMÁTICA — VENDAS ≥ R$500 (canal fixo premium) =====
        let postadoPremium = false;
        if (valorNum >= VALOR_MINIMO_PROVA_PREMIUM) {
          try {
            const canalAlto = await interaction.guild.channels.fetch(CANAL_PROVA_ALTO_VALOR).catch(() => null);
            if (canalAlto) {
              const embedAlto = new EmbedBuilder()
                .setColor(config.cor)
                .setAuthor({ name: `${config.nomeLoja} • Prova Social Premium`, iconURL: config.logo })
                .setTitle(`💎 Middleman de Alto Valor #${numProva}`)
                .setDescription(`Mais uma negociação **premium** intermediada com sucesso pela ${config.nomeLoja}! 🚀`)
                .addFields(
                  { name: '👥 Participantes', value: `${p1Mencao}\n${p2Mencao}`, inline: false },
                  { name: '📦 Item', value: `\`\`\`${ticket.item || 'Não informado'}\`\`\``, inline: false },
                  { name: '💰 Valor Negociado', value: `\`${valor}\``, inline: true },
                  { name: '🙋 Mediado por', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Staff TradeFlix', inline: true }
                )
                .setThumbnail(config.logo)
                .setImage(config.banner || null)
                .setFooter({ text: `${config.nomeLoja} • Negociações de elite` })
                .setTimestamp();

              await canalAlto.send({ embeds: [embedAlto] });
              postadoPremium = true;
              console.log(`💎 Prova social premium postada no canal ${CANAL_PROVA_ALTO_VALOR} — valor R$${valorNum.toFixed(2)}`);
            } else {
              console.warn(`⚠️ Canal premium ${CANAL_PROVA_ALTO_VALOR} não encontrado.`);
            }
          } catch (e) {
            console.error('⚠️ Falha ao postar prova social premium:', e?.message || e);
          }
        }

        // Resposta no canal do ticket
        let respMsg = '✅ Prova social registrada com sucesso!';
        const subiram = resultadosTier.filter(r => r.subiu);
        if (subiram.length) {
          respMsg += `\n🏆 ${subiram.map(r => `<@${r.uid}> subiu para **${r.tierNovo?.nome || 'novo tier'}**`).join(', ')}.`;
        }
        if (postadoPremium) {
          respMsg += `\n💎 Venda de alto valor publicada em <#${CANAL_PROVA_ALTO_VALOR}>!`;
        }
        respMsg += '\n🔒 Fechando o ticket em 3 segundos...';
        await interaction.editReply({ content: respMsg });

        setTimeout(() => fecharTicket(interaction, true), 3000);
        return;
      }

    } catch (err) {
      console.error('❌ Erro em interactionCreate:', err);
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: '❌ Ocorreu um erro. Avise um administrador.', ephemeral: true }).catch(() => {});
      }
    }
  }
};

// ----- AUXILIAR: FECHAR TICKET -----
async function fecharTicket(interaction, jaRespondido) {
  try {
    const data = db.read();
    const ticket = data.tickets?.[interaction.channel.id];
    if (!ticket) return;

    const canal = interaction.channel;
    const guild = interaction.guild;
    const transcript = await gerarTranscript(canal).catch(() => null);

    if (data.config.canalLogTickets) {
      const canalLog = await guild.channels.fetch(data.config.canalLogTickets).catch(() => null);
      if (canalLog) {
        const embedLog = new EmbedBuilder()
          .setColor(config.cor)
          .setAuthor({ name: `${config.nomeLoja} • Log de Ticket`, iconURL: config.logo })
          .setTitle(`🔒 Middleman #${ticket.numero} fechado`)
          .addFields(
            { name: '👤 Solicitante', value: `<@${ticket.userId}>`, inline: true },
            { name: '👥 Outro participante', value: ticket.outroParticipanteId ? `<@${ticket.outroParticipanteId}>` : (ticket.outroParticipanteRaw || 'N/A'), inline: true },
            { name: '🙋 Atendido por', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Ninguém', inline: true },
            { name: '📦 Item', value: ticket.item || 'N/A', inline: false },
            { name: '💰 Valor', value: ticket.valor || 'N/A', inline: true },
            { name: '✅ Prova social registrada?', value: ticket.intermediacaoRegistrada ? 'Sim' : 'Não', inline: true }
          )
          .setFooter({ text: `Fechado por ${interaction.user.tag}` })
          .setTimestamp();

        const payload = { embeds: [embedLog] };
        if (transcript) payload.files = [transcript];
        await canalLog.send(payload).catch(() => {});
      }
    }

    ticket.fechado = true;
    db.write(data);

    if (!jaRespondido) {
      await interaction.update({ content: '🔒 Fechando o ticket em 3 segundos...', components: [] }).catch(() => {});
    }
    setTimeout(() => canal.delete().catch(() => {}), 3000);
  } catch (err) {
    console.error('❌ Erro ao fechar ticket:', err);
  }
}
