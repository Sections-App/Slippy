import { computed, inject, onBeforeUnmount, onMounted, provide, ref, Ref, watch } from 'vue'
import {
  dragItemsFns, findClosestLine, GetDirection, getDropHandle, hoveredUuid,
  itemsResultsParents,
  queueCall, registerDropHandle,
  RemoveItem,
  runCalls, SetChildrenDroppableUuid, unregisterDropHandle,
} from './composables'
import { useDrop } from '../Droppable/useDrop'
import { unrefElement } from '../utils'
import { useComponentsTree } from '../composables/useComponentsTree'

const SortableDropArea = Symbol('SortableDropArea')

export type DropRect = { x: number, y: number, width: number, height: number }

export function useDropArea (el: Ref<HTMLElement | null>, options: {
  accept?: string | symbol | Array<string | symbol>,
  onAdd?: <T>(item: T, index: number) => void,
  onMove?: (oldIndex: number, newIndex: number) => void,
  onRemove?: (index: number) => void,
  getDirection?: () => 'vertical' | 'horizontal',
}) {
  const getDirection = options.getDirection || (() => 'horizontal')
  provide(GetDirection, getDirection)

  let elementRect = ref<DOMRect | null>(null)
  let elementStyle = ref<CSSStyleDeclaration | null>(null)

  const { uuid, nestedLevel, parentUuid, parentsUuids, childrenUuids, componentsTree } = useComponentsTree(SortableDropArea, () => ({
    accept: options.accept,
    dropHandler: handleDrop,
  }))

  let setChildrenDroppableUuid = inject(SetChildrenDroppableUuid, (_: string) => {})
  setChildrenDroppableUuid(uuid.value)

  function handleDrop(point: { x: number, y: number, i: number }, droppedItem: { item: unknown, index: number, uuid: string, remove: (i: number)=> void }) {
    const { item, index, uuid: elUuid, remove } = droppedItem
    const newIndex = point.i

    if (elUuid !== uuid.value) {
      remove(index)
    }

    closestLine.value = null

    if (elUuid !== uuid.value) {
      queueCall(nestedLevel, () => options.onAdd?.(item, newIndex))
    } else {
      queueCall(nestedLevel, () => options.onMove?.(index, index < newIndex ? newIndex - 1 : newIndex))
    }

    runCalls()
  }

  onMounted(() => {
    registerDropHandle(uuid.value, handleDrop)
  })
  onBeforeUnmount(() => {
    unregisterDropHandle(uuid.value)
  })

  const { type, isOver, isOverSelf } = useDrop(el, {
    accept: options.accept,
    canDrop () {
      // Here we return true as items type is checked on this logic layer.
      return true
    },
    drop (droppedItem, opts) {
      itemsResultsParents.value = {}

      if (opts.hasHandledDrop() || ! closestLine.value || ! hoveredUuid.value) {
        return
      }

      // @ts-ignore
      getDropHandle(hoveredUuid.value)?.(closestLine.value, droppedItem)

      return true
    },
    hover ({ getItemType, offset, isOver, getItem }) {
      if (! offset || ! isOver({ shallow: true })) {
        return
      }

      // @ts-ignore
      const isDraggingSelf = getItem().children.includes(uuid.value)

      if (canAccept(componentsTree.value[uuid.value]?.accept, getItemType()) && ! isDraggingSelf && (! dragItemsFns[uuid.value] || ! Object.keys(dragItemsFns[uuid.value]).length) && (elementRect.value && elementStyle.value)) {
        // probably element is empty
        let elRect = elementRect.value as DOMRect
        let elStyle = elementStyle.value as CSSStyleDeclaration
        hoveredUuid.value = uuid.value
        closestLine.value = {
          x1: elRect.x + parseInt(elStyle.paddingLeft),
          y1: elRect.y + parseInt(elStyle.paddingTop),
          x2: elRect.x + elRect.width - parseInt(elStyle.paddingLeft),
          y2: elRect.y + parseInt(elStyle.paddingTop),
          i: 0,
          empty: true
        }
      }
      else {
        const uuidsListReversed = [...parentsUuids].reverse()
        let pUuid = parentUuid
        for (let pUuidI of uuidsListReversed) {
          // @ts-ignore
          if (! getItem().children.includes(pUuidI)) {
            pUuid = pUuidI
            break
          }
        }
        let cp = findClosestLine(
          itemsResultsParents.value,
          offset,
          {
            // @ts-ignore
            exceptUuids: getItem().children,
            onlyUuids: [uuid.value, pUuid, ...Object.entries(childrenUuids.value).filter(([, l]) => l === nestedLevel + 1).map(([k]) => k)].filter(uuid => uuid !== null) as string[],
          }
        )

        if (cp) {
          hoveredUuid.value = cp.parentUuid
          closestLine.value = cp
        }
      }
    },
    collect: (options) => ({
      isOver: options.isOver(),
      isOverSelf: options.isOver({ shallow: true }),
      type: options.getItemType(),
      item: options.getItem(),
    })
  })

  watch(isOverSelf, (v) => {
    if (v) {
      elementRect.value = unrefElement(el)?.getBoundingClientRect() || null
      elementStyle.value = getComputedStyle(unrefElement(el) as HTMLElement)

      for (let parentUuid in dragItemsFns) {
        if (itemsResultsParents.value[parentUuid]) {
          continue
        }

        type SnappingLine = { x1: number, y1: number, x2: number, y2: number, i: number, parentUuid: string }

        let results = Object.values(dragItemsFns[parentUuid]).reduce<SnappingLine[][]>((acc, fn) => {
          let rectIndex = fn()
          if (! rectIndex) {
            return acc
          }

          let { rect, index, direction } = rectIndex
          if (! canAccept(componentsTree.value[parentUuid]?.accept, type.value)) {
            return acc
          }

          let targetAcc: SnappingLine[] = []
          if (acc.length) {
            targetAcc = acc[acc.length - 1]
          } else {
            acc.push(targetAcc)
          }

          let prevLine = targetAcc.length ? targetAcc[targetAcc.length - 1] : null

          const firstLine: SnappingLine = Object.assign(
            { i: index, parentUuid },
            direction === 'vertical'
              ? { x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y }
              : { x1: rect.x, y1: rect.y, x2: rect.x, y2: rect.y + rect.height }
          )

          let nextLine: SnappingLine = Object.assign(
            { i: index + 1, parentUuid },
            direction === 'vertical'
              ? { x1: rect.x, y1: rect.y + rect.height, x2: rect.x + rect.width, y2: rect.y + rect.height }
              : { x1: rect.x + rect.width, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height }
          )

          if (! prevLine) {
            targetAcc.push(firstLine)
          } else {
            if ((direction === 'vertical' && prevLine.y1 <= firstLine.y1) || (direction === 'horizontal' && prevLine.x1 <= firstLine.x1)) {
              targetAcc[targetAcc.length - 1] = Object.assign(
                { i: index, parentUuid },
                direction === 'vertical'
                  ? { x1: prevLine.x1, y1: (prevLine.y1 + firstLine.y1) / 2, x2: prevLine.x2, y2: (prevLine.y1 + firstLine.y1) / 2 }
                  : { x1: (prevLine.x1 + firstLine.x1) / 2, y1: prevLine.y1, x2: (prevLine.x2 + firstLine.x2) / 2, y2: prevLine.y2 }
              )
            } else {
              targetAcc = []
              acc.push(targetAcc)
              targetAcc.push(firstLine)
            }
          }

          targetAcc.push(nextLine)

          return acc
        }, [])

        itemsResultsParents.value[parentUuid] = results
      }
    }

    if (! v && closestLine.value) {
      closestLine.value = null
    }
  })

  watch(isOver, (value) => {
    if (! value) {
      requestAnimationFrame(() => closestLine.value = null)
    }
    if (! value && nestedLevel === 0) {
      hoveredUuid.value = null
    }
  })

  let closestLine = ref<{ x1: number, y1: number, x2: number, y2: number, i: number, empty?: boolean } | null>(null)

  let dropRect = computed(() => {
    if (! closestLine.value) {
      return null
    }

    const direction = closestLine.value.x1 === closestLine.value.x2 ? 'horizontal' : 'vertical'

    return {
      x: direction === 'horizontal' ? closestLine.value.x1 - 1 : closestLine.value.x1,
      y: direction === 'horizontal' ? closestLine.value.y1 : closestLine.value.y1 - 1,
      width: direction === 'horizontal' ? 2 : closestLine.value.x2 - closestLine.value.x1,
      height: direction === 'horizontal' ? closestLine.value.y2 - closestLine.value.y1 : 2,
    }
  })

  provide(RemoveItem, (i: number) => {
    queueCall(nestedLevel, () => options.onRemove?.(i))
  })

  return {
    childrenUuids,
    dropRect, isOverSelf, uuid, hoveredUuid: computed(() => hoveredUuid.value === uuid.value)
  }
}

function canAccept (accept: undefined | string | symbol | Array<string | symbol>, type: undefined | string | symbol) {
  if (! accept) {
    return type === undefined
  }
  if (! type) {
    return false
  }
  if (Array.isArray(accept)) {
    return accept.includes(type)
  }
  return accept === type
}
