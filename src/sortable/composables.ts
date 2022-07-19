import { InjectionKey, Ref, ref } from 'vue'

export const NestingLevel: InjectionKey<number> = Symbol('NestingLevel')

export const ParentUuid: InjectionKey<string> = Symbol('ParentUuid')
export const ParentUuidList: InjectionKey<string[]> = Symbol('ParentUuidList')
export const RemoveItem: InjectionKey<(index: number) => void> = Symbol('RemoveItem')
export const GetDirection: InjectionKey<() => 'horizontal' | 'vertical'> = Symbol('GetDirection')

export const ChildrenRegister: InjectionKey<(uuid: string, nesting: number) => void> = Symbol('ChildrenRegister')
export const ChildrenUnregister: InjectionKey<(uuid: string) => void> = Symbol('ChildrenUnregister')

export const SetChildrenDroppableUuid: InjectionKey<(uuid: string) => void> = Symbol('SetChildrenDroppableUuid')

let callsQueue: {nesting: number, callback: Function}[] = []
export function queueCall (nesting: number, callback: Function) {
  callsQueue.push({ nesting, callback })
}
export function runCalls () {
  callsQueue
    .sort((a, b) => a.nesting - b.nesting)
    .reverse()
    .forEach((e) => {
      e.callback()
    })

  callsQueue = []
}

// GLOBAL ITEM
export const hoveredUuid = ref<string | null>(null)

const registerDropHandles: Record<string, (point: { x: number, y: number, i: number }, item: any) => void> = {}
export function registerDropHandle(uuid: string, fn: (point: { x: number, y: number, i: number }, item: any) => void) {
  registerDropHandles[uuid] = fn
}
export function unregisterDropHandle(uuid: string) {
  delete registerDropHandles[uuid]
}
export function getDropHandle(uuid: string): ((point: { x: number, y: number, i: number }, item: any) => void) | undefined {
  return registerDropHandles[uuid]
}

// FNS
// { x: number, y: number, i: number }
type Rect = { x: number, y: number, width: number, height: number }
export const dragItemsFns: Record<string, Record<string, () => { index: number, rect: Rect, direction: 'vertical' | 'horizontal', type: undefined | string | symbol } | undefined>> = {}
export function registerDragItem(parentUuid: string, uuid: string, fn: () => { index: number, rect: Rect, direction: 'vertical' | 'horizontal', type: undefined | string | symbol } | undefined) {
  dragItemsFns[parentUuid] = dragItemsFns[parentUuid] || {}
  dragItemsFns[parentUuid][uuid] = fn
}
export function unregisterDragItem(parentUuid: string, uuid: string) {
  delete dragItemsFns[parentUuid][uuid]
}

// Results
export const itemsResultsParents = ref<Record<string, { x1: number, y1: number, x2: number, y2: number, i: number, parentUuid: string }[][]>>({})

export function findClosestLine(lines: Record<string, { x1: number, y1: number, x2: number, y2: number, i: number, parentUuid: string }[][]>, point: Point, options: {
  exceptUuids: string[],
  onlyUuids: string[],
}) {
  let closestLine = null
  let lastClosestDistance = null

  for (let uuid of options.onlyUuids) {
    if (options.exceptUuids.includes(uuid)) {
      continue
    }

    if (! lines[uuid]) {
      continue
    }

    let currentLines = lines[uuid]
    for (const sortedLines of currentLines) {
      let currentClosestLine = localMin(
        sortedLines,
        (line: { x1: number, y1: number, x2: number, y2: number, i: number, parentUuid: string }) => distToSegmentSquared(point, { x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 })
      )
      if (! currentClosestLine) {
        continue
      }
      let distance = distToSegmentSquared(point, { x: currentClosestLine.x1, y: currentClosestLine.y1 }, { x: currentClosestLine.x2, y: currentClosestLine.y2 })
      if (lastClosestDistance === null || distance < lastClosestDistance) {
        closestLine = currentClosestLine
        lastClosestDistance = distance
      }
    }
  }

  return closestLine
}

// value of a local minima. undefined  when empty array
function localMin<T>(arr: T[], comparator: (v: T) => number = (v) => v as unknown as number): T | undefined {
  if (! arr.length) {
    return undefined
  }

  if (arr.length === 1) {
    return arr[0]
  }

  // Find index of middle element
  const mid = Math.floor(arr.length / 2);

  let left = mid - 1
  while (arr[left] && comparator(arr[left]) === comparator(arr[mid])) {
    left--
  }

  if (! arr[left] || comparator(arr[left]) < comparator(arr[mid])) {
    let targetArray = arr.slice(0, left + 1)
    if (! targetArray.length) {
      return arr[left + 1]
    }
    return localMin(arr.slice(0, left + 1), comparator)
  }

  let right = mid + 1
  if (! arr[right]) {
    return arr[mid]
  }

  while (arr[right] && comparator(arr[right]) === comparator(arr[mid])) {
    right++
  }

  if (! arr[right] || comparator(arr[right]) > comparator(arr[mid])) {
    return arr[mid]
  }

  let targetArray = arr.slice(right - 1, arr.length)
  if (! targetArray.length) {
    return arr[right]
  }
  return localMin(targetArray, comparator)
}

// DISTANCE TO LINE SEGMENT!
type Point = { x: number, y: number }
function sqr(x: number) { return Math.pow(x, 2) }
function dist2(v: Point, w: Point) { return sqr(v.x - w.x) + sqr(v.y - w.y) }
export function distToSegmentSquared(p: Point, v: Point, w: Point) {
  // return 2
  var lineWidth = dist2(v, w);
  if (lineWidth == 0) return dist2(p, v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / lineWidth;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, { x: v.x + t * (w.x - v.x),
    y: v.y + t * (w.y - v.y) });
}
function distToSegment(p: Point, v: Point, w: Point) { return Math.sqrt(distToSegmentSquared(p, v, w)); }


const uuidChildrenRegistrar: Record<string, Ref<Record<string, number>>> = {}
export function registerUuidWithChildren(uuid: string, childrenUuids: Ref<Record<string, number>>) {
  uuidChildrenRegistrar[uuid] = childrenUuids
}
export function unregisterUuidWithChildren(uuid: string) {
  delete uuidChildrenRegistrar[uuid]
}
export function getChildrenByUuid(uuid: string): Record<string, number> {
  if (uuidChildrenRegistrar[uuid]) {
    return uuidChildrenRegistrar[uuid].value
  }
  return {}
}
