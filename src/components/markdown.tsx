import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Barnhaus-styled markdown for standards docs (server component, no client JS)

const H = 'font-bold text-white mt-6 mb-2'
const P = 'text-sm text-slate-300 leading-relaxed my-2'
const LI = 'text-sm text-slate-300 leading-relaxed my-1 ml-4 list-disc'
const CODE = 'text-xs font-mono text-gold-light bg-bh-black border border-bh-border rounded px-1.5 py-0.5'

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className={`${H} text-lg border-b border-bh-border pb-2`}>{children}</h1>,
          h2: ({ children }) => <h2 className={`${H} text-base text-gold-light`}>{children}</h2>,
          h3: ({ children }) => <h3 className={H}>{children}</h3>,
          h4: ({ children }) => <h4 className={`${H} text-sm`}>{children}</h4>,
          p: ({ children }) => <p className={P}>{children}</p>,
          li: ({ children }) => <li className={LI}>{children}</li>,
          ul: ({ children }) => <ul className="my-2">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal">{children}</ol>,
          strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
          em: ({ children }) => <em className="text-slate-400">{children}</em>,
          a: ({ children, href }) => <a href={href} className="text-gold-light underline">{children}</a>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-gold pl-3 my-2 text-slate-400">{children}</blockquote>,
          code: ({ children }) => <code className={CODE}>{children}</code>,
          pre: ({ children }) => <pre className="bg-bh-black border border-bh-border rounded-lg p-3 my-2 overflow-x-auto text-xs">{children}</pre>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-bh-border bg-bh-panel px-2 py-1.5 text-left text-slate-200 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-bh-border px-2 py-1.5 text-slate-300">{children}</td>,
          hr: () => <hr className="border-bh-border my-4" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
