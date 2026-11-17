const bcrypt = require('bcrypt');

const saltcost = parseInt(process.env.SALTCOST) || 10
(saltcost)
const hash = async (password)=>{
    return await bcrypt.hash(password, saltcost)
}
const hashAsync = async (password)=>{
    return await bcrypt.hash(password, saltcost)
}
const hashSync = (password)=>{
    return bcrypt.hashSync(password, saltcost)
}

const compare = async (password, hash)=>{
    return await bcrypt.compare(password, hash)
}
const compareAsync = async (password, hash)=>{
    return await bcrypt.compare(password, hash)
}
const compareSync = (password, hash)=>{
    return  bcrypt.compareSync(password, hash)
}

const verify = async (password, hash)=>{
    return await bcrypt.compare(password, hash)
}
const verifyAsync = async (password, hash)=>{
    return await bcrypt.compare(password, hash)
}
const verifySync = (password, hash)=>{
    return  bcrypt.compareSync(password, hash)
}

module.exports = {
    hash,
    hashAsync,
    hashSync,
    compare,
    compareAsync,
    compareSync,
    verify,
    verifyAsync,
    verifySync
}