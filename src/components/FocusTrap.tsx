import { useEffect, useRef, type ReactNode } from 'react'

interface FocusTrapProps {
  children: ReactNode
  onClose: () => void
  returnFocusRef?: React.RefObject<HTMLElement | null>
  initialFocusRef?: React.RefObject<HTMLElement | null>
  className?: string
  label: string
}

const selector = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

export function FocusTrap({ children, onClose, returnFocusRef, initialFocusRef, className, label }: FocusTrapProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const requestedReturnTarget = returnFocusRef?.current
    const panel = ref.current
    const first = initialFocusRef?.current ?? panel?.querySelector<HTMLElement>(selector)
    window.requestAnimationFrame(() => first?.focus())

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = [...panel.querySelectorAll<HTMLElement>(selector)].filter((element) => element.getClientRects().length > 0)
      const start = focusable[0]
      const end = focusable.at(-1)
      if (!start || !end) return
      if (event.shiftKey && document.activeElement === start) {
        event.preventDefault()
        end.focus()
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault()
        start.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      const target = requestedReturnTarget ?? previouslyFocused
      window.requestAnimationFrame(() => target?.focus())
    }
  }, [initialFocusRef, onClose, returnFocusRef])

  return <div ref={ref} className={className} role="dialog" aria-modal="true" aria-label={label}>{children}</div>
}
