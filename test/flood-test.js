/*
 */

const QueueSize = 'PROMISE_QUEUE_SIZE' in process.env
      ? parseInt(process.env.PROMISE_QUEUE_SIZE)
      : 25
const LogProcessStats = true

const child_process = require('child_process')
const AllTests = []
const Queue = require('../timeout-promise-queue.js').PromiseQueue(QueueSize)
const _AfterAllTests = typeof jest !== 'undefined' ? afterAll : after
const TestTimeoutMessage = 'timeout exceeded blah bah blah'

/* start processes */
Tests = [
  { processes: 10, sleep: 10000, timeout: 20000, ok: true },
  { processes: 10, sleep: 10000, timeout: 200, ok: false,
    rejection: () => Error(TestTimeoutMessage),
    exceptionPattern: RegExp('^' + TestTimeoutMessage + '$') }
]
let SuiteTimeout = 250 // generous setup and tear-down time
Tests.forEach((test, idx) => {
  const command = 'setTimeout(() => { process.exit(0); }, ' + test.sleep + ')'
  // const Command = 'for (let i = 0; i < 2**28; ++i) ;' // The busy alternative.
  SuiteTimeout += 2 * test.sleep * test.processes / QueueSize
  startProcesses(idx, test.processes, command, test.timeout, test.ok, test.rejection)
})

function startProcesses (batch, processes, command, timeout, ok, rejection) {
  for (let i = 0; i < processes; ++i) {
    const label = batch + '-' + i
    AllTests.push({
      label: label,
      ok: ok,
      start: new Date(),
      exec: Queue.add(cancel => new Promise((resolve, reject) => {
        let program = child_process.spawn('node', ['-e', command])
        program.on('exit', exitCode => { resolve({exitCode:exitCode}) })
        program.on('error', reject)
        cancel.on('timeout', err => {
          program.kill()
          reject()
        })
      }), timeout, rejection)
    })
  }
}

/* test results */
describe('churn', () => {
  AllTests.forEach(test => {
    let title = 'should ' + (test.ok ? 'pass' : 'fail') + ' test ' + test.label + '.'
    function cb (done) {
      test.exec.then(exec => {
        test.end = new Date()
        if (test.ok) {
          test.message = 'OK'
          done()
        } else {
          test.message = 'unexpected success ' + JSON.stringify(test)
          done(Error(test.message))
        }
      }).catch(e => {
        test.end = new Date()
        if (test.ok) {
          test.message = e
          done(e)
        } else {
          if (test.exceptionPattern) {
            if (e.message.match(test.exceptionPattern)) {
              test.message = 'OK'
              done()
            } else {
              test.message = "expected \"" + e.message + "\" to match /" + test.exceptionPattern + "/"
              done(Error(test.message))
            }
          } else {
            test.message = 'OK'
            done()
          }
        }
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

if (LogProcessStats) {
  _AfterAllTests(() => {
    console.log('\n' + AllTests.map(
      test =>
        test.label + ' ' + (test.end - test.start)/1000.0 + ' ' + test.message
    ).join('\n'))
  })
}
