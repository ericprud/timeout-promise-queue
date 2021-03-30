/*
 */

console.log(require('chalk').blueBright(
  'These tests take about 45 seconds to run.\n' +
    'Results will appear in 10-20 second chunks.'
))

const QueueSize = 'PROMISE_QUEUE_SIZE' in process.env
      ? parseInt(process.env.PROMISE_QUEUE_SIZE)
      : 5
const LogProcessStats = false // show summar at end

const child_process = require('child_process')
const AllTests = []
const Queue = require('../timeout-promise-queue.js').PromiseQueue(QueueSize)
const _AfterAllTests = typeof jest !== 'undefined' ? afterAll : after
const TestTimeoutMessage = 'timeout exceeded blah bah blah'

// Test list:
Tests = [
  // Lead with long sleeps so Queue doesn't deplete under mocha.
  { processes: 10, sleep: 10000, timeout: 20000, ok: true },

  { processes: 1, sleep: 1000, ok: true },

  { processes: 5, sleep: 100, resolve: {exitCode: 0} , timeout: 200, ok: true },

  { processes: 1, sleep: 10000, timeout: 20, ok: false,
    // no rejection parameter so expect timeout-promise-queue's default:
    exceptionPattern: RegExp('^timeout of 20 exceeded$') },

  { processes: 5, sleep: 100, reject: Error('died') , timeout: 200, ok: false,
    exceptionPattern: RegExp('^died$') },

  { processes: 1, sleep: 10000, timeout: 20, ok: false,
    rejection: Error(TestTimeoutMessage),
    exceptionPattern: RegExp('^' + TestTimeoutMessage + '$') },

  { processes: 10, sleep: 10000, timeout: 200, ok: false,
    rejection: () => Error(TestTimeoutMessage),
    exceptionPattern: RegExp('^' + TestTimeoutMessage + '$') }
]
let SuiteTimeout = 250 // generous setup and tear-down time
let ExpectedQueueSize = -QueueSize // first QueueSize will dispatch immediately.
Tests.forEach((test, idx) => {
  const command = 'setTimeout(() => { process.exit(0); }, ' + test.sleep + ')'
  // const Command = 'for (let i = 0; i < 2**28; ++i) ;' // The busy alternative.
  SuiteTimeout += 2 * test.sleep * test.processes / QueueSize
  startProcesses(idx, test, command)
  ExpectedQueueSize += test.processes
})

function startProcesses (batch, test, command) {
  for (let i = 0; i < test.processes; ++i) {
    const label = batch + '-' + i
    AllTests.push(Object.assign({
      label: label,
      start: new Date(),
      exec: Queue.add(
        ('resolve' in test || 'reject' in test
         ? makeThread(test)
         : makeProcess(test)),
        test.timeout, test.rejection)
    }, test)) // copy guts of test template
  }

  function makeProcess (test) {
    return cancel => new Promise((resolve, reject) => {
      let program = child_process.spawn('node', ['-e', command])
      program.on('exit', exitCode => { resolve({exitCode:exitCode}) })
      program.on('error', reject)
      if (cancel)
        cancel.on('timeout', err => {
          program.kill()
          reject(err)
        })
    })
  }

  function makeThread (test) {
    return cancel => new Promise((resolve, reject) => {
      setTimeout(() => {
        if ('reject' in test) {
          reject(test.reject)
        } else {
          resolve(test.resolve)
        }
      }, test.sleep)
      if (cancel)
        cancel.on('timeout', err => {
          reject(err)
        })
    })
  }
}

/* test results */
describe('timeout-promise-queue', () => {
  it('should have the right size', () => {
    if (Queue.size() !== ExpectedQueueSize)
      throw Error('expected ' + Queue.size() +' === ' + ExpectedQueueSize)
  })
  AllTests.forEach(test => {
    let title = 'should ' + (test.ok ? 'pass' : 'fail') + ' test ' + test.label + '.'
    function cb (done) {
      test.exec.then(exec => {
        if (test.ok) {
          if (typeof exec !== 'object' || exec.exitCode !== 0) {
            report(false, 'resolved result "' + JSON.stringify(exec) + '" !== { exitCode: 0 }')
          } else {
            report(true)
          }
        } else {
          report(false, 'unexpected success')
        }
      }).catch(e => {
        if (test.ok) {
          report(false, e.message)
        } else {
          if (test.exceptionPattern) {
            if (!e || !e.message) {
              report(false, "expected structured error instead of " + e)
            } else if (e.message.match(test.exceptionPattern)) {
              report(true)
            } else {
              report(false, "expected \"" + e.message + "\" to match exceptionPattern")
            }
          } else {
            report(true)
          }
        }
      })

      function report (pass, message) {
        test.end = new Date()
        test.message = message || (pass ? 'OK' : 'FAIL')
        if (pass) {
          done()
        } else {
          done(Error(message + ' ' + JSON.stringify(test)))
        }
      }
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

if (LogProcessStats) {
  _AfterAllTests(() => {
    console.log('\n' + AllTests.map(
      test =>
        test.label + ' ' + (test.end - test.start)/1000.0 + ' ' + test.message
    ).join('\n'))
  })
}
