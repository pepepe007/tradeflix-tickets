const { Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType, ChannelSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const store = require('../utils/embedStore');
const embedCmd = require('../commands/embed');

const PREFIX = 'eb_';

// Cache em memória pra resposta instantânea (sincroniza com arquivo no background)
const draftCache = new Map();

function getDraftFast(userId) {
  if (draftCache.has(userId)) return draftCache.get(userId);
  const d = store.getDraft(userId);
  if (d) draftCache.set(userId, d);
  return d;
}

function saveDraft(userId, draft) {
  draftCache.set(userId, draft);
  // I/O em background, não bloqueia
  setImmediate(() => store.setDraft(userId, draft));
}

function clearDraftFast(userId) {
  draftCache.delete(userId);
  setImmediate(() => store.clearDraft(userId));
}

async function refreshPreview(interaction, draft, extraContent) {
  const embed = embedCmd.buildEmbedFromDraft(draft);
  const components = embedCmd.builderControls();
  return interaction.editReply({
    content: extraContent || '🎨 **Construtor de Embed** — clique nos botões abaixo para customizar.',
    embeds: [embed],
    components
  }).catch(() => {});
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // FILTRO: só processa interações do embed builder
    if (!interaction.customId?.startsWith(PREFIX)) return;

    try {
      // ===== BOTÕES =====
      if (interaction.isButton()) {
        const id = interaction.customId;

        // === Modais que NÃO precisam de validação prévia (showModal direto, instantâneo) ===
        const modaisDirectos = {
          eb_edit_main: () => {
            const d = getDraftFast(interaction.user.id) || embedCmd.draftPadrao();
            const m = new ModalBuilder().setCustomId('eb_modal_main').setTitle('Editar Título e Descrição');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Título (máx 256)').setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(false).setValue(d.title || '')),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url').setLabel('URL do título (opcional)').setStyle(TextInputStyle.Short).setRequired(false).setValue(d.url || '')),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Descrição (máx 4000)').setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(false).setValue(d.description || ''))
            );
            return m;
          },
          eb_edit_author: () => {
            const d = getDraftFast(interaction.user.id) || embedCmd.draftPadrao();
            const m = new ModalBuilder().setCustomId('eb_modal_author').setTitle('Editar Autor');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Nome do autor').setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(false).setValue(d.author?.name || '')),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('iconURL').setLabel('URL do ícone').setStyle(TextInputStyle.Short).setRequired(false).setValue(d.author?.iconURL || '')),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url').setLabel('URL clicável').setStyle(TextInputStyle.Short).setRequired(false).setValue(d.author?.url || ''))
            );
            return m;
          },
          eb_edit_footer: () => {
            const d = getDraftFast(interaction.user.id) || embedCmd.draftPadrao();
            const m = new ModalBuilder().setCustomId('eb_modal_footer').setTitle('Editar Footer');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text').setLabel('Texto do footer').setStyle(TextInputStyle.Paragraph).setMaxLength(2048).setRequired(false).setValue(d.footer?.text || '')),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('iconURL').setLabel('URL do ícone do footer').setStyle(TextInputStyle.Short).setRequired(false).setValue(d.footer?.iconURL || ''))
            );
            return m;
          },
          eb_edit_images: () => {
            const d = getDraftFast(interaction.user.id) || embedCmd.draftPadrao();
            const m = new ModalBuilder().setCustomId('eb_modal_images').setTitle('Editar Imagens');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('thumbnail').setLabel('Thumbnail (canto sup. direito)').setStyle(TextInputStyle.Short).setRequired(false).setValue(d.thumbnail || '')),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('image').setLabel('Imagem grande (banner)').setStyle(TextInputStyle.Short).setRequired(false).setValue(d.image || ''))
            );
            return m;
          },
          eb_edit_color: () => {
            const d = getDraftFast(interaction.user.id) || embedCmd.draftPadrao();
            const m = new ModalBuilder().setCustomId('eb_modal_color').setTitle('Editar Cor');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Cor hex (ex: #A020F0)').setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(true).setValue(d.color || '#A020F0'))
            );
            return m;
          },
          eb_field_add: () => {
            const m = new ModalBuilder().setCustomId('eb_modal_field_add').setTitle('Adicionar Field');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Nome do field (máx 256)').setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(true)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('value').setLabel('Valor (máx 1024)').setStyle(TextInputStyle.Paragraph).setMaxLength(1024).setRequired(true)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('inline').setLabel('Inline? (sim/nao)').setStyle(TextInputStyle.Short).setMaxLength(3).setRequired(false).setValue('nao'))
            );
            return m;
          },
          eb_field_remove: () => {
            const d = getDraftFast(interaction.user.id);
            const max = d?.fields?.length || 0;
            const m = new ModalBuilder().setCustomId('eb_modal_field_remove').setTitle('Remover Field');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('index').setLabel(`Número (1 a ${max || 1}) ou "all"`).setStyle(TextInputStyle.Short).setRequired(true))
            );
            return m;
          },
          eb_btn_add: () => {
            const m = new ModalBuilder().setCustomId('eb_modal_btn_add').setTitle('Adicionar Botão Link');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('label').setLabel('Texto do botão (máx 80)').setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(true)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('url').setLabel('URL (https://...)').setStyle(TextInputStyle.Short).setRequired(true)),
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('emoji').setLabel('Emoji (opcional)').setStyle(TextInputStyle.Short).setRequired(false))
            );
            return m;
          },
          eb_btn_remove: () => {
            const d = getDraftFast(interaction.user.id);
            const max = d?.buttons?.length || 0;
            const m = new ModalBuilder().setCustomId('eb_modal_btn_remove').setTitle('Remover Botão');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('index').setLabel(`Número (1 a ${max || 1}) ou "all"`).setStyle(TextInputStyle.Short).setRequired(true))
            );
            return m;
          },
          eb_save_template: () => {
            const m = new ModalBuilder().setCustomId('eb_modal_save').setTitle('Salvar Template');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nome').setLabel('Nome (sem espaços)').setStyle(TextInputStyle.Short).setMaxLength(50).setRequired(true))
            );
            return m;
          },
          eb_import_json: () => {
            const m = new ModalBuilder().setCustomId('eb_modal_import').setTitle('Importar JSON');
            m.addComponents(
              new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('json').setLabel('Cole o JSON aqui').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
            return m;
          }
        };

        if (modaisDirectos[id]) {
          // showModal IMEDIATAMENTE — antes de qualquer I/O
          const modal = modaisDirectos[id]();
          return interaction.showModal(modal).catch(err => {
            console.error('Erro ao abrir modal:', err.message);
          });
        }

        // === Ações que precisam de defer ===
        if (id === 'eb_toggle_timestamp') {
          await interaction.deferUpdate().catch(() => {});
          let draft = getDraftFast(interaction.user.id);
          if (!draft) {
            return interaction.editReply({ content: '⚠️ Sessão expirada. Use `/embed criar` novamente.', embeds: [], components: [] });
          }
          draft.timestamp = !draft.timestamp;
          saveDraft(interaction.user.id, draft);
          return refreshPreview(interaction, draft, `🕐 Timestamp: **${draft.timestamp ? 'ATIVADO' : 'DESATIVADO'}**`);
        }

        if (id === 'eb_reset') {
          await interaction.deferUpdate().catch(() => {});
          const draft = embedCmd.draftPadrao();
          saveDraft(interaction.user.id, draft);
          return refreshPreview(interaction, draft, '🧹 Embed resetado.');
        }

        if (id === 'eb_export_json') {
          await interaction.deferReply({ ephemeral: true }).catch(() => {});
          const draft = getDraftFast(interaction.user.id);
          if (!draft) return interaction.editReply({ content: '⚠️ Sessão expirada.' });
          const exportObj = {
            embeds: [{
              title: draft.title || undefined,
              description: draft.description || undefined,
              url: draft.url || undefined,
              color: parseInt((draft.color || '#A020F0').replace('#', ''), 16),
              author: draft.author?.name ? { name: draft.author.name, icon_url: draft.author.iconURL || undefined, url: draft.author.url || undefined } : undefined,
              footer: draft.footer?.text ? { text: draft.footer.text, icon_url: draft.footer.iconURL || undefined } : undefined,
              thumbnail: draft.thumbnail ? { url: draft.thumbnail } : undefined,
              image: draft.image ? { url: draft.image } : undefined,
              timestamp: draft.timestamp ? new Date().toISOString() : undefined,
              fields: draft.fields?.length ? draft.fields : undefined
            }]
          };
          const json = JSON.stringify(exportObj, null, 2);
          const file = new AttachmentBuilder(Buffer.from(json), { name: 'embed.json' });
          return interaction.editReply({ content: '📋 JSON exportado (compatível com Discohook):', files: [file] });
        }

        if (id === 'eb_send') {
          const draft = getDraftFast(interaction.user.id);
          if (!draft) {
            return interaction.reply({ content: '⚠️ Sessão expirada.', ephemeral: true }).catch(() => {});
          }

          // Caso edição de mensagem existente
          if (draft._editingMessageId && draft._editingChannelId) {
            await interaction.deferUpdate().catch(() => {});
            const ch = await interaction.guild.channels.fetch(draft._editingChannelId).catch(() => null);
            const msg = ch ? await ch.messages.fetch(draft._editingMessageId).catch(() => null) : null;
            if (!msg) return interaction.editReply({ content: '❌ Mensagem original não encontrada.', embeds: [], components: [] });
            const newEmbed = embedCmd.buildEmbedFromDraft(draft);
            const newButtons = embedCmd.buildButtonsFromDraft(draft);
            await msg.edit({ embeds: [newEmbed], components: newButtons }).catch(() => null);
            clearDraftFast(interaction.user.id);
            return interaction.editReply({ content: `✅ Mensagem atualizada → [ver](${msg.url})`, embeds: [], components: [] });
          }

          // Caso normal: escolher canal
          const select = new ChannelSelectMenuBuilder()
            .setCustomId('eb_select_channel')
            .setPlaceholder('Selecione o canal de destino...')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);
          const row = new ActionRowBuilder().addComponents(select);
          return interaction.reply({ content: '📤 Selecione o canal onde o embed será enviado:', components: [row], ephemeral: true }).catch(() => {});
        }
      }

      // ===== SELECT DE CANAL =====
      if (interaction.isChannelSelectMenu?.() && interaction.customId === 'eb_select_channel') {
        await interaction.deferUpdate().catch(() => {});
        const draft = getDraftFast(interaction.user.id);
        if (!draft) return interaction.editReply({ content: '⚠️ Sessão expirada.', components: [] });
        const canal = interaction.channels.first();
        if (!canal) return interaction.editReply({ content: '❌ Canal inválido.', components: [] });
        const embed = embedCmd.buildEmbedFromDraft(draft);
        const buttons = embedCmd.buildButtonsFromDraft(draft);
        const sent = await canal.send({ embeds: [embed], components: buttons }).catch(() => null);
        if (!sent) return interaction.editReply({ content: '❌ Falha ao enviar (verifique permissões).', components: [] });
        clearDraftFast(interaction.user.id);
        return interaction.editReply({ content: `✅ Enviado em ${canal} → [ver mensagem](${sent.url})`, components: [] });
      }

      // ===== SUBMISSÃO DE MODAIS =====
      if (interaction.isModalSubmit()) {
        await interaction.deferUpdate().catch(() => {});
        let draft = getDraftFast(interaction.user.id);
        if (!draft) {
          draft = embedCmd.draftPadrao();
        }

        const id = interaction.customId;
        const get = (k) => { try { return interaction.fields.getTextInputValue(k).trim(); } catch { return ''; } };

        if (id === 'eb_modal_main') {
          draft.title = get('title');
          draft.url = get('url');
          draft.description = get('description');
        } else if (id === 'eb_modal_author') {
          draft.author = { name: get('name'), iconURL: get('iconURL'), url: get('url') };
        } else if (id === 'eb_modal_footer') {
          draft.footer = { text: get('text'), iconURL: get('iconURL') };
        } else if (id === 'eb_modal_images') {
          draft.thumbnail = get('thumbnail');
          draft.image = get('image');
        } else if (id === 'eb_modal_color') {
          let cor = get('color');
          if (!cor.startsWith('#')) cor = '#' + cor;
          if (!/^#[0-9A-Fa-f]{6}$/.test(cor)) {
            await interaction.followUp({ content: '❌ Cor inválida. Use hex (ex: #A020F0).', ephemeral: true }).catch(() => {});
            return;
          }
          draft.color = cor;
        } else if (id === 'eb_modal_field_add') {
          const inline = get('inline').toLowerCase();
          draft.fields = draft.fields || [];
          if (draft.fields.length >= 25) {
            await interaction.followUp({ content: '❌ Máximo de 25 fields.', ephemeral: true }).catch(() => {});
            return;
          }
          draft.fields.push({ name: get('name'), value: get('value'), inline: ['sim','s','yes','y','true','1'].includes(inline) });
        } else if (id === 'eb_modal_field_remove') {
          const v = get('index').toLowerCase();
          if (v === 'all') draft.fields = [];
          else {
            const i = parseInt(v) - 1;
            if (!isNaN(i) && i >= 0 && i < (draft.fields?.length || 0)) draft.fields.splice(i, 1);
          }
        } else if (id === 'eb_modal_btn_add') {
          draft.buttons = draft.buttons || [];
          if (draft.buttons.length >= 25) {
            await interaction.followUp({ content: '❌ Máximo de 25 botões.', ephemeral: true }).catch(() => {});
            return;
          }
          draft.buttons.push({ label: get('label'), url: get('url'), emoji: get('emoji') || null });
        } else if (id === 'eb_modal_btn_remove') {
          const v = get('index').toLowerCase();
          if (v === 'all') draft.buttons = [];
          else {
            const i = parseInt(v) - 1;
            if (!isNaN(i) && i >= 0 && i < (draft.buttons?.length || 0)) draft.buttons.splice(i, 1);
          }
        } else if (id === 'eb_modal_save') {
          const nome = get('nome').replace(/\s+/g, '-');
          if (!nome) {
            await interaction.followUp({ content: '❌ Nome inválido.', ephemeral: true }).catch(() => {});
            return;
          }
          const tplData = { ...draft };
          delete tplData._editingMessageId;
          delete tplData._editingChannelId;
          store.saveTemplate(nome, tplData);
          await interaction.followUp({ content: `💾 Template \`${nome}\` salvo!`, ephemeral: true }).catch(() => {});
        } else if (id === 'eb_modal_import') {
          try {
            const parsed = JSON.parse(get('json'));
            const e = parsed.embeds?.[0] || parsed;
            Object.assign(draft, embedCmd.draftPadrao(), {
              title: e.title || '',
              description: e.description || '',
              color: typeof e.color === 'number' ? '#' + e.color.toString(16).padStart(6, '0') : (e.color || '#A020F0'),
              url: e.url || '',
              author: { name: e.author?.name || '', iconURL: e.author?.icon_url || e.author?.iconURL || '', url: e.author?.url || '' },
              footer: { text: e.footer?.text || '', iconURL: e.footer?.icon_url || e.footer?.iconURL || '' },
              thumbnail: e.thumbnail?.url || '',
              image: e.image?.url || '',
              timestamp: !!e.timestamp,
              fields: (e.fields || []).map(f => ({ name: f.name, value: f.value, inline: !!f.inline }))
            });
          } catch {
            await interaction.followUp({ content: '❌ JSON inválido.', ephemeral: true }).catch(() => {});
            return;
          }
        }

        saveDraft(interaction.user.id, draft);
        return refreshPreview(interaction, draft);
      }
    } catch (err) {
      console.error('❌ Erro em embedInteractions:', err.message);
    }
  }
};
