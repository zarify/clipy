import { analyzeCode } from '../src/js/ast-analyzer.js';

const sample = `name = input("Name? ")
name = "Mr. " + name
print(f"Hello {name}")`;

(async () => {
    const res = await analyzeCode(sample, 'variable_usage:name');
    console.log('ANALYSIS_RESULT_START');
    console.log(JSON.stringify(res, null, 2));
    console.log('ANALYSIS_RESULT_END');
})();
