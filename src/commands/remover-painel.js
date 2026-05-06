const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remover-painel')
    .setDescription('Remove painéis antigos de Middleman de um canal.')
    .addChannelOption(o =>
      o.setName('canal')
        .setDescription('Canal para limpar painéis antigos')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const canal = interaction.options.getChannel('canal');
    const botId = interaction.client.user.id;

    try {
      const mensagens = await canal.messages.fetch({ limit: 100 });
      const paineis = mensagens.filter(m =>
        m.author.id === botId &&
        m.embeds.length > 0 &&
        m.components.length > 0 &&
        m.embeds[0].title?.includes('Middleman')
      );

      if (paineis.size === 0) {
        return interaction.editReply({ content: `ℹ️ Nenhum painel encontrado em ${canal}.` });
      }

      let apagados = 0;
      for (const [, msg] of paineis) {
        await msg.delete().catch(() => {});
        apagados++;
      }

      return interaction.editReply({ content: `✅ ${apagados} painel(éis) removido(s) de ${canal}.` });
    } catch (err) {
      console.error('Erro ao remover painéis:', err);
      return interaction.editReply({ content: '❌ Erro ao buscar mensagens. Verifique se o bot tem permissão **Manage Messages** no canal.' });
    }
  }
};
