exports.run = async (client, msg, args) => {
	try {
		// Check target
		const util = client.createUtil(msg, args)

		const {
			canContinue, target, userHasLocation, userHasArea, language,
		} = await util.buildTarget(args)

		if (!canContinue) return
		const translator = client.translatorFactory.Translator(language)

		const typeArray = Object.keys(client.utilData.types).map((o) => o.toLowerCase())

		let reaction = '👌'

		const remove = !!args.find((arg) => arg === 'remove')

		let monsters = []
		let exclusive = 0
		let distance = 0
		let team = 4
		let template = 1
		let clean = false
		let levels = []
		const pings = msg.getPings()
		const formNames = args.filter((arg) => arg.match(client.re.formRe)).map((arg) => arg.match(client.re.formRe)[2])
		const argTypes = args.filter((arg) => typeArray.includes(arg))

		if (formNames.length) {
			monsters = Object.values(client.monsters).filter((mon) => ((args.includes(mon.name.toLowerCase()) || args.includes(mon.id.toString())) && formNames.includes(mon.form.name.toLowerCase())
					|| mon.types.map((t) => t.name.toLowerCase()).find((t) => argTypes.includes(t)) && formNames.includes(mon.form.name.toLowerCase())
					|| args.includes('template'))	&& formNames.includes(mon.form.name.toLowerCase()))
		} else {
			monsters = Object.values(client.monsters).filter((mon) => ((args.includes(mon.name.toLowerCase()) || args.includes(mon.id.toString())) && !mon.form.id
					|| mon.types.map((t) => t.name.toLowerCase()).find((t) => argTypes.includes(t)) && !mon.form.id
					|| args.includes('template'))	&& !mon.form.id)
		}

		const genCommand = args.filter((arg) => arg.match(client.re.genRe))
		const gen = genCommand.length ? client.utilData.genData[+genCommand[0].replace(client.translator.translate('gen'), '')] : 0

		if (gen) monsters = monsters.filter((mon) => mon.id >= gen.min && mon.id <= gen.max)

		args.forEach((element) => {
			if (element === 'ex') exclusive = 1
			else if (element.match(client.re.levelRe)) levels.push(element.match(client.re.levelRe)[2])
			else if (element.match(client.re.templateRe)) [,, template] = element.match(client.re.templateRe)
			else if (element.match(client.re.dRe)) [,, distance] = element.match(client.re.dRe)
			else if (element === 'instinct') team = 3
			else if (element === 'valor') team = 2
			else if (element === 'mystic') team = 1
			else if (element === 'harmony') team = 0
			else if (element === 'everything') levels = [1, 2, 3, 4, 5, 6]
			else if (element === 'clean') clean = true
		})
		if (client.config.tracking.defaultDistance !== 0 && distance === 0) distance = client.config.tracking.defaultDistance
		if (client.config.tracking.maxDistance !== 0 && distance > client.config.tracking.maxDistance) distance = client.config.tracking.maxDistance
		if (distance > 0 && !userHasLocation && !remove) {
			await msg.react(translator.translate('🙅'))
			return await msg.reply(`${translator.translate('Oops, a distance was set in command but no location is defined for your tracking - check the')} \`${util.prefix}${translator.translate('help')}\``)
		}
		if (distance === 0 && !userHasArea && !remove) {
			await msg.react(translator.translate('🙅'))
			return await msg.reply(`${translator.translate('Oops, no distance was set in command and no area is defined for your tracking - check the')} \`${util.prefix}${translator.translate('help')}\``)
		}
		if (!levels.length && !monsters.length) {
			return await msg.reply(translator.translate('404 no valid tracks found'))
		}

		if (!remove) {
			const insert = monsters.map((mon) => ({
				id: target.id,
				pokemon_id: mon.id,
				ping: pings,
				exclusive: !!exclusive,
				template,
				distance,
				team,
				clean,
				level: 9000,
				form: mon.form.id,
			}))

			levels.forEach((level) => {
				insert.push({
					id: target.id,
					pokemon_id: 9000,
					ping: pings,
					exclusive: !!exclusive,
					template,
					distance,
					team,
					clean,
					level,
					form: 0,
				})
			})

			const result = await client.query.insertOrUpdateQuery('raid', insert)
			client.log.info(`${target.name} started tracking level ${levels.join(', ')} raids`)
			reaction = result.length || client.config.database.client === 'sqlite' ? '✅' : reaction
		} else {
			const monsterIds = monsters.map((mon) => mon.id)
			let result = 0
			if (monsterIds.length) {
				const monResult = await client.query.deleteWhereInQuery('raid', target.id, monsterIds, 'pokemon_id')
				result += monResult
			}
			if (levels.length) {
				const lvlResult = await client.query.deleteWhereInQuery('raid', target.id, levels, 'level')
				client.log.info(`${target.name} stopped tracking level ${levels.join(', ')} raids`)
				result += lvlResult
			}
			reaction = result.length || client.config.database.client === 'sqlite' ? '✅' : reaction
		}
		await msg.react(reaction)
	} catch (err) {
		client.log.error('raid command unhappy:', err)
	}
}
