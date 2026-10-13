# event-emitter-lib

A tiny typed event emitter with `once` and `off` semantics.

```js
import { EventEmitter } from 'event-emitter-lib';

const bus = new EventEmitter();

bus.on('change', (value) => console.log('changed to', value));
bus.once('ready', () => console.log('ready, once only'));

bus.emit('change', 42); // "changed to 42"
bus.emit('ready');      // "ready, once only"
bus.emit('ready');      // nothing — listener was removed

bus.off('change');      // remove every 'change' listener
```

## Why

Most projects that reach for an event emitter need `on`, `once`, `off`, and `emit` — and not much else. The heavier event libraries bring plugin systems, async queueing, namespaced wildcards, or priority ordering. This library is the boring, synchronous core: a `Map<string, Set<Function>>` and four methods. The trade-off is that there is no built-in async dispatch, no wildcard matching, and no error swallowing — if a listener throws, the throw propagates to whoever called `emit`.

## The edge you will hit

The one behavioural choice worth knowing: listeners are **snapshotted at the start of `emit`**. A listener that adds another listener during dispatch will not see that new listener fire for the current emit — it fires on the next one. A listener that removes itself (or a later listener) during dispatch is still called if it was in the snapshot, but a later listener that was removed by an earlier one in the same dispatch is skipped. This is the single interpretation we picked; it keeps dispatch order predictable and mutation safe without copying on every call.

The exported names are `EventEmitter`, with methods `on`, `once`, `off`, `emit`, `removeAllListeners`, and `listenerCount`.
