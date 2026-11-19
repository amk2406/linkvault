const validator = require('../helpers/input.validator');
const random = require('../helpers/generator/random').randomHex


const validatSignin = async (req, res, next) => {
    try {
        const {email, password, remember} = req.body || {}
        if (!email || email.trim() === '') {
            return res.status(400).render('auth/signin', {error: "Invalid email address or password."})
        }
        if (typeof email !== 'string') {
            return res.status(400).render('auth/signin', {error: "Invalid email address or password."})
        }
        if (!validator.isValidEmail(email)) {
            return res.status(400).render('auth/signin', {error: "Invalid email address or password."})
        }
        if (!password || typeof password !== 'string') {
            return res.status(400).render('auth/signin', {error: "Invalid email address or password."})
        }
        if (remember === '1' || remember === 'true') req.allowsession = true;
        req.userdata = {
            email: email.trim(),
            password: password,
            remember
        }
        next()
    } catch (error) {
        error.fromstatic = true
        next(error)
    }
}

const validatSignup = async (req, res, next) => {
    try {const {name, email, password, confirm, terms = true} = req.body || {}
        if (!name || name.trim() === '') return res.status(400).render('auth/signup', {error: "Name is required and cannot be empty."})
        if (!email) {
            return res.status(400).render('auth/signup', {error: "Email is required and cannot be empty."})
        }
        if (typeof email !== 'string') {
            return res.status(400).render('auth/signup', {error: "Email most be a valid and cannot be empty."})
        }
        if (!validator.isValidEmail(email)) {
            return res.status(400).render('auth/signup', {error: "Email most be a valid Email address and cannot be empty."})
        }
        if (!password || typeof password !== 'string') {
            return res.status(400).render('auth/signup', {error: "Password is required y."})
        }
        if (!confirm || typeof confirm !== 'string') {
            return res.status(400).render('auth/signup', {error: "Confirm your password to Continue."})
        }
        if (password.length <= 8) {
            return res.status(400).render('auth/signup', {error: "Password length most be at least 8 characters length."})
        }
        if (password !== confirm) {
            return res.status(400).render('auth/signup', {error: "Password and Confirmation is not the same."})
        }
        if (!terms) {
            return res.status(400).render('auth/signup', {error: "Agree with the terms and condition to continue."})
        }
        const userid = random(8)+ random(3)
        const userdata = {
            userid: 'usr:'+userid,
            name: name.trimStart().trimEnd(),
            email: email.trim(), password,
            isVerify: false
        }
        req.userid = 'usr:'+userid
        req.userdata = userdata
        if (next)next();
    } catch (error) {
        error.fromstatic = true;
        next(error)
    }
}

module.exports = {
    validatSignin,
    validatSignup
}