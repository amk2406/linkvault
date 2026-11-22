const path = require('path')
const http = require('http');
require('dotenv').config({quiet: true})

const helmet = require('helmet');
const express = require('express');
const logger = require('node-logger');
const ua = require('ua-parser')
const session = require('express-session');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const app = express();
const httpapp = http.createServer(app);

const log = console.log;
const logerr = console.error;
const env = process.env;
const config = {
    logpath: env.LOGPATH || 'logs',
    windowms: parseInt(env.XLIMITMS) || 234,
    ratelimit: parseInt(env.XRATELIMIT) || 100,
    port: env.PORT || 4041, host: env.HOST || '0.0.0.0'
};

const { getRetrySeconds } = require('./helpers/timer');
const auth = require('./route/auth.js');
const url = require('./route/url.js');
const {validateSession, requireAuth} = require('./services/session.manager.js')
const dashboard = require('./route/dashboard');
const { users } = require('./db.js');
logger({ path: path.resolve(config.logpath),
  showTimestampInConsole: false, exitOnUnexpected: false,
});

const limiter = rateLimit({
	windowMs: config.windowms,
	limit: config.ratelimit,
  handler: async (req, res, next)=>{
    try {
      if (req.method.toLowerCase() === 'get') {
        const retryAfter = res.getHeader("Retry-After");
        return res.status(429).render('errors/429', {retryAfterSeconds: getRetrySeconds(retryAfter, 300)})
      }
    } catch (error) {
      error.fromstatic = true
      next(error)
    }
  }
});


app.set('view engine', 'ejs');
app.set('views', path.resolve('public', 'views'));
app.set('trust proxy', 1);

app.use(limiter, express.urlencoded({extended: true}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: { defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"]
    }
  },
}));
app.use(express.json({limit: '8kb'}), express.static(path.resolve('public', 'pages', 'static'), {
  //maxAge: '7d',
  //immutable: true
}));
app.use(cookieParser(), async (req, res, next) => {
  req.userAgent = ua.parse(req.headers['user-agent']); next();
});

app.get('/', async (req, res, next) =>{
    try {
        res.status(200).sendFile(path.resolve('public', 'pages', 'index.html'))
    } catch (error) {
      error.fromstatic = true
      next(error)
    }
});

app.use(async (req, res, next) => {
  if (req.userAgent && req.userAgent.isBot) {
    return res.status(403).render('errors/403', {})
  } else{
    next()
  }
});

app.use('/auth', auth);
app.use('/url', url);

app.use(validateSession, express.static(path.resolve('public', 'assets/')), async (req, res, next) =>{
  try {
    if (!req.userid)res.status(400).redirect('/auth/signin')
    const {password, ...remaining} =  userdata = await users.findOneAsync({userid: req.userid})
    if(!userdata) res.status(400).redirect('/auth/signin');
    req.userdata = remaining
    next()
  } catch (error) {
    error.fromstatic = true
    next(error)
  }
})

app.use(dashboard);


app.use(async (req, res, next) =>{
  try {
    if(req.method.toLowerCase() === 'get') {
      const valid = req.userid ? true : false
      return res.status(404).render('errors/404', {valid})
    }   
  } catch (error) {
    next(error)
  }
});

app.use(async (err, req, res, next) => {
  try {
    log(err)
    if(req.method.toLowerCase() === 'get') {
      if (err.fromstatic) {
        return res.status(500).render('errors/error', {})
      }
      return res.status(500).render('errors/500', {})
    } else {
      if (req.url === ('/auth/signin') || req.url === ( '/auth/signup')) {
        return res.status(500).render('errors/error', {})
      } else {
        return res.status(500).json({success: false, status: 500, error: 'INTERNAL_ERR', message: 'Something went wrong while processing your request, Please try again in a few moments'})
      }

    }
  } catch (error) {
    log('[EXP ERR] error route midleware', error)
  }
});


httpapp.listen(config.port, config.host , (err)=>{
  if (err) logerr('[HTTP ERR]', err)
    log(`> [HTTP] Server is up and running on port: ${config.port} and host: ${config.host}`)
});

httpapp.on('error', async (err) =>{
  logerr('[HTTP ERR]', err)
});

const killcode = ['uncaughtException', 'uncaughtExceptionMonitor', 'unhandledRejection', 'rejectionHandled']
killcode.forEach(code =>{
    process.on(code, () =>{

    })
});