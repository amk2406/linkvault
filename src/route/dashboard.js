const express = require('express');
const {validateSession, removeAllSessions, removeSession} = require('../services/session.manager')

const app = express.Router()

app.get('/dashboard', async (req, res, next) =>{
    try {
        const userdata = req.userdata || {}
        res.status(200).render('dashboard', { user:userdata })
    } catch (error) {
        error.fromstatic = true;
        next(error)
    }
})
app.get('/links', async (req, res, next) =>{
    try {
        const userdata = req.userdata || {}
        res.status(200).render('links', { user: userdata })
    } catch (error) {
        error.fromstatic = true;
        next(error)
    }
})

app.get('/auth/logout', removeAllSessions, async (req, res, next)=>{
    try {
        res.status(200).render('logout', { user:userdata })
    } catch (error) {
        error.fromstatic = true;
        next(error)
    }
})
module.exports = app