const helpCommand = require('./help')
const trackedCommand = require('./tracked')

exports.run = async (client, msg, args, options) => {
	const logReference = Math.random().toString().slice(2, 11)

	try {
		const util = client.createUtil(msg, options)

		const {
			canContinue, target, userHasLocation, userHasArea, language, currentProfileNo,
		} = await util.buildTarget(args)

		if (!canContinue) return
		const commandName = __filename.slice(__dirname.length + 1, -3)

		client.log.info(`${logReference} ${target.name}/${target.type}-${target.id}: ${commandName} ${args}`)

		if (args[0] === 'help') {
			return helpCommand.run(client, msg, [commandName], options)
		}

		const translator = client.translatorFactory.Translator(language)

		if (!await util.commandAllowed(commandName)) {
			await msg.react('🚫')
			return msg.reply(translator.translate('You do not have permission to execute this command'))
		}

		if (args.length === 0) {
			await msg.reply(translator.translateFormat('Valid commands are e.g. `{0}track charmander`, `{0}track everything iv100`, `{0}track gible d500`', util.prefix),
				{ style: 'markdown' })
			await helpCommand.provideSingleLineHelp(client, msg, util, language, target, commandName)
			return
		}

		// Check for basic 'everything' tracking with no other parameters
		if (args.length === 1 && args[0] === 'everything' && !msg.isFromAdmin) {
			await msg.reply(translator.translate('This would result in too many alerts. You need to provide additional filters to limit the number of valid candidates.'))
			await helpCommand.provideSingleLineHelp(client, msg, util, language, target, commandName)
			return
		}

		const typeArray = Object.keys(client.GameData.utilData.types).map((o) => o.toLowerCase())

		let reaction = '👌'
		let monsters
		// Set defaults
		const pvpFilterMaxRank = Math.min(client.config.pvp.pvpFilterMaxRank, 4096)
		const pvp = {}
		const { leagues } = client.config.pvp
		Object.keys(leagues).forEach((league) => {
			const base = `${league}_league`
			pvp[league] = { [base]: 4096, [`${base}_highest`]: 1, [`${base}_cp`]: 0 }
		})
		const trackDefaults = {
			distance: 0,
			min_time: 0,
			min_cp: 0,
			max_cp: 9000,
			min_iv: -1,
			max_iv: 100,
			min_level: 0,
			max_level: 40,
			atk: 0,
			def: 0,
			sta: 0,
			max_atk: 15,
			max_def: 15,
			max_sta: 15,
			gender: 0,
			min_weight: 0,
			max_weight: 9000000,
			rarity: -1,
			max_rarity: 6,
			pvp_ranking_worst: 4096,
			pvp_ranking_best: 1,
			pvp_ranking_min_cp: 1,
			pvp_ranking_league: 0,
			// great_league_ranking: 4096,
			// great_league_ranking_min_cp: 0,
			// ultra_league_ranking: 4096,
			// ultra_league_ranking_min_cp: 0,
			clean: false,
			template: client.config.general.defaultTemplateName,
			ping: msg.getPings(),
		}
		// let distance = 0
		// let minTime = 0
		// let cp = 0
		// let maxcp = 9000
		// let iv = -1
		// let maxiv = 100
		// let level = 0
		// let maxlevel = 40
		// let atk = 0
		// let def = 0
		// let sta = 0
		// let maxAtk = 15
		// let maxDef = 15
		// let maxSta = 15
		// let gender = 0
		// let weight = 0
		// let maxweight = 9000000
		// let rarity = -1
		// let maxRarity = 6
		// let littleLeague = 4096
		// let littleLeagueHighest = 1
		// let littleLeagueCP = 0
		// let greatLeague = 4096
		// let greatLeagueHighest = 1
		// let greatLeagueCP = 0
		// let ultraLeague = 4096
		// let ultraLeagueHighest = 1
		// let ultraLeagueCP = 0
		// const { pvpFilterGreatMinCP, pvpFilterUltraMinCP, pvpFilterLittleMinCP } = client.config.pvp
		// let template = client.config.general.defaultTemplateName
		// let clean = false
		// const pings = msg.getPings()

		let disableEverythingTracking
		let forceEverythingSeparately
		let individuallyAllowed
		switch (client.config.tracking.everythingFlagPermissions.toLowerCase()) {
			case 'allow-any': {
				disableEverythingTracking = false
				forceEverythingSeparately = false
				individuallyAllowed = true
				break
			}
			case 'allow-and-always-individually': {
				disableEverythingTracking = false
				forceEverythingSeparately = true
				individuallyAllowed = true
				break
			}
			case 'allow-and-ignore-individually': {
				disableEverythingTracking = false
				forceEverythingSeparately = false
				individuallyAllowed = false
				break
			}
			case 'deny':
			default: {
				disableEverythingTracking = true
				forceEverythingSeparately = false
				individuallyAllowed = true
			}
		}
		// const littleLeagueAllowed = client.config.pvp.dataSource === 'internal'

		// Substitute aliases
		const pokemonAlias = require('../../../../config/pokemonAlias.json')
		for (let i = args.length - 1; i >= 0; i--) {
			let alias = pokemonAlias[args[i]]
			if (alias) {
				if (!Array.isArray(alias)) alias = [alias]
				args.splice(i, 1, ...alias.map((x) => x.toString()))
			}
		}

		// Check for monsters or forms
		const formArgs = args.filter((arg) => arg.match(client.re.formRe))
		const formNames = formArgs ? formArgs.map((arg) => client.translatorFactory.reverseTranslateCommand(arg.match(client.re.formRe)[2], true).toLowerCase()) : []
		const argTypes = args.filter((arg) => typeArray.includes(arg))
		const genCommand = args.filter((arg) => arg.match(client.re.genRe))
		const gen = genCommand.length ? client.GameData.utilData.genData[+(genCommand[0].match(client.re.genRe)[2])] : 0
		if (formNames.length || gen || (args.includes('individually') && (individuallyAllowed || msg.isFromAdmin)) || forceEverythingSeparately) {
			monsters = Object.values(client.GameData.monsters).filter((mon) => (
				(args.includes(mon.name.toLowerCase()) || args.includes(mon.id.toString()))
        || mon.types.map((t) => t.name.toLowerCase()).find((t) => argTypes.includes(t))
        || args.includes('everything') && !disableEverythingTracking
        || args.includes('everything') && msg.isFromAdmin)
        && (formNames.length ? formNames.includes(mon.form.name.toLowerCase()) : !mon.form.id))

			if (gen && args.length === 1) {
				monsters = Object.values(client.GameData.monsters).filter((mon) => mon.id >= gen.min && mon.id <= gen.max)
			} else if (gen) {
				monsters = monsters.filter((mon) => mon.id >= gen.min && mon.id <= gen.max)
			}
		} else {
			monsters = Object.values(client.GameData.monsters).filter((mon) => (
				(args.includes(mon.name.toLowerCase()) || args.includes(mon.id.toString()))
        || mon.types.map((t) => t.name.toLowerCase()).find((t) => argTypes.includes(t))) && !mon.form.id)

			if (args.includes('everything') && !disableEverythingTracking || args.includes('everything') && msg.isFromAdmin) {
				monsters.push({
					id: 0,
					form: {
						id: 0,
					},
				})
			}
		}
		// Parse command elements to stuff
		for (const element of args) {
			let match
			let input = element
			switch (element) {
				case 'male': trackDefaults.gender = 1; break
				case 'female': trackDefaults.gender = 2; break
				case 'genderless': trackDefaults.gender = 3; break
				case 'clean': trackDefaults.clean = true; break
				default:
					match = Object.keys(client.re).find((x) => element.match(client.re[x]))
					if (match) {
						const command = match.substring(0, match.length - 2)
						input = command.replace('_', '')
						if (trackDefaults[command] !== undefined) {
							[, , trackDefaults[command]] = element.match(client.re[match])
						} else if (command.includes('league')) {
							[, , pvp[command.split('_')[0]][command]] = element.match(client.re[match])
							// eslint-disable-next-line prefer-destructuring
							input = command.split('_')[0]
						}
					}
			}
			if (!await util.commandAllowed(input)) {
				await msg.react('🚫')
				return msg.reply(translator.translateFormat('You do not have permission to use the `{0}` parameter',
					translator.translate(input)))
			}
		}
		// if ((trackDefaults.great_league_ranking < 4096 && trackDefaults.ultra_league_ranking < 4096) || (trackDefaults.great_league_ranking < 4096 && trackDefaults.ultra_league_ranking_min_cp > 0) || (trackDefaults.great_league_ranking_min_cp > 0 && trackDefaults.ultra_league_ranking < 4096) || (trackDefaults.great_league_ranking_min_cp > 0 && trackDefaults.ultra_league_ranking_min_cp > 0)) {
		// args.forEach((element) => {
		// 	if (element.match(client.re.maxlevelRe)) [,, maxlevel] = element.match(client.re.maxlevelRe)
		// 	else if (element.match(client.re.templateRe)) [,, template] = element.match(client.re.templateRe)
		// 	else if (element.match(client.re.greatLeagueRe)) [,, greatLeague] = element.match(client.re.greatLeagueRe)
		// 	else if (element.match(client.re.greatLeagueCPRe)) [,, greatLeagueCP] = element.match(client.re.greatLeagueCPRe)
		// 	else if (element.match(client.re.greatLeagueHighestRe)) [,, greatLeagueHighest] = element.match(client.re.greatLeagueHighestRe)
		// 	else if (element.match(client.re.ultraLeagueRe)) [,, ultraLeague] = element.match(client.re.ultraLeagueRe)
		// 	else if (element.match(client.re.ultraLeagueCPRe)) [,, ultraLeagueCP] = element.match(client.re.ultraLeagueCPRe)
		// 	else if (element.match(client.re.ultraLeagueHighestRe)) [,, ultraLeagueHighest] = element.match(client.re.ultraLeagueHighestRe)
		// 	else if (element.match(client.re.littleLeagueRe) && littleLeagueAllowed) [,, littleLeague] = element.match(client.re.littleLeagueRe)
		// 	else if (element.match(client.re.littleLeagueCPRe) && littleLeagueAllowed) [,, littleLeagueCP] = element.match(client.re.littleLeagueCPRe)
		// 	else if (element.match(client.re.littleLeagueHighestRe) && littleLeagueAllowed) [,, littleLeagueHighest] = element.match(client.re.littleLeagueHighestRe)
		// 	else if (element.match(client.re.maxcpRe)) [,, maxcp] = element.match(client.re.maxcpRe)
		// 	else if (element.match(client.re.maxivRe)) [,, maxiv] = element.match(client.re.maxivRe)
		// 	else if (element.match(client.re.maxweightRe)) [,, maxweight] = element.match(client.re.maxweightRe)
		// 	else if (element.match(client.re.maxRarityRe)) [,, maxRarity] = element.match(client.re.maxRarityRe)
		// 	else if (element.match(client.re.maxatkRe)) [,, maxAtk] = element.match(client.re.maxatkRe)
		// 	else if (element.match(client.re.maxdefRe)) [,, maxDef] = element.match(client.re.maxdefRe)
		// 	else if (element.match(client.re.maxstaRe)) [,, maxSta] = element.match(client.re.maxstaRe)
		// 	else if (element.match(client.re.cpRe)) [,, cp] = element.match(client.re.cpRe)
		// 	else if (element.match(client.re.levelRe)) [,, level] = element.match(client.re.levelRe)
		// 	else if (element.match(client.re.ivRe)) [,, iv] = element.match(client.re.ivRe)
		// 	else if (element.match(client.re.atkRe)) [,, atk] = element.match(client.re.atkRe)
		// 	else if (element.match(client.re.defRe)) [,, def] = element.match(client.re.defRe)
		// 	else if (element.match(client.re.staRe)) [,, sta] = element.match(client.re.staRe)
		// 	else if (element.match(client.re.weightRe)) [,, weight] = element.match(client.re.weightRe)
		// 	else if (element.match(client.re.tRe)) [,, minTime] = element.match(client.re.tRe)
		// 	else if (element.match(client.re.rarityRe)) [,, rarity] = element.match(client.re.rarityRe)
		// 	else if (element.match(client.re.dRe)) [,, distance] = element.match(client.re.dRe)
		// 	else if (element === 'female') gender = 2
		// 	else if (element === 'clean') clean = true
		// 	else if (element === 'male') gender = 1
		// 	else if (element === 'genderless') gender = 3
		// })

		const filteredPvp = {}
		Object.keys(leagues).forEach((league) => {
			if (pvp[league][`${league}_league`] < 4096) {
				const base = `${league}_league`
				filteredPvp[league] = {
					pvp_ranking_min_cp: Math.max(pvp[league][`${base}_cp`], client.config.pvp[`pvpFilter${league.charAt(0).toUpperCase()}${league.slice(1)}MinCP`]),
					pvp_ranking_worst: Math.min(pvp[league][base], pvpFilterMaxRank),
					pvp_ranking_best: pvp[league][`${base}_highest`],
					pvp_ranking_league: league,
				}
			}
		})
		// if (pgreatLeague < 4096) {
		// 	Object.assign(pvp, { 1500: { minCp: Math.max(greatLeagueCP, pvpFilterGreatMinCP), worst: Math.min(greatLeague, pvpFilterMaxRank), best: greatLeagueHighest } })
		// }
		// if (ultraLeague < 4096) {
		// 	Object.assign(pvp, { 2500: { minCp: Math.max(ultraLeagueCP, pvpFilterUltraMinCP), worst: Math.min(ultraLeague, pvpFilterMaxRank), best: ultraLeagueHighest } })
		// }
		// if (littleLeague < 4096) {
		// 	Object.assign(pvp, { 500: { minCp: Math.max(littleLeagueCP, pvpFilterLittleMinCP), worst: Math.min(littleLeague, pvpFilterMaxRank), best: littleLeagueHighest } })
		// }

		if (Object.keys(filteredPvp).length > 1) {
			await msg.react(translator.translate('🙅'))
			return await msg.reply(`${translator.translate('Oops, more than one league PVP parameters were set in command! - check the')} \`${util.prefix}${translator.translate('help')}\``)
		}

		// ['great_league_ranking', 'ultra_league_ranking'].forEach((league, i) => {
		// 	const minCp = `${league}_min_cp`
		// 	const minCpFilter = i ? 'pvpFilterUltraMinCP' : 'pvpFilterGreatMinCP'
		// 	// if a value for great/ultra league rank was given, force it to be not greater than pvpFilterMaxRank
		// 	if (trackDefaults[league] < 4096 && trackDefaults[league] > pvpFilterMaxRank) {
		// 		trackDefaults[league] = pvpFilterMaxRank
		// 	}
		// 	// if a value for great/ultra league CP was given, force it to be not less than pvpFilterGreatMinCP/pvpFilterUltraMinCP
		// 	if (trackDefaults[minCp] > 0 && trackDefaults[minCp] < client.config.pvp[minCpFilter]) {
		// 		trackDefaults[minCp] = client.config.pvp[minCpFilter]
		// 	}
		// 	// if a value for great/ultra league rank was given but none for great/ultra league CP, set the later implicitly to pvpFilterGreatMinCP/pvpFilterUltraMinCP
		// 	if (trackDefaults[league] < 4096 && trackDefaults[minCp] === 0) {
		// 		trackDefaults[minCp] = client.config.pvp[minCpFilter]
		// 	}
		// 	// if a value for great/ultra league CP was given but none for great/ultra league rank, set the later implicitly to pvpFilterMaxRank
		// 	if (trackDefaults[minCp] > 0 && trackDefaults[league] === 4096) {
		// 		trackDefaults[league] = pvpFilterMaxRank
		// 	}
		// })

		if (client.config.tracking.defaultDistance !== 0 && trackDefaults.distance === 0 && !msg.isFromAdmin) {
			trackDefaults.distance = client.config.tracking.defaultDistance
		}
		if (client.config.tracking.maxDistance !== 0 && trackDefaults.distance > client.config.tracking.maxDistance && !msg.isFromAdmin) {
			trackDefaults.distance = client.config.tracking.maxDistance
		}

		['rarity', 'max_rarity'].forEach((rarity, i) => {
			const peak = i ? 6 : -1
			if (trackDefaults[rarity] !== peak && ![1, 2, 3, 4, 5, 6].includes(trackDefaults[rarity])) {
				trackDefaults[rarity] = client.translatorFactory.reverseTranslateCommand(trackDefaults[rarity], true)
				const rarityLevel = Object.keys(client.GameData.utilData.rarity).find((x) => client.GameData.utilData.rarity[x].toLowerCase() === trackDefaults[rarity].toLowerCase())
				if (rarityLevel) {
					trackDefaults[rarity] = rarityLevel
				} else {
					trackDefaults[rarity] = peak
				}
			}
		})

		if (trackDefaults.distance > 0 && !userHasLocation && !target.webhook) {
			await msg.react(translator.translate('🙅'))
			return await msg.reply(`${translator.translate('Oops, a distance was set in command but no location is defined for your tracking - check the')} \`${util.prefix}${translator.translate('help')}\``)
		}
		if (trackDefaults.distance === 0 && !userHasArea && !target.webhook && !msg.isFromAdmin) {
			await msg.react(translator.translate('🙅'))
			return await msg.reply(`${translator.translate('Oops, no distance was set in command and no area is defined for your tracking - check the')} \`${util.prefix}${translator.translate('help')}\``)
		}
		if (trackDefaults.distance === 0 && !userHasArea && !target.webhook && msg.isFromAdmin) {
			await msg.reply(`${translator.translate('Warning: Admin command detected without distance set - using default distance')} ${client.config.tracking.defaultDistance}`)
			trackDefaults.distance = client.config.tracking.defaultDistance
		}

		const insert = monsters.map((mon) => ({
			...trackDefaults,
			...filteredPvp[Object.keys(filteredPvp)[0]],
			id: target.id,
			profile_no: currentProfileNo,
			pokemon_id: mon.id,
			form: mon.form.id,
			// max_atk: +maxAtk,
			// max_def: +maxDef,
			// max_sta: +maxSta,
			// gender: +gender,
			// clean: +clean,
			// great_league_ranking: (+pvpLeague === 1500) ? +pvp[pvpLeague].worst : 4096,				// deprecated
			// great_league_ranking_min_cp: (+pvpLeague === 1500) ? +pvp[pvpLeague].minCp : 0,			// deprecated
			// ultra_league_ranking: (+pvpLeague === 2500) ? +pvp[pvpLeague].worst : 4096,				// deprecated
			// ultra_league_ranking_min_cp: (+pvpLeague === 2500) ? +pvp[pvpLeague].minCp : 0,			// deprecated
			// pvp_ranking_league: +pvpLeague,
			// pvp_ranking_best: pvpLeague ? +pvp[pvpLeague].best : 1,
			// pvp_ranking_worst: pvpLeague ? +pvp[pvpLeague].worst : 4096,
			// pvp_ranking_min_cp: pvpLeague ? +pvp[pvpLeague].minCp : 0,
			// rarity: +rarity,
			// max_rarity: +maxRarity,
			// min_time: +minTime,
		}))
		if (!insert.length) {
			return await msg.reply(translator.translate('404 No monsters found'))
		}

		const tracked = await client.query.selectAllQuery('monsters', { id: target.id, profile_no: currentProfileNo })
		const updates = []
		const alreadyPresent = []

		for (let i = insert.length - 1; i >= 0; i--) {
			const toInsert = insert[i]

			for (const existing of tracked.filter((x) => x.pokemon_id === toInsert.pokemon_id)) {
				const differences = client.updatedDiff(existing, toInsert)

				switch (Object.keys(differences).length) {
					case 1:		// No differences (only UID)
						// No need to insert
						alreadyPresent.push(toInsert)
						insert.splice(i, 1)
						break
					case 2:		// One difference (something + uid)
						if (Object.keys(differences).some((x) => ['min_iv', 'distance', 'template', 'clean'].includes(x))) {
							updates.push({
								...toInsert,
								uid: existing.uid,
							})
							insert.splice(i, 1)
						}
						break
					default:	// more differences
						break
				}
			}
		}

		let message = ''

		if ((alreadyPresent.length + updates.length + insert.length) > 50) {
			message = translator.translateFormat('I have made a lot of changes. See {0}{1} for details', util.prefix, translator.translate('tracked'))
		} else {
			alreadyPresent.forEach((monster) => {
				message = message.concat(translator.translate('Unchanged: '), trackedCommand.monsterRowText(client.config, translator, client.GameData, monster), '\n')
			})
			updates.forEach((monster) => {
				message = message.concat(translator.translate('Updated: '), trackedCommand.monsterRowText(client.config, translator, client.GameData, monster), '\n')
			})
			insert.forEach((monster) => {
				message = message.concat(translator.translate('New: '), trackedCommand.monsterRowText(client.config, translator, client.GameData, monster), '\n')
			})
		}

		await client.query.deleteWhereInQuery('monsters', {
			id: target.id,
			profile_no: currentProfileNo,
		},
		updates.map((x) => x.uid),
		'uid')

		await client.query.insertQuery('monsters', [...insert, ...updates])

		reaction = insert.length ? '✅' : reaction
		await msg.reply(message, { style: 'markdown' })
		await msg.react(reaction)

		client.log.info(`${logReference} ${target.name} started tracking monsters: ${monsters.map((m) => m.name).join(', ')}`)
	} catch (err) {
		client.log.error(`${logReference} Track command unhappy:`, err)
		msg.reply(`There was a problem making these changes, the administrator can find the details with reference ${logReference}`)
	}
}
