// AST analyzer: robust variable analysis and normalized ctx access

let pyAst = null;

async function initializePyAst() {
    if (!pyAst) pyAst = await import('../vendor/py-ast/index.esm.js');
    return pyAst;
}

export class ASTAnalyzer {
    constructor() {
        this.cache = new Map();
        this.initialized = false;
    }

    async initialize() {
        if (!this.initialized) {
            await initializePyAst();
            this.initialized = true;
        }
        return this;
    }

    hashCode(str) {
        let h = 0;
        if (!str) return '0';
        for (let i = 0; i < str.length; i++) {
            const c = str.charCodeAt(i);
            h = ((h << 5) - h) + c;
            h = h & h;
        }
        return String(h);
    }

    async parse(code) {
        if (!this.initialized) await this.initialize();
        const k = this.hashCode(code);
        if (this.cache.has(k)) return this.cache.get(k);
        try {
            const ast = pyAst.parse(code);
            if (this.cache.size > 100) this.cache.delete(this.cache.keys().next().value);
            this.cache.set(k, ast);
            return ast;
        } catch (e) {
            this.cache.set(k, null);
            return null;
        }
    }

    analyze(ast, expression) {
        if (!ast || !expression) return null;
        const [type, target] = expression.split(':');
        switch (type) {
            case 'variable_usage': return this.analyzeVariables(ast, target);
            case 'function_exists': return this.checkFunctionExists(ast, target);
            case 'control_flow': return this.analyzeControlFlow(ast, target);
            case 'function_count': return this.countFunctions(ast);
            case 'code_quality': return this.analyzeCodeQuality(ast, target);
            default: return this.genericQuery(ast, expression);
        }
    }

    checkFunctionExists(ast, functionName) {
        if (!ast || !ast.body) return null;
        for (const n of ast.body) {
            if (n && n.nodeType === 'FunctionDef' && (functionName === '*' || n.name === functionName)) {
                return { name: n.name, lineno: n.lineno };
            }
        }
        return null;
    }

    analyzeVariables(ast, variableName) {
        const analysis = { assigned: false, used: false, modified: false, assignments: [], usages: [] };
        const getCtx = (node) => node && node.ctx && (node.ctx.nodeType || node.ctx._type || node.ctx.type);

        const seen = new Set();
        const traverse = (node, inheritedLineno) => {
            if (!node || typeof node !== 'object' || seen.has(node)) return;
            seen.add(node);
            if (Array.isArray(node)) return node.forEach(n => traverse(n, inheritedLineno));

            // Prefer the inherited (containing statement) lineno so nested
            // expression nodes (e.g. Name inside FormattedValue) report the
            // surrounding statement's line number.
            const thisLineno = inheritedLineno || node.lineno;

            if (node.nodeType === 'Assign' && Array.isArray(node.targets)) {
                node.targets.forEach(t => {
                    if (t && t.nodeType === 'Name' && (variableName === '*' || t.id === variableName)) {
                        analysis.assigned = true;
                        analysis.assignments.push({ name: t.id, lineno: thisLineno });
                    }
                });
            }

            if (node.nodeType === 'AnnAssign' && node.target && node.target.nodeType === 'Name') {
                const t = node.target;
                if (variableName === '*' || t.id === variableName) {
                    analysis.assigned = true;
                    analysis.assignments.push({ name: t.id, lineno: thisLineno });
                }
            }

            if (node.nodeType === 'AugAssign' && node.target && node.target.nodeType === 'Name') {
                const t = node.target;
                if (variableName === '*' || t.id === variableName) {
                    analysis.assigned = true;
                    analysis.modified = true;
                    analysis.assignments.push({ name: t.id, lineno: thisLineno });
                }
            }

            if (node.nodeType === 'Name') {
                const ctx = getCtx(node);
                // Coerce to the containing statement line when available.
                const resolvedLineno = thisLineno;
                if (ctx === 'Load' && (variableName === '*' || node.id === variableName)) {
                    analysis.used = true;
                    analysis.usages.push({ name: node.id, lineno: resolvedLineno });
                }
                if ((ctx === 'Store' || ctx === 'Del') && (variableName === '*' || node.id === variableName)) {
                    analysis.assigned = true;
                    analysis.assignments.push({ name: node.id, lineno: resolvedLineno });
                }
            }

            if (node.nodeType === 'Call' && node.func && node.func.nodeType === 'Attribute') {
                const v = node.func.value;
                if (v && v.nodeType === 'Name' && (variableName === '*' || v.id === variableName)) analysis.modified = true;
            }

            for (const k of Object.keys(node)) {
                const c = node[k];
                if (!c) continue;
                if (Array.isArray(c)) c.forEach(item => traverse(item, thisLineno));
                else if (typeof c === 'object') traverse(c, thisLineno);
            }
        };

        if (ast && Array.isArray(ast.body)) ast.body.forEach(n => traverse(n, n.lineno));
        return (analysis.assigned || analysis.used) ? analysis : null;
    }

    /**
     * Analyze control flow structures
     */
    analyzeControlFlow(ast, flowType) {
        const flows = {
            if_statement: 0,
            for_loop: 0,
            while_loop: 0,
            try_except: 0,
            with_statement: 0
        };

        const details = [];

        // Manual traversal
        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'If') {
                flows.if_statement++;
                details.push({ type: 'if', lineno: node.lineno });
            }
            if (node.nodeType === 'For') {
                flows.for_loop++;
                details.push({ type: 'for', lineno: node.lineno });
            }
            if (node.nodeType === 'While') {
                flows.while_loop++;
                details.push({ type: 'while', lineno: node.lineno });
            }
            if (node.nodeType === 'Try') {
                flows.try_except++;
                details.push({ type: 'try', lineno: node.lineno });
            }
            if (node.nodeType === 'With') {
                flows.with_statement++;
                details.push({ type: 'with', lineno: node.lineno });
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
            if (node.finalbody && Array.isArray(node.finalbody)) {
                node.finalbody.forEach(traverse);
            }
            if (node.handlers && Array.isArray(node.handlers)) {
                node.handlers.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        if (flowType && flowType !== '*') {
            return flows[flowType] > 0 ? {
                type: flowType,
                count: flows[flowType],
                details: details.filter(d => d.type === flowType.replace('_statement', '').replace('_loop', ''))
            } : null;
        }

        // Return all flow analysis
        return Object.values(flows).some(count => count > 0) ? { flows, details } : null;
    }

    /**
     * Count total functions in code
     */
    countFunctions(ast) {
        let count = 0;
        const functions = [];

        // Manual traversal
        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'FunctionDef') {
                count++;
                functions.push({
                    name: node.name,
                    lineno: node.lineno,
                    parameters: (node.args && node.args.args) ? node.args.args.length : 0
                });
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return count > 0 ? { count, functions } : null;
    }

    /**
     * Check for docstrings in functions and classes
     */
    checkDocstrings(ast) {
        const analysis = {
            functions: { total: 0, withDocstring: 0 },
            classes: { total: 0, withDocstring: 0 },
            details: []
        };

        // Manual traversal
        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'FunctionDef') {
                analysis.functions.total++;
                const docstring = this.getDocstring(node);
                if (docstring) {
                    analysis.functions.withDocstring++;
                }
                analysis.details.push({
                    type: 'function',
                    name: node.name,
                    lineno: node.lineno,
                    hasDocstring: !!docstring,
                    docstring: docstring
                });
            }

            if (node.nodeType === 'ClassDef') {
                analysis.classes.total++;
                const docstring = this.getDocstring(node);
                if (docstring) {
                    analysis.classes.withDocstring++;
                }
                analysis.details.push({
                    type: 'class',
                    name: node.name,
                    lineno: node.lineno,
                    hasDocstring: !!docstring,
                    docstring: docstring
                });
            }

            // Recursively traverse child nodes
            if (node.body && Array.isArray(node.body)) {
                node.body.forEach(traverse);
            }
            if (node.orelse && Array.isArray(node.orelse)) {
                node.orelse.forEach(traverse);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        const hasAnyDocstring = analysis.functions.withDocstring > 0 || analysis.classes.withDocstring > 0;
        return hasAnyDocstring ? analysis : null;
    }

    /**
     * Get docstring from a function or class node
     */
    getDocstring(node) {
        if (node.body && node.body.length > 0) {
            const firstStmt = node.body[0];
            if (firstStmt.nodeType === 'Expr' &&
                firstStmt.value &&
                firstStmt.value.nodeType === 'Constant' &&
                typeof firstStmt.value.value === 'string') {
                return firstStmt.value.value;
            }
        }
        return null;
    }

    /**
     * Analyze code quality aspects
     */
    analyzeCodeQuality(ast, qualityCheck) {
        switch (qualityCheck) {
            case 'has_docstring':
                return this.checkDocstrings(ast);
            case 'no_hardcoded_values':
                return this.checkHardcodedValues(ast);
            case 'proper_naming':
                return this.checkNamingConventions ? this.checkNamingConventions(ast) : null;
            case 'complexity':
                return this.calculateComplexity(ast);
            default:
                return this.generalQualityCheck(ast);
        }
    }

    /**
     * Generic AST query for basic node type searches
     */
    genericQuery(ast, expression) {
        const results = [];
        const nodeType = expression;

        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === nodeType) {
                results.push({
                    type: nodeType,
                    lineno: node.lineno,
                    details: this.extractNodeDetails(node)
                });
            }

            // Recursively traverse child nodes
            for (const k of Object.keys(node)) {
                const c = node[k];
                if (!c) continue;
                if (Array.isArray(c)) c.forEach(traverse);
                else if (typeof c === 'object') traverse(c);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return results.length > 0 ? { type: nodeType, count: results.length, results } : null;
    }

    /**
     * Extract relevant details from an AST node
     */
    extractNodeDetails(node) {
        const details = { nodeType: node.nodeType };

        if (node.name) details.name = node.name;
        if (node.id) details.id = node.id;
        if (node.lineno) details.lineno = node.lineno;
        if (node.col_offset !== undefined) details.col_offset = node.col_offset;

        return details;
    }

    /**
     * Custom advanced query (placeholder for future expansion)
     */
    customQuery(ast, queryExpression) {
        console.warn('Custom queries not yet implemented:', queryExpression);
        return null;
    }

    /**
     * Check for hardcoded values (numbers, strings) that might be better as constants
     */
    checkHardcodedValues(ast) {
        const hardcodedValues = [];

        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'Constant') {
                const value = node.value;
                if (typeof value === 'number' && ![0, 1, -1, 2, 10, 100].includes(value)) {
                    hardcodedValues.push({
                        value: value,
                        type: 'number',
                        lineno: node.lineno
                    });
                } else if (typeof value === 'string' && value.length > 10) {
                    hardcodedValues.push({
                        value: value.substring(0, 50) + (value.length > 50 ? '...' : ''),
                        type: 'string',
                        lineno: node.lineno
                    });
                }
            }

            // Recursively traverse child nodes
            for (const k of Object.keys(node)) {
                const c = node[k];
                if (!c) continue;
                if (Array.isArray(c)) c.forEach(traverse);
                else if (typeof c === 'object') traverse(c);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return hardcodedValues.length > 0 ? { hardcodedValues } : null;
    }

    /**
     * Basic complexity calculation (simplified cyclomatic complexity)
     */
    calculateComplexity(ast) {
        let complexity = 1; // Base complexity

        const traverse = (node) => {
            if (!node) return;

            if (['If', 'For', 'While', 'Try'].includes(node.nodeType)) {
                complexity++;
            }
            if (node.nodeType === 'ExceptHandler') {
                complexity++;
            }

            // Recursively traverse child nodes
            for (const k of Object.keys(node)) {
                const c = node[k];
                if (!c) continue;
                if (Array.isArray(c)) c.forEach(traverse);
                else if (typeof c === 'object') traverse(c);
            }
        };

        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach(traverse);
        }

        return { complexity };
    }

    /**
     * General code quality assessment
     */
    generalQualityCheck(ast) {
        return {
            functions: this.countFunctions(ast),
            docstrings: this.checkDocstrings(ast),
            complexity: this.calculateComplexity(ast),
            controlFlow: this.analyzeControlFlow(ast, '*')
        };
    }
}

/**
 * Global AST analyzer instance for shared use
 */
let globalAnalyzer = null;

/**
 * Get or create global AST analyzer instance
 */
export async function getASTAnalyzer() {
    if (!globalAnalyzer) {
        globalAnalyzer = new ASTAnalyzer();
        await globalAnalyzer.initialize();
    }
    return globalAnalyzer;
}

/**
 * Convenience function for quick AST analysis
 * @param {string} code - Python source code
 * @param {string} expression - Analysis query expression
 * @returns {Promise<Object|null>} - Analysis result
 */
export async function analyzeCode(code, expression) {
    try {
        const analyzer = await getASTAnalyzer();
        const ast = await analyzer.parse(code);
        if (!ast) return null;
        return analyzer.analyze(ast, expression);
    } catch (error) {
        console.error('AST analysis failed:', error);
        return null;
    }
}

// Export for browser global access if needed
if (typeof window !== 'undefined') {
    window.ASTAnalyzer = ASTAnalyzer;
    window.analyzeCode = analyzeCode;
}
