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
            # Parse the text and get Jyutping
            result = []
            for char in text:
                # Get Jyutping for each character
                jyutping_list = pycantonese.characters_to_jyutping(char)
                if jyutping_list:
                    # jyutping_list is a list of tuples (character, jyutping)
                    # Extract just the jyutping part (second element)
                    jyutping = jyutping_list[0][1] if isinstance(jyutping_list[0], tuple) else jyutping_list[0]
                    result.append(jyutping)
                else:
                    result.append(char)  # Keep original if no Jyutping found
            
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
    print(f"pycantonese not installed. Install with: pip3 install pycantonese", file=sys.stderr)
    if len(sys.argv) >= 2:
        print(sys.argv[1])  # Return original text as fallback
