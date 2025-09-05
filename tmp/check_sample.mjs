import { analyzeCode } from '../src/js/ast-analyzer.js';

const sample = "print(f\"Hello {input('What is your name? ')}!\")";

(async () => {
    const res = await analyzeCode(sample, 'variable_usage');
    console.log('ANALYZE_RESULT');
    console.log(JSON.stringify(res, null, 2));
})();
