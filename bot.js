const { Client, GatewayIntentBits, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  try {
    const channel = await client.channels.fetch(process.env.CHANNEL_ID);
    if (!channel) return console.error('Assistance channel not found!');

    // Clear previous bot messages in the channel if desired, or just post a new one
    const embed = new EmbedBuilder()
      .setTitle('🌴 Florida State Roleplay — Support Tickets')
      .setDescription('Need assistance? Select a support category from the dropdown menu below to open your ticket on our portal.')
      .setColor(0x38bdf8)
      .setFooter({ text: 'Florida State Roleplay Ticketing System' });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ticket_category_select')
        .setPlaceholder('Choose a ticket category...')
        .addOptions([
          {
            label: 'General Support',
            description: 'General questions or assistance',
            value: 'General Support',
            emoji: '🎫'
          },
          {
            label: 'High Rank Support',
            description: 'Inquiries requiring high-rank attention',
            value: 'High Rank Support',
            emoji: '⭐'
          },
          {
            label: 'Ownership Support',
            description: 'Direct inquiries for ownership',
            value: 'Ownership Support',
            emoji: '👑'
          },
          {
            label: 'Player Report',
            description: 'Report a rule breaker or issue',
            value: 'Player Report',
            emoji: '🛡️'
          }
        ])
    );

    // Send the persistent ticket panel
    await channel.send({ embeds: [embed], components: [row] });
    console.log('Ticket panel posted successfully!');
  } catch (error) {
    console.error('Error posting ticket panel:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId === 'ticket_category_select') {
    const selectedCategory = interaction.values[0];
    const encodedCategory = encodeURIComponent(selectedCategory);
    const targetUrl = `${WEB_URL}/tickets?category=${encodedCategory}`;

    await interaction.reply({
      content: `Click the link below to open your **${selectedCategory}** ticket on our website:\n👉 ${targetUrl}`,
      ephemeral: true // Only visible to the user who clicked it
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
