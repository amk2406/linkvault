const express = require('express');
const limit = require('express-rate-limit');
const {validatSignin, validatSignup} = require('../services/form.validator');
const users = require('../db').urltracker

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


auth.post('/signin', ratelimit, validatSignin, async (req, res, next) => {
    
})

auth.post('/signup', ratelimit, validatSignup, async (req, res, next) => {
    try {
        const userid = req.userid || req.userdata.userid
        const userdata = req.userdata
        const email = userdata.email
        const isfoundemail = await users.findOneAsync({email})
        if(email) return res.status(400).render('auth/signup', {error: 'Email already exist, try another one.'})
        
        await users.insertAsync(userdata).catch(error =>{
            console.log(error)
            return res.status(500).render('auth/signup', {error: `Something went wrong while Process you Request — Your request didn't go through, Please try again in a few moments.`})
        }).then(inserted =>{
            return res.status(200).redirect('/dashboard')
        })

    } catch (error) {
        error.fromstatic = true
        next(error)
    }
})

module.exports = auth