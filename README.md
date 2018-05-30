# timeout-promise-queue 
[![NPM Version](https://badge.fury.io/js/timeout-promise-queue.png)](https://npmjs.org/package/timeout-promise-queue)
[![Build Status](https://travis-ci.org/ericprud/timeout-promise-queue.svg?branch=master)](https://travis-ci.org/ericprud/timeout-promise-queue)
[![Coverage Status](https://coveralls.io/repos/ericprud/timeout-promise-queue/badge.png?branch=master)](https://coveralls.io/r/ericprud/timeout-promise-queue)
[![Dependency Status](https://gemnasium.com/ericprud/timeout-promise-queue.png)](https://gemnasium.com/ericprud/timeout-promise-queue)

Promise queue with timeouts and promise cleanup after expiration.

# Motivation
Reduce threads associated with forked processes by throttling the creating of processes.

## Installation

`timeout-promise-queue` can be installed using `npm`:

```
npm install timeout-promise-queue
```

## Interface
 - `PromiseQueue(Number maxConcurrent): Queue`
 - `Queue#add(Function promseGenerator, [Number timeout, [rejection]]): Promise` - calls function to generate a promise to add to the queue
   - `promiseGenerator([EventEmitter cancel]): Promise - generate a promise to add to the queue
   - if `timeout` is defined, `promseGenerator` is called with an EventEmitter which will get a `'timeout'` event if `timeout` is exceeded.
   If `rejection` is not defined, timeouts call `reject(Error('timeout of ' + timeout + ' exceeded'))`
   If `rejection` is defined, it generates the timeout error. `rejection` must be one of:
     - if `rejection` is function, timouts call `reject(rejection())`.
     - otherwise timouts call `reject(rejection)`.
 - `Queue#size(): Number` - returns number of pending promises

# Use

```js
const Queue = require('timeout-promise-queue').PromiseQueue(25) // allow 25 concurrent promises
Promise.all([
  Queue.add(cancel => cancellable(cancel)),
  Queue.add(cancel => cancellable(cancel)),
  Queue.add(cancel => cancellable(cancel))...,
]).then(l => {console.log('done') })
```
