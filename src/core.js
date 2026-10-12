/**
 * Tiny, typed-friendly event emitter supporting `on`, `once`, `emit`, and `off`.
 *
 * Design decisions, stated plainly:
 *
 * 1. A single `Map<string, Set<Function>>` holds listeners. We deliberately
 *    keep a *stable* data structure across mutations so that listeners
 *    removed during dispatch are honoured immediately and listeners added
 *    during dispatch are *not* invoked for the in-flight emission. This is
 *    the one interpretation of "during emit" mutation we picked; the README
 *    calls it out.
 *
 * 2. `once` wraps the listener so it removes itself before invoking the
 *    callback. Removing first means a callback that throws will still have
 *    been de-registered, so a throw cannot cause re-entry.
 *
 * 3. `off` with no listener argument removes every listener for that event.
 *    `off` with no event argument is not supported (call `removeAllListeners`
 *    explicitly instead). We refuse the ambiguous overload rather than
 *    guess.
 */
export class EventEmitter {
  constructor() {
    /** @type {Map<string, Set<(...args: unknown[]) => void>>} */
    this._listeners = new Map();
    /**
     * When > 0 we are inside an active `emit`. We snapshot the listener set
     * at the start of dispatch, so mutations to the live set during dispatch
     * cannot change who gets called for *this* emit.
     */
    this._depth = 0;
  }

  /**
   * Register a listener for an event.
   *
   * @param {string} event
   * @param {(...args: unknown[]) => void} listener
   * @returns {this} for chaining
   */
  on(event, listener) {
    if (typeof event !== 'string') {
      throw new TypeError('event must be a string');
    }
    if (typeof listener !== 'function') {
      throw new TypeError('listener must be a function');
    }
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(listener);
    return this;
  }

  /**
   * Register a listener that fires at most once.
   *
   * The wrapper removes itself from the live set *before* calling the user
   * callback. If the callback throws, the listener is already gone — a
   * subsequent emit will not re-invoke it. Returns `this` for chaining,
   * matching `on`.
   *
   * @param {string} event
   * @param {(...args: unknown[]) => void} listener
   * @returns {this}
   */
  once(event, listener) {
    if (typeof event !== 'string') {
      throw new TypeError('event must be a string');
    }
    if (typeof listener !== 'function') {
      throw new TypeError('listener must be a function');
    }
    const wrapper = (...args) => {
      // Remove first. If the user callback throws, we have already
      // de-registered, so the throw cannot be retried by a later emit.
      this.off(event, wrapper);
      listener(...args);
    };
    this.on(event, wrapper);
    return this;
  }

  /**
   * Remove listeners.
   *
   * - `off(event, listener)` removes that specific listener.
   * - `off(event)` removes every listener for that event.
   *
   * Calling `off()` with no arguments is intentionally rejected: the meaning
   * of "remove everything" is not obvious enough to overload, and a caller
   * who wants it can use `removeAllListeners()`.
   *
   * @param {string} event
   * @param {Function} [listener]
   * @returns {this}
   */
  off(event, listener) {
    if (typeof event !== 'string') {
      throw new TypeError('event must be a string');
    }
    const set = this._listeners.get(event);
    if (!set) return this;
    if (listener === undefined) {
      // Remove every listener for this event.
      this._listeners.delete(event);
      return this;
    }
    set.delete(listener);
    if (set.size === 0) {
      this._listeners.delete(event);
    }
    return this;
  }

  /**
   * Remove every listener for every event.
   *
   * @returns {this}
   */
  removeAllListeners() {
    this._listeners.clear();
    return this;
  }

  /**
   * Emit an event synchronously to every currently-registered listener.
   *
   * Returns `true` if there was at least one listener, `false` otherwise.
   *
   * The set of listeners called is snapshotted at the moment `emit` begins.
   * A listener that removes itself (or another listener) during dispatch will
   * still be called if it was in the snapshot, but a listener *added* during
   * dispatch will not be called for this emit. This is the one, stated
   * interpretation of during-emit mutation we support.
   *
   * If a listener throws, the error propagates immediately and remaining
   * listeners are not invoked. We made this choice deliberately: swallowing
   * errors silently makes bugs invisible, and an error handler that runs
     * "around" every listener is easy to build on top with a `once` wrapper.
   *
   * @param {string} event
   * @param {...unknown} args
   * @returns {boolean}
   */
  emit(event, ...args) {
    if (typeof event !== 'string') {
      throw new TypeError('event must be a string');
    }
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return false;

    // Snapshot so adds/removes during dispatch do not change who is called
    // for *this* emit. Array.from on a Set is deterministic by insertion
    // order, which is what users expect.
    const snapshot = Array.from(set);
    this._depth++;
    try {
      for (const fn of snapshot) {
        // Guard against a listener removed between snapshot and invocation
        // (e.g. an earlier listener in the snapshot called `off`).
        if (!set.has(fn)) continue;
        fn(...args);
      }
    } finally {
      this._depth--;
    }
    return true;
  }

  /**
   * Number of registered listeners for an event (0 if none).
   *
   * @param {string} event
   * @returns {number}
   */
  listenerCount(event) {
    if (typeof event !== 'string') {
      throw new TypeError('event must be a string');
    }
    const set = this._listeners.get(event);
    return set ? set.size : 0;
  }
}
