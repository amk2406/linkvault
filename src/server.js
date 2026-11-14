const path = require('path')
const http = require('http');
require('dotenv').config({quiet: true})

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('node-logger');
const session = require('express-session');
const cookieParser = require('cookie-parser');

const app = express()
const httpapp = http.createServer(app)

const log = console.log
const env = process.env
const config = {
    logpath: env.LOGPATH || 'logs',
    windowms: parseInt(env.XLIMITMS) || 234,
    ratelimit: parseInt(env.XRATELIMIT) || 100,
    port: env.PORT || 4041, host: env.HOST || '0.0.0.0'
}

logger({ path: path.resolve(config.logpath),
  showTimestampInConsole: false, exitOnUnexpected: false,
});

const limiter = rateLimit({
	windowMs: config.windowms,
	limit: config.ratelimit
})


app.set('view engine', 'ejs');
app.set('views', path.resolve('public', 'views'));
app.set('trust proxy', 1);

app.use(limiter, helmet(), express.urlencoded({extended: true}))
app.use(express.json({limit: '8kb'}), express.static(path.resolve('public', 'pages', 'static')))
app.use(cookieParser())

app.get('/', async (req, res) =>{
    res.render('index', {})
})



httpapp.listen(config.port, config.host , ()=>{
    console.log('> Server is up and running on port : ' + config.port, 'and host:', config.host)
})


const killcode = ['uncaughtException', 'uncaughtExceptionMonitor', 'unhandledRejection', 'rejectionHandled']
killcode.forEach(code =>{
    process.on(code, () =>{

    })
})