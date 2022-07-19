import { onBeforeUnmount, onMounted, provide, reactive, ref, Ref, toRefs, watch } from 'vue'
import { ActuallyUsedParentUuid, context } from './composables'
import { v4 } from 'uuid'
import { injectStrict } from './../composables/injectStrict'
import { unrefElement } from './../utils'

export type DropOptions = {
  getItem: ()=> unknown,
  getItemType: ()=> undefined | string | symbol,
  payload: Record<string, any>,
  offset: { x: number, y: number } | null,
  isOver: (options?: { shallow?: boolean })=> boolean,
  canDrop: ()=> boolean,
  hasHandledDrop: ()=> boolean,
}

export function useDrop<T extends object>(el: Ref<HTMLElement | null>, options: {
  accept?: string | symbol | Array<string | symbol>,
  canDrop?: (options: DropOptions)=> boolean,
  drop?: (item: unknown, options: DropOptions)=> void,
  hover?: (options: DropOptions)=> void,
  collect?: (options: DropOptions)=> T,
} = {}): {[K in keyof T]: Ref<T[K]>} {
  const collect = options.collect || (() => undefined)

  onMounted(() => {
    unrefElement(el)?.addEventListener('mousemove', handleHover as EventListener)
    unrefElement(el)?.addEventListener('mouseleave', handleLeave as EventListener)
    unrefElement(el)?.addEventListener('mouseup', handleUp as EventListener)
  })

  onBeforeUnmount(() => {
    unrefElement(el)?.removeEventListener('mousemove', handleHover as EventListener)
    unrefElement(el)?.removeEventListener('mouseleave', handleLeave as EventListener)
    unrefElement(el)?.removeEventListener('mouseup', handleUp as EventListener)
  })

  let offset = ref<{ x: number, y: number } | null>(null)
  let isOver = ref(false)

  let uuid = v4()
  let parentUuid = injectStrict(ActuallyUsedParentUuid, [])
  const uuidPath = [...parentUuid, uuid]
  provide(ActuallyUsedParentUuid, uuidPath)

  const makeOptions = (payload: Record<string, any> = {}): DropOptions => ({
    getItem: () => context.item,
    getItemType: () => context.type,
    canDrop: () => {
      if (options.canDrop) {
        return options.canDrop(makeOptions())
      }
      return ! options.accept || (options.accept && context.type && Array.isArray(options.accept) ? options.accept.includes(context.type) : options.accept === context.type)
    },
    payload,
    offset: offset.value,
    isOver (options: { shallow?: boolean } = { shallow: false }) {
      if (! context.isDragging) {
        return false
      }

      if (! options.shallow) {
        return isOver.value
      }

      let currentUuidPosition = uuidPath.indexOf(uuid)
      let draggingUuidPosition = uuidPath.indexOf(context.draggingOverUuid as string)

      return draggingUuidPosition !== -1 && currentUuidPosition <= draggingUuidPosition
    },

    hasHandledDrop () {
      return context.dropHandled
    },
  })

  function handleHover (e: MouseEvent) {
    if (! context.isDragging) {
      return false
    }

    context.dropHandled = false

    isOver.value = true

    if (context.dragEvent !== e) {
      context.draggingOverUuid = uuid
    }

    offset.value = { x: e.x, y: e.y }

    // @ts-ignore
    e.payload = e.payload || {}

    // @ts-ignore
    options.hover?.(makeOptions(e.payload as Record<string, any>))

    context.dragEvent = e
  }

  function handleLeave (e: MouseEvent) {
    offset.value = null
    isOver.value = false

    context.dragEvent = null
    context.draggingOverUuid = null
  }

  function handleUp (e: MouseEvent) {
    handleLeave(e)

    const dropOpts = makeOptions()

    let handledDrop = false
    if (context.isDragging && dropOpts.canDrop()) {
      handledDrop = !! options.drop?.(context.item, dropOpts)
    }

    if (handledDrop) {
      context.dropHandled = true
    }
  }

  let results = collect(makeOptions())
  if (! results) {
    // @ts-ignore
    return undefined
  }

  let reactiveResults = reactive(results)
  watch(
    () => collect(makeOptions()),
    (value) => {
      for (let key in value) {
        // @ts-ignore
        reactiveResults[key] = value[key]
      }
    }
  )
  // @ts-ignore
  return toRefs(reactiveResults)
}
