import { analyzeCode } from './src/js/ast-analyzer.js';

async function run() {
    const code1 = `
class Calculator:
    def add(self, a: int, b: int) -> int:
        return a + b

x: float = 3.14
`;
    console.log('--- Variable annotation check ---');
    console.log(await analyzeCode(code1, 'variable_usage:*'));

    const code2 = `
nums = [i for i in range(10) if i % 2 == 0]
pairs = {k:v for k,v in enumerate(nums)}
g = (x*x for x in nums)
`;
    console.log('--- Comprehensions check ---');
    console.log(await analyzeCode(code2, 'comprehensions:*'));

    const code3 = `
try:
    import something
    result = do_work()
    value = obj.method()
except Exception:
    pass
`;
    console.log('--- Exception handling calls check ---');
    console.log(await analyzeCode(code3, 'exception_handling:*'));
}

run().catch(e => console.error(e));
