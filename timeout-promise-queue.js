
const EventEmitter = require('events');

function PromiseQueue (threshold) {
  let queue = []
  let inPlay = 0

  return {
    /** queue (I/O) functions which return promises.
     * @pfunc returns a promise
     */
    add: function (pfunc, timeout, rejection) {
      if (++inPlay > threshold) {
        return new Promise((resolve, reject) => {
          queue.push(() => {
            resolve(makeTimeout())
          })
        })
      } else {
        return makeTimeout()
      }

      function makeTimeout () {
        let timer = null
        let clientCancellation = new EventEmitter();
        let myCancellation = new EventEmitter();
        let ret = timeout === undefined
          ? pfunc()
          : Promise.race([
            new Promise((resolve, reject) => {
              timer = setTimeout(() => {
                let r = typeof rejection === 'undefined'
                    ? Error('timeout of ' + timeout + ' exceeded')
                    : typeof rejection === 'function'
                    ? rejection()
                    : rejection
                clientCancellation.emit('timeout', r);
                nextEntry()
                reject(r)
              }, timeout)
              // pfunc().then emits 'clear' which resolves with pfunc's result.
              myCancellation.on('clear', result => resolve(result))
              return timer
            }),
            pfunc(clientCancellation).then(result => {
              myCancellation.emit('clear', result);
              clearTimeout(timer)
              return result
            })
          ])
        return ret.then(nextEntry)
      }
    },

    /** number of entries in the queue.
     */
    size: function () {
      return queue.length
    }
  }

  function nextEntry (ret) {
    // After each resolution, check the queue.
    --inPlay
    if (queue.length > 0) {
      queue.pop()()
    }
    return ret
  }
}

module.exports = { PromiseQueue: PromiseQueue }

