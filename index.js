'use strict'

const express = require('express')
const http = require('http')
const corser = require('corser')
const compression = require('compression')

const api = express()
const server = http.createServer(api)

const allowed = corser.simpleRequestHeaders.concat(['User-Agent'])
api.use(corser.create({ requestHeaders: allowed })) // CORS
api.use(compression())

api.use((err, req, res, next) => {
	if (res.headersSent) return next(err)
	res.status(err.statusCode || 500).json({ ok: false, msg: err.message })
	next()
})

server.listen(port, (e) => {
	if (e) return console.error(e)
	console.log(`Listening on ${port}.`)
})
