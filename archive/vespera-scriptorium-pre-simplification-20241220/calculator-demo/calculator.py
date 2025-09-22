#!/usr/bin/env python3
"""
Calculator Engine - Core mathematical operations and expression parsing.

Handles basic arithmetic operations with error handling and expression evaluation.
"""

import re
import operator
from typing import Union, List, Tuple


class CalculatorError(Exception):
    """Custom exception for calculator-specific errors."""
    pass


class Calculator:
    """Core calculation engine with expression parsing capabilities."""
    
    def __init__(self):
        """Initialize calculator with supported operations."""
        self.operators = {
            '+': operator.add,
            '-': operator.sub,
            '*': operator.mul,
            '/': operator.truediv,
            '%': operator.mod,
            '**': operator.pow,
            '^': operator.pow,  # Alternative power syntax
        }
        
        # Operator precedence (higher number = higher precedence)
        self.precedence = {
            '+': 1, '-': 1,
            '*': 2, '/': 2, '%': 2,
            '**': 3, '^': 3
        }
    
    def add(self, a: float, b: float) -> float:
        """Add two numbers."""
        return a + b
    
    def subtract(self, a: float, b: float) -> float:
        """Subtract b from a."""
        return a - b
    
    def multiply(self, a: float, b: float) -> float:
        """Multiply two numbers."""
        return a * b
    
    def divide(self, a: float, b: float) -> float:
        """Divide a by b with zero-division checking."""
        if b == 0:
            raise CalculatorError("Division by zero is not allowed")
        return a / b
    
    def modulo(self, a: float, b: float) -> float:
        """Calculate a modulo b."""
        if b == 0:
            raise CalculatorError("Modulo by zero is not allowed")
        return a % b
    
    def power(self, a: float, b: float) -> float:
        """Raise a to the power of b."""
        try:
            return a ** b
        except OverflowError:
            raise CalculatorError("Result too large to calculate")
    
    def tokenize(self, expression: str) -> List[str]:
        """
        Tokenize mathematical expression into numbers, operators, and parentheses.
        
        Args:
            expression: String expression to tokenize
            
        Returns:
            List of tokens (numbers, operators, parentheses)
            
        Raises:
            CalculatorError: If expression contains invalid characters
        """
        # Remove whitespace
        expression = expression.replace(' ', '')
        
        # Regular expression for numbers (including decimals and negative numbers)
        token_pattern = r'(\d+\.?\d*|\+|\-|\*\*|\*|/|%|\^|\(|\))'
        tokens = re.findall(token_pattern, expression)
        
        if not tokens:
            raise CalculatorError("Empty or invalid expression")
        
        # Join the tokens and compare with original to check for invalid characters
        rejoined = ''.join(tokens)
        if rejoined != expression:
            raise CalculatorError(f"Invalid characters in expression: {expression}")
        
        return tokens
    
    def infix_to_postfix(self, tokens: List[str]) -> List[str]:
        """
        Convert infix notation to postfix (Reverse Polish Notation) using Shunting Yard algorithm.
        
        Args:
            tokens: List of tokens in infix notation
            
        Returns:
            List of tokens in postfix notation
            
        Raises:
            CalculatorError: If expression has mismatched parentheses or invalid syntax
        """
        output = []
        operator_stack = []
        
        for token in tokens:
            if self._is_number(token):
                output.append(token)
            elif token in self.operators:
                # Pop operators with higher or equal precedence
                while (operator_stack and 
                       operator_stack[-1] != '(' and
                       operator_stack[-1] in self.operators and
                       self.precedence.get(operator_stack[-1], 0) >= self.precedence.get(token, 0)):
                    output.append(operator_stack.pop())
                operator_stack.append(token)
            elif token == '(':
                operator_stack.append(token)
            elif token == ')':
                # Pop until opening parenthesis
                while operator_stack and operator_stack[-1] != '(':
                    output.append(operator_stack.pop())
                if not operator_stack:
                    raise CalculatorError("Mismatched parentheses: missing opening parenthesis")
                operator_stack.pop()  # Remove the opening parenthesis
        
        # Pop remaining operators
        while operator_stack:
            if operator_stack[-1] in '()':
                raise CalculatorError("Mismatched parentheses: missing closing parenthesis")
            output.append(operator_stack.pop())
        
        return output
    
    def evaluate_postfix(self, postfix_tokens: List[str]) -> float:
        """
        Evaluate postfix expression and return result.
        
        Args:
            postfix_tokens: List of tokens in postfix notation
            
        Returns:
            Numerical result of the expression
            
        Raises:
            CalculatorError: If expression is invalid or contains errors
        """
        stack = []
        
        for token in postfix_tokens:
            if self._is_number(token):
                stack.append(float(token))
            elif token in self.operators:
                if len(stack) < 2:
                    raise CalculatorError("Invalid expression: insufficient operands")
                
                b = stack.pop()
                a = stack.pop()
                
                try:
                    result = self.operators[token](a, b)
                    stack.append(result)
                except ZeroDivisionError:
                    raise CalculatorError(f"Division by zero in operation: {a} {token} {b}")
                except OverflowError:
                    raise CalculatorError("Result too large to calculate")
                except Exception as e:
                    raise CalculatorError(f"Error in operation {a} {token} {b}: {str(e)}")
            else:
                raise CalculatorError(f"Unknown token: {token}")
        
        if len(stack) != 1:
            raise CalculatorError("Invalid expression: malformed syntax")
        
        return stack[0]
    
    def calculate(self, expression: str) -> float:
        """
        Main calculation method - parses and evaluates a mathematical expression.
        
        Args:
            expression: Mathematical expression as string
            
        Returns:
            Numerical result
            
        Raises:
            CalculatorError: If expression is invalid or calculation fails
        """
        if not expression or not expression.strip():
            raise CalculatorError("Empty expression")
        
        try:
            # Tokenize the expression
            tokens = self.tokenize(expression.strip())
            
            # Convert to postfix notation
            postfix = self.infix_to_postfix(tokens)
            
            # Evaluate postfix expression
            result = self.evaluate_postfix(postfix)
            
            return result
            
        except CalculatorError:
            # Re-raise calculator-specific errors
            raise
        except Exception as e:
            # Wrap unexpected errors
            raise CalculatorError(f"Unexpected error: {str(e)}")
    
    def _is_number(self, token: str) -> bool:
        """Check if token is a valid number."""
        try:
            float(token)
            return True
        except ValueError:
            return False


if __name__ == "__main__":
    # Basic testing
    calc = Calculator()
    
    test_expressions = [
        "2 + 3",
        "10 - 4 * 2",
        "(5 + 3) * 2",
        "15 / 3",
        "2 ** 3",
        "10 % 3"
    ]
    
    print("Calculator Engine Test:")
    print("=" * 30)
    
    for expr in test_expressions:
        try:
            result = calc.calculate(expr)
            print(f"{expr:15} = {result}")
        except CalculatorError as e:
            print(f"{expr:15} = ERROR: {e}")