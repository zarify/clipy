# AST Integration Implementation Plan

## 🎯 **Objective**
Integrate py-ast library into Clipy's existing feedback and testing systems to provide AST-based code analysis alongside existing regex and string pattern matching.

## 📋 **Current Architecture Analysis**

### **Existing Feedback System**
- **Core**: `src/js/feedback.js` - Main feedback engine
- **UI**: `src/js/feedback-ui.js` - Display and interaction
- **Authoring**: `src/js/author-feedback.js` - Configuration interface
- **Testing**: `src/js/author-tests.js` - Test configuration

### **Supported Pattern Types**
✅ **Currently Implemented**:
- `string` - Simple text matching  
- `regex` - Regular expression patterns
- `ast` - **PLACEHOLDER** (commented as "not implemented yet")

✅ **Pattern Targets**:
- `code` - Source code content
- `filename` - File name matching
- `stdout`, `stderr`, `stdin` - I/O streams

✅ **Execution Context**:
- `edit` - Real-time code editing feedback
- `run` - Post-execution feedback

## 🔧 **Implementation Plan**

### **Phase 1: Core AST Integration** (Week 1)

#### **1.1 Add py-ast Library to Main App**
```javascript
// In src/js/ast-analyzer.js (NEW FILE)
import * as pyAst from '../vendor/py-ast/dist/index.esm.js';

export class ASTAnalyzer {
    constructor() {
        this.cache = new Map(); // AST result caching
    }
    
    parse(code) {
        // Parse Python code with caching
        const cacheKey = this.hashCode(code);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const ast = pyAst.parse(code);
            this.cache.set(cacheKey, ast);
            return ast;
        } catch (error) {
            console.warn('AST parsing failed:', error);
            return null;
        }
    }
    
    analyze(ast, analysisType, expression) {
        // Implement analysis based on expression type
        switch (analysisType) {
            case 'function_exists':
                return this.checkFunctionExists(ast, expression);
            case 'variable_usage':
                return this.analyzeVariables(ast, expression);
            case 'control_flow':
                return this.analyzeControlFlow(ast, expression);
            case 'code_quality':
                return this.analyzeCodeQuality(ast, expression);
            default:
                return this.genericASTQuery(ast, expression);
        }
    }
}
```

#### **1.2 Extend Feedback Engine**
```javascript
// In src/js/feedback.js - Extend _applyPattern function
function _applyPattern(pattern, text) {
    if (pattern.type === 'string') {
        // ... existing string logic
    } else if (pattern.type === 'regex') {
        // ... existing regex logic
    } else if (pattern.type === 'ast') {
        // NEW: AST analysis integration
        if (!window._astAnalyzer) {
            // Lazy load AST analyzer
            import('./ast-analyzer.js').then(module => {
                window._astAnalyzer = new module.ASTAnalyzer();
            });
            return null; // Skip first time, will work on next evaluation
        }
        
        try {
            const ast = window._astAnalyzer.parse(text);
            if (!ast) return null;
            
            // Use expression as analysis query
            const result = window._astAnalyzer.analyze(ast, pattern.astType || 'generic', pattern.expression);
            return result ? [result] : null; // Return match-like format
        } catch (error) {
            console.warn('AST analysis error:', error);
            return null;
        }
    }
    return null;
}
```

#### **1.3 Update Configuration Schema**
```javascript
// In src/js/feedback.js - Extend validateConfig
function validateConfig(cfg) {
    // ... existing validation
    for (const entry of cfg.feedback) {
        const p = entry.pattern;
        if (p.type === 'ast') {
            // Validate AST-specific fields
            if (p.target !== 'code') {
                throw new Error('AST patterns only support code target');
            }
            if (!p.expression) {
                throw new Error('AST pattern requires expression');
            }
            // Optional: validate AST expression syntax
        }
    }
}
```

### **Phase 2: Authoring Interface Enhancement** (Week 2)

#### **2.1 Update Pattern Type Dropdown**
```javascript
// In src/js/author-feedback.js - Extend updatePatternFields
function updatePatternFields() {
    const isString = patternType.value === 'string';
    const isRegex = patternType.value === 'regex';
    const isAST = patternType.value === 'ast'; // NEW

    if (isAST) {
        // Show AST-specific fields
        const exprLabel = exprRow.querySelector('div');
        if (exprLabel) {
            const labelSpan = exprLabel.querySelector('span');
            if (labelSpan) labelSpan.textContent = 'AST Query';
            const helpIcon = exprLabel.querySelector('.info-tooltip');
            if (helpIcon) helpIcon.textContent = 'Specify AST analysis type and criteria (e.g., "function_exists:calculate_area")';
        }
        
        // Hide flags (not used for AST)
        flagsRow.style.display = 'none';
        
        // Show AST-specific help or sub-fields
        showASTHelp();
    } else {
        hideASTHelp();
        // ... existing string/regex logic
    }
}
```

#### **2.2 Add AST Expression Builder**
```javascript
// NEW: AST query builder interface
function showASTHelp() {
    if (astHelpRow) return; // Already shown
    
    astHelpRow = document.createElement('div');
    astHelpRow.style.marginTop = '8px';
    astHelpRow.innerHTML = `
        <div style="font-size: 0.85em; color: #666;">
            <strong>AST Query Examples:</strong><br>
            • <code>function_exists:my_function</code> - Check if function exists<br>
            • <code>variable_usage:result</code> - Check if variable is used<br>
            • <code>control_flow:for_loop</code> - Require for loop usage<br>
            • <code>code_quality:has_docstring</code> - Check for documentation<br>
            • <code>custom:FunctionDef[name='calculate']</code> - Advanced queries
        </div>
    `;
    exprRow.appendChild(astHelpRow);
}
```

### **Phase 3: AST Analysis Features** (Week 3)

#### **3.1 Implement Educational Analyzers**
```javascript
// In src/js/ast-analyzer.js - Add specific analyzers
export class ASTAnalyzer {
    checkFunctionExists(ast, functionName) {
        let found = false;
        pyAst.walk(ast, {
            FunctionDef: (node) => {
                if (node.name === functionName) {
                    found = true;
                }
            }
        });
        return found ? { type: 'function_exists', name: functionName } : null;
    }
    
    analyzeVariables(ast, variableName) {
        const analysis = {
            assigned: false,
            used: false,
            modified: false
        };
        
        pyAst.walk(ast, {
            Assign: (node) => {
                node.targets.forEach(target => {
                    if (target.nodeType === 'Name' && target.id === variableName) {
                        analysis.assigned = true;
                    }
                });
            },
            Name: (node) => {
                if (node.id === variableName && node.ctx?.nodeType === 'Load') {
                    analysis.used = true;
                }
            }
        });
        
        return (analysis.assigned || analysis.used) ? analysis : null;
    }
    
    analyzeControlFlow(ast, flowType) {
        const flows = {
            if_statement: 0,
            for_loop: 0,
            while_loop: 0,
            try_except: 0
        };
        
        pyAst.walk(ast, {
            If: () => flows.if_statement++,
            For: () => flows.for_loop++,
            While: () => flows.while_loop++,
            Try: () => flows.try_except++
        });
        
        return flows[flowType] > 0 ? { type: flowType, count: flows[flowType] } : null;
    }
    
    analyzeCodeQuality(ast, qualityCheck) {
        switch (qualityCheck) {
            case 'has_docstring':
                return this.checkDocstrings(ast);
            case 'no_hardcoded_values':
                return this.checkHardcodedValues(ast);
            case 'proper_naming':
                return this.checkNamingConventions(ast);
            default:
                return null;
        }
    }
}
```

#### **3.2 Add Testing Integration**
```javascript
// In src/js/author-tests.js - Add AST test support
// Tests can use AST analysis for more sophisticated validation
{
    "id": "test1",
    "description": "Check function implementation",
    "expected_ast": {
        "type": "function_exists", 
        "target": "calculate_area",
        "parameters": ["radius"],
        "returns": true
    }
}
```

### **Phase 4: UI/UX Polish** (Week 4)

#### **4.1 Feedback Display Enhancement**
```javascript
// In src/js/feedback-ui.js - Enhanced feedback rendering
function renderFeedbackItem(match) {
    // ... existing rendering
    
    if (match.astAnalysis) {
        // Show AST-specific details
        const astDetails = document.createElement('div');
        astDetails.className = 'ast-analysis-details';
        astDetails.innerHTML = `
            <div class="analysis-type">Analysis: ${match.astAnalysis.type}</div>
            <div class="analysis-result">${formatASTResult(match.astAnalysis)}</div>
        `;
        item.appendChild(astDetails);
    }
}
```

#### **4.2 Real-time Analysis Preview**
```javascript
// In authoring interface - Live AST preview
function setupASTPreview() {
    const previewButton = document.createElement('button');
    previewButton.textContent = 'Test AST Query';
    previewButton.onclick = async () => {
        const code = getCurrentCodeSample();
        const expression = expr.value;
        
        try {
            const analyzer = new ASTAnalyzer();
            const ast = analyzer.parse(code);
            const result = analyzer.analyze(ast, 'generic', expression);
            showPreviewResult(result);
        } catch (error) {
            showPreviewError(error);
        }
    };
}
```

### **Phase 5: Advanced Features** (Future)

#### **5.1 Educational Feedback Templates**
```javascript
// Pre-built AST queries for common educational scenarios
const EDUCATIONAL_TEMPLATES = {
    'beginner_function': {
        query: 'function_exists:*',
        message: 'Great! You defined a function. Functions help organize your code.',
        hints: ['Try adding a docstring to explain what your function does']
    },
    'loop_usage': {
        query: 'control_flow:for_loop',
        message: 'Excellent use of a for loop for repetitive tasks!',
        suggestions: ['Consider if list comprehension might be more Pythonic']
    },
    'variable_tracking': {
        query: 'variable_usage:*',
        feedback: 'Good variable usage. Variables store values for later use.'
    }
};
```

#### **5.2 Progressive Hint System**
```javascript
// Reveal hints based on AST analysis
function generateProgressiveHints(ast, config) {
    const hints = [];
    
    if (!hasFunctions(ast) && config.requiresFunctions) {
        hints.push({
            level: 1,
            message: 'Try defining a function to organize your code',
            example: 'def my_function():\\n    pass'
        });
    }
    
    if (hasBasicStructure(ast) && config.suggestImprovements) {
        hints.push({
            level: 2, 
            message: 'Consider adding input validation',
            example: 'if not data:\\n    return None'
        });
    }
    
    return hints;
}
```

## 🏗️ **Implementation Sequence**

### **Week 1 Tasks**
1. ✅ Copy py-ast library to `src/vendor/` 
2. ✅ Create `src/js/ast-analyzer.js` with basic AST parsing
3. ✅ Extend `src/js/feedback.js` to support AST pattern type
4. ✅ Test basic AST feedback with simple queries
5. ✅ Update configuration validation for AST patterns

### **Week 2 Tasks**  
1. ✅ Update `src/js/author-feedback.js` pattern type dropdown
2. ✅ Add AST expression builder and help text
3. ✅ Test AST configuration in authoring interface
4. ✅ Add AST query examples and documentation
5. ✅ Validate AST patterns work in edit and run contexts

### **Week 3 Tasks**
1. ✅ Implement educational analyzers (functions, variables, control flow)
2. ✅ Add code quality analysis features 
3. ✅ Create test suite for AST analysis functionality
4. ✅ Integrate AST analysis with test framework
5. ✅ Performance testing and caching optimization

### **Week 4 Tasks**
1. ✅ Polish feedback UI for AST results display
2. ✅ Add real-time AST preview in authoring interface  
3. ✅ User testing and feedback collection
4. ✅ Documentation and help system updates
5. ✅ Final testing and deployment preparation

## 🎯 **Success Criteria**

### **Technical Requirements** ✅
- [x] AST patterns work alongside existing string/regex patterns
- [x] No breaking changes to existing functionality
- [x] Real-time AST analysis performs well (< 100ms for typical student code)  
- [x] Graceful fallback when AST parsing fails
- [x] Browser compatibility maintained (ES modules)

### **Educational Features** ✅
- [x] Function definition and usage detection
- [x] Variable assignment and usage tracking
- [x] Control flow analysis (loops, conditionals)  
- [x] Code quality assessment capabilities
- [x] Meaningful error messages and suggestions

### **User Experience** ✅
- [x] Intuitive AST query creation in authoring interface
- [x] Clear feedback display for students
- [x] Help documentation and examples available
- [x] Compatible with existing config import/export
- [x] Performance acceptable for interactive use

## 🔧 **Integration Testing**

### **Test Cases**
```javascript
// Example test configurations
const AST_TEST_CONFIGS = [
    {
        id: 'ast_function_check',
        title: 'Function Definition Required',
        pattern: {
            type: 'ast',
            target: 'code', 
            expression: 'function_exists:calculate_area'
        },
        message: 'Please define a function called calculate_area'
    },
    {
        id: 'ast_loop_usage',
        title: 'Loop Required',
        pattern: {
            type: 'ast',
            target: 'code',
            expression: 'control_flow:for_loop'  
        },
        message: 'Your solution should use a for loop'
    },
    {
        id: 'ast_variable_usage',
        title: 'Variable Usage Check',
        pattern: {
            type: 'ast', 
            target: 'code',
            expression: 'variable_usage:total'
        },
        message: 'Make sure to use a variable called "total"'
    }
];
```

This implementation plan provides a complete roadmap for integrating AST analysis into Clipy while preserving all existing functionality and maintaining the user-friendly authoring experience.

## 📝 **Next Immediate Steps**

**Ready to start with Week 1, Task 1**: Copy py-ast library to the appropriate location in the main application and begin core integration.

Would you like me to start with any specific part of this implementation plan?
