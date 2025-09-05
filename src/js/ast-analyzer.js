/**
 * AST Analyzer Module for Clipy Educational Feedback
 * 
 * Provides Python AST analysis capabilities for educational feedback
 * and code quality assessment using py-ast library.
 */

// Import py-ast library from vendor directory
let pyAst = null;

// Initialize py-ast library (async loading)
async function initializePyAst() {
    if (!pyAst) {
        try {
            // Use relative path from src directory (document root)
            pyAst = await import('../vendor/py-ast/index.esm.js');
            console.log('py-ast library loaded successfully');
        } catch (error) {
            console.error('Failed to load py-ast library:', error);
            throw new Error('AST analysis unavailable: ' + error.message);
        }
    }
    return pyAst;
}

/**
 * Main AST Analyzer class
 * Provides caching, parsing, and educational analysis capabilities
 */
export class ASTAnalyzer {
    constructor() {
        this.cache = new Map(); // Cache for parsed AST results
        this.initialized = false;
    }

    /**
     * Initialize the analyzer (load py-ast library)
     */
    async initialize() {
        if (!this.initialized) {
            await initializePyAst();
            this.initialized = true;
        }
        return this;
    }

    /**
     * Generate a simple hash for caching
     */
    hashCode(str) {
        let hash = 0;
        if (str.length === 0) return hash;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    /**
     * Parse Python code to AST with caching
     * @param {string} code - Python source code
     * @returns {Object|null} - Parsed AST or null if parsing failed
     */
    async parse(code) {
        console.log('🔍 AST Parser - Starting parse for code:', code.substring(0, 100) + '...');

        if (!this.initialized) {
            console.log('🔍 AST Parser - Not initialized, initializing now...');
            await this.initialize();
        }

        const cacheKey = this.hashCode(code);
        if (this.cache.has(cacheKey)) {
            console.log('🔍 AST Parser - Using cached result for hash:', cacheKey);
            return this.cache.get(cacheKey);
        }

        try {
            console.log('🔍 AST Parser - Calling pyAst.parse()...');
            console.log('🔍 AST Parser - pyAst object:', pyAst);
            const ast = pyAst.parse(code);
            console.log('🔍 AST Parser - Parse successful, AST:', ast);

            // Limit cache size to prevent memory issues
            if (this.cache.size > 100) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }

            this.cache.set(cacheKey, ast);
            return ast;
        } catch (error) {
            console.error('🔍 AST Parser - Parse failed:', error);
            console.warn('AST parsing failed:', error.message);
            this.cache.set(cacheKey, null); // Cache failures too
            return null;
        }
    }

    /**
     * Analyze AST based on query expression
     * @param {Object} ast - Parsed AST
     * @param {string} expression - Analysis query expression
     * @returns {Object|null} - Analysis result or null
     */
    analyze(ast, expression) {
        console.log('🔍 AST Analyzer - Starting analysis');
        console.log('🔍 AST Analyzer - AST object:', ast);
        console.log('🔍 AST Analyzer - Expression:', expression);

        if (!ast || !expression) {
            console.log('🔍 AST Analyzer - Missing AST or expression, returning null');
            return null;
        }

        try {
            // Parse expression format: "analysisType:target" or just "analysisType"
            const [analysisType, target] = expression.split(':');
            console.log('🔍 AST Analyzer - Analysis type:', analysisType, 'Target:', target);

            let result = null;
            switch (analysisType) {
                case 'function_exists':
                    console.log('🔍 AST Analyzer - Running function_exists analysis');
                    result = this.checkFunctionExists(ast, target);
                    break;

                case 'variable_usage':
                    console.log('🔍 AST Analyzer - Running variable_usage analysis');
                    result = this.analyzeVariables(ast, target);
                    break;

                case 'control_flow':
                    console.log('🔍 AST Analyzer - Running control_flow analysis');
                    result = this.analyzeControlFlow(ast, target);
                    break;

                case 'code_quality':
                    console.log('🔍 AST Analyzer - Running code_quality analysis');
                    result = this.analyzeCodeQuality(ast, target);
                    break;

                case 'function_count':
                    console.log('🔍 AST Analyzer - Running function_count analysis');
                    result = this.countFunctions(ast);
                    break;

                case 'has_docstring':
                    console.log('🔍 AST Analyzer - Running has_docstring analysis');
                    result = this.checkDocstrings(ast);
                    break;

                case 'custom':
                    console.log('🔍 AST Analyzer - Running custom analysis');
                    result = this.customQuery(ast, target);
                    break;

                default:
                    console.log('🔍 AST Analyzer - Running generic query');
                    // Generic AST query
                    result = this.genericQuery(ast, expression);
            }

            console.log('🔍 AST Analyzer - Analysis result:', result);
            return result;
        } catch (error) {
            console.error('🔍 AST Analyzer - Analysis error:', error);
            console.warn('AST analysis error:', error);
            return null;
        }
    }

    /**
     * Check if a specific function exists
     */
    checkFunctionExists(ast, functionName) {
        console.log('🔍 Function Check - Looking for function:', functionName);
        console.log('🔍 Function Check - AST structure:', Object.keys(ast));
        console.log('🔍 Function Check - AST body:', ast.body);

        // Let's also inspect the actual nodes in the body
        if (ast.body && Array.isArray(ast.body)) {
            ast.body.forEach((node, index) => {
                console.log(`🔍 Function Check - Body node ${index}:`, node);
                console.log(`🔍 Function Check - Node type: ${node.nodeType}`);
            });
        }

        let found = false;
        let foundFunction = null;

        try {
            // Let's try a different approach - manual traversal first to understand the structure
            console.log('🔍 Function Check - Attempting pyAst.walk...');

            pyAst.walk(ast, {
                FunctionDef: (node) => {
                    console.log('🔍 Function Check - Found FunctionDef node:', node);
                    console.log('🔍 Function Check - Function name:', node.name);

                    if (functionName === '*' || node.name === functionName) {
                        found = true;
                        foundFunction = {
                            name: node.name,
                            parameters: node.args.args.map(arg => arg.arg),
                            defaults: node.args.defaults.length,
                            lineno: node.lineno,
                            docstring: pyAst.getDocstring(node)
                        };
                        console.log('🔍 Function Check - Match found:', foundFunction);

                        // If looking for specific function, we can stop
                        if (functionName !== '*') {
                            return false; // Stop walking
                        }
                    }
                },
                // Let's also try other potential node type names
                'FunctionDef': (node) => {
                    console.log('🔍 Function Check - Alternative FunctionDef handler called:', node);
                }
            });

            // Manual check as backup
            console.log('🔍 Function Check - Manual traversal of body...');
            if (ast.body && Array.isArray(ast.body)) {
                ast.body.forEach(node => {
                    if (node.nodeType === 'FunctionDef') {
                        console.log('🔍 Function Check - Manual found FunctionDef:', node);
                        if (functionName === '*' || node.name === functionName) {
                            found = true;
                            foundFunction = {
                                name: node.name,
                                parameters: node.args.args.map(arg => arg.arg),
                                defaults: node.args.defaults.length,
                                lineno: node.lineno,
                                docstring: null // We'll handle docstring separately
                            };
                        }
                    }
                });
            }

        } catch (error) {
            console.error('🔍 Function Check - Error during walk:', error);
        }

        console.log('🔍 Function Check - Final result:', found ? foundFunction : null);
        return found ? foundFunction : null;
    }

    /**
     * Analyze variable usage patterns
     */
    analyzeVariables(ast, variableName) {
        console.log('🔍 Variable Analysis - Looking for variable:', variableName);

        const analysis = {
            assigned: false,
            used: false,
            modified: false,
            assignments: [],
            usages: []
        };

        try {
            pyAst.walk(ast, {
                Assign: (node) => {
                    console.log('🔍 Variable Analysis - Found Assign node:', node);
                    node.targets.forEach(target => {
                        console.log('🔍 Variable Analysis - Assignment target:', target);
                        if (target.nodeType === 'Name' &&
                            (variableName === '*' || target.id === variableName)) {
                            analysis.assigned = true;
                            analysis.assignments.push({
                                name: target.id,
                                lineno: node.lineno
                            });
                            console.log('🔍 Variable Analysis - Assignment match:', target.id);
                        }
                    });
                },
                Name: (node) => {
                    console.log('🔍 Variable Analysis - Found Name node:', node);
                    if (node.ctx?.nodeType === 'Load' &&
                        (variableName === '*' || node.id === variableName)) {
                        analysis.used = true;
                        analysis.usages.push({
                            name: node.id,
                            lineno: node.lineno
                        });
                        console.log('🔍 Variable Analysis - Usage match:', node.id);
                    }
                },
                Call: (node) => {
                    // Check for method calls that modify variables (e.g., list.append)
                    if (node.func?.nodeType === 'Attribute' &&
                        node.func.value?.nodeType === 'Name' &&
                        (variableName === '*' || node.func.value.id === variableName)) {
                        analysis.modified = true;
                        console.log('🔍 Variable Analysis - Modification match:', node.func.value.id);
                    }
                }
            });
        } catch (error) {
            console.error('🔍 Variable Analysis - Error during walk:', error);
        }

        console.log('🔍 Variable Analysis - Final analysis:', analysis);
        const result = (analysis.assigned || analysis.used) ? analysis : null;
        console.log('🔍 Variable Analysis - Returning:', result);
        return result;
    }

    /**
     * Analyze control flow structures
     */
    analyzeControlFlow(ast, flowType) {
        console.log('🔍 Control Flow Analysis - Looking for flow type:', flowType);

        const flows = {
            if_statement: 0,
            for_loop: 0,
            while_loop: 0,
            try_except: 0,
            with_statement: 0
        };

        const details = [];

        // Manual traversal since pyAst.walk() isn't working
        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'If') {
                console.log('🔍 Control Flow - Found If node:', node);
                flows.if_statement++;
                details.push({ type: 'if', lineno: node.lineno });
            }
            if (node.nodeType === 'For') {
                console.log('🔍 Control Flow - Found For node:', node);
                flows.for_loop++;
                details.push({ type: 'for', lineno: node.lineno });
            }
            if (node.nodeType === 'While') {
                console.log('🔍 Control Flow - Found While node:', node);
                flows.while_loop++;
                details.push({ type: 'while', lineno: node.lineno });
            }
            if (node.nodeType === 'Try') {
                console.log('🔍 Control Flow - Found Try node:', node);
                flows.try_except++;
                details.push({ type: 'try', lineno: node.lineno });
            }
            if (node.nodeType === 'With') {
                console.log('🔍 Control Flow - Found With node:', node);
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

        console.log('🔍 Control Flow Analysis - Found flows:', flows);
        console.log('🔍 Control Flow Analysis - Details:', details);

        if (flowType && flowType !== '*') {
            const result = flows[flowType] > 0 ? {
                type: flowType,
                count: flows[flowType],
                details: details.filter(d => d.type === flowType.replace('_statement', '').replace('_loop', ''))
            } : null;
            console.log('🔍 Control Flow Analysis - Specific flow result:', result);
            return result;
        }

        // Return all flow analysis
        const result = Object.values(flows).some(count => count > 0) ? { flows, details } : null;
        console.log('🔍 Control Flow Analysis - All flows result:', result);
        return result;
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
                return this.checkNamingConventions(ast);
            case 'complexity':
                return this.calculateComplexity(ast);
            default:
                return this.generalQualityCheck(ast);
        }
    }

    /**
     * Count total functions in code
     */
    countFunctions(ast) {
        console.log('🔍 Function Count - Starting count');
        let count = 0;
        const functions = [];

        // Manual traversal since pyAst.walk() isn't working
        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'FunctionDef') {
                count++;
                functions.push({
                    name: node.name,
                    lineno: node.lineno,
                    parameters: node.args.args.length
                });
                console.log('🔍 Function Count - Found function:', node.name);
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

        console.log('🔍 Function Count - Total count:', count);
        console.log('🔍 Function Count - Functions:', functions);
        return count > 0 ? { count, functions } : null;
    }

    /**
     * Check for docstrings in functions and classes
     */
    checkDocstrings(ast) {
        console.log('🔍 Docstring Check - Starting check');
        const analysis = {
            functions: { total: 0, withDocstring: 0 },
            classes: { total: 0, withDocstring: 0 },
            details: []
        };

        // Manual traversal since pyAst.walk() isn't working
        const traverse = (node) => {
            if (!node) return;

            if (node.nodeType === 'FunctionDef') {
                analysis.functions.total++;
                console.log('🔍 Docstring Check - Found function:', node.name);

                // Check for docstring (first statement in body if it's a string)
                let docstring = null;
                if (node.body && node.body.length > 0) {
                    const firstStmt = node.body[0];
                    if (firstStmt.nodeType === 'Expr' &&
                        firstStmt.value &&
                        firstStmt.value.nodeType === 'Constant' &&
                        typeof firstStmt.value.value === 'string') {
                        docstring = firstStmt.value.value;
                        analysis.functions.withDocstring++;
                    }
                }

                analysis.details.push({
                    type: 'function',
                    name: node.name,
                    lineno: node.lineno,
                    hasDocstring: !!docstring,
                    docstring: docstring
                });

                console.log('🔍 Docstring Check - Function docstring:', docstring ? 'found' : 'none');
            }

            if (node.nodeType === 'ClassDef') {
                analysis.classes.total++;
                console.log('🔍 Docstring Check - Found class:', node.name);

                // Check for docstring
                let docstring = null;
                if (node.body && node.body.length > 0) {
                    const firstStmt = node.body[0];
                    if (firstStmt.nodeType === 'Expr' &&
                        firstStmt.value &&
                        firstStmt.value.nodeType === 'Constant' &&
                        typeof firstStmt.value.value === 'string') {
                        docstring = firstStmt.value.value;
                        analysis.classes.withDocstring++;
                    }
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

        console.log('🔍 Docstring Check - Analysis:', analysis);
        const hasAnyDocstring = analysis.functions.withDocstring > 0 || analysis.classes.withDocstring > 0;
        return hasAnyDocstring ? analysis : null;
    }

    /**
     * Generic AST query for basic node type searches
     */
    genericQuery(ast, expression) {
        const results = [];
        const nodeType = expression;

        pyAst.walk(ast, {
            [nodeType]: (node) => {
                results.push({
                    type: nodeType,
                    lineno: node.lineno,
                    details: this.extractNodeDetails(node)
                });
            }
        });

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
        // This could be expanded to support XPath-like queries or other advanced patterns
        console.warn('Custom queries not yet implemented:', queryExpression);
        return null;
    }

    /**
     * Check for hardcoded values (numbers, strings) that might be better as constants
     */
    checkHardcodedValues(ast) {
        const hardcodedValues = [];

        pyAst.walk(ast, {
            Constant: (node) => {
                // Skip common values that are typically fine to hardcode
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
        });

        return hardcodedValues.length > 0 ? { hardcodedValues } : null;
    }

    /**
     * Basic complexity calculation (simplified cyclomatic complexity)
     */
    calculateComplexity(ast) {
        let complexity = 1; // Base complexity

        pyAst.walk(ast, {
            If: () => complexity++,
            For: () => complexity++,
            While: () => complexity++,
            Try: () => complexity++,
            ExceptHandler: () => complexity++
        });

        return { complexity };
    }

    /**
     * General code quality assessment
     */
    generalQualityCheck(ast) {
        const analysis = {
            functions: this.countFunctions(ast),
            docstrings: this.checkDocstrings(ast),
            complexity: this.calculateComplexity(ast),
            controlFlow: this.analyzeControlFlow(ast, '*')
        };

        return analysis;
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
    console.log('🔍 analyzeCode - Starting analysis');
    console.log('🔍 analyzeCode - Code length:', code.length);
    console.log('🔍 analyzeCode - Expression:', expression);

    try {
        const analyzer = await getASTAnalyzer();
        console.log('🔍 analyzeCode - Got analyzer:', analyzer);

        const ast = await analyzer.parse(code);
        console.log('🔍 analyzeCode - Got AST:', ast);

        if (!ast) {
            console.log('🔍 analyzeCode - AST is null, returning null');
            return null;
        }

        const result = analyzer.analyze(ast, expression);
        console.log('🔍 analyzeCode - Final result:', result);
        return result;
    } catch (error) {
        console.error('🔍 analyzeCode - Error:', error);
        console.error('AST analysis failed:', error);
        return null;
    }
}

// Export for browser global access if needed
if (typeof window !== 'undefined') {
    window.ASTAnalyzer = ASTAnalyzer;
    window.analyzeCode = analyzeCode;
}
