const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-painel')
    .setDescription('Envia o painel de Middleman em um canal.')
    .addChannelOption(o =>
      o.setName('canal')
        .setDescription('Canal onde o painel será enviado')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true))
    .addBooleanOption(o =>
      o.setName('limpar-antigos')
        .setDescription('Remove painéis antigos antes de enviar o novo (recomendado)')
        .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const canal = interaction.options.getChannel('canal');
    const limparAntigos = interaction.options.getBoolean('limpar-antigos') ?? false;

    const permsBot = canal.permissionsFor(interaction.guild.members.me);
    if (!permsBot?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ViewChannel])) {
      return interaction.reply({ content: `❌ Não tenho permissão para enviar mensagens em ${canal}.`, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    // Detecta painéis antigos
    const botId = interaction.client.user.id;
    let painelAntigos = 0;
    try {
      const mensagens = await canal.messages.fetch({ limit: 100 });
      const paineis = mensagens.filter(m =>
        m.author.id === botId &&
        m.embeds.length > 0 &&
        m.components.length > 0 &&
        m.embeds[0].title?.includes('Middleman')
      );
      painelAntigos = paineis.size;

      if (painelAntigos > 0 && limparAntigos) {
        for (const [, msg] of paineis) {
          await msg.delete().catch(() => {});
        }
      } else if (painelAntigos > 0 && !limparAntigos) {
        return interaction.editReply({
          content: `⚠️ Já existem **${painelAntigos} painel(éis)** neste canal. Botões antigos vão falhar para os usuários.\n\n` +
                   `**Opções:**\n` +
                   `\`1.\` Rode novamente com a opção **limpar-antigos:True** para remover automaticamente\n` +
                   `\`2.\` Ou use \`/remover-painel canal:${canal.name}\` antes de enviar o novo`
        });
      }
    } catch (err) {
      console.warn('Não foi possível verificar painéis antigos:', err.message);
    }

    // Tabela de taxas — fields nativos (responsivo PC/mobile)
    const fieldsTaxas = [
      { name: '🟢 Até R$ 7,99',     value: '`R$ 0,50`',     inline: true },
      { name: '🟢 R$ 8 — R$ 99',    value: '`R$ 1,50`',     inline: true },
      { name: '🟡 R$ 100 — R$ 199', value: '`R$ 15,00`',    inline: true },
      { name: '🟠 R$ 200 — R$ 399', value: '`R$ 20,00`',    inline: true },
      { name: '🔴 R$ 400 — R$ 699', value: '`R$ 30,00`',    inline: true },
      { name: '🟣 R$ 700 ou mais',  value: '`5% do valor`', inline: true }
    ];

    const embed = new EmbedBuilder()
      .setColor(config.cor)
      .setAuthor({ name: `${config.nomeLoja} • Middleman Profissional`, iconURL: config.logo })
      .setTitle(`🤝 Central de Middleman ${config.nomeLoja}`)
      .setDescription(
        `> Bem-vindo à **${config.nomeLoja}**!\n\n` +
        `Aqui você solicita um **middleman** seguro para intermediar sua negociação com outro usuário.\n\n` +
        `**📋 Como funciona:**\n` +
        `\`1.\` Clique no botão abaixo **Solicitar Middleman**\n` +
        `\`2.\` Preencha os dados: outro participante, item e valor\n` +
        `\`3.\` Um canal privado será criado com você, o outro participante e a staff\n` +
        `\`4.\` Após a negociação concluída, a staff registra a prova social\n\n` +
        `**⚠️ Importante:** forneça dados verdadeiros. Tickets falsos resultam em punição.`
      )
      .addFields(
        {
          name: '\u200B',
          value: '**💰 Tabela de Taxas do Middleman**\n*Cobrada apenas após o middleman ser concluído com sucesso.*',
          inline: false
        },
        ...fieldsTaxas,
        {
          name: '\u200B',
          value: '🔒 *Pagamento da taxa via PIX para a staff responsável.*',
          inline: false
        }
      )
      .setThumbnail(config.logo)
      .setImage(config.banner || null)
      .setFooter({ text: `${config.nomeLoja} • Sistema de Middleman Profissional` })
      .setTimestamp();

    const botao = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('solicitar_middleman')
        .setLabel('Solicitar Middleman')
        .setEmoji('🤝')
        .setStyle(ButtonStyle.Success)
    );

    const msg = await canal.send({ embeds: [embed], components: [botao] });

    const confirm = new EmbedBuilder()
      .setColor(config.cor)
      .setTitle('✅ Painel enviado com sucesso!')
      .setDescription(
        `**Canal:** ${canal}\n` +
        `**Mensagem:** [Clique aqui](${msg.url})\n` +
        (painelAntigos > 0 && limparAntigos ? `**🧹 Painéis antigos removidos:** ${painelAntigos}` : '')
      )
      .setFooter({ text: `${config.nomeLoja} • Painel pronto para uso` })
      .setTimestamp();

    await interaction.editReply({ embeds: [confirm] });
  }
};
