exports.run = async (client, msg) => {
	if (!client.config.discord.channels.includes(msg.channel.id)) {
		return client.log.info(`${msg.author.tag} tried to register in ${msg.channel.name}`)
	}
	try {
		const command = msg.content.split(' ')[0].substring(1)

		let language = ''

		if (client.config.general.registrationLanguages) {
			for (const l in client.config.general.registrationLanguages) {
				if (client.config.general.registrationLanguages[l].poracle == command) {
					language = l
				}
			}
		}

		const isRegistered = await client.query.countQuery('humans', { id: msg.author.id })
		if (isRegistered) {
			await msg.react('👌')
//			await client.query.updateQuery('humans', { language: language }, { id: msg.author.id })
		} else {
			await client.query.insertQuery('humans', {
				id: msg.author.id, type: 'discord:user', name: client.emojiStrip(msg.author.username), area: '[]', language: language
			})
			await msg.react('✅')
		}

		let greetingDts = client.dts.find((template) => template.type === 'greeting' && template.platform === 'discord' && template.language == language)
		if (!greetingDts) {
			greetingDts = client.dts.find((template) => template.type === 'greeting' && template.platform === 'discord' && template.default)
		}

		if (greetingDts) {
			const view = {prefix: client.config.discord.prefix}
			const greeting = client.mustache.compile(JSON.stringify(greetingDts.template))
			await msg.author.send(JSON.parse(greeting(view)))
		}
		client.log.info(`${client.emojiStrip(msg.author.username)} Registered!`)
	} catch (err) {
		client.log.error('!poracle command errored with:', err)
	}
}
