const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverpassword')
    .setDescription('Đặt hoặc đổi mật khẩu xóa trắng server (chỉ Owner)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ Chỉ chủ server mới được đặt mật khẩu.', flags: 64 });
    }
    const modal = new ModalBuilder().setCustomId('sr_set_clear_password').setTitle('🔐 Mật khẩu Server Clear');
    const input = new TextInputBuilder()
      .setCustomId('password')
      .setLabel('Mật khẩu mới (tối thiểu 6 ký tự)')
      .setStyle(TextInputStyle.Short)
      .setMinLength(6)
      .setMaxLength(100)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }
};