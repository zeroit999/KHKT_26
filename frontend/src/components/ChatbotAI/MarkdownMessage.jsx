import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function CodeBlock({ children, isDark }) {
  const [copied, setCopied] = useState(false)
  const codeElement = Array.isArray(children) ? children[0] : children
  const className = String(codeElement?.props?.className || '')
  const language = className.replace(/^language-/, '') || 'code'
  const code = String(codeElement?.props?.children || '').replace(/\n$/, '')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className={`my-3 overflow-hidden rounded-xl border ${isDark ? 'border-violet-400/20 bg-slate-950' : 'border-slate-200 bg-slate-950'}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span>{language}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Sao chép đoạn mã"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Đã chép' : 'Sao chép'}
        </button>
      </div>
      <pre className="max-w-full overflow-x-auto p-3 text-xs leading-5 text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export default function MarkdownMessage({ content, isDark }) {
  const mutedText = isDark ? 'text-violet-100/75' : 'text-slate-600'
  const borderColor = isDark ? 'border-violet-400/25' : 'border-cyan-200'

  return (
    <div className="min-w-0 text-sm leading-6 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2.5 whitespace-normal">{children}</p>,
          h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-black leading-7">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-black leading-6">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1.5 mt-3 text-sm font-black leading-6">{children}</h3>,
          strong: ({ children }) => <strong className="font-black text-current">{children}</strong>,
          em: ({ children }) => <em className="font-medium italic">{children}</em>,
          ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1 marker:text-cyan-500">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1 marker:font-black marker:text-cyan-500">{children}</ol>,
          li: ({ children }) => <li className="pl-1 leading-6">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className={`my-3 border-l-4 pl-3 italic ${borderColor} ${mutedText}`}>{children}</blockquote>
          ),
          hr: () => <hr className={`my-4 border-0 border-t ${borderColor}`} />,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className={`font-bold underline decoration-2 underline-offset-2 ${isDark ? 'text-cyan-300 hover:text-cyan-200' : 'text-cyan-700 hover:text-cyan-600'}`}
            >
              {children}
            </a>
          ),
          code: ({ children, className }) => (
            <code className={`${className || ''} rounded-md px-1.5 py-0.5 font-mono text-[0.86em] ${isDark ? 'bg-violet-500/20 text-cyan-200' : 'bg-cyan-100 text-cyan-800'}`}>
              {children}
            </code>
          ),
          pre: ({ children }) => <CodeBlock isDark={isDark}>{children}</CodeBlock>,
          table: ({ children }) => (
            <div className={`my-3 max-w-full overflow-x-auto rounded-xl border ${borderColor}`}>
              <table className="w-full min-w-[420px] border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className={isDark ? 'bg-violet-500/15' : 'bg-cyan-50'}>{children}</thead>,
          th: ({ children }) => <th className={`border-b px-3 py-2 font-black ${borderColor}`}>{children}</th>,
          td: ({ children }) => <td className={`border-b px-3 py-2 align-top last:border-b-0 ${borderColor}`}>{children}</td>,
        }}
      >
        {String(content || '')}
      </ReactMarkdown>
    </div>
  )
}
