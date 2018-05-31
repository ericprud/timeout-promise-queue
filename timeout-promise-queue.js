
const EventEmitter = require('events');

function PromiseQueue (threshold) {
  let queue = []
  let inPlay = 0

  return {
    /** queue (I/O) functions which return promises.
     * @pfunc returns a promise
     *   If add is called with a @timeout, @pfunc will be called with an
     *   EventEmitter which will emit a 'timeout' if @timeout is exceeded.
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
        let ret = timeout === undefined
            ? pfunc()
            : new Promise((resolve, reject) => {
              let clientCancellation = new EventEmitter();

              // Create a timer to send a cancellation to pfunc()'s promise.
              let timer = setTimeout(() => {
                let r = typeof rejection === 'undefined'
                    ? Error('timeout of ' + timeout + ' exceeded')
                    : typeof rejection === 'function'
                    ? rejection()
                    : rejection
                clientCancellation.emit('timeout', r);
                reject(r)
              }, timeout)

              // Delete timer after resolution.
              resolve(pfunc(clientCancellation).then(result => {
                clearTimeout(timer)
                return result
              }).catch(result => {
                clearTimeout(timer)
                throw result
              }))
            })
        return ret.then(nextEntry).catch(result => {throw nextEntry(result)})
      }
    },

    /** number of entries in the queue.
     */
    size: function () {
      return queue.length
    }
  }

  /** After each resolution or rejection, check the queue.
   */
  function nextEntry (ret) {
    --inPlay
    if (queue.length > 0) {
      queue.pop()()
    }
    return ret
  }
}

module.exports = { PromiseQueue: PromiseQueue }

