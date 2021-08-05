const helpCommand = require('./help')
const trackedCommand = require('./tracked')

const trackTranslate = {
	formRe: 'form',
	genRe: 'gen',
	maxlevelRe: 'max_level',
	templateRe: 'template',
	maxcpRe: 'max_cp',
	maxivRe: 'max_iv',
	maxweightRe: 'max_weight',
	maxRarityRe: 'max_rarity',
	maxatkRe: 'max_atk',
	maxdefRe: 'max_def',
	maxstaRe: 'max_sta',
	cpRe: 'min_cp',
	levelRe: 'min_level',
	ivRe: 'min_iv',
	atkRe: 'atk',
	defRe: 'def',
	staRe: 'sta',
	weightRe: 'min_weight',
	rarityRe: 'rarity',
}

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
		const pvp = {}
		const { leagues } = client.config.pvp
		Object.keys(leagues).forEach((league) => {
			const base = `${league}_league`
			trackTranslate[`${league}LeagueRe`] = base
			trackTranslate[`${league}LeagueHighestRe`] = `${base}_highest`
			trackTranslate[`${league}LeagueCPRe`] = `${base}_cp`
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
			great_league_ranking: 4096,
			great_league_ranking_min_cp: 0,
			ultra_league_ranking: 4096,
			ultra_league_ranking_min_cp: 0,
			pvp_ranking_worst: 4096,
			pvp_ranking_best: 1,
			pvp_ranking_min_cp: 0,
			pvp_ranking_league: 0,
			clean: 0,
			template: client.config.general.defaultTemplateName.toString(),
			ping: msg.getPings(),
		}

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
				case 'clean': trackDefaults.clean = 1; break
				default:
					match = Object.keys(client.re).find((x) => element.match(client.re[x]))
					if (match) {
						const command = trackTranslate[match]
						if (command.includes('league')) {
							[input] = command.split('_')
							if (input) [, , pvp[input][command]] = element.match(client.re[match])
						} else if (trackDefaults[command] !== undefined) {
							[, , trackDefaults[command]] = element.match(client.re[match])
							input = command.replace('_', '')
						}
					}
			}
			if (match && !await util.commandAllowed(input)) {
				await msg.react('🚫')
				return msg.reply(translator.translateFormat('You do not have permission to use the `{0}` parameter',
					translator.translate(input)))
			}
		}

		const filteredPvp = {}
		Object.keys(leagues).forEach((league) => {
			const base = `${league}_league`
			if (pvp[league][base] < 4096) {
				filteredPvp[league] = {
					pvp_ranking_min_cp: Math.max(pvp[league][`${base}_cp`], client.config.pvp[`pvpFilter${league.charAt(0).toUpperCase()}${league.slice(1)}MinCP`]),
					pvp_ranking_worst: Math.min(pvp[league][base], Math.min(client.config.pvp.pvpFilterMaxRank, 4096)),
					pvp_ranking_best: pvp[league][`${base}_highest`],
					pvp_ranking_league: leagues[league],
				}
			}
		})

		if (Object.keys(filteredPvp).length > 1) {
			await msg.react(translator.translate('🙅'))
			return await msg.reply(`${translator.translate('Oops, more than one league PVP parameters were set in command! - check the')} \`${util.prefix}${translator.translate('help')}\``)
		}

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
