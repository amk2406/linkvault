const express = require('express');
const {validateSession} = require('../services/session.manager')

const app = require('express').Router()


app.get('/:code' , (req , res)=>{

})

app.use(validateSession)

app.post('/api/link/new' , (req , res)=>{
    try {
        console.log(req)
        const userid = req.userid || req.session.userid
        res.send('hello from simple server :)')
    } catch (error) {
        
    }

})
module.exports  = app