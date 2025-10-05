/**
 * Test script to verify the f_locals caching bug demonstration
 * Runs the test-return-event-bug.py file through our MicroPython runtime
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load MicroPython
const micropythonPath = path.join(__dirname, 'micropython-asyncify', 'micropython.mjs');
const { loadMicroPython } = await import(micropythonPath);

console.log('Loading MicroPython runtime...');
const mp = await loadMicroPython();

console.log('MicroPython loaded successfully\n');

// Read the test file
const testFilePath = path.join(__dirname, 'project', 'test-return-bug-simple.py');
const testCode = fs.readFileSync(testFilePath, 'utf-8');

console.log('Running test-return-event-bug.py...');
console.log('='.repeat(60));

// Capture stdout
let output = '';
const originalStdout = mp.stdout;
mp.stdout = (text) => {
    output += text;
    if (originalStdout) originalStdout(text);
};

try {
    // Run the test code
    await mp.runPythonAsync(testCode);
    console.log('='.repeat(60));

    if (output) {
        console.log('\nPython output:');
        console.log(output);
    } else {
        console.log('\nNo output captured - checking if test ran correctly...');

        // Try running a simpler test
        const result = await mp.runPythonAsync('print("Testing print...")');
        console.log('Simple print test:', result);
    }
} catch (error) {
    console.error('Error running test:', error);
    process.exit(1);
}
