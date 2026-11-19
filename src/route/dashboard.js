const express = require('express');
const {validateSession} = require('../services/session.manager')

const app = express()

app.get('/dashboard', async (req, res, next) =>{
    res.render('dashboard', {})
})

module.exports = app