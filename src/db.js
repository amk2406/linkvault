const {JSONDB} = require('file-json-db');
const path = require('path');

const db = new JSONDB(path.resolve(process.env.DBPATH || 'database'))

module.exports = {

}