#!/usr/bin/env python3
"""
Test script to verify auto-formatting hooks are working
"""

# Intentionally bad formatting to test black
def badly_formatted_function( param1,param2 ):
    x=1+2
    y=   "hello world"
    return x,y

# Imports in wrong order to test isort
import sys
import os
import json
import asyncio

def main():
    print("This file should be auto-formatted by hooks!")
    result=badly_formatted_function(1,2)
    print(f"Result: {result}")

if __name__=="__main__":
    main()