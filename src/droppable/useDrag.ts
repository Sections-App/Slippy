import { onBeforeUnmount, onMounted, Ref } from 'vue'
import { context } from './composables'
import { unrefElement } from './../utils'

export type DragOptions = {
  offset: { x: number, y: number },
  isOver: (options: { shallow: boolean })=> boolean,
}

export function useDrag<T>(el: Ref<HTMLElement | null>, options: {
  item: () => T,
  type?: string | symbol,
  handle?: Ref<HTMLElement | null>,
  threshold?: number,
  begin?: (item: T, options: DragOptions)=> void,
  end?: (item: T, options: DragOptions)=> void,
}) {
  const getHandle = () => unrefElement(options.handle || el)
  const THRESHOLD = options.threshold || 0

  onMounted(() => {
    getHandle()?.addEventListener('mousedown', handleMouseDown as EventListener, false)
  })

  onBeforeUnmount(() => {
    getHandle()?.removeEventListener('mousedown', handleMouseDown as EventListener)
  })

  function handleMouseDown (e: MouseEvent) {
    e.stopPropagation()

    let mousedownPoint: { x: number, y: number } | null = { x: e.x, y: e.y }
    let mousedownOffset: { x: number, y: number } | null = { x: e.offsetX, y: e.offsetY }

    requestAnimationFrame(() => document.body.style.userSelect = 'none')
    // I commented out e.preventDefault 'cause it prevented other features to work as expected (like fields loosing focus when you click on sortable block).
    // e.preventDefault()

    let clonedEl: HTMLElement | null = null
    function handleMouseMove (moveE: MouseEvent) {
      const distance = Math.sqrt(Math.pow(mousedownPoint!.x - moveE.x, 2) + Math.pow(mousedownPoint!.y - moveE.y, 2))

      if (distance >= THRESHOLD) {
        if (! context.isDragging) {
          const target = unrefElement(el) as HTMLElement

          handleDragStart(e)

          clonedEl = target.cloneNode(true) as HTMLElement

          clonedEl.style.width = `${target.getBoundingClientRect().width}px`
          clonedEl.style.height = `${target.getBoundingClientRect().height}px`
          clonedEl.style.position = 'fixed'
          clonedEl.style.pointerEvents = 'none'
          clonedEl.style.top = '0px'
          clonedEl.style.opacity = '0.45'
          clonedEl.style.left = '0px'
          clonedEl.style.willChange = 'transform'
          clonedEl.style.zIndex = '9999'
          clonedEl.style.transform = `translateX(${moveE.x - mousedownOffset!.x}px) translateY(${moveE.y - mousedownOffset!.y}px) translateZ(0)`
          document.body.appendChild(clonedEl)
        }
      }

      if (clonedEl) {
        clonedEl.style.transform = `translateX(${moveE.x - mousedownOffset!.x}px) translateY(${moveE.y - mousedownOffset!.y}px) translateZ(0)`
      }
    }

    function handleMouseUp (e: MouseEvent) {
      requestAnimationFrame(() => document.body.style.userSelect = '')

      mousedownPoint = null
      mousedownOffset = null

      handleDragEnd(e)

      if (clonedEl) {
        clonedEl.remove()
      }

      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mousemove', handleMouseMove)
    }

    document.addEventListener('mouseup', handleMouseUp, false)
    document.addEventListener('mousemove', handleMouseMove, false)
  }

  function handleDragStart (e: MouseEvent) {
    context.isDragging = true
    context.item = options.item()
    context.type = options.type || undefined

    // @ts-ignore
    options.begin?.(context.item as T, {})
  }

  function handleDragEnd (e: MouseEvent) {
    const item = context.item

    context.isDragging = false
    context.item = null
    context.type = undefined

    // @ts-ignore
    options.end?.(item as T, {})
  }
}
