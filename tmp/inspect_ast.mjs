import * as pyAst from '../src/vendor/py-ast/index.esm.js';

const code = `name = input("Name? ")
name = "Mr. " + name
print(f"Hello {name}")`;

const ast = pyAst.parse(code);
const names = [];

function walk(node) {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    try {
        if (node.nodeType === 'Name') names.push(node);
        for (const k of Object.keys(node)) {
            const v = node[k];
            if (v && typeof v === 'object') walk(v);
        }
    } catch (e) {
        // ignore circular or unexpected
    }
}

walk(ast);

console.log('AST root nodeType:', ast && ast.nodeType);
console.log('Total Name nodes found:', names.length);
names.forEach((n, i) => {
    console.log(`Name[${i}] id=${n.id} lineno=${n.lineno} nodeType=${n.nodeType} ctx=`, n.ctx);
});

// Also dump a small part of AST around the print call
function findPrintCall(node) {
    if (!node) return null;
    if (Array.isArray(node)) return node.map(findPrintCall).find(Boolean);
    if (node.nodeType === 'Call' && node.func) {
        if (node.func.nodeType === 'Name' && node.func.id === 'print') return node;
        if (node.func.nodeType === 'Attribute' && node.func.attr === 'print') return node;
    }
    for (const k of Object.keys(node)) {
        const v = node[k];
        if (v && typeof v === 'object') {
            const found = findPrintCall(v);
            if (found) return found;
        }
    }
    return null;
}

const printCall = findPrintCall(ast);
console.log('Print call node:', printCall ? { nodeType: printCall.nodeType, lineno: printCall.lineno, func: printCall.func && (printCall.func.id || printCall.func.attr) } : null);
