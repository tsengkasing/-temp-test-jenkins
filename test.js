/**
 * Created by tsengkasing on 4/25/2017.
 */

const GPA = require('./GPA')
console.log(123)
console.log('commit1')
console.log('commit...')
GPA({ token1: 'abc', token2: 'abc' }, (obj) => {
  console.log(obj)
})
console.log('commit 1')
console.log('commit 2')

console.log('commit 666')
