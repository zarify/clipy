# Zero-Knowledge Offline Verification for Student Solutions

## Overview
This document describes a method for teachers to verify that a student has solved a coding problem and passed all tests, **without any server communication** and in a way that is simple, human-readable, and tamper-resistant. The system is inspired by zero-knowledge proof concepts and the "three words" encoding system.

## Goals
- **No server required:** All verification is local and deterministic.
- **Simple for students:** Students receive a short code after passing all tests.
- **Simple for teachers:** Teachers can verify the code using the same app and test suite.
- **Tamper-resistant:** The code is tied to the test suite, student identity, and optionally a timestamp.
- **Human-readable:** Preferably a short word-based code, but base32/base58 is also acceptable.

## System Design

### 1. Inputs for Verification
- **Test Suite Hash:** A hash (e.g., SHA-256) of the test definitions to ensure the code is tied to the correct problem.
- **Student Code:** A unique code provided by the teacher (e.g., "blue-tiger-17") and stored in the app.
- **Timestamp (Optional):** For freshness, a rounded date or time window can be included.
- **(Optional) Solution Code:** If desired, the student's solution code can be included in the hash to tie the proof to their code.

### 2. Proof Code Generation
- When all tests pass, the app generates a hash from the above inputs:

  ```js
  // Pseudocode
  const input = testSuiteHash + studentCode + timestamp;
  const proofHash = sha256(input);
  ```

- The hash is then encoded into a human-readable format:
  - **Three-word system:** Use a wordlist to encode the hash into 3-4 words (e.g., "apple-robot-42").
  - **Alternative:** Use a short base32/base58 string (e.g., "4FQ9-2KJ8-7XPL").

### 3. Verification Flow
- **Student:**
  - Runs all tests locally.
  - Enters their student code.
  - Receives a "proof code" (e.g., "apple-robot-42").
  - Sends this code to the teacher.
- **Teacher:**
  - Inputs the student code and test suite into the app.
  - App generates the expected code for that student and test suite.
  - If it matches the student's code, verification is complete.

### 4. Security & Integrity
- **Zero-knowledge:** The code does not reveal the solution, only that the student passed the tests with the correct test suite and code.
- **Tamper-resistance:** Changing the test suite, student code, or timestamp will change the proof code.
- **No server required:** All verification is local and deterministic.

## Example
- **Student code:** "blue-tiger-17"
- **Test suite hash:** "a1b2c3d4"
- **Timestamp:** "2025-09-04"
- **Proof code:** "apple-robot-42" (generated from hash)

## Implementation Notes
- Use a secure hash function (SHA-256 or similar).
- Use a wordlist for encoding (RFC1751, BIP39, or custom).
- Optionally, allow teachers to set time windows for code validity.
- Consider exposing a simple UI for both students and teachers to generate/verify codes.

## Summary
This system allows teachers to verify student solutions **offline** and **without revealing the solution**, using a simple, human-friendly code. It is robust, easy to implement, and fits the requirements for privacy and simplicity.

---

*For future implementation: see this document for design details and rationale.*
