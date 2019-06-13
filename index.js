'use strict'

const express = require('express')
const http = require('http')
const corser = require('corser')
const compression = require('compression')
const bodyParser = require('body-parser')
const path = require('path')
const fs = require('fs')
const pify = require('pify')
const get = require('lodash/get')
const pick = require('lodash/pick')

const port = process.env.PORT || '3000'
const volumeDirectory = process.env.VOLUME_DIRECTORY || '/mnt/europa_volume'
const dataPath = path.resolve(volumeDirectory, './data.ndjson')

const promisedAppendFile = pify(fs.appendFile)
const appendData = line => promisedAppendFile(dataPath, line)

const api = express()
const server = http.createServer(api)

const allowed = corser.simpleRequestHeaders.concat(['User-Agent'])
api.use(corser.create({ requestHeaders: allowed })) // CORS
api.use(compression())
api.use(bodyParser.json({ type: '*/*' }))

const validateRecording = recording => {
	const bssid = get(recording, 'wifi.bssid')
	if (typeof bssid !== 'string' || bssid.length < 1) return null

	const ssid = get(recording, 'wifi.ssid')
	if (typeof ssid !== 'string' || ssid.length < 1) return null

	const station = get(recording, 'station')
	if (typeof station !== 'string' || station.length !== 12) return null

	const direction = get(recording, 'direction')
	if (typeof direction !== 'string' || direction.length !== 12) return null

	const line = get(recording, 'line')
	if (typeof line !== 'string' || line.length < 1) return null

	return {
		wifi: pick(recording.wifi, ['ssid', 'bssid']),
		...pick(recording, ['line', 'station', 'direction'])
	}
}

api.get('/data.ndjson', (req, res, next) => {
	res.setHeader('content-type', 'application/x-ndjson')
	const readStream = fs.createReadStream(dataPath)
	readStream.on('error', error => {
		error.code = 500
		next(error)
	})
	readStream.pipe(res)
})

api.post('/', async (req, res, next) => {
	const recording = get(req, 'body')
	const validatedRecording = validateRecording(recording)
	if (!validatedRecording) return next({ statusCode: 400, message: 'Invalid recording' })

	try {
		await appendData(JSON.stringify(validatedRecording) + '\n')
		res.status(200).json({ ok: true })
	} catch (error) {
		error.code = 500
		next(error)
	}
})

api.use((err, req, res, next) => {
	if (res.headersSent) return next(err)
	res.status(err.statusCode || 500).json({ ok: false, msg: err.message })
	next()
})

server.listen(port, (e) => {
	if (e) return console.error(e)
	console.log(`Listening on ${port}.`)
})
