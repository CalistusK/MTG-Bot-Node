const Discord = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const auth = require('./auth.json');
const config = require('./config.json');

const client = new Discord.Client();

axios.defaults.baseURL = 'https://api.scryfall.com/cards';

function buildCardPrice(cards, query, isArray) {
  let card;

  if (isArray) {
    card = cards.find(item => item.name.toLowerCase() === query.toLowerCase());

    if (!card) {
      card = cards[0];
    }
  } else {
    card = cards;
  }

  const name = card.name;

  if (!card.prices.usd && !card.prices.usd_foil) {
    return `No USD price found for ${name}`;
  }

  const price = !card.prices.usd
    ? `${card.prices.usd_foil} (foil)`
    : Math.min(...[card.prices.usd, card.prices.usd_foil].filter(Boolean));

  return `${name} (${card.set.toUpperCase()}) ~ $${price}`;
}

function buildCardInfo(card) {
  const cardInfo = [];
  const faces = card.card_faces ? card.card_faces : [card];
  faces.forEach((face) => {
    if (face.mana_cost) {
      cardInfo.push(`${face.name} - ${emojify(face.mana_cost)}`);
    } else {
      cardInfo.push(face.name);
    }

    cardInfo.push('```');
    cardInfo.push(face.type_line);

    if (face.oracle_text) {
      cardInfo.push(face.oracle_text);
    }

    if (face.power) {
      cardInfo.push(`${face.power}\\${face.toughness}`);
    }

    if (face.loyalty) {
      cardInfo.push(`Loyalty: ${face.loyalty}`);
    }

    cardInfo.push('```');
  });

  return cardInfo.join('\n');
}

function emojify(cost) {
  const alteredCost = cost.replace(/[{}]/g, '');
  const manaCount = /\d/.test(alteredCost) ? /\d+/.exec(alteredCost)[0] : null;
  let manaTypes = /\D/.test(alteredCost) ? /\D+/.exec(alteredCost)[0] : null;

  if (!manaTypes) return manaCount;

  manaTypes = manaTypes.replace(/W/g, ':white_circle:');
  manaTypes = manaTypes.replace(/U/g, ':large_blue_circle:');
  manaTypes = manaTypes.replace(/B/g, ':black_circle:');
  manaTypes = manaTypes.replace(/R/g, ':red_circle:');
  manaTypes = manaTypes.replace(/G/g, ':evergreen_tree:');

  if (!manaCount) return manaTypes;

  return `${manaCount} ${manaTypes}`;
}

function searchCard(args, channel) {
  let cardInfo;
  axios.get('/named', {
    params: {
      fuzzy: args.join(' '),
    },
  })
    .then((response) => {
      cardInfo = buildCardInfo(response.data);
    })
    .then(() => {
      channel.send(cardInfo);
    })
    .catch((err) => {
      console.log(err);
      channel.send('Something went wrong while trying to find this card. :(');
    });
}

function searchCardPrice(args, channel) {
  let cardPrice;
  axios.get('/search', {
    params: {
      dir: 'asc',
      order: 'usd',
      q: args.join(' '),
    },
  })
    .then((response) => {
      cardPrice = buildCardPrice(response.data.data, args.join(' '), true);
    })
    .then(() => {
      channel.send(cardPrice);
    })
    .catch((err) => {
      console.log(err)
      channel.send('Something went wrong while trying to find this card. :(');
    });
}

function searchCardSetPrice(args, channel) {
  let cardPrice;
  axios.get('/named', {
    params: {
      set: args[0],
      fuzzy: args.slice(1).join(' '),
    },
  })
    .then((response) => {
      cardPrice = buildCardPrice(response.data, args.join(' '), false);
    })
    .then(() => {
      channel.send(cardPrice);
    })
    .catch((err) => {
      console.log(err);
      channel.send('Something went wrong while trying to find this card. :(');
    });
}

function handleMessage(message) {
  if (message.author.bot) return;
  if (message.content.indexOf(config.prefix) !== 0) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  switch (command) {
    case 'c':
      searchCard(args, message.channel);
      break;
    case 'p':
      searchCardPrice(args, message.channel);
      break;
    case 'ps':
      searchCardSetPrice(args, message.channel);
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
