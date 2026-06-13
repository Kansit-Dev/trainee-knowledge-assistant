"use client"

import { useRef, useState } from "react"
import { FileText, FileType2, Loader2, Paperclip, Trash2, Check } from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const ACCEPTED = [".pdf", ".txt"]
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentsPanel() {
  const { documents, activeConversation, attachDocument, removeDocument, toggleDocumentOnConversation } =
    useStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    const lower = file.name.toLowerCase()
    // Client-side validation. The backend MUST re-validate type + size.
    if (!ACCEPTED.some((ext) => lower.endsWith(ext))) {
      toast.error("Unsupported file type", { description: "Only PDF and TXT are allowed." })
      return
    }
    if (file.size > MAX_BYTES) {
      toast.error("File too large", { description: "Maximum size is 10 MB." })
      return
    }
    setUploading(true)
    try {
      await attachDocument(file)
      toast.success("Document ready", { description: `${file.name} was processed.` })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const attachedIds = activeConversation?.documentIds ?? []

  return (
    <div className="border-t border-border px-2 py-3">
      <div className="flex items-center justify-between px-2 pb-2">
        <p className="text-xs font-medium text-muted-foreground">Documents</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Paperclip className="size-3.5" aria-hidden="true" />
          )}
          Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <ul className="flex max-h-44 flex-col gap-0.5 overflow-y-auto">
        {documents.map((doc) => {
          const attached = attachedIds.includes(doc.id)
          return (
            <li
              key={doc.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-sidebar-accent/60"
            >
              <button
                type="button"
                onClick={() => toggleDocumentOnConversation(doc.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                aria-pressed={attached}
                title={attached ? "Remove from context" : "Add to context"}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md",
                    attached ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {attached ? (
                    <Check className="size-3.5" />
                  ) : doc.type === "pdf" ? (
                    <FileText className="size-3.5" />
                  ) : (
                    <FileType2 className="size-3.5" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs">{doc.name}</span>
                  <span className="block text-[10px] text-muted-foreground">
                    {doc.status === "processing" ? (
                      "Processing…"
                    ) : (
                      <>
                        {formatSize(doc.sizeBytes)} · {doc.chunkCount} chunks
                      </>
                    )}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => removeDocument(doc.id)}
                aria-label={`Delete ${doc.name}`}
                className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          )
        })}
        {documents.length === 0 && (
          <li className="px-2 py-3 text-center text-[11px] text-muted-foreground">
            No documents. Upload a PDF or TXT.
          </li>
        )}
      </ul>
    </div>
  )
}
