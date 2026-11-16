const crypto = require('crypto');
const randomString = require('./generator/index').randomString
module.exports = (token, signhash = randomString(10))=>{
 return crypto.createHmac('sha256', signhash).update(token).digest('hex')
}