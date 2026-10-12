import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from '../src/index.js';

describe('EventEmitter', () => {
  /** @type {EventEmitter} */
  let emitter;
  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe('on + emit', () => {
    it('invokes a registered listener with emitted arguments', () => {
      const calls = [];
      emitter.on('ping', (...a) => calls.push(a));
      const hadListeners = emitter.emit('ping', 1, 'x');
      assert.equal(hadListeners, true);
      assert.deepEqual(calls, [[1, 'x']]);
    });

    it('invokes multiple listeners in registration order', () => {
      const order = [];
      emitter.on('e', () => order.push(1));
      emitter.on('e', () => order.push(2));
      emitter.on('e', () => order.push(3));
      emitter.emit('e');
      assert.deepEqual(order, [1, 2, 3]);
    });

    it('returns false when emitting an event with no listeners', () => {
      assert.equal(emitter.emit('nothing'), false);
    });

    it('throws TypeError for non-string event in on', () => {
      assert.throws(() => emitter.on(123, () => {}), TypeError);
    });

    it('throws TypeError for non-function listener in on', () => {
      assert.throws(() => emitter.on('e', null), TypeError);
    });

    it('throws TypeError for non-string event in emit', () => {
      assert.throws(() => emitter.emit(123), TypeError);
    });
  });

  describe('once', () => {
    it('invokes the listener exactly once then de-registers', () => {
      let count = 0;
      emitter.once('boot', () => { count += 1; });
      assert.equal(emitter.listenerCount('boot'), 1);
      emitter.emit('boot');
      assert.equal(count, 1);
      assert.equal(emitter.listenerCount('boot'), 0);
      emitter.emit('boot');
      assert.equal(count, 1);
    });

    it('passes emitted arguments to the once listener', () => {
      let captured = null;
      emitter.once('go', (a, b) => { captured = [a, b]; });
      emitter.emit('go', 42, 'z');
      assert.deepEqual(captured, [42, 'z']);
    });

    it('de-registers before invoking so a throw is not retried', () => {
      let attempts = 0;
      emitter.once('flaky', () => {
        attempts += 1;
        throw new Error('boom');
      });
      assert.throws(() => emitter.emit('flaky'), /boom/);
      assert.equal(emitter.listenerCount('flaky'), 0);
      // A second emit must not retry the already-removed listener.
      assert.equal(emitter.emit('flaky'), false);
      assert.equal(attempts, 1);
    });

    it('throws TypeError for non-string event in once', () => {
      assert.throws(() => emitter.once(123, () => {}), TypeError);
    });
  });

  describe('off', () => {
    it('removes a specific listener without touching others', () => {
      let a = 0, b = 0;
      const fa = () => { a += 1; };
      const fb = () => { b += 1; };
      emitter.on('e', fa);
      emitter.on('e', fb);
      emitter.off('e', fa);
      emitter.emit('e');
      assert.equal(a, 0);
      assert.equal(b, 1);
    });

    it('removes every listener for an event when only the event is given', () => {
      emitter.on('e', () => {});
      emitter.on('e', () => {});
      assert.equal(emitter.listenerCount('e'), 2);
      emitter.off('e');
      assert.equal(emitter.listenerCount('e'), 0);
    });

    it('is a no-op for an unknown event', () => {
      assert.doesNotThrow(() => emitter.off('nope', () => {}));
    });

    it('is a no-op when removing a listener that was never added', () => {
      emitter.on('e', () => {});
      assert.doesNotThrow(() => emitter.off('e', () => {}));
      assert.equal(emitter.listenerCount('e'), 1);
    });

    it('throws TypeError for non-string event in off', () => {
      assert.throws(() => emitter.off(123), TypeError);
    });
  });

  describe('removeAllListeners', () => {
    it('clears listeners for every event', () => {
      emitter.on('a', () => {});
      emitter.on('b', () => {});
      emitter.removeAllListeners();
      assert.equal(emitter.listenerCount('a'), 0);
      assert.equal(emitter.listenerCount('b'), 0);
    });
  });

  describe('during-emit mutation (snapshot semantics)', () => {
    it('does not invoke listeners added during the current emit', () => {
      const seen = [];
      emitter.on('e', () => {
        seen.push('first');
        emitter.on('e', () => seen.push('late'));
      });
      emitter.emit('e');
      assert.deepEqual(seen, ['first']);
      // The late listener is now registered and fires on the next emit.
      emitter.emit('e');
      assert.deepEqual(seen, ['first', 'first', 'late']);
    });

    it('still calls a listener that removes itself mid-dispatch', () => {
      const seen = [];
      const self = () => {
        seen.push('self');
        emitter.off('e', self);
      };
      emitter.on('e', self);
      emitter.emit('e');
      assert.deepEqual(seen, ['self']);
      assert.equal(emitter.listenerCount('e'), 0);
    });

    it('skips a listener removed by an earlier listener in the same dispatch', () => {
      const seen = [];
      const victim = () => seen.push('victim');
      const culprit = () => {
        seen.push('culprit');
        emitter.off('e', victim);
      };
      emitter.on('e', culprit);
      emitter.on('e', victim);
      emitter.emit('e');
      assert.deepEqual(seen, ['culprit']);
      assert.equal(emitter.listenerCount('e'), 1);
    });
  });

  describe('listenerCount', () => {
    it('counts registered listeners', () => {
      emitter.on('e', () => {});
      emitter.on('e', () => {});
      assert.equal(emitter.listenerCount('e'), 2);
    });

    it('returns 0 for an event with no listeners', () => {
      assert.equal(emitter.listenerCount('none'), 0);
    });
  });
});
