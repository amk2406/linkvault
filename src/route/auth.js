const express = require('express');
const limit = require('express-rate-limit');
const validator = require('express-validator');

const auth = express.Router()

auth.get('/signin', async (req, res, next) => {
    try {
        res.status(200).render('auth/signin', {})
    } catch (error) {
        error.fromstatic = true
        next(error)
    }
})

auth.get('/signup', async (req, res, next) => {
    try {
        res.status(200).render('auth/signup', {})
    } catch (error) {
        error.fromstatic = true
        next(error)
    }
})
const ratelimit = limit({
    windowMs: 1000 * 60 * 7,
    limit: 5,
    handler: async (req, res, next) => {
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
})


auth.post('/signin', ratelimit, async (req, res, next) => {
    
})

auth.post('/signup', ratelimit, async (req, res, next) => {
    try {
        a
    } catch (error) {
        error.fromstatic = true
        next(error)
    }
})

module.exports = auth