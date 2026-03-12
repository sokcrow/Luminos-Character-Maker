from html.parser import HTMLParser
import sys

class StrictHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack = []
        self.void_elements = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def handle_starttag(self, tag, attrs):
        if tag not in self.void_elements:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.void_elements:
            return
        if not self.stack:
            print(f"Error: Encountered closing tag </{tag}> but no tags are open.")
            return
        if self.stack[-1] != tag:
            # Try to recover by looking up the stack
            if tag in self.stack:
                idx = len(self.stack) - 1 - self.stack[::-1].index(tag)
                print(f"Error: Missing closing tags for {self.stack[idx+1:]} before </{tag}>.")
                self.stack = self.stack[:idx]
            else:
                print(f"Error: Encountered unexpected closing tag </{tag}>. Expected </{self.stack[-1]}>.")
        else:
            self.stack.pop()

    def close(self):
        super().close()
        if self.stack:
            print(f"Error: Unclosed tags at EOF: {self.stack}")

with open('hoja_personaje.html', 'r', encoding='utf-8') as f:
    parser = StrictHTMLParser()
    parser.feed(f.read())
    parser.close()
    print("Check complete.")
