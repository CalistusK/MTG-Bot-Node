const Discord = require("discord.js");
const config = require("./mtgconfig.json");
const request = require('request');
const rp = require('request-promise');
const client = new Discord.Client();

function sprintf(template, values) {
  return template.replace(/%s/g, function() {
    return values.shift();
  });
}

function titlecase(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function ifexists(cardpart) {
  if (cardpart == undefined) {
    return "";
  } else {
    return cardpart;
  }
}

function emojify (cost, server) {
  let i;
  let emocost = "";
  cost = cost.toLowerCase().replace(/\{/g,"mana").replace(/\}/g," ").replace(/\//g,"").split(" ");
  for (i = 0; i < cost.length - 1; i++) {
    emocost += server.emojis.find(x => x.name === cost[i]);
  }
  return emocost
}

client.on("message", async message => {
  if(message.author.bot) return;
  if(message.content.indexOf(config.prefix) !== 0) return;

  async function sendCardText (params) {
      rp(params)
      .then(async function (cd) {
        if (ifexists(cd.card_faces) != "") {
        var halves = "";
        var cardhalf;
        var halfname;
        var halfcost;
        var halftype;
        var halftext;
        var i;
        // This for loop doesn't seem to do anything yet.
          for (i = 0; i == 2; i++) {
            cardhalf = cd.card_faces[i];
            console.log(i);
            halfname = "```" + cardhalf.name + " ";
            (ifexists(cardhalf.mana_cost) != "") ? halfcost = cardhalf.mana_cost + "\n" : halfcost = "\n";
            halftype = cardhalf.type_line + "\n";
            halftext = cardhalf.oracle_text;
            (ifexists(cardhalf.power) != "") ? pt = "\n" + cardhalf.power + "/" + cardhalf.toughness : pt = "";
            halves += halfname + halfcost + halftype.replace("â€”","—") + halftext + pt + '```';
            if (i == 0) {
              if (ifexists(cardhalf.loyalty) != "") {
              halves += "Loyalty: " + cardhalf.loyalty;
              }
              halves += "\n";
            }
          }
          await message.channel.send(sprintf("%s\n%s\n%s (%s)\n%s", [
            cd.name,
            (ifexists(cd.card_faces[1].mana_cost != "")) ? emojify(cd.card_faces[0].mana_cost, message.guild) + " // " + emojify(cd.card_faces[1].mana_cost, message.guild) : emojify(cd.card_faces[0].mana_cost, message.guild),
            titlecase(cd.rarity),
            cd.set.toUpperCase(),
            halves
            ]));
        } else {
          await message.channel.send(sprintf("%s %s\n%s (%s)\n%s\n%s%s%s", [
            cd.name,
            (ifexists(cd.mana_cost) != "") ? emojify(cd.mana_cost, message.guild) : "",
            titlecase(cd.rarity),
            cd.set.toUpperCase(),
            cd.type_line.replace("â€”","—"),
            (cd.oracle_text == "" ? "" : "```\n") + cd.oracle_text.replace("â€”","—") + (cd.oracle_text == "" ? "" : "```"),
            ifexists(cd.power) + (cd.power == undefined ? "" : "/") + ifexists(cd.toughness),
            (cd.loyalty == undefined ? "" : "Loyalty: ") + ifexists(cd.loyalty)
            ]));
        }
      })
      .catch(async function(err) {
        console.log(err)
      });
    }

  async function sendCardPrice (params) {
    rp(params)
    .then(async function (cd) {
      if (cd.usd == undefined) {
        await message.channel.send(sprintf("No USD price found for %s (%s)", [
          cd.name,
          cd.set.toUpperCase()
          ]))
      } else {
        await message.channel.send(sprintf("%s (%s) ~ $%s", [
          cd.name,
          cd.set.toUpperCase(),
          cd.usd
          ]
        ));
      }
    })
    .catch(async function(err) {
      console.log(err)
    });
  }
  
  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();
  var searchCard = {
    uri: "https://api.scryfall.com/cards/named",
    qs: {
      fuzzy: args.join(" ")
    },
    json: true
  }
  var searchSetCard = {
    uri: "https://api.scryfall.com/cards/named",
    qs: {
      set: args.shift(),
      fuzzy: args.join(" ")
    },
    json: true
  }
  
  if(command === "c") {
    sendCardText(searchCard)
  }

  if(command === "cs") {
    sendCardText(searchSetCard)
  }

  if(command === "p") {
    sendCardPrice(searchCard)
  }
  
  if(command === "ps") {
    sendCardPrice(searchSetCard)
  }

});

client.login(config.token);