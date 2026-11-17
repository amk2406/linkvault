'use strict';

const path = require('path');
const { session } = require('../db');
const Cache = require('cache'); // amk2406/cache

/**
 * A persistent, single-process session store built on two layers:
 *
 * 1. **Hot layer** — `amk2406/cache` (pure in-memory, TTL-aware).
 *    All `get`/`set`/`has` calls hit RAM only. No disk I/O on the read path.
 *
 * 2. **Durable layer** — `file-json-db` (chunked, atomic, self-healing JSON
 *    document store with an in-memory secondary index).
 *    Written to only on flush ticks, on dirty-key batches, and on shutdown.
 *
 * Durability model: **write-behind / eventually durable**.
 * On a hard crash (`SIGKILL`, OOM kill, power loss) up to `flushIntervalMs`
 * milliseconds of session changes are lost. Clean shutdowns (`SIGINT`,
 * `SIGTERM`) flush synchronously before exit.
 *
 * ⚠️ Single-writer only. Do NOT point two processes at the same `dir`.
 *
 * @example
 * const Store = require('./session-store');
 * const sessions = new Store({ dir: './data/sessions', defaultTTL: 1800 });
 * await sessions.start();
 * sessions.set('sess:abc', { userId: 42 }, 3600);
 * const s = sessions.get('sess:abc');
 */
class SessionStore {
  /**
   * @param {object}   opts
   * @param {string}   opts.dir               Directory for the `file-json-db` database.
   * @param {number}   [opts.defaultTTL=1800] Default session lifetime in **seconds**.
   * @param {number}   [opts.maxSize=10000]   Max in-memory entries before oldest eviction.
   * @param {number}   [opts.flushIntervalMs=10000] How often dirty keys are flushed to disk.
   *                                          Also the worst-case loss window on hard crash.
   */
  constructor({ dir, defaultTTL = 1800, maxSize = 10000, flushIntervalMs = 10000 } = {}) {
    if (!dir) throw new TypeError('SessionStore: `dir` is required');

    this.dir = path.resolve(dir);
    this.flushIntervalMs = flushIntervalMs;

    /** @type {Cache} Hot in-memory layer. Never touches disk. */
    this.cache = new Cache({ defaultTTL, maxSize });

    /** @type {Set<string>} Keys changed since last flush (upserts). */
    this.dirty = new Set();
    /** @type {Set<string>} Keys removed since last flush. */
    this.deleted = new Set();

    /** @type {Promise<void>|null} Coalesces concurrent flush() calls. */
    this.flushing = null;
    /** @type {NodeJS.Timeout|null} */
    this.timer = null;
    this.stopped = false;

    /** @type {any|null} `file-json-db` collection handle for sessions. */
    this.col = null;
  }

  // ─────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────

  /**
   * Opens the database, restores live sessions into memory, starts the
   * periodic flush timer, and installs shutdown handlers.
   *
   * Must be awaited before any `get`/`set` will see restored sessions.
   * @returns {Promise<void>}
   */
  async start() {
    this.col = session

    await this._restore();

    this.timer = setInterval(() => {
      this.flush().catch((e) => console.error('[session-store] flush failed', e));
    }, this.flushIntervalMs);
    // Don't keep the process alive solely for flush ticks.
    this.timer.unref?.();

    const shutdown = async () => {
      if (this.stopped) return;
      this.stopped = true;
      clearInterval(this.timer);
      try {
        await this.flush();
      } catch (e) {
        console.error('[session-store] final flush failed', e);
      }
      process.exit(0);
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

    // Last-ditch, synchronous, best-effort only.
    // Runs only on normal exit paths — NOT on SIGKILL / OOM / panic.
    process.once('exit', () => {
      try { this._flushSync(); } catch { /* swallow */ }
    });
  }

  /**
   * Stops the flush timer. Does **not** flush; call {@link flush} first if
   * you need the final state persisted outside of process shutdown.
   */
  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.stopped = true;
  }

  // ─────────────────────────────────────────────────────────────
  // Public hot-path API (all RAM-only)
  // ─────────────────────────────────────────────────────────────

  /**
   * Stores a session value and marks the key dirty for the next flush.
   * @param {string} key
   * @param {*} value              Any JSON-serializable value.
   * @param {number|null} [ttlSeconds] Seconds until expiry; `null` = never.
   * @returns {void}
   */
  set(key, value, ttlSeconds) {
    this.cache.set(key, value, ttlSeconds);
    // A set resurrects a previously deleted key: cancel the pending delete.
    if (this.deleted.size) this.deleted.delete(key);
    this.dirty.add(key);
  }

  /**
   * Reads a session from memory. Returns `null` if missing or expired.
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    return this.cache.get(key);
  }

  /**
   * Returns `true` if the key exists and has not expired. Does not affect
   * hit/miss statistics.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * Removes a session from memory and schedules deletion from disk.
   * @param {string} key
   * @returns {boolean} `true` if the key existed.
   */
  delete(key) {
    const existed = this.cache.delete(key);
    if (existed) {
      this.dirty.delete(key);
      this.deleted.add(key);
    }
    return existed;
  }

  /**
   * Returns the cached value for `key`, or awaits `fn()` and caches its
   * result if absent. Mirrors `amk2406/cache#getOrSet` but async-friendly.
   * @template T
   * @param {string} key
   * @param {() => T|Promise<T>} fn
   * @param {number|null} [ttlSeconds]
   * @returns {Promise<T>}
   */
  async getOrSet(key, fn, ttlSeconds) {
    const existing = this.get(key);
    if (existing !== null) return existing;
    const value = await fn();
    this.set(key, value, ttlSeconds);
    return value;
  }

  // ─────────────────────────────────────────────────────────────
  // Flush
  // ─────────────────────────────────────────────────────────────

  /**
   * Flushes all dirty/deleted keys to `file-json-db`. Safe to call
   * concurrently: overlapping calls share the same in-flight promise.
   * @returns {Promise<void>}
   */
  flush() {
    if (this.flushing) return this.flushing;
    this.flushing = this._doFlush().finally(() => { this.flushing = null; });
    return this.flushing;
  }

  /**
   * Batched dirty-key flush.
   *
   * Performance notes:
   * - Only dirty keys are written; cost scales with change volume, not total
   *   session count.
   * - Snapshot-then-clear before writing: any `set`/`delete` that lands during
   *   an in-flight flush re-dirties its key and is picked up next tick.
   * - `findOne({ key })` hits the `key` secondary index, so upsert routing
   *   doesn't scan part files.
   * - Expired-key housekeeping uses an index-backed range query (see
   *   `_purgeExpired`) rather than loading every record.
   * @private
   * @returns {Promise<void>}
   */
  async _doFlush() {
    if (this.dirty.size === 0 && this.deleted.size === 0) return;

    const dirtyKeys = Array.from(this.dirty);
    const deletedKeys = Array.from(this.deleted);
    this.dirty.clear();
    this.deleted.clear();

    const now = Date.now();

    // 1) Deletes — one indexed lookup + delete each.
    for (let i = 0; i < deletedKeys.length; i++) {
      const key = deletedKeys[i];
      if (this.col.findOne({ key })) this.col.deleteOne({ key });
    }

    // 2) Upserts — indexed findOne then update/insert.
    for (let i = 0; i < dirtyKeys.length; i++) {
      const key = dirtyKeys[i];
      const value = this.cache.get(key);
      const ttl = this.cache.ttl(key); // -1 = no expiry, -2 = missing, ≥0 = seconds

      if (value === null || ttl === -2) {
        // Expired between scheduling and flush — remove from disk too.
        if (this.col.findOne({ key })) this.col.deleteOne({ key });
        continue;
      }

      const record = {
        key,
        value,
        expiresAt: ttl >= 0 ? now + ttl * 1000 : null,
      };

      if (this.col.findOne({ key })) {
        this.col.updateOne({ key }, { $set: record });
      } else {
        this.col.insert(record);
      }
    }

    // 3) Purge anything that expired on disk during this window.
    this._purgeExpired(now);
  }

  /**
   * Deletes records whose `expiresAt` is in the past.
   * Uses a range query rather than loading the whole collection; pair with an
   * `expiresAt` index in `start()` if session volume is large.
   * @private
   * @param {number} now Epoch ms.
   */
  _purgeExpired(now) {
    const expired = this.col.find({
      expiresAt: { $ne: null, $lte: now },
    }).toArray();
    for (let i = 0; i < expired.length; i++) {
      this.col.deleteOne({ _id: expired[i]._id });
    }
  }

  /**
   * Best-effort **synchronous** flush for `process.on('exit')`.
   * Cannot run on `SIGKILL`/OOM. Uses the sync `file-json-db` API.
   * @private
   */
  _flushSync() {
    if (!this.col) return;
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      const ttl = this.cache.ttl(key);
      if (ttl === -2) continue;
      const record = {
        key,
        value,
        expiresAt: ttl >= 0 ? now + ttl * 1000 : null,
      };
      const existing = this.col.findOne({ key });
      if (existing) this.col.updateOne({ key }, { $set: record });
      else this.col.insert(record);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Restore
  // ─────────────────────────────────────────────────────────────

  /**
   * Hydrates the in-memory cache from persisted records, preserving TTLs.
   *
   * Loads only records that are still live (`expiresAt` null or in the future)
   * and removes stale ones as it goes, so a restart doesn't leave expired rows
   * sitting on disk.
   * @private
   * @returns {Promise<void>}
   */
  async _restore() {
    const now = Date.now();
    // Fetch only live records — avoids hydrating expired rows.
    const records = this.col.find({
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).toArray();

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      if (!rec || !rec.key) continue;
      if (rec.expiresAt === null || rec.expiresAt === undefined) {
        this.cache.set(rec.key, rec.value, null);
      } else {
        this.cache.set(
          rec.key,
          rec.value,
          Math.ceil((rec.expiresAt - now) / 1000),
        );
      }
    }

    // Sweep anything that expired while the process was down.
    this._purgeExpired(now);
  }
}

module.exports = SessionStore;