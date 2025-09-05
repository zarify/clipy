const pythonAst = require('python-ast');

console.log('=== python-ast Testing ===');

const testCode = `def hello(name):
    if name:
        return f'Hello {name}'
    return 'Hello World'`;

console.log('Test code:', testCode);

try {
    const ast = pythonAst.parse(testCode);
    console.log('\nParse successful!');
    console.log('AST type:', ast.constructor.name);
    console.log('AST has children:', Array.isArray(ast.children));
    console.log('Children count:', ast.children ? ast.children.length : 0);

    // Try walking the AST
    console.log('\nWalking AST:');
    let functionCount = 0;
    let ifCount = 0;
    let returnCount = 0;

    pythonAst.walk(ast, (node) => {
        const nodeName = node.constructor.name;
        if (nodeName === 'FuncdefContext') {
            functionCount++;
            console.log('- Found function');
        }
        if (nodeName === 'If_stmtContext') {
            ifCount++;
            console.log('- Found if statement');
        }
        if (nodeName === 'Return_stmtContext') {
            returnCount++;
            console.log('- Found return statement');
        }
    });

    console.log(`\nSummary: ${functionCount} functions, ${ifCount} if statements, ${returnCount} return statements`);
    console.log('\n=== SUCCESS! python-ast works perfectly ===');

} catch (error) {
    console.log('Parse failed:', error.message);
    console.log('Stack:', error.stack);
}
