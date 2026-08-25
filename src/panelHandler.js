const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const { get, run } = require('./utils/database');
const { createBackup, listBackups, deleteBackup } = require('./utils/backupManager');
const { panelEmbed, ensureSettings } = require('./commands/panel');

async function handlePanelInteraction(interaction) {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return false;
  const id = interaction.customId || '';
  if (!id.startsWith('sr_')) return false;

  const settings = await ensureSettings(interaction.guildId);

  if (id === 'sr_panel_menu') {
    const value = interaction.values[0];
    if (value === 'backup') {
      return interaction.update({
        embeds: [new EmbedBuilder().setTitle('💾 Backup').setDescription('Dùng các nút bên dưới để quản lý backup.')],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('sr_backup_create').setLabel('Tạo Backup').setEmoji('💾').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('sr_backup_list').setLabel('Danh sách').setEmoji('📋').setStyle(ButtonStyle.Secondary)
        )]
      });
    }
    if (value === 'auto') {
      return interaction.update({
        embeds: [new EmbedBuilder().setTitle('🔄 Auto Backup').setDescription(`Trạng thái: ${settings.auto_backup ? '🟢 Bật' : '🔴 Tắt'}\nChu kỳ: **${settings.interval_minutes} phút**`)],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('sr_auto_toggle').setLabel(settings.auto_backup ? 'Tắt Auto Backup' : 'Bật Auto Backup').setStyle(settings.auto_backup ? ButtonStyle.Danger : ButtonStyle.Success),
          new ButtonBuilder().setCustomId('sr_auto_interval').setLabel('Đổi chu kỳ').setStyle(ButtonStyle.Primary)
        )]
      });
    }
    if (value === 'limit') {
      return interaction.update({
        embeds: [new EmbedBuilder().setTitle('📦 Giới hạn Backup').setDescription(`Hiện tại: **${settings.max_backups} backup**`)],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sr_limit').setLabel('Đổi giới hạn').setStyle(ButtonStyle.Primary))]
      });
    }
    if (value === 'logs') {
      return interaction.update({
        embeds: [new EmbedBuilder().setTitle('📜 Kênh Logs').setDescription(settings.log_channel_id ? `Kênh hiện tại: <#${settings.log_channel_id}>` : 'Chưa cấu hình kênh logs.')],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sr_logs').setLabel('Đặt kênh logs').setStyle(ButtonStyle.Primary))]
      });
    }
    return interaction.update({ embeds: [panelEmbed(interaction.guild, settings)], components: [] });
  }

  if (id === 'sr_backup_create') {
    await interaction.deferReply({ ephemeral: true });
    const backup = await createBackup(interaction.guild, interaction.user);
    return interaction.editReply(`✅ Đã tạo backup **${backup.id}**.`);
  }

  if (id === 'sr_backup_list') {
    const backups = await listBackups(interaction.guildId);
    const text = backups.length ? backups.slice(0, 15).map(b => `• **${b.id}** — <t:${Math.floor(new Date(b.created_at).getTime() / 1000)}:R>`).join('\n') : 'Chưa có backup nào.';
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('📋 Danh sách Backup').setDescription(text)], ephemeral: true });
  }

  if (id === 'sr_backup_info') {
    return interaction.reply({ embeds: [panelEmbed(interaction.guild, settings)], ephemeral: true });
  }

  if (id === 'sr_auto_toggle') {
    await run(`UPDATE settings SET auto_backup = ? WHERE guild_id = ?`, [settings.auto_backup ? 0 : 1, interaction.guildId]);
    const next = await get(`SELECT * FROM settings WHERE guild_id = ?`, [interaction.guildId]);
    return interaction.update({ embeds: [panelEmbed(interaction.guild, next)], components: [] });
  }

  if (id === 'sr_auto_interval' || id === 'sr_limit' || id === 'sr_logs') {
    const modal = new ModalBuilder().setCustomId(`${id}_modal`).setTitle(id === 'sr_logs' ? '📜 Kênh Logs' : id === 'sr_limit' ? '📦 Giới hạn Backup' : '⏱️ Chu kỳ Auto Backup');
    const input = new TextInputBuilder().setCustomId('value').setLabel(id === 'sr_logs' ? 'ID kênh Discord' : id === 'sr_limit' ? 'Số backup tối đa' : 'Số phút').setStyle(TextInputStyle.Short).setRequired(true);
    return interaction.showModal(modal.addComponents(new ActionRowBuilder().addComponents(input)));
  }

  if (id.endsWith('_modal')) {
    const value = interaction.fields.getTextInputValue('value').trim();
    if (id === 'sr_auto_interval_modal') {
      const minutes = Number(value);
      if (!Number.isInteger(minutes) || minutes < 1) return interaction.reply({ content: '❌ Số phút không hợp lệ.', ephemeral: true });
      await run(`UPDATE settings SET interval_minutes = ? WHERE guild_id = ?`, [minutes, interaction.guildId]);
    } else if (id === 'sr_limit_modal') {
      const limit = Number(value);
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) return interaction.reply({ content: '❌ Giới hạn phải từ 1 đến 1000.', ephemeral: true });
      await run(`UPDATE settings SET max_backups = ? WHERE guild_id = ?`, [limit, interaction.guildId]);
    } else if (id === 'sr_logs_modal') {
      const channel = interaction.guild.channels.cache.get(value);
      if (!channel || !channel.isTextBased()) return interaction.reply({ content: '❌ ID kênh không hợp lệ.', ephemeral: true });
      await run(`UPDATE settings SET log_channel_id = ? WHERE guild_id = ?`, [channel.id, interaction.guildId]);
    }
    const next = await get(`SELECT * FROM settings WHERE guild_id = ?`, [interaction.guildId]);
    return interaction.reply({ embeds: [panelEmbed(interaction.guild, next)], ephemeral: true });
  }

  return false;
}

module.exports = { handlePanelInteraction };
