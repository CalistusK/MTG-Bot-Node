const Discord = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const auth = require('./auth.json');
const config = require('./config.json');

const client = new Discord.Client();

axios.defaults.baseURL = 'https://api.scryfall.com/cards';

async function searchCard(args, channel) {
  let message = '```';
  let faces = [];

  axios.get('/named', {
    params: {
      fuzzy: args.join(' '),
    },
  })
    .then(async (response) => {
      faces = response.data.card_faces ? response.data.card_faces : [response.data];
      faces.forEach((face) => {
        message += `${face.name}`;
        message += face.mana_cost ? ` ${face.mana_cost}\n` : '\n';
        message += `${face.type_line}\n`;
        message += face.oracle_text ? `${face.oracle_text}\n` : '';
        message += face.power ? `${face.power}\\${face.toughness}\n` : '';
        message += face.loyalty ? `Loyalty: ${face.loyalty}` : '';
        message += faces.length > 1 ? '\n' : '';
      });

      message += '```';

      await channel.send(message);
    })
    .catch(async () => {
      await channel.send('Something went wrong while trying to find this card. :(');
    });
}

async function handleMessage(message) {
  if (message.author.bot) return;
  if (message.content.indexOf(config.prefix) !== 0) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  switch (command) {
    case 'c':
      searchCard(args, message.channel);
      break;
    case 'cs':
      console.log('Searching for a set card...');
      break;
    case 'p':
      console.log('Searching for price...');
      break;
    case 'ps':
      console.log('Searching for ???');
      break;
    case 'r':
      console.log('Searching for rulings...');
      break;
    default:
      console.log('I\'m not sure what this command does.');
      break;
  }
}

client.on('ready', () => {
  console.log('Ready.');
});

client.on('message', async (message) => {
  handleMessage(message);
});


client.login(auth.token);
