const {JSONDB} = require('file-json-db');
const path = require('path');

const db = new JSONDB(path.resolve(process.env.DBPATH || 'database'))

const users = db.collection({name: 'users', autoId: true, idType: 'auto', keepIdIndex: true, indexes: ['email', 'userid']})
const session = db.collection({name: 'session', autoId: true, idType: 'objectid', indexes: ['userid', 'sessid']})
const url = db.collection({name: 'url', autoId: true, idType: 'objectid', indexes: ['urlid', 'code']})
const urltracker = db.collection({name: 'url-tracker', autoId: true, idType: 'objectid', indexes: ['urlid', 'code']})

module.exports = { users, session, url, urltracker }