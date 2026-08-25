const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { get, run } = require('../utils/database');

const menu = new StringSelectMenuBuilder()
  .setCustomId('sr_panel_menu')
  .setPlaceholder('⚙️ Chọn nhóm cài đặt...')
  .addOptions(
    { label: 'Backup', description: 'Tạo, xem, tải và xóa backup', value: 'backup', emoji: '💾' },
    { label: 'Auto Backup', description: 'Bật/tắt và chỉnh chu kỳ tự động', value: 'auto', emoji: '🔄' },
    { label: 'Giới hạn Backup', description: 'Số lượng backup tối đa', value: 'limit', emoji: '📦' },
    { label: 'Kênh Logs', description: 'Chọn kênh nhận nhật ký', value: 'logs', emoji: '📜' },
    { label: 'Thông tin', description: 'Xem trạng thái hệ thống', value: 'info', emoji: 'ℹ️' }
  );

function panelEmbed(guild, settings) {
  const auto = settings?.auto_backup !== 0;
  return new EmbedBuilder()
    .setTitle('☁️ SkyRush Backup — Control Panel')
    .setDescription('Quản lý toàn bộ hệ thống backup của server tại đây.\n\nChọn một mục bên dưới để mở cài đặt tương ứng.')
    .addFields(
      { name: '🔄 Auto Backup', value: auto ? '🟢 Đang bật' : '🔴 Đang tắt', inline: true },
      { name: '⏱️ Chu kỳ', value: `${settings?.interval_minutes ?? 60} phút`, inline: true },
      { name: '📦 Giới hạn', value: `${settings?.max_backups ?? 20} backup`, inline: true },
      { name: '📜 Logs', value: settings?.log_channel_id ? `<#${settings.log_channel_id}>` : 'Chưa đặt', inline: true }
    )
    .setFooter({ text: `SkyRush Backup • ${guild.name}` });
}

async function ensureSettings(guildId) {
  await run(`INSERT OR IGNORE INTO settings (guild_id) VALUES (?)`, [guildId]);
  return get(`SELECT * FROM settings WHERE guild_id = ?`, [guildId]);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Mở bảng điều khiển SkyRush Backup')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const settings = await ensureSettings(interaction.guildId);
    const row = new ActionRowBuilder().addComponents(menu);
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('sr_backup_create').setLabel('Tạo Backup').setEmoji('💾').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('sr_backup_list').setLabel('Danh sách').setEmoji('📋').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('sr_backup_info').setLabel('Trạng thái').setEmoji('📊').setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({ embeds: [panelEmbed(interaction.guild, settings)], components: [row, buttons] });
  }
};

module.exports.panelEmbed = panelEmbed;
module.exports.ensureSettings = ensureSettings;
