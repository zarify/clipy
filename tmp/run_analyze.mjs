import { analyzeCode } from '../src/js/ast-analyzer.js';

const sample = `name = input("Name? ")
name = "Mr. " + name
print(f"Hello {name}")`;

(async () => {
    const res = await analyzeCode(sample, 'variable_usage:name');
    console.log('ANALYSIS_RESULT_START');
    console.log(JSON.stringify(res, null, 2));
    console.log('ANALYSIS_RESULT_END');
    // test a self-referential assignment
    const sample2 = `x = 1\nx = x + 1`;
    const res2 = await analyzeCode(sample2, 'variable_usage:x');
    console.log('ANALYSIS_RESULT_SELFREF_START');
    console.log(JSON.stringify(res2, null, 2));
    console.log('ANALYSIS_RESULT_SELFREF_END');
    // run full variable report (no name)
    const resAll = await analyzeCode(sample, 'variable_usage:');
    console.log('ANALYSIS_RESULT_ALLVARS_START');
    console.log(JSON.stringify(resAll, null, 2));
    console.log('ANALYSIS_RESULT_ALLVARS_END');
    // attribute assignment test
    const sample3 = `obj = Some()\nobj.attr = 5`;
    const res3 = await analyzeCode(sample3, 'variable_usage:obj');
    console.log('ANALYSIS_RESULT_ATTR_ASSIGN_START');
    console.log(JSON.stringify(res3, null, 2));
    console.log('ANALYSIS_RESULT_ATTR_ASSIGN_END');

    // attribute augassign test
    const sample4 = `obj = Some()\nobj.attr += 1`;
    const res4 = await analyzeCode(sample4, 'variable_usage:obj');
    console.log('ANALYSIS_RESULT_ATTR_AUG_START');
    console.log(JSON.stringify(res4, null, 2));
    console.log('ANALYSIS_RESULT_ATTR_AUG_END');
    // function exists test
    const sample5 = `def calculate_average(numbers):
    """Calculate the average of a list of numbers."""
    if not numbers:
        return 0
    return sum(numbers) / len(numbers)

calculate_average([1,2,3,4])`;
    const res5 = await analyzeCode(sample5, 'function_exists:calculate_average');
    console.log('ANALYSIS_RESULT_FUNC_EXISTS_START');
    console.log(JSON.stringify(res5, null, 2));
    console.log('ANALYSIS_RESULT_FUNC_EXISTS_END');
})();
