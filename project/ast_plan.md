# AST-Based Feedback and Testing Plan

## Overview

This document outlines a comprehensive plan for implementing Abstract Syntax Tree (AST) based code analysis in Clipy to provide intelligent feedback and automated testing for student code submissions. The AST analysis will run on the JavaScript side of the application for easier integration with the existing Clipy interface.

## Current State

Currently, Clipy uses simple string-based feedback and output comparison testing. AST-based analysis would enable much more sophisticated code quality assessment and educational feedback while running entirely in the browser environment.

## Core AST Analysis Categories

### 1. Function Analysis
- **Function Definition Detection**: Check if required functions are defined
- **Parameter Validation**: Verify function signatures (parameter names, count, defaults)
- **Return Statement Analysis**: Ensure functions return appropriate values
- **Function Call Detection**: Verify if specific functions are called
- **Recursive Function Detection**: Identify and validate recursive implementations
- **Function Complexity**: Measure cyclomatic complexity of functions

### 2. Control Flow Analysis
- **Conditional Structure Depth**: Monitor nesting levels of if/elif/else statements
- **Loop Structure Analysis**: 
  - Detect for/while loops
  - Measure loop nesting depth
  - Identify infinite loop potential
  - Check for proper loop variable usage
- **Exception Handling**: Verify try/except/finally block usage

### 3. Variable and Data Structure Analysis
- **Variable Declaration Tracking**: Monitor when variables are first assigned
- **Variable Usage Patterns**: Detect unused variables or variables used before assignment
- **Scope Analysis**: Check variable scope usage (local vs global)
- **Data Type Usage**: Verify use of specific data types (lists, dicts, sets, etc.)

### 4. Object-Oriented Programming Analysis
- **Class Definition Detection**: Verify class structure and inheritance
- **Method Implementation**: Check for required methods (__init__, __str__, etc.)
- **Instance Variable Usage**: Validate proper use of self.variable

### 5. Code Quality and Style Analysis
- **Import Statement Analysis**: 
  - Check for required imports
  - Detect unused imports
  - Validate import patterns (from X import Y vs import X)
- **Magic Number Detection**: Flag hardcoded numeric values
- **Comment Analysis**: Verify presence of docstrings and comments

### 6. Error-Prone Pattern Detection
- **Resource Management**: File handling, context manager usage

## Implementation Architecture

### JavaScript-Based AST Processing Pipeline
1. **Parse Phase**: Convert Python code to AST using a JavaScript Python parser (e.g., Skulpt AST or py-ast)
2. **Analysis Phase**: Run various analyzers on the AST in the browser
3. **Feedback Generation**: Create human-readable feedback messages
4. **Test Evaluation**: Generate pass/fail results for specific criteria

### JavaScript Analyzer Framework
```javascript
import { parse } from 'pyparser'; // or RustPython WASM alternative

class ASTAnalyzer {
    constructor(codeString) {
        this.code = codeString;
        this.tree = null;
        this.results = {};
    }
    
    async parsePythonCode(code) {
        try {
            // Using pyparser (primary option)
            this.tree = await parse(code);
            return this.tree;
        } catch (error) {
            console.error('AST parsing failed:', error);
            throw new Error('Failed to parse Python code: ' + error.message);
        }
    }
    
    async analyze(analysisTypes) {
        if (!this.tree) {
            await this.parsePythonCode(this.code);
        }
        
        for (const analyzerType of analysisTypes) {
            const analyzer = this.getAnalyzer(analyzerType);
            this.results[analyzerType] = analyzer.analyze(this.tree);
        }
        return this.results;
    }
    
    getAnalyzer(type) {
        const analyzers = {
            'function_definition': new FunctionAnalyzer(),
            'variable_usage': new VariableAnalyzer(),
            'control_flow': new ControlFlowAnalyzer(),
            'loop_analysis': new LoopAnalyzer()
        };
        return analyzers[type];
    }
}

// Example analyzer implementation
class FunctionAnalyzer {
    analyze(tree) {
        const functions = [];
        this.visitNode(tree, (node) => {
            if (node._type === 'FunctionDef') {
                functions.push({
                    name: node.name,
                    params: node.args.args.map(arg => arg.arg),
                    lineno: node.lineno,
                    returns: node.returns !== null
                });
            }
        });
        return { functions, count: functions.length };
    }
    
    visitNode(node, callback) {
        if (!node || typeof node !== 'object') return;
        
        callback(node);
        
        // Recursively visit child nodes
        for (const key in node) {
            const value = node[key];
            if (Array.isArray(value)) {
                value.forEach(child => this.visitNode(child, callback));
            } else if (typeof value === 'object') {
                this.visitNode(value, callback);
            }
        }
    }
}
```

### Configuration Schema
```json
{
  "ast_feedback": [
    {
      "type": "function_definition",
      "target": "calculate_area",
      "parameters": ["radius"],
      "message": "Define a function called 'calculate_area' that takes a 'radius' parameter"
    },
    {
      "type": "loop_usage",
      "min_loops": 1,
      "max_nesting": 2,
      "message": "Use at least one loop, but avoid deeply nested loops"
    },
    {
      "type": "variable_usage", 
      "required_vars": ["total", "count"],
      "message": "Your solution should use variables named 'total' and 'count'"
    }
  ]
}
```

## Specific Use Cases

### Beginner Programming
- Function definition and calling
- Basic variable usage and scoping
- Simple control structures (if/else, for loops)
- Input/output operations
- Basic data type usage

### Intermediate Programming
- List comprehensions and generator expressions
- Error handling with try/except
- File I/O operations
- Basic algorithm implementation
- Function parameter patterns (args, kwargs)

### Advanced Programming
- Object-oriented design patterns
- Decorator usage and implementation
- Context managers
- Algorithm optimization
- Code organization and modularity

## Integration Points

### Author Interface
- Visual AST feedback configuration
- Real-time analysis preview
- Feedback message templates
- Analysis weight/priority settings

### Student Interface
- Progressive feedback disclosure
- Hint system based on AST analysis
- Code quality metrics
- Suggested improvements

### Assessment System
- Automated grading based on AST criteria
- Partial credit for meeting some requirements
- Progress tracking across multiple attempts
- Comparative analysis between submissions

## Technical Considerations

### JavaScript AST Parser Options

After research, here are the **actual viable options** for JavaScript-based Python AST parsing:

#### 1. **pyparser** (npm package)
- **Status**: Active but early development (v0.0.8, published 1 year ago)
- **Features**: Python AST parsing and tokenization for Node.js with TypeScript support
- **Python Version**: Supports Python 3 syntax
- **Output**: JSON-compatible AST structure similar to Python's ast module
- **Pros**: Purpose-built for our use case, TypeScript support, direct npm installation
- **Cons**: Very new project (might have limited features), small community
- **Usage**: `npm install pyparser`, then `import {parse} from 'pyparser'`

#### 2. **RustPython WASM**
- **Status**: Mature and actively developed
- **Features**: Full Python 3 implementation compiled to WebAssembly
- **Python Version**: Python 3.11+ compatible
- **Output**: Can access Python's built-in `ast` module functionality
- **Pros**: Complete Python AST support, mature codebase, actively maintained
- **Cons**: Larger bundle size, more complex integration, overkill for just AST parsing
- **Usage**: Import RustPython WASM and use Python's `ast.parse()` function

#### 3. **ANTLR4 + Python Grammar**
- **Status**: Mature parsing framework with official Python grammars
- **Features**: Multiple Python grammar versions available (2.7, 3.x, 3.13)
- **Python Version**: All versions supported with separate grammars
- **Output**: ANTLR parse tree (needs custom AST conversion)
- **Pros**: Highly accurate, multiple Python versions, mature framework
- **Cons**: Requires ANTLR4 runtime, more setup complexity, larger footprint
- **Usage**: Generate JavaScript parser from Python3.g4 grammar file

#### 4. **Skulpt (Limited Option)**
- **Status**: Mainly Python 2 focused, some Python 3 work in progress
- **Features**: JavaScript implementation of Python
- **Python Version**: Primarily Python 2.7, partial Python 3 support
- **Output**: Custom AST format
- **Pros**: Established project, full Python implementation
- **Cons**: Primarily Python 2, large bundle size, not ideal for educational Python 3 code
- **Usage**: Import Skulpt and use its AST parsing capabilities

#### **Recommended Approach**: 

**Option 1 (pyparser)** appears most suitable for our needs:
- Lightweight and focused on AST parsing
- Python 3 support
- npm package ready for browser use
- TypeScript support for better development experience
- JSON output format easy to work with

**Fallback Option 2 (RustPython WASM)** if pyparser limitations become apparent:
- Complete Python 3 AST compatibility
- Can leverage Python's native `ast` module
- More robust but heavier implementation

### Performance
- AST parsing overhead in JavaScript environment
- Browser memory constraints for large code analysis
- Real-time analysis during code editing
- Caching parsed AST results between analysis runs

### Integration with MicroPython Environment
- Ensure AST analysis works with MicroPython code subset
- Handle MicroPython-specific syntax limitations
- Coordinate with existing MicroPython execution pipeline
- Share analysis results with feedback and testing systems

### Accuracy
- False positive/negative detection
- Edge case handling in AST parsing
- Student code with syntax errors
- Incomplete or partial submissions

### Extensibility
- Plugin architecture for custom analyzers
- Browser-compatible analyzer modules
- Integration with existing Clipy configuration system
- Support for MicroPython and standard Python differences

## Implementation Phases

### Phase 1: JavaScript AST Foundation
- Research and select JavaScript Python AST parser
- Basic AST parsing infrastructure in browser
- Core analyzer framework and plugin system
- Function and variable detection analyzers
- Integration with existing Clipy feedback system

### Phase 2: Control Flow Analysis
- Loop and conditional structure analyzers
- Nesting depth calculation
- Flow control pattern detection
- Integration with authoring interface for configuration

### Phase 3: Advanced Code Analysis
- Object-oriented pattern recognition
- Code quality and style analyzers
- Error-prone pattern detection
- Performance and complexity assessment

### Phase 4: Educational Integration
- Real-time feedback during code editing
- Progressive hint disclosure system
- Integration with existing test framework
- Analytics and progress tracking

## Benefits for Education

### For Students
- Immediate, specific feedback on code quality
- Guidance toward better programming practices
- Understanding of algorithm efficiency
- Progressive skill development tracking

### For Educators
- Automated assessment of programming concepts
- Detailed analytics on student progress
- Identification of common misconceptions
- Reduced manual code review overhead

### For Curriculum Design
- Objective measurement of learning outcomes
- Data-driven curriculum improvement
- Identification of difficult concepts
- Adaptive learning path generation

## Next Steps

1. **Evaluate pyparser npm package**
   - Install and test `pyparser` with typical student Python 3 code
   - Verify AST output format compatibility with our analysis needs
   - Test parsing accuracy for educational Python constructs
   - Benchmark performance for typical student code sizes (50-500 lines)

2. **Prototype Basic AST Analysis Framework**
   - Create modular analyzer plugin system using discovered AST format
   - Implement core analyzers: function detection, variable usage, basic control flow
   - Design analyzer interface for different analysis types
   - Build configuration system for authoring interface

3. **Test RustPython WASM Alternative**
   - Evaluate RustPython WASM bundle size and integration complexity
   - Test Python `ast` module access from JavaScript
   - Compare parsing accuracy and performance with pyparser
   - Determine if the extra features justify the complexity

4. **Implement Core Analysis Features**
   - Function definition and call detection
   - Variable usage and scope analysis  
   - Basic control flow analysis (loops, conditionals)
   - Simple feedback generation and display

5. **Browser Integration Testing**
   - Ensure chosen parser works in browser environment
   - Test performance with various student code patterns
   - Validate compatibility with existing MicroPython execution pipeline
   - Implement caching for parsed AST results

6. **Clipy Integration Development**
   - Add AST analysis configuration to authoring interface
   - Create real-time analysis preview for authors
   - Implement student-facing feedback display
   - Connect with existing test framework and feedback systems

This JavaScript-based AST system will enhance Clipy's educational value by providing intelligent, automated feedback that runs entirely in the browser, seamlessly integrating with the existing MicroPython environment and user interface.
