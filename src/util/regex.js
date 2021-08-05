function createCommandRegex(translatorFactory, commandName, paramMatch, flags = 'i') {
	const translatedCommands = translatorFactory.translateCommand(commandName)
	// sort longest name first to avoid matching partials
	translatedCommands.sort((a, b) => b.length - a.length)
	// ASC  -> a.length - b.length
	// DESC -> b.length - a.length

	let first = true
	let expr = '^('
	for (const translatedCommand of translatedCommands) {
		if (first) {
			first = false
		} else {
			expr += '|'
		}

		expr += translatedCommand
	}
	expr += `):?(${paramMatch})`

	return new RegExp(expr, flags)
}

module.exports = (translatorFactory) => ({
	nameRe: createCommandRegex(translatorFactory, 'name', '\\S+'),
	userRe: createCommandRegex(translatorFactory, 'user', '-?\\d{1,20}'),
	formRe: createCommandRegex(translatorFactory, 'form', '.+'),
	genRe: createCommandRegex(translatorFactory, 'gen', '[1-8]+'),
	max_levelRe: createCommandRegex(translatorFactory, 'maxlevel', '\\d{1,2}'),
	templateRe: createCommandRegex(translatorFactory, 'template', '.+'),
	max_cpRe: createCommandRegex(translatorFactory, 'maxcp', '\\d{1,5}'),
	max_ivRe: createCommandRegex(translatorFactory, 'maxiv', '\\d{1,3}'),
	max_weightRe: createCommandRegex(translatorFactory, 'maxweight', '\\d{1,6}'),
	max_rarityRe: createCommandRegex(translatorFactory, 'maxrarity', '.+'),
	max_atkRe: createCommandRegex(translatorFactory, 'maxatk', '\\d{1,2}'),
	max_defRe: createCommandRegex(translatorFactory, 'maxdef', '\\d{1,2}'),
	max_staRe: createCommandRegex(translatorFactory, 'maxsta', '\\d{1,2}'),
	cpRe: createCommandRegex(translatorFactory, 'cp', '\\d{1,5}'),
	min_levelRe: createCommandRegex(translatorFactory, 'level', '\\d{1,2}'),
	min_ivRe: createCommandRegex(translatorFactory, 'iv', '\\d{1,3}'),
	atkRe: createCommandRegex(translatorFactory, 'atk', '\\d{1,2}'),
	defRe: createCommandRegex(translatorFactory, 'def', '\\d{1,2}'),
	staRe: createCommandRegex(translatorFactory, 'sta', '\\d{1,2}'),
	min_weightRe: createCommandRegex(translatorFactory, 'weight', '\\d{1,8}'),
	rarityRe: createCommandRegex(translatorFactory, 'rarity', '.+'),
	great_league_rankingRe: createCommandRegex(translatorFactory, 'great', '\\d{1,4}'),
	great_league_ranking_min_cpRe: createCommandRegex(translatorFactory, 'greatcp', '\\d{1,5}'),
	ultra_league_rankingRe: createCommandRegex(translatorFactory, 'ultra', '\\d{1,4}'),
	ultra_league_ranking_min_cpRe: createCommandRegex(translatorFactory, 'ultracp', '\\d{1,5}'),
	dRe: createCommandRegex(translatorFactory, 'd', '[\\d.]{1,}'),
	tRe: createCommandRegex(translatorFactory, 't', '\\d{1,4}'),
	stardustRe: createCommandRegex(translatorFactory, 'stardust', '\\d{1,8}'),
	energyRe: createCommandRegex(translatorFactory, 'energy', '\\S+'),
	candyRe: createCommandRegex(translatorFactory, 'candy', '\\S+'),
	channelRe: createCommandRegex(translatorFactory, 'channel', '\\d{1,20}'),
	guildRe: createCommandRegex(translatorFactory, 'guild', '\\d{1,20}'),
	areaRe: createCommandRegex(translatorFactory, 'area', '.+'),
	languageRe: createCommandRegex(translatorFactory, 'language', '.+'),
	monRe: createCommandRegex(translatorFactory, 'mon', '(\\d\\d?)?(:?)(\\d\\d?)?'),
	tueRe: createCommandRegex(translatorFactory, 'tue', '(\\d\\d?)?(:?)(\\d\\d?)?'),
	wedRe: createCommandRegex(translatorFactory, 'wed', '(\\d\\d?)?(:?)(\\d\\d?)?'),
	thuRe: createCommandRegex(translatorFactory, 'thu', '(\\d\\d?)?(:?)(\\d\\d?)?'),
	friRe: createCommandRegex(translatorFactory, 'fri', '(\\d\\d?)?(:?)(\\d\\d?)?'),
	satRe: createCommandRegex(translatorFactory, 'sat', '(\\d\\d?)?(:?)(\\d\\d?)?'),
	sunRe: createCommandRegex(translatorFactory, 'sun', '(\\d\\d?)?(:?)(\\d\\d?)?'),
	weekdayRe: createCommandRegex(translatorFactory, 'weekday', '(\\d\\d?)?(:?)(\\d\\d?)?'),
	weekendRe: createCommandRegex(translatorFactory, 'weekend', '(\\d\\d?)?(:?)(\\d\\d?)?'),
	minspawnRe: createCommandRegex(translatorFactory, 'minspawn', '(\\d\\d?)?(:?)(\\d\\d?)?'),
}
)
