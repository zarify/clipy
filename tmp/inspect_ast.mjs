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

function dumpNode(node, prefix = '') {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach((n, i) => dumpNode(n, prefix + '[' + i + ']'));
    const info = `${prefix}${node.nodeType || '<?>'}${node.lineno ? ' @' + node.lineno : ''}`;
    if (node.nodeType === 'Name') {
        console.log(info + ` id=${node.id} ctx=${node.ctx && (node.ctx.nodeType || node.ctx._type || node.ctx.type)}`);
    } else {
        console.log(info);
    }
    for (const k of Object.keys(node)) {
        const v = node[k];
        if (!v || (typeof v !== 'object')) continue;
        dumpNode(v, prefix + '.' + k);
    }
}

if (printCall && printCall.args) {
    console.log('Print call args count:', printCall.args.length);
    printCall.args.forEach((arg, i) => {
        console.log('Arg', i);
        dumpNode(arg, 'arg' + i + ':');
    });
}

// Raw JSON dump of the FormattedValue node for inspection
try {
    const fv = printCall && printCall.args && printCall.args[0] && printCall.args[0].values && printCall.args[0].values[1];
    if (fv) {
        console.log('--- RAW FormattedValue JSON ---');
        console.log(JSON.stringify(fv, (k, v) => {
            // Avoid cycles: if value is a function or large, show a short tag
            if (typeof v === 'function') return '[Function]';
            return v;
        }, 2));
    }
} catch (e) {
    console.error('Could not dump FormattedValue JSON', e);
}
