import { onBeforeUnmount, onMounted, provide, Ref, ref } from 'vue'
import {
  getChildrenByUuid,
  GetDirection,
  ParentUuid, registerDragItem,
  RemoveItem, SetChildrenDroppableUuid,
  unregisterDragItem
} from './composables'
import { injectStrict } from '../composables/injectStrict'
import { DragOptions, useDrag } from '../Droppable/useDrag'
import { unrefElement } from '../utils'
import { v4 } from 'uuid'

export function useDragItem (el: Ref<HTMLElement | null>, options: {
  type?: string | symbol,
  itemGetter: () => { item: unknown, index: number },
  handle?: Ref<HTMLElement | null>,
  end?: (item: unknown, options: DragOptions)=> void,
}) {
  const parentUuid = injectStrict(ParentUuid)
  const handleRemoveItem = injectStrict(RemoveItem)
  const getDirection = injectStrict(GetDirection)

  const childrenDroppableUuid = ref<string | null>(null)
  provide(SetChildrenDroppableUuid, (uuid: string) => childrenDroppableUuid.value = uuid)

  function getItemRect () {
    const rect = unrefElement(el)?.getBoundingClientRect()
    if (! rect) {
      return
    }
    return { rect, index: options.itemGetter().index, direction: getDirection(), type: options.type }
  }

  const uuid = ref(v4())
  onMounted(() => {
    registerDragItem(parentUuid, options.itemGetter().index.toString(), getItemRect)
  })
  onBeforeUnmount(() => {
    unregisterDragItem(parentUuid, options.itemGetter().index.toString())
  })

  useDrag(el, {
    threshold: 16,
    handle: options.handle,
    type: options.type,
    item: () => Object.assign({
      uuid: parentUuid,
      children: childrenDroppableUuid.value ? [childrenDroppableUuid.value, ...Object.keys(getChildrenByUuid(childrenDroppableUuid.value))] : [],
      remove: handleRemoveItem,
    }, options.itemGetter()),
    end: options.end,
  })

  return [ parentUuid, uuid ]
}
