const {
    EmbedBuilder
} = require("discord.js");


function createEmbed() {

    return new EmbedBuilder()

        .setColor("#5865F2")

        .setFooter({

            text: "⚡ SkyRush Backup"

        })

        .setTimestamp();

}



function successEmbed(title, description) {

    return createEmbed()

        .setColor("#57F287")

        .setTitle(`✅ ${title}`)

        .setDescription(description);

}



function errorEmbed(title, description) {

    return createEmbed()

        .setColor("#ED4245")

        .setTitle(`❌ ${title}`)

        .setDescription(description);

}



function infoEmbed(title, description) {

    return createEmbed()

        .setColor("#5865F2")

        .setTitle(`📦 ${title}`)

        .setDescription(description);

}



module.exports = {

    createEmbed,

    successEmbed,

    errorEmbed,

    infoEmbed

};