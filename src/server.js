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

function getRetrySeconds(value, fallback = 300) {
  if (!value) return fallback;

  // Retry-After can be a number of seconds.
  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.ceil(seconds);
  }

  // Or it can be an HTTP date.
  const date = Date.parse(value);

  if (!Number.isNaN(date)) {
    return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  }

  return fallback;
}

const limiter = rateLimit({
	windowMs: config.windowms,
	limit: config.ratelimit,
    handler: async (req, res)=>{
        
        if (req.method.toLowerCase() === 'get') {
            const retryAfter = res.getHeader("Retry-After");
            return res.status(429).render('errors/429', {retryAfterSeconds: getRetrySeconds(retryAfter, 300)})
        }
    }
})


app.set('view engine', 'ejs');
app.set('views', path.resolve('public', 'views'));
app.set('trust proxy', 1);

app.use(limiter, express.urlencoded({extended: true}))
app.use(helmet({
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"]
    }
  },
}));
app.use(express.json({limit: '8kb'}), express.static(path.resolve('public', 'pages', 'static')))
app.use(cookieParser())

app.get('/', async (req, res) =>{
    try {
        res.status(200).sendFile(path.resolve('public', 'pages', 'index.html'))
    } catch (error) {next(error)}
})

app.get('/400', async (req, res, next) =>{
    res.render('errors/400', {isvalid: false})
})


httpapp.listen(config.port, config.host , ()=>{
    log(`> Server is up and running on port: ${config.port} and host: ${config.host}`)
})


const killcode = ['uncaughtException', 'uncaughtExceptionMonitor', 'unhandledRejection', 'rejectionHandled']
killcode.forEach(code =>{
    process.on(code, () =>{

    })
})