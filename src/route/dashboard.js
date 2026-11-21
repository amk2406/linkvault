const express = require('express');
const {validateSession} = require('../services/session.manager')

const app = express.Router()

app.get('/dashboard', async (req, res, next) =>{
    try {
        const userdata = req.userdata || {}
        ender('dashboard', { user:userdata })
    } catch (error) {
        error.fromstatic = true;
        next(error)
    }
})
app.get('/links', async (req, res, next) =>{
    try {
        const userdata = req.userdata || {}
        ender('links', { user: userdata })
    } catch (error) {
        error.fromstatic = true;
        next(error)
    }
})
module.exports = app