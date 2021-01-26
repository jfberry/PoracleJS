const geoTz = require('geo-tz')
const moment = require('moment-timezone')
const Controller = require('./controller')

class Pokestop extends Controller {
	async invasionWhoCares(obj) {
		const data = obj
		let areastring = `humans.area like '%"${data.matched[0] || 'doesntexist'}"%' `
		data.matched.forEach((area) => {
			areastring = areastring.concat(`or humans.area like '%"${area}"%' `)
		})
		if (!data.gender) data.gender = -1
		let query = `
		select humans.id, humans.name, humans.type, humans.language, humans.latitude, humans.longitude, invasion.template, invasion.distance, invasion.clean, invasion.ping from invasion
		join humans on humans.id = invasion.id
		where humans.enabled = 1 and
		(invasion.grunt_type='${String(data.gruntType).toLowerCase()}' or invasion.grunt_type = 'everything') and
		(invasion.gender = ${data.gender} or invasion.gender = 0)`

		if (['pg', 'mysql'].includes(this.config.database.client)) {
			query = query.concat(`
			and
			(
				(
					round(
						6371000
						* acos(cos( radians(${data.latitude}) )
						* cos( radians( humans.latitude ) )
						* cos( radians( humans.longitude ) - radians(${data.longitude}) )
						+ sin( radians(${data.latitude}) )
						* sin( radians( humans.latitude ) )
						)
					) < invasion.distance and invasion.distance != 0)
					or
					(
						invasion.distance = 0 and (${areastring})
					)
			)
				group by humans.id, humans.name, humans.type, humans.language, humans.latitude, humans.longitude, invasion.template, invasion.distance, invasion.clean, invasion.ping
			`)
		} else {
			query = query.concat(`
				and ((invasion.distance = 0 and (${areastring})) or invasion.distance > 0)
				group by humans.id, humans.name, humans.type, humans.language, humans.latitude, humans.longitude, invasion.template, invasion.distance, invasion.clean, invasion.ping
			`)
		}

		let result = await this.db.raw(query)
		if (!['pg', 'mysql'].includes(this.config.database.client)) {
			result = result.filter((res) => res.distance === 0 || res.distance > 0 && res.distance > this.getDistance({ lat: res.latitude, lon: res.longitude }, { lat: data.latitude, lon: data.longitude }))
		}
		result = this.returnByDatabaseType(result)
		// remove any duplicates
		const alertIds = []
		result = result.filter((alert) => {
			if (!alertIds.includes(alert.id)) {
				alertIds.push(alert.id)
				return alert
			}
		})
		return result
	}

	async handle(obj) {
		let pregenerateTile = false
		const data = obj
		const minTth = this.config.general.monsterMinimumTimeTillHidden || 0
		// const minTth = this.config.general.alertMinimumTime || 0

		try {
			switch (this.config.geocoding.staticProvider.toLowerCase()) {
				case 'poracle': {
					data.staticmap = `https://tiles.poracle.world/static/${this.config.geocoding.type}/${+data.latitude.toFixed(5)}/${+data.longitude.toFixed(5)}/${this.config.geocoding.zoom}/${this.config.geocoding.width}/${this.config.geocoding.height}/${this.config.geocoding.scale}/png`
					break
				}
				case 'tileservercache': {
					pregenerateTile = true
					break
				}
				case 'google': {
					data.staticmap = `https://maps.googleapis.com/maps/api/staticmap?center=${data.latitude},${data.longitude}&markers=color:red|${data.latitude},${data.longitude}&maptype=${this.config.geocoding.type}&zoom=${this.config.geocoding.zoom}&size=${this.config.geocoding.width}x${this.config.geocoding.height}&key=${this.config.geocoding.staticKey[~~(this.config.geocoding.staticKey.length * Math.random())]}`
					break
				}
				case 'osm': {
					data.staticmap = `https://www.mapquestapi.com/staticmap/v5/map?locations=${data.latitude},${data.longitude}&size=${this.config.geocoding.width},${this.config.geocoding.height}&defaultMarker=marker-md-3B5998-22407F&zoom=${this.config.geocoding.zoom}&key=${this.config.geocoding.staticKey[~~(this.config.geocoding.staticKey.length * Math.random())]}`
					break
				}
				case 'mapbox': {
					data.staticmap = `https://api.mapbox.com/styles/v1/mapbox/streets-v10/static/url-https%3A%2F%2Fi.imgur.com%2FMK4NUzI.png(${data.longitude},${data.latitude})/${data.longitude},${data.latitude},${this.config.geocoding.zoom},0,0/${this.config.geocoding.width}x${this.config.geocoding.height}?access_token=${this.config.geocoding.staticKey[~~(this.config.geocoding.staticKey.length * Math.random())]}`
					break
				}
				default: {
					data.staticmap = ''
				}
			}

			data.mapurl = `https://www.google.com/maps/search/?api=1&query=${data.latitude},${data.longitude}`
			data.applemap = `https://maps.apple.com/maps?daddr=${data.latitude},${data.longitude}`
			data.imgUrl = data.url

			const incidentExpiration = data.incident_expiration ? data.incident_expiration : data.incident_expire_timestamp
			data.tth = moment.preciseDiff(Date.now(), incidentExpiration * 1000, true)
			data.distime = moment(incidentExpiration * 1000).tz(geoTz(data.latitude, data.longitude).toString()).format(this.config.locale.time)

			// Stop handling if it already disappeared or is about to go away
			if (data.tth.firstDateWasLater || ((data.tth.hours * 3600) + (data.tth.minutes * 60) + data.tth.seconds) < minTth) {
				this.log.debug(`${data.name} Invasion already disappeared or is about to go away in: ${data.tth.hours}:${data.tth.minutes}:${data.tth.seconds}`)
				return []
			}

			data.matched = await this.pointInArea([data.latitude, data.longitude])

			data.gruntTypeId = 0
			if (data.incident_grunt_type) {
				data.gruntTypeId = data.incident_grunt_type
			} else if (data.grunt_type) {
				data.gruntTypeId = data.grunt_type
			}

			data.gruntTypeEmoji = '❓'
			data.gruntTypeColor = 'BABABA'

			data.gender = 0
			data.gruntName = ''
			data.gruntTypeColor = 'BABABA'
			data.gruntRewards = ''
			data.gruntRewardsList = {}

			// Only enough to match for query

			if (data.gruntTypeId) {
				data.gender = 0
				data.gruntName = 'Grunt'
				data.gruntType = 'Mixed'
				data.gruntRewards = ''
				if (data.gruntTypeId in this.utilData.gruntTypes) {
					const gruntType = this.utilData.gruntTypes[data.gruntTypeId]
					data.gruntName = gruntType.grunt
					data.gender = gruntType.gender
					data.gruntType = gruntType.type
				}
			}

			const whoCares = await this.invasionWhoCares(data)

			this.log.info(`Invasion against ${data.gruntType} appeared and ${whoCares.length} humans cared.`)

			let discordCacheBad = true // assume the worst
			whoCares.forEach((cares) => {
				const { count } = this.getDiscordCache(cares.id)
				if (count <= this.config.discord.limitAmount + 1) discordCacheBad = false // but if anyone cares and has not exceeded cache, go on
			})

			if (discordCacheBad) return []

			const geoResult = await this.getAddress({ lat: data.latitude, lon: data.longitude })
			const jobs = []

			if (pregenerateTile) {
				data.staticmap = await this.tileserverPregen.getPregeneratedTileURL('pokestop', data)
			}

			for (const cares of whoCares) {
				const caresCache = this.getDiscordCache(cares.id).count

				const language = cares.language || this.config.general.locale
				const translator = this.translatorFactory.Translator(language)

				// full build
				if (data.gruntTypeId) {
					data.gender = 0
					data.gruntName = translator.translate('Grunt')
					data.gruntType = translator.translate('Mixed')
					data.gruntRewards = ''
					if (data.gruntTypeId in this.utilData.gruntTypes) {
						const gruntType = this.utilData.gruntTypes[data.gruntTypeId]
						data.gruntName = translator.translate(gruntType.grunt)
						data.gender = gruntType.gender
						data.genderDataEng = this.utilData.genders[data.gender]
						if (this.utilData.types[gruntType.type]) {
							data.gruntTypeEmoji = translator.translate(this.utilData.types[gruntType.type].emoji)
						}
						if (gruntType.type in this.utilData.types) {
							data.gruntTypeColor = this.utilData.types[gruntType.type].color
						}
						data.gruntType = translator.translate(gruntType.type)

						let gruntRewards = ''
						const gruntRewardsList = {}
						gruntRewardsList.first = { chance: 100, monsters: [] }
						if (gruntType.encounters) {
							if (gruntType.second_reward && gruntType.encounters.second) {
								// one out of two rewards
								gruntRewards = '85%: '
								gruntRewardsList.first = { chance: 85, monsters: [] }
								let first = true
								gruntType.encounters.first.forEach((fr) => {
									if (!first) gruntRewards += ', '
									else first = false

									const firstReward = +fr
									const firstRewardMonster = Object.values(this.monsterData).find((mon) => mon.id === firstReward && !mon.form.id)
									gruntRewards += firstRewardMonster ? translator.translate(firstRewardMonster.name) : ''
									gruntRewardsList.first.monsters.push({ id: firstReward, name: translator.translate(firstRewardMonster.name) })
								})
								gruntRewards += '\\n15%: '
								gruntRewardsList.second = { chance: 15, monsters: [] }
								first = true
								gruntType.encounters.second.forEach((sr) => {
									if (!first) gruntRewards += ', '
									else first = false

									const secondReward = +sr
									const secondRewardMonster = Object.values(this.monsterData).find((mon) => mon.id === secondReward && !mon.form.id)

									gruntRewards += secondRewardMonster ? translator.translate(secondRewardMonster.name) : ''
									gruntRewardsList.second.monsters.push({ id: secondReward, name: translator.translate(secondRewardMonster.name) })
								})
							} else {
								// Single Reward 100% of encounter (might vary based on actual fight).
								let first = true
								gruntType.encounters.first.forEach((fr) => {
									if (!first) gruntRewards += ', '
									else first = false

									const firstReward = +fr
									const firstRewardMonster = Object.values(this.monsterData).find((mon) => mon.id === firstReward && !mon.form.id)
									gruntRewards += firstRewardMonster ? translator.translate(firstRewardMonster.name) : ''
									gruntRewardsList.first.monsters.push({ id: firstReward, name: translator.translate(firstRewardMonster.name) })
								})
							}
							data.gruntRewards = gruntRewards
							data.gruntRewardsList = gruntRewardsList
						}
					}
				}

				const view = {
					...geoResult,
					...data,
					time: data.distime,
					tthh: data.tth.hours,
					tthm: data.tth.minutes,
					tths: data.tth.seconds,
					confirmedTime: data.disappear_time_verified,
					now: new Date(),
					genderData: {name: translator.translate(data.genderDataEng.name), emoji: translator.translate(data.genderDataEng.emoji)},
					areas: data.matched.map((area) => area.replace(/'/gi, '').replace(/ /gi, '-')).join(', '),
				}

				let [platform] = cares.type.split(':')
				if (platform == 'webhook') platform = 'discord'

				const mustache = this.getDts('invasion', platform, cares.template, language)
				if (mustache) {
					const message = JSON.parse(mustache(view, { data: { language } }))

					if (cares.ping) {
						if (!message.content) {
							message.content = cares.ping
						} else {
							message.content += cares.ping
						}
					}
					const work = {
						lat: data.latitude.toString().substring(0, 8),
						lon: data.longitude.toString().substring(0, 8),
						message: caresCache === this.config.discord.limitAmount + 1 ? { content: `You have reached the limit of ${this.config.discord.limitAmount} messages over ${this.config.discord.limitSec} seconds` } : message,
						target: cares.id,
						type: cares.type,
						name: cares.name,
						tth: data.tth,
						clean: cares.clean,
						emoji: caresCache === this.config.discord.limitAmount + 1 ? [] : data.emoji,
					}
					if (caresCache <= this.config.discord.limitAmount + 1) {
						jobs.push(work)
						this.addDiscordCache(cares.id)
					}
				}
			}

			return jobs
		} catch (e) {
			this.log.error('Can\'t seem to handle pokestop: ', e, data)
		}
	}
}

module.exports = Pokestop
