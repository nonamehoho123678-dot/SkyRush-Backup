const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { get, run } = require('../utils/database');
const { createBackup, listBackups, deleteBackup } = require('../utils/backupManager');

async function settings(guildId) {
  await run(`INSERT OR IGNORE INTO settings (guild_id) VALUES (?)`, [guildId]);
  return get(`SELECT * FROM settings WHERE guild_id = ?`, [guildId]);
}

function home(guild, s) {
  return new EmbedBuilder()
    .setTitle('☁️ SkyRush Backup — Control Panel')
    .setDescription('Quản lý toàn bộ hệ thống backup của server tại đây.')
    .addFields(
      { name: '🔄 Auto Backup', value: s.auto_backup ? '🟢 Bật' : '🔴 Tắt', inline: true },
      { name: '⏱️ Chu kỳ', value: `${s.interval_minutes} phút`, inline: true },
      { name: '📦 Giới hạn', value: `${s.max_backups} backup`, inline: true },
      { name: '📜 Logs', value: s.log_channel_id ? `<#${s.log_channel_id}>` : 'Chưa đặt', inline: true }
    )
    .setFooter({ text: `SkyRush Backup • ${guild.name}` });
}

function menu() {
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
    .setCustomId('sr_panel_menu').setPlaceholder('⚙️ Chọn nhóm cài đặt...')
    .addOptions(
      { label: 'Backup', description: 'Tạo, xem và xóa backup', value: 'backup', emoji: '💾' },
      { label: 'Auto Backup', description: 'Bật/tắt và chỉnh chu kỳ', value: 'auto', emoji: '🔄' },
      { label: 'Giới hạn Backup', description: 'Chỉnh số backup tối đa', value: 'limit', emoji: '📦' },
      { label: 'Kênh Logs', description: 'Chọn kênh nhận nhật ký', value: 'logs', emoji: '📜' },
      { label: 'Thông tin', description: 'Xem trạng thái hệ thống', value: 'info', emoji: 'ℹ️' }
    ));
}

async function refresh(interaction) {
  const s = await settings(interaction.guildId);
  await interaction.update({ embeds: [home(interaction.guild, s)], components: [menu(), buttons()] });
}

function buttons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sr_backup_create').setLabel('Tạo Backup').setEmoji('💾').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('sr_backup_list').setLabel('Danh sách').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('sr_backup_info').setLabel('Trạng thái').setEmoji('📊').setStyle(ButtonStyle.Secondary)
  );
}

async function handle(interaction) {
  if (!interaction.customId.startsWith('sr_')) return false;
  if (!interaction.guild) return true;
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: '❌ Bạn cần quyền **Quản lý máy chủ**.', ephemeral: true });
    return true;
  }

  const id = interaction.customId;

  if (id === 'sr_panel_menu') {
    const value = interaction.values[0];
    if (value === 'backup') {
      const rows = await listBackups(interaction.guildId);
      const text = rows.length ? rows.slice(0, 10).map(x => `• \`${x.id}\` — <t:${Math.floor(new Date(x.created_at).getTime()/1000)}:R>`).join('\n') : 'Chưa có backup.';
      await interaction.update({ embeds: [new EmbedBuilder().setTitle('💾 Backup').setDescription(text)], components: [menu(), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sr_backup_create').setLabel('Tạo Backup').setEmoji('💾').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('sr_backup_delete').setLabel('Xóa Backup').setEmoji('🗑️').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('sr_panel_home').setLabel('Trang chính').setStyle(ButtonStyle.Secondary))] });
    } else if (value === 'auto') {
      const s = await settings(interaction.guildId);
      await interaction.update({ embeds: [new EmbedBuilder().setTitle('🔄 Auto Backup').setDescription(`Trạng thái: **${s.auto_backup ? 'Bật' : 'Tắt'}**\nChu kỳ hiện tại: **${s.interval_minutes} phút**`)], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sr_auto_toggle').setLabel(s.auto_backup ? 'Tắt Auto Backup' : 'Bật Auto Backup').setStyle(s.auto_backup ? ButtonStyle.Danger : ButtonStyle.Success), new ButtonBuilder().setCustomId('sr_auto_interval').setLabel('Đổi chu kỳ').setStyle(ButtonStyle.Primary)), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sr_panel_home').setLabel('Trang chính').setStyle(ButtonStyle.Secondary))] });
    } else if (value === 'limit') {
      const modal = new ModalBuilder().setCustomId('sr_limit_modal').setTitle('📦 Giới hạn Backup');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('max').setLabel('Số backup tối đa (1–100)').setStyle(TextInputStyle.Short).setRequired(true).setValue(String((await settings(interaction.guildId)).max_backups))));
      await interaction.showModal(modal);
    } else if (value === 'logs') {
      await interaction.update({ embeds: [new EmbedBuilder().setTitle('📜 Kênh Logs').setDescription('Chọn kênh để nhận thông báo backup.')], components: [new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('sr_logs_channel').setPlaceholder('Chọn kênh logs').setChannelTypes(0)), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sr_logs_clear').setLabel('Xóa kênh Logs').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('sr_panel_home').setLabel('Trang chính').setStyle(ButtonStyle.Secondary))] });
    } else {
      const s = await settings(interaction.guildId);
      const rows = await listBackups(interaction.guildId);
      await interaction.update({ embeds: [new EmbedBuilder().setTitle('ℹ️ Thông tin hệ thống').addFields({ name: 'Backup', value: `${rows.length}/${s.max_backups}` }, { name: 'Auto Backup', value: s.auto_backup ? `Bật — ${s.interval_minutes} phút` : 'Tắt' }, { name: 'Logs', value: s.log_channel_id ? `<#${s.log_channel_id}>` : 'Chưa đặt' })], components: [menu(), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sr_panel_home').setLabel('Trang chính').setStyle(ButtonStyle.Secondary))] });
    }
    return true;
  }

  if (id === 'sr_panel_home') return refresh(interaction);
  if (id === 'sr_backup_info') {
    const s = await settings(interaction.guildId); const rows = await listBackups(interaction.guildId);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('📊 Trạng thái').setDescription(`Có **${rows.length}** backup.\nAuto Backup: **${s.auto_backup ? 'Bật' : 'Tắt'}**`)], ephemeral: true }); return true;
  }
  if (id === 'sr_backup_create') {
    await interaction.deferUpdate();
    const data = await createBackup(interaction.guild, interaction.user);
    const s = await settings(interaction.guildId);
    const { pruneBackups } = require('../utils/backupManager');
    await pruneBackups(interaction.guildId, s.max_backups);
    await interaction.editReply({ embeds: [home(interaction.guild, s), new EmbedBuilder().setDescription(`✅ Đã tạo backup **${data.id}**.`)], components: [menu(), buttons()] });
    return true;
  }
  if (id === 'sr_backup_list') {
    const rows = await listBackups(interaction.guildId);
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('📋 Danh sách Backup').setDescription(rows.length ? rows.slice(0, 20).map(x => `• \`${x.id}\``).join('\n') : 'Chưa có backup.')], ephemeral: true }); return true;
  }
  if (id === 'sr_auto_toggle') {
    const s = await settings(interaction.guildId); await run(`UPDATE settings SET auto_backup = ? WHERE guild_id = ?`, [s.auto_backup ? 0 : 1, interaction.guildId]); return refresh(interaction);
  }
  if (id === 'sr_auto_interval') {
    const modal = new ModalBuilder().setCustomId('sr_interval_modal').setTitle('⏱️ Chu kỳ Auto Backup');
    modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('minutes').setLabel('Số phút (5–10080)').setStyle(TextInputStyle.Short).setRequired(true).setValue(String((await settings(interaction.guildId)).interval_minutes))));
    await interaction.showModal(modal); return true;
  }
  if (id === 'sr_logs_channel') { await run(`UPDATE settings SET log_channel_id = ? WHERE guild_id = ?`, [interaction.values[0], interaction.guildId]); return refresh(interaction); }
  if (id === 'sr_logs_clear') { await run(`UPDATE settings SET log_channel_id = NULL WHERE guild_id = ?`, [interaction.guildId]); return refresh(interaction); }
  if (id === 'sr_backup_delete') {
    const rows = await listBackups(interaction.guildId);
    if (!rows.length) { await interaction.reply({ content: '❌ Chưa có backup để xóa.', ephemeral: true }); return true; }
    const select = new StringSelectMenuBuilder().setCustomId('sr_delete_select').setPlaceholder('Chọn backup cần xóa').addOptions(rows.slice(0, 25).map(x => ({ label: x.id, value: x.id })));
    await interaction.update({ components: [menu(), new ActionRowBuilder().addComponents(select), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('sr_panel_home').setLabel('Trang chính').setStyle(ButtonStyle.Secondary))] }); return true;
  }
  if (id === 'sr_delete_select') { await deleteBackup(interaction.values[0], interaction.guildId); return refresh(interaction); }
  return false;
}

async function handleModal(interaction) {
  if (!interaction.customId.startsWith('sr_')) return false;
  if (interaction.customId === 'sr_limit_modal') {
    const n = Number(interaction.fields.getTextInputValue('max')); if (!Number.isInteger(n) || n < 1 || n > 100) { await interaction.reply({ content: '❌ Nhập số từ 1 đến 100.', ephemeral: true }); return true; }
    await run(`UPDATE settings SET max_backups = ? WHERE guild_id = ?`, [n, interaction.guildId]); await interaction.reply({ content: `✅ Đã đặt giới hạn **${n}** backup.`, ephemeral: true }); return true;
  }
  if (interaction.customId === 'sr_interval_modal') {
    const n = Number(interaction.fields.getTextInputValue('minutes')); if (!Number.isInteger(n) || n < 5 || n > 10080) { await interaction.reply({ content: '❌ Nhập số phút từ 5 đến 10080.', ephemeral: true }); return true; }
    await run(`UPDATE settings SET interval_minutes = ? WHERE guild_id = ?`, [n, interaction.guildId]); await interaction.reply({ content: `✅ Chu kỳ Auto Backup: **${n} phút**.`, ephemeral: true }); return true;
  }
  return false;
}

module.exports = { handle, handleModal };
