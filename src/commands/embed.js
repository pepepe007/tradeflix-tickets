const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, StringSelectMenuBuilder } = require('discord.js');
const store = require('../utils/embedStore');

const draftPadrao = () => ({
  title: '',
  description: 'Edite este embed clicando nos botões abaixo.',
  color: '#A020F0',
  url: '',
  author: { name: '', iconURL: '', url: '' },
  footer: { text: '', iconURL: '' },
  thumbnail: '',
  image: '',
  timestamp: false,
  fields: [],
  buttons: [] // [{label, url, emoji, style}]
});

function buildEmbedFromDraft(draft) {
  const e = new EmbedBuilder();
  if (draft.title) e.setTitle(draft.title.slice(0, 256));
  if (draft.description) e.setDescription(draft.description.slice(0, 4096));
  if (draft.url) try { e.setURL(draft.url); } catch {}
  try { e.setColor(draft.color || '#A020F0'); } catch {}
  if (draft.author?.name) {
    e.setAuthor({
      name: draft.author.name.slice(0, 256),
      iconURL: draft.author.iconURL || undefined,
      url: draft.author.url || undefined
    });
  }
  if (draft.footer?.text) {
    e.setFooter({
      text: draft.footer.text.slice(0, 2048),
      iconURL: draft.footer.iconURL || undefined
    });
  }
  if (draft.thumbnail) try { e.setThumbnail(draft.thumbnail); } catch {}
  if (draft.image) try { e.setImage(draft.image); } catch {}
  if (draft.timestamp) e.setTimestamp();
  if (draft.fields?.length) {
    e.addFields(draft.fields.slice(0, 25).map(f => ({
      name: (f.name || '\u200B').slice(0, 256),
      value: (f.value || '\u200B').slice(0, 1024),
      inline: !!f.inline
    })));
  }
  return e;
}

function buildButtonsFromDraft(draft) {
  if (!draft.buttons?.length) return [];
  const rows = [];
  for (let i = 0; i < draft.buttons.length; i += 5) {
    const row = new ActionRowBuilder();
    draft.buttons.slice(i, i + 5).forEach(b => {
      if (!b.url || !b.label) return;
      const btn = new ButtonBuilder()
        .setLabel(b.label.slice(0, 80))
        .setStyle(ButtonStyle.Link)
        .setURL(b.url);
      if (b.emoji) try { btn.setEmoji(b.emoji); } catch {}
      row.addComponents(btn);
    });
    if (row.components.length) rows.push(row);
  }
  return rows;
}

function builderControls() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_edit_main').setLabel('Título/Descrição').setEmoji('📝').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('eb_edit_author').setLabel('Autor').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_edit_footer').setLabel('Footer').setEmoji('🔻').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_edit_images').setLabel('Imagens').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_edit_color').setLabel('Cor').setEmoji('🎨').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_field_add').setLabel('+ Field').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('eb_field_remove').setLabel('- Field').setEmoji('➖').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('eb_btn_add').setLabel('+ Botão Link').setEmoji('🔗').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('eb_btn_remove').setLabel('- Botão').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('eb_toggle_timestamp').setLabel('Timestamp').setEmoji('🕐').setStyle(ButtonStyle.Secondary)
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('eb_send').setLabel('Enviar').setEmoji('📤').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('eb_save_template').setLabel('Salvar Template').setEmoji('💾').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('eb_export_json').setLabel('Exportar JSON').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_import_json').setLabel('Importar JSON').setEmoji('📥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('eb_reset').setLabel('Resetar').setEmoji('🧹').setStyle(ButtonStyle.Danger)
  );
  return [row1, row2, row3];
}

module.exports = {
  buildEmbedFromDraft,
  buildButtonsFromDraft,
  builderControls,
  draftPadrao,

  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Sistema completo de criação de embeds customizáveis.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s => s.setName('criar').setDescription('Abre o construtor de embed interativo.'))
    .addSubcommand(s => s
      .setName('enviar-template')
      .setDescription('Envia um template salvo em um canal.')
      .addStringOption(o => o.setName('nome').setDescription('Nome do template').setRequired(true).setAutocomplete(true))
      .addChannelOption(o => o.setName('canal').setDescription('Canal de destino').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(s => s
      .setName('editar')
      .setDescription('Edita um embed já enviado pelo bot (cole o link da mensagem).')
      .addStringOption(o => o.setName('link').setDescription('Link da mensagem').setRequired(true)))
    .addSubcommand(s => s.setName('listar').setDescription('Lista todos os templates salvos.'))
    .addSubcommand(s => s
      .setName('deletar')
      .setDescription('Deleta um template salvo.')
      .addStringOption(o => o.setName('nome').setDescription('Nome do template').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s
      .setName('importar')
      .setDescription('Importa um JSON (compatível com Discohook).')
      .addStringOption(o => o.setName('json').setDescription('Cole o JSON aqui (ou use /embed criar e clique em Importar JSON)').setRequired(false))),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const nomes = store.listTemplates().filter(n => n.includes(focused)).slice(0, 25);
    await interaction.respond(nomes.map(n => ({ name: n, value: n })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'criar') {
      const draft = draftPadrao();
      store.setDraft(interaction.user.id, draft);
      const embed = buildEmbedFromDraft(draft);
      return interaction.reply({
        content: '🎨 **Construtor de Embed** — clique nos botões abaixo para customizar. Apenas você vê esta mensagem.',
        embeds: [embed],
        components: builderControls(),
        ephemeral: true
      });
    }

    if (sub === 'enviar-template') {
      const nome = interaction.options.getString('nome');
      const canal = interaction.options.getChannel('canal');
      const tpl = store.getTemplate(nome);
      if (!tpl) return interaction.reply({ content: `❌ Template \`${nome}\` não encontrado.`, ephemeral: true });
      const embed = buildEmbedFromDraft(tpl);
      const components = buildButtonsFromDraft(tpl);
      const msg = await canal.send({ embeds: [embed], components }).catch(e => null);
      if (!msg) return interaction.reply({ content: '❌ Falha ao enviar (verifique permissões).', ephemeral: true });
      return interaction.reply({ content: `✅ Template \`${nome}\` enviado em ${canal} → [ver](${msg.url})`, ephemeral: true });
    }

    if (sub === 'editar') {
      const link = interaction.options.getString('link');
      const m = link.match(/channels\/(\d+)\/(\d+)\/(\d+)/);
      if (!m) return interaction.reply({ content: '❌ Link inválido. Cole o link de uma mensagem do Discord.', ephemeral: true });
      const [, gId, cId, mId] = m;
      if (gId !== interaction.guild.id) return interaction.reply({ content: '❌ A mensagem precisa ser deste servidor.', ephemeral: true });
      const ch = await interaction.guild.channels.fetch(cId).catch(() => null);
      if (!ch) return interaction.reply({ content: '❌ Canal não encontrado.', ephemeral: true });
      const msg = await ch.messages.fetch(mId).catch(() => null);
      if (!msg) return interaction.reply({ content: '❌ Mensagem não encontrada.', ephemeral: true });
      if (msg.author.id !== interaction.client.user.id) return interaction.reply({ content: '❌ Só posso editar mensagens enviadas por mim.', ephemeral: true });
      if (!msg.embeds[0]) return interaction.reply({ content: '❌ A mensagem não tem embed.', ephemeral: true });

      const e = msg.embeds[0];
      const draft = {
        ...draftPadrao(),
        title: e.title || '',
        description: e.description || '',
        color: e.hexColor || '#A020F0',
        url: e.url || '',
        author: { name: e.author?.name || '', iconURL: e.author?.iconURL || '', url: e.author?.url || '' },
        footer: { text: e.footer?.text || '', iconURL: e.footer?.iconURL || '' },
        thumbnail: e.thumbnail?.url || '',
        image: e.image?.url || '',
        timestamp: !!e.timestamp,
        fields: e.fields?.map(f => ({ name: f.name, value: f.value, inline: !!f.inline })) || [],
        buttons: [],
        _editingMessageId: msg.id,
        _editingChannelId: ch.id
      };
      store.setDraft(interaction.user.id, draft);
      const previa = buildEmbedFromDraft(draft);
      return interaction.reply({
        content: `✏️ Editando [esta mensagem](${msg.url}). Ao clicar em **Enviar**, ela será atualizada.`,
        embeds: [previa],
        components: builderControls(),
        ephemeral: true
      });
    }

    if (sub === 'listar') {
      const nomes = store.listTemplates();
      if (!nomes.length) return interaction.reply({ content: '📭 Nenhum template salvo.', ephemeral: true });
      return interaction.reply({ content: `📚 **Templates salvos (${nomes.length}):**\n${nomes.map(n => `• \`${n}\``).join('\n')}`, ephemeral: true });
    }

    if (sub === 'deletar') {
      const nome = interaction.options.getString('nome');
      const ok = store.deleteTemplate(nome);
      return interaction.reply({ content: ok ? `🗑️ Template \`${nome}\` deletado.` : `❌ Template \`${nome}\` não encontrado.`, ephemeral: true });
    }

    if (sub === 'importar') {
      const json = interaction.options.getString('json');
      if (!json) return interaction.reply({ content: 'ℹ️ Use `/embed criar` e clique em **Importar JSON** para abrir o modal de importação.', ephemeral: true });
      try {
        const parsed = JSON.parse(json);
        const e = parsed.embeds?.[0] || parsed;
        const draft = {
          ...draftPadrao(),
          title: e.title || '',
          description: e.description || '',
          color: typeof e.color === 'number' ? '#' + e.color.toString(16).padStart(6, '0') : (e.color || '#A020F0'),
          url: e.url || '',
          author: { name: e.author?.name || '', iconURL: e.author?.icon_url || e.author?.iconURL || '', url: e.author?.url || '' },
          footer: { text: e.footer?.text || '', iconURL: e.footer?.icon_url || e.footer?.iconURL || '' },
          thumbnail: e.thumbnail?.url || '',
          image: e.image?.url || '',
          timestamp: !!e.timestamp,
          fields: (e.fields || []).map(f => ({ name: f.name, value: f.value, inline: !!f.inline })),
          buttons: []
        };
        store.setDraft(interaction.user.id, draft);
        return interaction.reply({
          content: '✅ JSON importado! Continue editando:',
          embeds: [buildEmbedFromDraft(draft)],
          components: builderControls(),
          ephemeral: true
        });
      } catch (err) {
        return interaction.reply({ content: '❌ JSON inválido. Verifique a formatação.', ephemeral: true });
      }
    }
  }
};
