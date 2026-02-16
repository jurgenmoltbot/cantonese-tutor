#!/usr/bin/env python3
"""
Jyutping conversion script using pycantonese
Converts Chinese characters to Jyutping romanization
"""
import sys

try:
    import pycantonese
    
    def text_to_jyutping(text):
        """Convert Chinese text to Jyutping"""
        try:
            # Use characters_to_jyutping on the whole string
            jyutping_list = pycantonese.characters_to_jyutping(text)
            
            if not jyutping_list:
                return text
            
            result = []
            for item in jyutping_list:
                if isinstance(item, tuple) and len(item) >= 2:
                    char, jyutping = item[0], item[1]
                    # Use jyutping if available, otherwise keep the character
                    if jyutping and jyutping.strip():
                        result.append(jyutping)
                    else:
                        # Non-Chinese characters (punctuation, etc.)
                        result.append(char)
                elif isinstance(item, str):
                    result.append(item)
                else:
                    result.append(str(item))
            
            return ' '.join(result)
        except Exception as e:
            print(f"Conversion error: {e}", file=sys.stderr)
            return text
    
    if __name__ == '__main__':
        if len(sys.argv) < 2:
            print("Usage: jyutping.py <chinese_text>", file=sys.stderr)
            sys.exit(1)
        
        input_text = sys.argv[1]
        jyutping_output = text_to_jyutping(input_text)
        print(jyutping_output)

except ImportError:
    # Fallback if pycantonese is not installed
    print("pycantonese not installed. Install with: pip3 install pycantonese", file=sys.stderr)
    if len(sys.argv) >= 2:
        print(sys.argv[1])  # Return original text as fallback
