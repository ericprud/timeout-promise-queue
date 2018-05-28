let child_process = require('child_process');
let AllTests = [];

/* start processes */
for (let i = 0; i < 100; ++i) {
  AllTests.push({
    i: i,
    start: new Date(),
    exec: new Promise((resolve, reject) => {
      let program = child_process.spawn(
        'node', ['-e', 'setTimeout(() => { process.exit(0); }, 9999)'])
        // 'node', ['-e', 'for (let i = 0; i < 2**28; ++i) ;'])
      program.on('exit', exitCode => { resolve({exitCode:exitCode}) })
      program.on('error', err => { reject(err) })
    })
  })
}

/* test results */
describe('churn', () => {
  AllTests.forEach(test => {
    it('should execute test ' + test.i + '.',
       done => {
         test.exec.then(exec => {
           test.end = new Date()
           done()
         })
       })
  })
})

if (false)
afterAll(() => {
  console.log()
  AllTests.forEach(test => {
    console.log(test.i, (test.end - test.start)/1000.0)
  })
})

