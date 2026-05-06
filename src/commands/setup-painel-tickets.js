const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const config = require('../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-painel-tickets')
    .setDescription('Envia o painel de tickets de atendimento (Suporte, Compra, Venda, Parceria).')
    .addChannelOption(o => o.setName('canal').setDescription('Canal').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const canal = interaction.options.getChannel('canal');
    await interaction.deferReply({ ephemeral: true });

    const embed = new EmbedBuilder()
      .setColor(config.cor)
      .setAuthor({ name: `${config.nomeLoja} • Atendimento`, iconURL: config.logo })
      .setTitle(`🎫 Central de Atendimento ${config.nomeLoja}`)
      .setDescription(
        `> Selecione abaixo o tipo de atendimento que deseja abrir.\n\n` +
        `**📋 Tipos de ticket disponíveis:**\n` +
        `🛒 **Compra** — quero comprar algo na TradeFlix\n` +
        `💰 **Venda** — quero vender algo para a TradeFlix\n` +
        `🛠️ **Suporte** — dúvidas, problemas ou reclamações\n` +
        `✨ **Parceria** — propostas comerciais e parcerias\n\n` +
        `**⚠️ Regras:**\n` +
        `• Apenas 1 ticket aberto por vez\n` +
        `• Aguarde a staff responder com paciência\n` +
        `• Não abra tickets sem motivo (resulta em punição)`
      )
      .setThumbnail(config.logo)
      .setImage(config.banner || null)
      .setFooter({ text: `${config.nomeLoja} • Sistema de Tickets Profissional` })
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId('atend_open_ticket')
      .setPlaceholder('🎯 Selecione o tipo de atendimento...')
      .addOptions(
        { label: 'Compra', value: 'compra', emoji: '🛒', description: 'Quero comprar algo' },
        { label: 'Venda', value: 'venda', emoji: '💰', description: 'Quero vender algo' },
        { label: 'Suporte', value: 'suporte', emoji: '🛠️', description: 'Dúvidas e problemas' },
        { label: 'Parceria', value: 'parceria', emoji: '✨', description: 'Propostas comerciais' }
      );
    const row = new ActionRowBuilder().addComponents(menu);

    await canal.send({ embeds: [embed], components: [row] });
    return interaction.editReply({ content: `✅ Painel de tickets enviado em ${canal}.` });
  }
};
