const Discord = require('discord.js');

const client = new Discord.Client();
const fs = require('fs');
const rp = require('request-promise');
const auth = require('./auth.json');
const config = require('./config.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sprintf(template, values) {
  return template.replace(/%s/g, () => values.shift());
}

function titlecase(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function ifexists(cardpart) {
  if (cardpart === undefined) {
    return '';
  }

  return cardpart;
}

function emojify(cost, server) {
  let i;
  let emocost = '';
  cost = cost.toLowerCase().replace(/\{/g, 'mana').replace(/\}/g, ' ').replace(/\//g, '')
    .split(' ');

  for (i = 0; i < cost.length - 1; i += 1) {
    emocost += server.emojis.find(x => x.name === cost[i]);
  }
  return emocost;
}

function searchExact(results, searched) {
  for (let i = 0; i < results.total_cards; i++) {
    if (results.data[i].name.toLowerCase() == searched) {
      return results.data[i];
    }
  }
  return results.data[0];
}

function parseRulings(rulings) {
  const arrayRulings = [];
  rulings.filter(idx => idx.source !== 'wotc');
  for (let i = 0; i < rulings.length; i += 1) {
    config.rulingsDate ? arrayRulings.push("```\n" + rulings[i].published_at + "\n" + rulings[i].comment + "```") : arrayRulings.push("```\n" + rulings[i].comment + "```")
  }
  if (arrayRulings.join('\n').length <= 2000) {
    return arrayRulings.join('\n');
  }

  let rulingpart = '';
  const arrayRulingsBig = [];
  for (let i = 0; i < arrayRulings.length; i += 1) {
    // +2 to account for linebreak
    if (rulingpart.length + arrayRulings[i].length + 2 <= 2000) {
      rulingpart += `${arrayRulings[i]}\n`;
    } else {
      arrayRulingsBig.push(rulingpart.trim());
      rulingpart = '';
      i -= 1;
    }
  }
  if (rulingpart !== '') {
    arrayRulingsBig.push(rulingpart.trim());
  }
  return arrayRulingsBig;
}

client.on('message', async (message) => {
  if (message.author.bot) return;
  if (message.content.indexOf(config.prefix) !== 0) return;

  async function sendCardText(params) {
    rp(params)
      .then(async (cd) => {
        if (ifexists(cd.card_faces) !== '') {
          let halves = '';
          let cardhalf;
          let halfname;
          let halfcost;
          let halftype;
          let halftext;
          for (let i = 0; i < 2; i += 1) {
            cardhalf = cd.card_faces[i];
            halfname = "```" + cardhalf.name + " ";
            (ifexists(cardhalf.mana_cost) != "") ? halfcost = cardhalf.mana_cost + "\n": halfcost = "\n";
            halftype = cardhalf.type_line + "\n";
            halftext = cardhalf.oracle_text;
            (ifexists(cardhalf.power) != "") ? pt = "\n" + cardhalf.power + "/" + cardhalf.toughness: pt = "";
            halves += halfname + halfcost + halftype.replace("â€”", "—") + halftext + pt + '```';
            if (i === 0) {
              if (ifexists(cardhalf.loyalty) !== '') {
                halves += `Loyalty: ${cardhalf.loyalty}`;
              }
              halves += '\n';
            }
          }
          await message.channel.send(sprintf('%s\n%s\n%s (%s)\n%s', [
            cd.name,
            (ifexists(cd.card_faces[1].mana_cost !== '')) ? emojify(cd.card_faces[0].mana_cost, message.guild) + " // " + emojify(cd.card_faces[1].mana_cost, message.guild) : emojify(cd.card_faces[0].mana_cost, message.guild),
            titlecase(cd.rarity),
            cd.set.toUpperCase(),
            halves,
          ]));
        } else {
          await message.channel.send(sprintf('%s %s\n%s (%s)\n%s\n%s%s%s', [
            cd.name,
            (ifexists(cd.mana_cost) !== '') ? emojify(cd.mana_cost, message.guild) : '',
            titlecase(cd.rarity),
            cd.set.toUpperCase(),
            cd.type_line.replace('â€”', '—'),
            (cd.oracle_text === '' ? '' : '```\n') + cd.oracle_text.replace('â€”', '—') + (cd.oracle_text === '' ? '' : '```'),
            ifexists(cd.power) + (cd.power === undefined ? '' : '/') + ifexists(cd.toughness),
            (cd.loyalty === undefined ? '' : 'Loyalty: ') + ifexists(cd.loyalty),
          ]));
        }
      })
      .catch(async (err) => {
        console.log(err);
      });
  }

  async function sendCardPrice(params) {
    rp(params)
      .then(async (cd) => {
        ifexists(cd.data) ? cdset = searchExact(cd, args.join(" ")) : cdset = cd
        if (cdset.prices.usd === undefined && cdset.prices.usd_foil === undefined) {
          await message.channel.send(sprintf('No USD price found for %s', [
            cdset.name
          ]));
        } else {
          if (cdset.prices.usd === undefined) {
            price = `${cdset.prices.usd_foil} (foil)`;
          } else {
            price = Math.min([cdset.prices.usd, cdset.prices.usd_foil].filter(pf => pf > 0));
          }
          await message.channel.send(
            sprintf('%s (%s) ~ $%s', [cdset.name,
              cdset.set.toUpperCase(),
              price
            ]),
          );
        }
      })
      .catch(async (err) => {
        console.log(err);
      });
  }

  async function sendRulings(params) {
    rp(params)
      .then(async (cd) => {
        const uriRulings = {
          uri: cd.rulings_uri,
          json: true,
        };

        rp(uriRulings)
          .then(async (cr) => {
            if (cr.data === undefined || cr.data.length === 0) {
              await message.channel.send('No rulings found for ' & cd.name)
            } else {
              const readyRulings = parseRulings(cr.data);
              if (typeof readyRulings === 'string') {
                await message.channel.send(readyRulings);
              } else {
                for (let i = 0; i < readyRulings.length; i += 1) {
                  await message.channel.send(readyRulings[i]);
                  await sleep(1000);
                }
              }
            }
          });
      });
  }

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();
  const searchCard = {
    uri: 'https://api.scryfall.com/cards/named',
    qs: {
      fuzzy: args.join(' '),
    },
    json: true,
  };

  const searchSetCard = {
    uri: 'https://api.scryfall.com/cards/named',
    qs: {
      set: args[0],
      fuzzy: args.slice(1).join(' '),
    },
    json: true,
  };

  const searchPrice = {
    uri: 'https://api.scryfall.com/cards/search',
    qs: {
      q: args.join(' '),
      dir: 'asc',
      order: 'usd',
    },
    json: true,
  };

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
    default:
      // add "owners" to your auth.json as an array with Discord IDs of users who should have access to this command
      // add "channelwl" to your auth.json as an empty array
      if (auth.owners.includes(message.author.id) && !auth.channelwl.includes(message.channel.id)) {
        auth.channelwl.push(message.channel.id);
        fs.writeFile('./auth.json', JSON.stringify(auth, 0, 4), (err) => { console.log(err); });
        message.channel.send(`${message.channel.name} has been whitelisted for commands that require whitelisting.`);
      } else {
        auth.channelwl = auth.channelwl.filter(chan => chan !== message.channel.id);
        fs.writeFile('./auth.json', JSON.stringify(auth, 0, 4), (err) => { console.log(err); });
        message.channel.send(`${message.channel.name} has been removed from the whitelist.`);
      }
      break;
  }
});

client.login(auth.token);
