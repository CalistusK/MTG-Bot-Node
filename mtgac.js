const Discord = require("discord.js");
const auth = require("./auth.json");
const config = require("./config.json");
const request = require('request');
const rp = require('request-promise');
const client = new Discord.Client();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

function emojify(cost, server) {
    let i;
    let emocost = "";
    cost = cost.toLowerCase().replace(/\{/g, "mana").replace(/\}/g, " ").replace(/\//g, "").split(" ");
    for (i = 0; i < cost.length - 1; i++) {
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
    var arrayRulings = [];
    rulings.filter(idx => idx.source !== "wotc");
    for (let i = 0; i < rulings.length; i++) {
        config.rulingsDate ? arrayRulings.push("```\n" + rulings[i].published_at + "\n" + rulings[i].comment + "```") : arrayRulings.push("```\n" + rulings[i].comment + "```")
    }
    if (arrayRulings.join("\n").length <= 2000) {
        return arrayRulings.join("\n");
    } else {
        var rulingpart = "";
        var arrayRulingsBig = [];
        for (let i = 0; i < arrayRulings.length; i++) {
            //+2 to account for linebreak
            if (rulingpart.length + arrayRulings[i].length + 2 <= 2000) {
                rulingpart += arrayRulings[i] + "\n";
            } else {
                arrayRulingsBig.push(rulingpart.trim());
                rulingpart = "";
                i--;
            }
        }
        if (rulingpart !== "") {
            arrayRulingsBig.push(rulingpart.trim());
        }
        return arrayRulingsBig;
    }
}

client.on("message", async message => {
    if (message.author.bot) return;
    if (message.content.indexOf(config.prefix) !== 0) return;

    async function sendCardText(params) {
        rp(params)
            .then(async function(cd) {
                if (ifexists(cd.card_faces) != "") {
                    var halves = "";
                    var cardhalf;
                    var halfname;
                    var halfcost;
                    var halftype;
                    var halftext;
                    for (var i = 0; i < 2; i++) {
                        cardhalf = cd.card_faces[i];
                        halfname = "```" + cardhalf.name + " ";
                        (ifexists(cardhalf.mana_cost) != "") ? halfcost = cardhalf.mana_cost + "\n": halfcost = "\n";
                        halftype = cardhalf.type_line + "\n";
                        halftext = cardhalf.oracle_text;
                        (ifexists(cardhalf.power) != "") ? pt = "\n" + cardhalf.power + "/" + cardhalf.toughness: pt = "";
                        halves += halfname + halfcost + halftype.replace("â€”", "—") + halftext + pt + '```';
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
                        cd.type_line.replace("â€”", "—"),
                        (cd.oracle_text == "" ? "" : "```\n") + cd.oracle_text.replace("â€”", "—") + (cd.oracle_text == "" ? "" : "```"),
                        ifexists(cd.power) + (cd.power == undefined ? "" : "/") + ifexists(cd.toughness),
                        (cd.loyalty == undefined ? "" : "Loyalty: ") + ifexists(cd.loyalty)
                    ]));
                }
            })
            .catch(async function(err) {
                console.log(err)
            });
    }

    async function sendCardPrice(params) {
        rp(params)
            .then(async function(cd) {
                ifexists(cd.data) ? cdset = searchExact(cd, args.join(" ")) : cdset = cd
                if (cdset.prices.usd == undefined && cdset.prices.usd_foil == undefined) {
                    await message.channel.send(sprintf("No USD price found for %s", [
                        cdset.name
                    ]));
                } else {
                    if (cdset.prices.usd == undefined) {
                        price = cdset.prices.usd_foil + " (foil)";
                    } else {
                        price = Math.min([cdset.prices.usd, cdset.prices.usd_foil].filter(pf => pf > 0));
                    }
                    await message.channel.send(
                        sprintf("%s (%s) ~ $%s", [cdset.name,
                            cdset.set.toUpperCase(),
                            price
                        ])
                    );
                }
            })
            .catch(async function(err) {
                console.log(err);
            });
    }

    async function sendRulings(params) {
        rp(params)
            .then(async function(cd) {
                var uriRulings = {
                    uri: cd.rulings_uri,
                    json: true
                }
                rp(uriRulings)
                    .then(async function(cr) {
                        if (cr.data === undefined || cr.data.length == 0) {
                            await message.channel.send("No rulings found for " & cd.name)
                        } else {
                            var readyRulings = parseRulings(cr.data);
                            if (typeof readyRulings === "string") {
                                await message.channel.send(readyRulings);
                            } else {
                                for (let i = 0; i < readyRulings.length; i++) {
                                    await message.channel.send(readyRulings[i]);
                                    await sleep(1000);
                                }
                            }
                        }
                    })

            })
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
            set: args[0],
            fuzzy: args.slice(1).join(" ")
        },
        json: true
    }
    var searchPrice = {
        uri: "https://api.scryfall.com/cards/search",
        qs: {
            q: args.join(" "),
            dir: "asc",
            order: "usd"
        },
        json: true
    }
    switch (command) {
        case "c":
            sendCardText(searchCard);
            break;
        case "cs":
            sendCardText(searchSetCard);
            break;
        case "p":
            sendCardPrice(searchPrice);
            break;
        case "ps":
            sendCardPrice(searchSetCard);
            break;
        case "r":
            sendRulings(searchCard);
            break;
    }
});

client.login(auth.token);