'use strict';

const crypto = require('crypto');
const path = require('path');
const PersistentSessionStore = require('./session.store.db');
const { randomToken } = require('../helpers/generator/random');

const cookiestate = {
    sid: 'string',
    sign: 'string',
    sessid: 'string',
    sesstk: 'string',
    acctk: 'string'
}
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production-min-32-chars';
const DEFAULT_TTL = parseInt(process.env.SESSION_TTL || '1800', 10); // seconds

// ─── helpers ──────────────────────────────────────────────────
function hashUA(ua = '') {
  return crypto.createHash('sha256').update(ua).digest('hex').slice(0, 32);
}

function signSession({ sessid, sesstoken, userid, uahash }) {
  const data = `\( {sessid}| \){sesstoken}|\( {userid}| \){uahash}`;
  return crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('hex');
}

function verifySign(payload, expected) {
  try {
    const actual = signSession(payload);
    return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── store ────────────────────────────────────────────────────
const store = new PersistentSessionStore({
  dir: path.resolve(process.env.SESSION_DIR || 'database/sessions'),
  defaultTTL: DEFAULT_TTL,
  maxSize: 20000,
  flushIntervalMs: 20000,
});

let started = false;

async function ensureStarted() {
  if (!started) {
    await store.start();
    started = true;
  }
}

// ─── PUBLIC API (all accept req, res, next) ───────────────────

/**
 * Create a new session (call after successful login/signup)
 * Expects: req.userid  and  req.headers['user-agent']
 * Sets cookies and attaches req.session
 */
async function createSession(req, res, next) {
  try {
    await ensureStarted();

    if (!req.userid) {
      const err = new Error('userid is required to create session');
      err.fromstatic = true;
      return next ? next(err) : null;
    }

    const ua = req.headers['user-agent'] || '';
    const sessid = 's:' + randomToken(16);
    const sesstoken = 't:' + randomToken(32);
    const accesstoken = 'at:' + randomToken(28);
    const uahash = hashUA(ua);

    const payload = { sessid, sesstoken, userid: req.userid, uahash };
    const sign = signSession(payload);

    const record = {
      ...payload,
      accesstoken,
      sign,
      createdAt: Date.now(),
    };

    store.set(sessid, record, DEFAULT_TTL);

    // set cookies
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: DEFAULT_TTL * 1000,
    };

    res.cookie('sessid', sessid, cookieOpts);
    res.cookie('sesstoken', sesstoken, cookieOpts);

    // attach to request for convenience
    req.session = record;
    req.userid = record.userid;

    if (typeof next === 'function'){ next()}else{return true};
  } catch (error) {
    error.fromstatic = true;
    if (typeof next === 'function') next(error);
  }
}

/**
 * Validate session from cookies
 * On success → attaches req.session + req.userid
 * On failure → clears cookies and continues (or you can redirect)
 */
async function validateSession(req, res, next) {
  try {
    await ensureStarted();

    const { sessid, sesstoken } = req.cookies || {};

    if (!sessid || !sesstoken) {
      if (typeof next === 'function') return res.status(400).redirect('/auth/signin');
      return;
    }

    const record = store.get(sessid);

    if (!record) {
      // session gone → clear cookies
      res.clearCookie('sessid');
      res.clearCookie('sesstoken');
      if (typeof next === 'function') return res.status(400).redirect('/auth/signin');;
      return;
    }

    // 1. token match
    if (record.sesstoken !== sesstoken) {
      store.delete(sessid);
      res.clearCookie('sessid');
      res.clearCookie('sesstoken');
      if (typeof next === 'function') return res.status(400).redirect('/auth/signin');;
      return;
    }

    // 2. signature check (stolen / modified detection)
    const payload = {
      sessid: record.sessid,
      sesstoken: record.sesstoken,
      userid: record.userid,
      uahash: record.uahash,
    };

    if (!verifySign(payload, record.sign)) {
      store.delete(sessid);
      res.clearCookie('sessid');
      res.clearCookie('sesstoken');
      if (typeof next === 'function') return res.status(400).redirect('/auth/signin');;
      return;
    }

    // 3. User-Agent binding
    const currentUAHash = hashUA(req.headers['user-agent']);
    if (currentUAHash !== record.uahash) {
      store.delete(sessid);
      res.clearCookie('sessid');
      res.clearCookie('sesstoken');
      if (typeof next === 'function') return res.status(400).redirect('/auth/signin');;
      return;
    }

    // success
    req.session = record;
    req.userid = record.userid;

    if (typeof next === 'function') next();
  } catch (error) {
    error.fromstatic = true;
    if (typeof next === 'function') next(error);
  }
}

/**
 * Renew / touch session (sliding expiration)
 * Call this after validateSession if you want the TTL to reset
 */
async function renewSession(req, res, next) {
  try {
    await ensureStarted();

    if (!req.session || !req.session.sessid) {
      if (typeof next === 'function') return next();
      return;
    }

    store.set(req.session.sessid, req.session, DEFAULT_TTL);

    // also refresh cookie maxAge
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: DEFAULT_TTL * 1000,
    };
    res.cookie('sessid', req.session.sessid, cookieOpts);
    res.cookie('sesstoken', req.session.sesstoken, cookieOpts);

    if (typeof next === 'function') next();
  } catch (error) {
    error.fromstatic = true;
    if (typeof next === 'function') next(error);
  }
}

/**
 * Destroy current session (logout)
 */
async function removeSession(req, res, next) {
  try {
    await ensureStarted();

    const { sessid } = req.cookies || {};
    if (sessid) {
      store.delete(sessid);
    }

    res.clearCookie('sessid');
    res.clearCookie('sesstoken');

    req.session = null;
    req.userid = null;

    if (typeof next === 'function') next();
  } catch (error) {
    error.fromstatic = true;
    if (typeof next === 'function') next(error);
  }
}

/**
 * Destroy ALL sessions belonging to a user
 * Useful after password change / force logout everywhere
 * Expects: req.userid  or  pass userid in req.body / req.params
 */
async function removeAllSessions(req, res, next) {
  try {
    await ensureStarted();

    const userid = req.userid || req.body?.userid || req.params?.userid;
    if (!userid) {
      const err = new Error('userid required to remove all sessions');
      err.fromstatic = true;
      return next ? next(err) : null;
    }

    // scan hot cache (safe because maxSize is limited)
    for (const [key, value] of store.cache.entries()) {
      if (value && value.userid === userid) {
        store.delete(key);
      }
    }

    // also clear current cookies if this is the same user
    if (req.userid === userid) {
      res.clearCookie('sessid');
      res.clearCookie('sesstoken');
      req.session = null;
      req.userid = null;
    }

    if (typeof next === 'function') next();
  } catch (error) {
    error.fromstatic = true;
    if (typeof next === 'function') next(error);
  }
}

/**
 * Require authentication middleware
 * Combines validate + optional renew
 */
async function requireAuth(req, res, next) {
  try {
    await validateSession(req, res, async () => {
      if (!req.userid) {
        // not authenticated
        if (req.method.toLowerCase() === 'get') {
          return res.redirect('/auth/signin');
        }
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // optional: renew on every successful request
      await renewSession(req, res, next);
    });
  } catch (error) {
    error.fromstatic = true;
    if (typeof next === 'function') next(error);
  }
}

// ─── export ───────────────────────────────────────────────────
module.exports = {
  createSession,
  validateSession,
  renewSession,
  removeSession,
  removeAllSessions,
  requireAuth,

  // also export the raw store if ever needed
  store,
};

