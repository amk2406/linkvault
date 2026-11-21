const express = require('express');
const limit = require('express-rate-limit');
const {validatSignin, validatSignup} = require('../services/form.validator');
const users = require('../db').users
const {createSession, removeSession, renewSession} = require('../services/session.manager')
const {hash, compare} = require('../services/password.manager')


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


auth.post('/signin', ratelimit, removeSession, validatSignin, async (req, res, next) => {
    try {
        const {email, password, remember} = req.userdata || {};
        if (!email || !password) {
            return res.status(400).render('auth/signin', {error: "Invalid email address or password."})            
        }
        const result = await users.findOneAsync({email})
        if (!result) {
            return res.status(400).render('auth/signin', {error: "Invalid email address or password."})            
        }
        const validpass = await compare(password, result.password)
        if (!validpass) {
            return res.status(400).render('auth/signin', {error: "Invalid email address or password."})
        }
        if (!req.allowsession || !remember) {
            return res.status(400).render('auth/signin', {error: "Cheched on Remember me to continue."})
        }
        req.userid = result.userid
        await createSession(req, res)
        return res.status(200).redirect('/dashboard')
    } catch (error) {
        error.fromstatic = true
        next(error)
    }
})

auth.post('/signup', ratelimit, validatSignup, async (req, res, next) => {
    try {
        const userid = req.userid || req.userdata.userid
        const userdata = req.userdata
        const email = userdata.email
        const isfoundemail = await users.findOneAsync({email})
        if(isfoundemail) return res.status(400).render('auth/signup', {error: 'Email already exist, try another one.'})
        const password = userdata.password
        userdata.password = await hash(password)
        await users.insertAsync(userdata).catch(error =>{
            console.log(error)
            return res.status(500).render('auth/signup', {error: `Something went wrong while Process you Request — Your request didn't go through, Please try again in a few moments.`})
        }).then(async (inserted) =>{
            await createSession(req, res)
            return res.status(201).render('layouts/success', {successMessage: 'You have been signed up successfully, You will be redirected to dashboard in a few moments.', title: 'Signed Up Successfully!'})
        })
    } catch (error) {
        error.fromstatic = true
        next(error)
    }
})

module.exports = auth