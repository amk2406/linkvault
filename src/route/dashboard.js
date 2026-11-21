const express = require('express');
const {validateSession} = require('../services/session.manager')

const app = express.Router()

app.get('/dashboard', async (req, res, next) =>{
    const userdata = req.userdata || {}
    res.render('dashboard', {user:userdata})
})

module.exports = app