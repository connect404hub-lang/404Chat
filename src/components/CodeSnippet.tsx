"use client";

import React, { useState } from "react";
import { Check, Copy, Code } from "lucide-react";

interface CodeSnippetProps {
  code: string;
  language: string;
}

export default function CodeSnippet({ code, language }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  // Unified RegExp-based Syntax Highlighter utilizing single-pass tokenization
  const highlightCode = (txt: string, lang: string): string => {
    // Escape HTML characters
    let html = txt
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const cleanLang = lang.toLowerCase();

    // Map languages to their respective tokenizers
    let regex: RegExp;

    switch (cleanLang) {
      case "js":
        regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(&quot;[^\n&quot;]*&quot;|'[^'\n]*'|`[^`]*`)|(\b(?:const|let|var|function|return|import|export|default|class|extends|if|else|for|while|try|catch|new|typeof|async|await|null|undefined|true|false|from|switch|case|break|default|throw|finally)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/g;
        break;
      case "ts":
        regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(&quot;[^\n&quot;]*&quot;|'[^'\n]*'|`[^`]*`)|(\b(?:const|let|var|function|return|import|export|default|class|extends|if|else|for|while|try|catch|new|typeof|async|await|null|undefined|true|false|from|switch|case|break|default|throw|finally|interface|type|readonly|private|public|protected|as|any|keyof|number|string|boolean|void|implements|namespace|declare|module)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/g;
        break;
      case "py":
      case "python":
        regex = /(#[^\n]*)|(&quot;&quot;&quot;[\s\S]*?&quot;&quot;&quot;|'''[\s\S]*?'''|&quot;[^\n&quot;]*&quot;|'[^'\n]*')|(\b(?:def|class|return|import|from|as|if|elif|else|for|while|in|is|not|and|or|try|except|finally|pass|lambda|None|True|False|with|yield|global|assert|break|continue|del)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/g;
        break;
      case "c":
        regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(&quot;[^\n&quot;]*&quot;|'[^'\n]*')|(\b(?:int|float|double|char|void|return|if|else|for|while|const|static|struct|union|typedef|sizeof|include|define|switch|case|break|continue|extern|volatile)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/g;
        break;
      case "cpp":
        regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(&quot;[^\n&quot;]*&quot;|'[^'\n]*')|(\b(?:int|float|double|char|bool|void|class|struct|public|private|protected|return|if|else|for|while|new|delete|const|static|virtual|namespace|using|include|template|typename|std|cout|cin|endl|switch|case|break|default|sizeof|typedef|unsigned|signed)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/g;
        break;
      case "java":
        regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(&quot;[^\n&quot;]*&quot;|'[^'\n]*')|(\b(?:public|private|protected|class|interface|extends|implements|return|import|package|if|else|for|while|try|catch|finally|new|null|true|false|this|super|void|int|double|float|char|boolean|long|short|byte|static|final|abstract|synchronized|volatile|transient|throws|throw|instanceof)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/g;
        break;
      case "react":
      case "nextjs":
      case "jsx":
      case "tsx":
        regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(&quot;[^\n&quot;]*&quot;|'[^'\n]*'|`[^`]*`)|(\b(?:const|let|var|function|return|import|export|default|class|extends|if|else|for|while|try|catch|new|typeof|async|await|null|undefined|true|false|from|switch|case|break|default|throw|finally|interface|type|readonly|private|public|protected|as|any|keyof|number|string|boolean|void|useState|useEffect|useContext|useRef|useMemo|useCallback|useRouter|usePathname|useSearchParams|React|Link|Image|getServerSideProps|getStaticProps)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())|(&lt;\/?[a-zA-Z_][\w-]*|(?:\b[a-zA-Z_][\w-]*)\s*=)/g;
        break;
      case "node":
        regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(&quot;[^\n&quot;]*&quot;|'[^'\n]*'|`[^`]*`)|(\b(?:const|let|var|function|return|import|export|default|class|extends|if|else|for|while|try|catch|new|typeof|async|await|null|undefined|true|false|from|switch|case|break|default|throw|finally|require|module|exports|process|global|__dirname|__filename|Buffer)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/g;
        break;
      case "go":
        regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(&quot;[^\n&quot;]*&quot;|'[^'\n]*'|`[^`]*`)|(\b(?:package|import|func|var|const|type|struct|interface|return|if|else|for|range|switch|case|default|select|chan|map|go|defer|panic|recover|nil|true|false|make|new|len|cap|append|int|string|bool|float64)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/g;
        break;
      case "rust":
        regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(&quot;[^\n&quot;]*&quot;|'[^'\n]*')|(\b(?:fn|let|mut|const|static|impl|trait|struct|enum|use|mod|pub|return|if|else|match|for|while|loop|in|as|ref|self|Self|crate|super|unsafe|where|type|dyn|async|await|true|false|Option|Result|Some|None|Ok|Err|String|str|u8|u32|i32|usize)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/g;
        break;
      case "html":
        regex = /(&lt;!--[\s\S]*?--&gt;)|(&quot;[^\n&quot;]*&quot;|'[^'\n]*')|(\b(?:div|span|p|a|h1|h2|h3|h4|h5|h6|button|input|textarea|form|label|img|svg|path|head|body|html|meta|link|script|style|class|id|href|src|onClick|className|alt|placeholder|type|value|width|height|target|rel|name)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/g;
        break;
      case "css":
        regex = /(\/\*[\s\S]*?\*\/)|(&quot;[^\n&quot;]*&quot;|'[^'\n]*')|(\b(?:body|html|root|color|background|margin|padding|display|flex|grid|border|font|width|height|position|align|justify|hover|active|focus|media|import|keyframes|transform|transition|animation|opacity|overflow|z-index|box-shadow|text-align|text-transform|text-decoration|cursor)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/g;
        break;
      case "sql":
        regex = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('[^'\n]*'|&quot;[^\n&quot;]*&quot;)|(\b(?:SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|CREATE|TABLE|JOIN|LEFT|RIGHT|INNER|ON|AND|OR|NOT|NULL|ORDER|BY|LIMIT|GROUP|HAVING|COUNT|AS|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|DATABASE|DROP|ALTER|ADD|COLUMN)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/gi;
        break;
      case "bash":
      case "shell":
        regex = /(#[^\n]*)|(&quot;[^\n&quot;]*&quot;|'[^'\n]*')|(\b(?:if|then|else|elif|fi|for|in|do|done|while|until|case|esac|function|echo|exit|sudo|apt|cd|ls|mkdir|rm|cp|mv|clear|git|npm|npx|node|yarn|cat|grep|awk|sed|chmod|chown|ssh)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/g;
        break;
      case "json":
        regex = /(?!x)x|(&quot;[^\n&quot;]*&quot;)|(\b(?:true|false|null)\b)|(\b\d+\b)|((?!x)x)/g;
        break;
      default:
        // Default tokenizer using JavaScript rules as a baseline fallback
        regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(&quot;[^\n&quot;]*&quot;|'[^'\n]*'|`[^`]*`)|(\b(?:const|let|var|function|return|import|export|default|class|extends|if|else|for|while|try|catch|new|typeof|async|await|null|undefined|true|false|from|switch|case|break|default|throw|finally)\b)|(\b\d+\b)|(\b[a-zA-Z_]\w*\b(?=\s*\())/g;
        break;
    }

    // Single-pass replacement to avoid comment/string nesting collisions
    html = html.replace(regex, (match, comment, string, keyword, number, func, jsx) => {
      if (comment) return `<span class="hl-comment">${comment}</span>`;
      if (string) return `<span class="hl-string">${string}</span>`;
      if (keyword) return `<span class="hl-keyword">${keyword}</span>`;
      if (number) return `<span class="hl-number">${number}</span>`;
      if (func) return `<span class="hl-function">${func}</span>`;
      if (jsx) {
        if (jsx.startsWith("&lt;")) {
          // Highlight opening tag and tag name
          return `<span class="hl-keyword">&lt;</span><span class="hl-function">${jsx.substring(4)}</span>`;
        }
        if (jsx.endsWith("=")) {
          // Highlight JSX attribute name
          return `<span class="hl-keyword">${jsx.substring(0, jsx.length - 1)}</span>=`;
        }
        return jsx;
      }
      return match;
    });

    // Special JSON formatting post-processor to highlight keys distinctly from values
    if (cleanLang === "json") {
      html = html.replace(
        /<span class="hl-string">(&quot;[^&quot;\n]+&quot;)<\/span>\s*:/g,
        `<span class="hl-keyword">$1</span>:`
      );
    }

    return html;
  };

  const getLanguageLabel = (lang: string): string => {
    const labels: Record<string, string> = {
      js: "JavaScript",
      ts: "TypeScript",
      py: "Python",
      cpp: "C++",
      c: "C",
      java: "Java",
      react: "React / JSX",
      nextjs: "Next.js / TSX",
      jsx: "React / JSX",
      tsx: "Next.js / TSX",
      node: "Node.js",
      rust: "Rust",
      go: "Go",
      sql: "SQL",
      html: "HTML",
      css: "CSS",
      json: "JSON",
      bash: "Bash / Shell",
      shell: "Bash / Shell",
    };
    return labels[lang.toLowerCase()] || lang.toUpperCase() || "CODE";
  };

  // Generate lines
  const lines = code.split("\n");

  return (
    <div className="hl-container border border-slate-800 rounded-lg overflow-hidden bg-[#0d0e12] font-mono text-sm shadow-lg max-w-full my-2">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#151820] border-b border-slate-800 select-none">
        <div className="flex items-center gap-2 text-slate-400">
          <Code size={16} className="text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider">{getLanguageLabel(language)}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-cyan-400 bg-[#1e222b] hover:bg-[#252a36] border border-slate-800 rounded transition-all duration-200 cursor-pointer active:scale-95"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check size={13} className="text-green-400 animate-pulse" />
              <span className="text-green-400 font-semibold">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code contents with line numbers */}
      <div className="flex overflow-x-auto p-4 leading-relaxed max-h-[380px] scrollbar-thin">
        {/* Line Numbers */}
        <div className="flex flex-col text-right text-slate-600 select-none pr-4 border-r border-slate-800/60 sticky left-0 bg-[#0d0e12]">
          {lines.map((_, i) => (
            <span key={i} className="text-xs min-w-[20px]">
              {i + 1}
            </span>
          ))}
        </div>

        {/* Highlighted Code */}
        <pre className="pl-4 flex-1 text-slate-300 overflow-visible text-xs text-left" style={{ whiteSpace: "pre", wordBreak: "normal" }}>
          <code
            dangerouslySetInnerHTML={{
              __html: highlightCode(code, language),
            }}
          />
        </pre>
      </div>
    </div>
  );
}
