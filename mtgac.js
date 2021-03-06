/* eslint-disable no-console */
const Discord = require('discord.js');
const auth = require('./auth.json');
const config = require('./config.json');
const fs = require('fs');
const rp = require('request-promise');
const client = new Discord.Client();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function titlecase(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function emojify(cost, server) {
  if (!cost) return '';
  let i;
  let emocost = '';
  cost = cost.toLowerCase()
             .replace(/\{/g, 'mana')
             .replace(/\}/g, ' ')
             .replace(/\//g, '')
             .split(' ');
  for (i = 0; i < cost.length - 1; i++) {
    emocost += server.emojis.find(x => x.name === cost[i]);
  }
  return emocost;
}

function searchExact(results, searched) {
  for (let i = 0; i < results.total_cards; i++) {
    if (results.data[i].name.toLowerCase() === searched.toLowerCase()) {
      return results.data[i];
    }
  }
  return results.data[0];
}

function parseRulings(rulings) {
  var arrayRulings = [];
  rulings.filter(idx => idx.source !== 'wotc');
  for (let i = 0; i < rulings.length; i++) {
    config.rulingsDate ? arrayRulings.push(
                             '```\n' + rulings[i].published_at + '\n' +
                             rulings[i].comment + '```') :
                         arrayRulings.push('```\n' + rulings[i].comment + '```')
  }
  if (arrayRulings.join('\n').length <= 2000) {
    return arrayRulings.join('\n');
  } else {
    var rulingpart = '';
    var arrayRulingsBig = [];
    for (let i = 0; i < arrayRulings.length; i++) {
      //+2 to account for linebreak
      if (rulingpart.length + arrayRulings[i].length + 2 <= 2000) {
        rulingpart += arrayRulings[i] + '\n';
      } else {
        arrayRulingsBig.push(rulingpart.trim());
        rulingpart = '';
        i--;
      }
    }
    if (rulingpart !== '') {
      arrayRulingsBig.push(rulingpart.trim());
    }
    return arrayRulingsBig;
  }
}

client.on('message', async message => {
  if (message.author.bot) return;
  if (message.content.indexOf(config.prefix) !== 0) return;

  async function sendCardText(params) {
    rp(params)
        .then(async (cd) => {
          let buildMessage = [];
          let oracletext = '';
          let pt = '';
          let loyalty = '';

          if (cd.card_faces) {
            let otherHalfCost = '';
            let halves = [];

            if (cd.card_faces[1].mana_cost) otherHalfCost = ' // ' + emojify(cd.card_faces[1].mana_cost, message.guild);
            buildMessage.push(cd.card_faces[0].name + ' // ' + cd.card_faces[1].name);
            buildMessage.push(emojify(cd.card_faces[0].mana_cost, message.guild) + otherHalfCost);
            buildMessage.push(titlecase(cd.rarity) + ' (' + cd.set.toUpperCase() + ')');
            for (let i = 0; i < 2; i++)
            {
              let half = ['```\n'];
              loyalty = '';

              if (cd.card_faces[i].oracle_text) oracletext = cd.card_faces[i].oracle_text;
              if (cd.card_faces[i].power) pt = cd.card_faces[i].power + '/' + cd.card_faces[i].toughness;
              if (cd.card_faces[i].loyalty) loyalty = 'Loyalty: ' + cd.card_faces[i].loyalty;
              half.push(cd.card_faces[i].name + ' ' + cd.card_faces[i].mana_cost);
              half.push(cd.type_line);
              half.push(oracletext);
              half.push(pt);
              half.push('```' + loyalty);
              halves.push(half.join('\n'));
            }
            buildMessage.push(halves.join(''));
            await message.channel.send(buildMessage.join('\n'));
          } else {
            if (cd.oracle_text) oracletext = '```\n' + cd.oracle_text + '```';
            if (cd.power) pt = cd.power + '/' + cd.toughness;
            if (cd.loyalty) loyalty = 'Loyalty: ' + cd.loyalty;
            buildMessage.push(cd.name + ' ' + emojify(cd.mana_cost, message.guild));
            buildMessage.push(titlecase(cd.rarity) + ' (' + cd.set.toUpperCase() + ')');
            buildMessage.push(cd.type_line);
            buildMessage.push(oracletext + pt + loyalty);
            await message.channel.send(buildMessage.join('\n'));
          }
        })
        .catch(async (err) => {
          console.log(err)
        });
  }

  async function sendCardPrice(params) {
    rp(params)
        .then(async (cd) => {
          let cdset = cd;
          let price;

          if (cd.data) cdset = searchExact(cd, args.join(' '));
          if (!cdset.prices.usd && !cdset.prices.usd_foil) {
            await message.channel.send(`No USD price found for ${cdset.name}`);
          } else {
            if (!cdset.prices.usd) {
              price = parseFloat(cdset.prices.usd_foil).toFixed(2) + ' (foil)';
            } else {
              price = Math.min(...[cdset.prices.usd, cdset.prices.usd_foil]
                          .filter(Boolean))
                          .toFixed(2);
            }
            await message.channel.send(`${cdset.name} (${cdset.set.toUpperCase()}) ~ $${price}`);
          }
        })
        .catch(async (err) => {
          console.log(err);
        });
  }

  async function sendRulings(params) {
    rp(params).then(async (cd) => {
      var uriRulings = {
        uri: cd.rulings_uri,
        json: true
      } 
      rp(uriRulings).then(async (cr) => {
        if (!cr.data) {
          await message.channel.send('No rulings found for ' & cd.name)
        } else {
          var readyRulings = parseRulings(cr.data);
          if (typeof readyRulings === 'string') {
            await message.channel.send(readyRulings);
          } else {
            for (let i = 0; i < readyRulings.length; i++) {
              await message.channel.send(readyRulings[i]);
              await sleep(1000);
            }
          }
        }
      })
      .catch(async (err) => {
        console.log(err);
      })
    })
    .catch(async (err) => {
      console.log(err);
    })
  }

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();
  var searchCard = {
    uri: 'https://api.scryfall.com/cards/named',
    qs: {fuzzy: args.join(' ')},
    json: true
  }
  var searchRandCard = {
    uri: 'https://api.scryfall.com/cards/random',
    qs: {q: args.join(' ')},
    json: true
  }
  var searchSetCard = {
    uri: 'https://api.scryfall.com/cards/named',
    qs: {set: args[0], fuzzy: args.slice(1).join(' ')},
    json: true
  }
  var searchPrice = {
    uri: 'https://api.scryfall.com/cards/search',
    qs: {q: args.join(' '), dir: 'asc', order: 'usd'},
    json: true
  }
  switch (command) {
    case 'c':
      sendCardText(searchCard);
      break;
    case 'cs':
      sendCardText(searchSetCard);
      break;
    case 'p':
      sendCardPrice(searchPrice);
      break;
    case 'ps':
      sendCardPrice(searchSetCard);
      break;
    case 'r':
      if (auth.channelwl.includes(message.channel.id)) {
        sendRulings(searchCard);
      }
      break;
    case 'random':
      sendCardText(searchRandCard);
      break;
    case 'whitelist':
      // add "owners" to your auth.json as an array with Discord IDs of users
      // who should have access to this command.
      // add "channelwl" to your auth.json as an empty array.
      if (auth.owners.includes(message.author.id) &&
          !auth.channelwl.includes(message.channel.id)) {
        auth.channelwl.push(message.channel.id);
        fs.writeFile(
            './auth.json', JSON.stringify(auth, 0, 4),
            (err) => {console.log(err)});
        message.channel.send(
            message.channel.name +
            ' has been whitelisted for commands that require whitelisting.')
      } else {
        auth.channelwl =
            auth.channelwl.filter(chan => chan !== message.channel.id);
        fs.writeFile(
            './auth.json', JSON.stringify(auth, 0, 4),
            (err) => {console.log(err)});
        message.channel.send(
            message.channel.name + ' has been removed from the whitelist.');
      }
      break;
  }
});

client.login(auth.token);
