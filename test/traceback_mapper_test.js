const assert = require('assert')
const { mapTraceback } = require('../src/lib/traceback_mapper')

function runTests(){
  // simple mapping
  const raw = 'Traceback (most recent call last):\n  File "<stdin>", line 10, in <module>\nValueError: oops'
  const mapped = mapTraceback(raw, 3)
  assert(mapped.includes('line 7'), 'Line should map from 10->7')

  // with column
  const raw2 = 'File "<stdin>", line 5, column 12\nSyntaxError'
  const mapped2 = mapTraceback(raw2, 2)
  assert(mapped2.includes('line 3, column 12'), 'Column should be preserved and line adjusted')

  // no traceback
  const empty = mapTraceback('', 2)
  assert(empty === '', 'Empty input yields empty output')

  console.log('All traceback_mapper tests passed')
}

runTests()
