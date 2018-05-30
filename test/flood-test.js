/*
 */

const QUEUE_SIZE = 'PROMISE_QUEUE_SIZE' in process.env
      ? parseInt(process.env.PROMISE_QUEUE_SIZE)
      : 25
const Threads = 100
const Sleep = 1000
const ThreadTimeout = 20000
const SuiteTimeout = 4 * Sleep * Threads / QUEUE_SIZE
const Command = 'setTimeout(() => { process.exit(0); }, ' + Sleep + ')'
// const Command = 'for (let i = 0; i < 2**28; ++i) ;' // The busy alternative.

const child_process = require('child_process')
const AllTests = []
const Queue = require('../timeout-promise-queue.js').PromiseQueue(QueueSize)
const _AfterAllTests = typeof jest !== 'undefined' ? afterAll : after

/* start processes */
for (let i = 0; i < Threads; ++i) {
  AllTests.push({
    i: i,
    start: new Date(),
    exec: Queue.add(cancel => new Promise((resolve, reject) => {
      let program = child_process.spawn('node', ['-e', Command])
      program.on('exit', exitCode => { resolve({exitCode:exitCode}) })
      program.on('error', reject)
      cancel.on('timeout', err => {
        program.kill()
        reject()
      })
    }), ThreadTimeout, () => Error('timeout exceeded in test ' + i))
  })
}

/* test results */
describe('churn', () => {
  AllTests.forEach(test => {
    let title = 'should execute test ' + test.i + '.'
    function cb (done) {
      test.exec.then(exec => {
        test.end = new Date()
        test.message = 'OK'
        done()
      }).catch(e => {
        test.end = new Date()
        test.message = 'Error: ' + e
        done(e)
      })
        }
    if (typeof jest !== 'undefined') {
      it(title, cb, SuiteTimeout)
    } else /*if (typeof mocha !== 'undefined')*/ {
      it(title, cb).timeout(SuiteTimeout)
    }
    // Need to dispose of these rejections before cb is called.
    test.exec.catch(e => null)
  })
})

if (true)
_AfterAllTests(() => {
  console.log('\n' + AllTests.map(
    test =>
      test.i + ' ' + (test.end - test.start)/1000.0 + ' ' + test.message
  ).join('\n'))
})

