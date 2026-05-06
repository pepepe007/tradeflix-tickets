const {
  Events, ChannelType, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');
const db = require('../utils/db');
const { isStaff, getStaffRoleIds } = require('../utils/permissions');
const { gerarTranscript } = require('../utils/transcript');
const config = require('../../config.json');

const TIPOS = {
  compra:   { emoji: '🛒',  label: 'Compra' },
  venda:    { emoji: '💰',  label: 'Venda' },
  suporte:  { emoji: '🛠️', label: 'Suporte' },
  parceria: { emoji: '✨',  label: 'Parceria' }
};

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      // ===== ABRIR TICKET DE ATENDIMENTO =====
      if (interaction.isStringSelectMenu() && interaction.customId === 'atend_open_ticket') {
        await interaction.deferReply({ ephemeral: true });
        const tipoKey = interaction.values[0];
        const tipo = TIPOS[tipoKey];
        if (!tipo) return interaction.editReply({ content: '❌ Tipo inválido.' });

        const data = db.read();
        const cfg = data.config;
        if (!cfg.categoriaTicketsId) return interaction.editReply({ content: '❌ Categoria de tickets não configurada.' });

        const staffIds = getStaffRoleIds();
        if (!staffIds.length) return interaction.editReply({ content: '❌ Nenhum cargo de staff configurado.' });

        // Verifica ticket existente
        for (const [canalId, t] of Object.entries(data.ticketsAtendimento || {})) {
          if (t.userId === interaction.user.id && !t.fechado) {
            const ch = await interaction.guild.channels.fetch(canalId).catch(() => null);
            if (ch) return interaction.editReply({ content: `❌ Você já tem um ticket aberto: ${ch}` });
            t.fechado = true;
            db.write(data);
          }
        }

        data.contadorTicketAtendimento = (data.contadorTicketAtendimento || 0) + 1;
        const numero = String(data.contadorTicketAtendimento).padStart(4, '0');

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
              PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory
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

        const canal = await interaction.guild.channels.create({
          name: `${tipoKey}-${numero}`,
          type: ChannelType.GuildText,
          parent: cfg.categoriaTicketsId,
          permissionOverwrites: overwrites
        });

        if (!data.ticketsAtendimento) data.ticketsAtendimento = {};
        data.ticketsAtendimento[canal.id] = {
          numero, tipo: tipoKey, userId: interaction.user.id,
          criadoEm: Date.now(), fechado: false, claimedBy: null
        };
        db.write(data);

        const embed = new EmbedBuilder()
          .setColor(config.cor)
          .setAuthor({ name: `${config.nomeLoja} • Ticket #${numero}`, iconURL: config.logo })
          .setTitle(`${tipo.emoji} Ticket de ${tipo.label}`)
          .setDescription(`Olá ${interaction.user}! Aguarde um membro da staff atender seu chamado.\n\nDescreva detalhadamente sua solicitação enquanto espera.`)
          .addFields(
            { name: '👤 Solicitante', value: `${interaction.user}`, inline: true },
            { name: '📋 Tipo', value: tipo.label, inline: true },
            { name: '🕐 Aberto em', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
          )
          .setThumbnail(config.logo)
          .setFooter({ text: `${config.nomeLoja} • Ticket Profissional` })
          .setTimestamp();

        const botoes = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('atend_claim').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('atend_close').setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        const mencao = `${interaction.user} ${staffIds.map(id => `<@&${id}>`).join(' ')}`;
        await canal.send({ content: mencao, embeds: [embed], components: [botoes] });
        return interaction.editReply({ content: `✅ Ticket criado: ${canal}` });
      }

      // ===== CLAIM =====
      if (interaction.isButton() && interaction.customId === 'atend_claim') {
        const data = db.read();
        const ticket = data.ticketsAtendimento?.[interaction.channel.id];
        if (!ticket) return;
        if (!isStaff(interaction.member)) return interaction.reply({ content: '❌ Apenas staff pode dar claim.', ephemeral: true });
        if (ticket.claimedBy) return interaction.reply({ content: `❌ Já foi assumido por <@${ticket.claimedBy}>.`, ephemeral: true });

        ticket.claimedBy = interaction.user.id;
        db.write(data);

        for (const rid of getStaffRoleIds()) {
          await interaction.channel.permissionOverwrites.edit(rid, { ViewChannel: false, SendMessages: false }).catch(() => {});
        }
        await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
          ViewChannel: true, SendMessages: true, ReadMessageHistory: true, ManageMessages: true
        });

        const novosBotoes = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('atend_desclaim').setLabel('Desclaim').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('atend_close').setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );
        const msg = interaction.message;
        const e = EmbedBuilder.from(msg.embeds[0]);
        e.setDescription((e.data.description || '') + `\n\n**🙋 Atendendo:** ${interaction.user}`);
        await msg.edit({ embeds: [e], components: [novosBotoes] });
        return interaction.reply({ content: `✅ ${interaction.user} assumiu este ticket.` });
      }

      // ===== DESCLAIM =====
      if (interaction.isButton() && interaction.customId === 'atend_desclaim') {
        const data = db.read();
        const ticket = data.ticketsAtendimento?.[interaction.channel.id];
        if (!ticket) return;
        const isClaimer = ticket.claimedBy === interaction.user.id;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!isClaimer && !isAdmin) return interaction.reply({ content: '❌ Só quem assumiu pode desclaim.', ephemeral: true });

        ticket.claimedBy = null;
        db.write(data);

        for (const rid of getStaffRoleIds()) {
          await interaction.channel.permissionOverwrites.edit(rid, { ViewChannel: true, SendMessages: true }).catch(() => {});
        }
        await interaction.channel.permissionOverwrites.delete(interaction.user.id).catch(() => {});

        const novosBotoes = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('atend_claim').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('atend_close').setLabel('Fechar').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );
        const msg = interaction.message;
        const e = EmbedBuilder.from(msg.embeds[0]);
        let desc = (e.data.description || '').replace(/\n\n\*\*🙋 Atendendo:\*\* <@\d+>/, '');
        e.setDescription(desc);
        await msg.edit({ embeds: [e], components: [novosBotoes] });
        return interaction.reply({ content: `🔓 ${interaction.user} liberou o ticket.` });
      }

      // ===== FECHAR (DIRETO — apenas staff) =====
      if (interaction.isButton() && interaction.customId === 'atend_close') {
        const data = db.read();
        const ticket = data.ticketsAtendimento?.[interaction.channel.id];
        if (!ticket) return;

        if (!isStaff(interaction.member)) {
          return interaction.reply({ content: '❌ Apenas a **staff** pode encerrar tickets.', ephemeral: true });
        }

        return fecharTicketAtendimento(interaction, false);
      }

    } catch (err) {
      console.error('❌ Erro em ticketsAtendimento:', err.message);
    }
  }
};

async function fecharTicketAtendimento(interaction, jaRespondido) {
  try {
    const data = db.read();
    const ticket = data.ticketsAtendimento?.[interaction.channel.id];
    if (!ticket) return;

    const transcript = await gerarTranscript(interaction.channel).catch(() => null);
    if (data.config.canalLogTickets) {
      const canalLog = await interaction.guild.channels.fetch(data.config.canalLogTickets).catch(() => null);
      if (canalLog) {
        const embedLog = new EmbedBuilder()
          .setColor(config.cor)
          .setAuthor({ name: `${config.nomeLoja} • Log de Ticket`, iconURL: config.logo })
          .setTitle(`🔒 Ticket #${ticket.numero} fechado`)
          .addFields(
            { name: '👤 Solicitante', value: `<@${ticket.userId}>`, inline: true },
            { name: '📋 Tipo', value: ticket.tipo, inline: true },
            { name: '🙋 Atendido por', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'N/A', inline: true }
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
      await interaction.reply({ content: '🔒 Ticket fechando em 3 segundos...' }).catch(() => {});
    }
    setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
  } catch (err) {
    console.error('❌ Erro ao fechar ticket atendimento:', err.message);
  }
}
