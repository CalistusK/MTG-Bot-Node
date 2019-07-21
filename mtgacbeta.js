const Discord = require("discord.js");
const auth = require("./auth.json");
const config = require("./config.json");
const fs = require("fs");
const request = require("request");
const rp = require("request-promise");
const client = new Discord.Client();

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function sprintf(template, values) {
	return template.replace(/%s/g, function () {
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

//Intended to be used with the Scryfall manamoji pack:
//https://github.com/scryfall/manamoji-discord
function emojify(cost, server) {
	let origcost = cost;
	let emocost = "";
	cost = cost
		.toLowerCase()
		.replace(/\{/g, "mana")
		.replace(/\}/g, " ")
		.replace(/\//g, "")
		.split(" ");
	if (cost[0] == "mana1000000") {
		for (let i = 0; i < 4; i += 1) {
			emocost += server.emojis.find(x => x.name === "mana1000000" + (i + 1).toString())
			if (emocost == "null") {
				return origcost;
			}
		}
		return emocost;
	}
	for (let i = 0; i < cost.length - 1; i++) {
		emocost += server.emojis.find(x => x.name === cost[i]);
		if (emocost == "null") {
			return origcost;
		}
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
	if (auth.channelbl.includes(message.channel.id)) return;
	if (message.author.bot) return;
  if (message.content.charAt(0) !== "!") return;

  async function createJSON(filename) {
    switch (filename) {
      case 'decklists':
      case 'customcommands':
        fs.writeFile('./assets/' + filename + ".json", "[]", 'utf8', (err) => {
          if (err) throw err;
          console.log("Created file: " + filename + ".json");
        });
        break;
      default:
        message.channel.send("Something went wrong!");
        console.log("Unexpectedly ended up in the default case of function createJSON.")
        break;
    }
  }
    
	async function sendCardImage(params) {
		rp(params)
			.then(async function (cd) {
				//console.log(cd);
				if(ifexists(cd.card_faces) != "") {
					var halves = "";
					var cardhalf;
					var halfname;
					await message.channel.send("currently not implemented for double faced cards");
				} else {
						await message.channel.send(cd.image_uris.png).catch(console.error);
				}
				
			})
			.catch(async function (err) {
				console.log(err);
			});
	}
	async function sendCardText(params) {
		rp(params)
			.then(async function (cd) {
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
						ifexists(cardhalf.mana_cost) != "" ?
							(halfcost = cardhalf.mana_cost + "\n") :
							(halfcost = "\n");
						halftype = cardhalf.type_line + "\n";
						halftext = cardhalf.oracle_text;
						ifexists(cardhalf.power) != "" ?
							(pt = "\n" + cardhalf.power + "/" + cardhalf.toughness) :
							(pt = "");
						halves +=
							halfname +
							halfcost +
							halftype.replace("â€”", "—") +
							halftext +
							pt +
							"```";
						if (i == 0) {
							if (ifexists(cardhalf.loyalty) != "") {
								halves += "Loyalty: " + cardhalf.loyalty;
							}
							halves += "\n";
						}
					}
					await message.channel.send(
						sprintf("%s\n%s\n%s (%s)\n%s", [
							cd.name,
							ifexists(cd.card_faces[1].mana_cost != "") ?
							emojify(cd.card_faces[0].mana_cost, message.guild) +
							" // " +
							emojify(cd.card_faces[1].mana_cost, message.guild) :
							emojify(cd.card_faces[0].mana_cost, message.guild),
							titlecase(cd.rarity),
							cd.set.toUpperCase(),
							halves
						])
					);
				} else {
					await message.channel.send(
						sprintf("%s %s\n%s (%s)\n%s\n%s%s%s", [
							cd.name,
							ifexists(cd.mana_cost) != "" ?
							emojify(cd.mana_cost, message.guild) :
							"",
							titlecase(cd.rarity),
							cd.set.toUpperCase(),
							cd.type_line.replace("â€”", "—"),
							(cd.oracle_text == "" ? "" : "```\n") +
							cd.oracle_text.replace("â€”", "—") +
							(cd.oracle_text == "" ? "" : "```"),
							ifexists(cd.power) +
							(cd.power == undefined ? "" : "/") +
							ifexists(cd.toughness),
							(cd.loyalty == undefined ? "" : "Loyalty: ") +
							ifexists(cd.loyalty)
						])
					);
				}
			})
			.catch(async function (err) {
				console.log(err);
			});
	}

	async function readCommand(command, filename) {
		fs.readFile("./assets/" + filename + ".json", "utf8", function (err, data) {
			if (err && err.code === 'ENOENT') {
				createJSON(filename);
				message.channel.send("command does not exist");
				return;
			}
			let ccjson = JSON.parse(data)
			for (let i = 0; i < ccjson.length; i++) {
				if (ccjson[i].name == command) {
					message.channel.send(ccjson[i].comm);
					return;
				}
			}
		message.channel.send("command does not exist");
		})
	}

	async function addCommand(command, filename) {	
		fs.readFile("./assets/" + filename + ".json", "utf8", function (err, data) {
			if (err && err.code === 'ENOENT') {
				createJSON(filename);
				//for now, just assume the file created by createJSON contains this string
				//TODO: actually read the contents of the file created by createJSON here
				data = "[]"
			}
			let ccjson = JSON.parse(data)
			if (ccjson === undefined || ccjson.length == 0 || ccjson.length == undefined) {
				ccjson = [{"name": command.name,"comm": command.comm}]
			} else {
				for (let i = 0; i < ccjson.length; i++) {
					if (ccjson[i].name == command.name) {
						message.channel.send("command already exists");
						return;
					}
				}
				ccjson.push(command)
				message.channel.send(command.name + " added");
			};
			fs.writeFile("./assets/" + filename + ".json", JSON.stringify(ccjson,0,4), (err) => {if(err) console.log(err)});
		})
	}

	async function removeCommand(command, filename) {
		fs.readFile("./assets/" + filename + ".json", "utf8", function (err, data) {
			if (err && err.code === 'ENOENT') {
				createJSON(filename);
				message.channel.send(command + " does not exist.");
				return;
			}
			let ccjson = JSON.parse(data)
			//delete ccjson.command
			let i = 0;
			for(; i < ccjson.length; i++){
				if(ccjson[i].name == command){
					ccjson.splice(i, 1);
					message.channel.send(command + " removed");
					break;
				}
			}
			
			fs.writeFile("./assets/" + filename + ".json", JSON.stringify(ccjson,0,4), (err) => {if(err) console.log(err)});
		})
	}

	async function sendCardPrice(params) {
		rp(params)
			.then(async function (cd) {
        var cdset = ""
        var price = ""
				ifexists(cd.data) ? cdset = searchExact(cd, args.join(" ")) : cdset = cd
				if (cdset.prices.usd == undefined && cdset.prices.usd_foil == undefined) {
					await message.channel.send(sprintf("No USD price found for %s", [
						cdset.name
					]));
				} else {
					if (cdset.prices.usd == undefined) {
						price = cdset.prices.usd_foil + " (foil)";
					} else {
						price = Math.min(...[cdset.prices.usd, cdset.prices.usd_foil].filter(Boolean));
					}
					await message.channel.send(
						sprintf("%s (%s) ~ $%s", [cdset.name,
							cdset.set.toUpperCase(),
							price.toFixed(2)
						])
					);
				}
			})
			.catch(async function (err) {
				console.log(err);
			});
	}

	async function sendRulings(params) {
		rp(params)
			.then(async function (cd) {
				var uriRulings = {
					uri: cd.rulings_uri,
					json: true
				}
				rp(uriRulings)
					.then(async function (cr) {
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

	const args = message.content.substring(1).trim().split(/ +/g);
	const command = args.shift().toLowerCase();
    var searchCard = {
        uri: "https://api.scryfall.com/cards/named",
        qs: {
            fuzzy: args.join(" ")
        },
        json: true
    };
    var searchImageCard = {
        uri: "https://api.scryfall.com/cards/named",
        qs: {
            fuzzy: args.join(" ")
        },
        json: true
    }
    var searchImageSet = {
        uri: "https://api.scryfall.com/cards/named",
        qs: {
            set: args[0],
            fuzzy: args.slice(1).join(" ")
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
    };
    var searchPrice = {
        uri: "https://api.scryfall.com/cards/search",
        qs: {
            order: "usd",
            dir: "asc",
            q: args.join(" ")
        },
        json: true
    };
    var addedCommand = {
        name: args[0],
        comm: args.slice(1).join(" ")
    };
	
	switch (command) {
		case "ownerhelp":
			if (auth.owners.includes(message.author.id)){
				message.channel.send("!whitelist whitelists a channel for the !r [cardName] command");
			}
			break;
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
			if (auth.channelwl.includes(message.channel.id)) {
				sendRulings(searchCard);
			}
			break;
		case "im":
			sendCardImage(searchImageCard);
			break;
		case "ims":
			sendCardImage(searchImageSet);
			break;
		case "adddeck":
			addCommand(addedCommand, "decklists");
			break;
		case "addcom":
			addCommand(addedCommand, "customcommands");
			break;
		case "deck":
			readCommand(args[0], "decklists");
			break;
		case "removedeck":
			removeCommand(args[0], "decklists");
			break;
		case "removecom":
			removeCommand(args[0], "customcommands");
			break;
		case "decks":
			var decknames = "Decks: "
			fs.readFile("./assets/decklists.json", "utf8", function (err, data) {
				if (err && err.code === 'ENOENT') {
					message.channel.send("No decks found.");
					return;
				}
				let ccjson = JSON.parse(data)
				if (ccjson.length !== 0) {
					for (let i = 0; i < ccjson.length; i++) {
						decknames += ccjson[i].name;
						if (i === ccjson.length - 1) break;
						decknames += ", ";
					}
				}
				if (decknames !== "Decks: ") {
					message.channel.send(decknames);
				} else {
					message.channel.send("No decks found.");
				}
			})
			break;
		case "whitelist":
			//add "owners" to your auth.json as an array with Discord IDs of users who should have access to this command
			//add "channelwl" to your auth.json as an empty array
			if (auth.owners.includes(message.author.id) && !auth.channelwl.includes(message.channel.id)) {
				auth.channelwl.push(message.channel.id);
				fs.writeFile("./auth.json", JSON.stringify(auth,0,4), (err) => {console.log(err)});
				message.channel.send(message.channel.name + " has been whitelisted for commands that require whitelisting.")
			} else {
				auth.channelwl = auth.channelwl.filter(chan => chan !== message.channel.id);
				fs.writeFile("./auth.json", JSON.stringify(auth,0,4), (err) => {console.log(err)});
				message.channel.send(message.channel.name + " has been removed from the whitelist.");
			}
			break;
		default:
			try{
				readCommand(command, "customcommands");
			} catch(err){
				console.log(err);
			}		
			break;				
	}
});


client.login(auth.token);
