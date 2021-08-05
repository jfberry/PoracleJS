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
		// Set defaults
		let monsters
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
			great_league_ranking: 4096,
			great_league_ranking_min_cp: 0,
			ultra_league_ranking: 4096,
			ultra_league_ranking_min_cp: 0,
			clean: false,
			template: client.config.general.defaultTemplateName,
			ping: msg.getPings(),
		}
		const pvpFilterMaxRank = Math.min(client.config.pvp.pvpFilterMaxRank, 4096)

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
        || args.includes('everything') && msg.isFromAdmin) && !mon.form.id)

			if (gen) {
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
						input = command.includes('ranking') ? command.split('_')[0] : command.replace('_', '')
						if (command) [, , trackDefaults[command]] = element.match(client.re[match])
					}
			}
			if (!await util.commandAllowed(input)) {
				await msg.react('🚫')
				return msg.reply(translator.translateFormat('You do not have permission to use the `{0}` parameter',
					translator.translate(input)))
			}
		}
		if ((trackDefaults.great_league_ranking < 4096 && trackDefaults.ultra_league_ranking < 4096) || (trackDefaults.great_league_ranking < 4096 && trackDefaults.ultra_league_ranking_min_cp > 0) || (trackDefaults.great_league_ranking_min_cp > 0 && trackDefaults.ultra_league_ranking < 4096) || (trackDefaults.great_league_ranking_min_cp > 0 && trackDefaults.ultra_league_ranking_min_cp > 0)) {
			await msg.react(translator.translate('🙅'))
			return await msg.reply(`${translator.translate('Oops, both Great and Ultra league parameters were set in command! - check the')} \`${util.prefix}${translator.translate('help')}\``)
		}

		['great_league_ranking', 'ultra_league_ranking'].forEach((league, i) => {
			const minCp = `${league}_min_cp`
			const minCpFilter = i ? 'pvpFilterUltraMinCP' : 'pvpFilterGreatMinCP'
			// if a value for great/ultra league rank was given, force it to be not greater than pvpFilterMaxRank
			if (trackDefaults[league] < 4096 && trackDefaults[league] > pvpFilterMaxRank) {
				trackDefaults[league] = pvpFilterMaxRank
			}
			// if a value for great/ultra league CP was given, force it to be not less than pvpFilterGreatMinCP/pvpFilterUltraMinCP
			if (trackDefaults[minCp] > 0 && trackDefaults[minCp] < client.config.pvp[minCpFilter]) {
				trackDefaults[minCp] = client.config.pvp[minCpFilter]
			}
			// if a value for great/ultra league rank was given but none for great/ultra league CP, set the later implicitly to pvpFilterGreatMinCP/pvpFilterUltraMinCP
			if (trackDefaults[league] < 4096 && trackDefaults[minCp] === 0) {
				trackDefaults[minCp] = client.config.pvp[minCpFilter]
			}
			// if a value for great/ultra league CP was given but none for great/ultra league rank, set the later implicitly to pvpFilterMaxRank
			if (trackDefaults[minCp] > 0 && trackDefaults[league] === 4096) {
				trackDefaults[league] = pvpFilterMaxRank
			}
		})

		if (client.config.tracking.defaultDistance !== 0 && trackDefaults.distance === 0 && !msg.isFromAdmin) {
			trackDefaults.distance = client.config.tracking.defaultDistance
		}
		if (client.config.tracking.maxDistance !== 0 && trackDefaults.distance > client.config.tracking.maxDistance && !msg.isFromAdmin) {
			trackDefaults.distance = client.config.tracking.maxDistance
		}

		if (trackDefaults.rarity !== -1 && !['1', '2', '3', '4', '5', '6'].includes(trackDefaults.rarity)) {
			trackDefaults.rarity = client.translatorFactory.reverseTranslateCommand(trackDefaults.rarity, true)
			const rarityLevel = Object.keys(client.GameData.utilData.rarity).find((x) => client.GameData.utilData.rarity[x].toLowerCase() === trackDefaults.rarity.toLowerCase())
			if (rarityLevel) {
				trackDefaults.rarity = rarityLevel
			} else {
				trackDefaults.rarity = -1
			}
		}
		if (trackDefaults.max_rarity !== 6 && !['1', '2', '3', '4', '5', '6'].includes(trackDefaults.max_rarity)) {
			trackDefaults.max_rarity = client.translatorFactory.reverseTranslateCommand(trackDefaults.max_rarity, true)
			const maxRarityLevel = Object.keys(client.GameData.utilData.rarity).find((x) => client.GameData.utilData.rarity[x].toLowerCase() === trackDefaults.max_rarity.toLowerCase())
			if (maxRarityLevel) {
				trackDefaults.max_rarity = maxRarityLevel
			} else {
				trackDefaults.max_rarity = 6
			}
		}

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
			id: target.id,
			profile_no: currentProfileNo,
			pokemon_id: mon.id,
			form: mon.form.id,
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
				message = message.concat(translator.translate('Unchanged: '), trackedCommand.monsterRowText(translator, client.GameData, monster), '\n')
			})
			updates.forEach((monster) => {
				message = message.concat(translator.translate('Updated: '), trackedCommand.monsterRowText(translator, client.GameData, monster), '\n')
			})
			insert.forEach((monster) => {
				message = message.concat(translator.translate('New: '), trackedCommand.monsterRowText(translator, client.GameData, monster), '\n')
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
		await msg.reply(message)
		await msg.react(reaction)

		client.log.info(`${logReference} ${target.name} started tracking monsters: ${monsters.map((m) => m.name).join(', ')}`)
	} catch (err) {
		client.log.error(`${logReference} Track command unhappy:`, err)
		msg.reply(`There was a problem making these changes, the administrator can find the details with reference ${logReference}`)
	}
}
