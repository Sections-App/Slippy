export function arrayMove<T>(arr: T[], oldIndex: number, newIndex: number): T[] {
  let newValue = [...arr]

  if (newIndex >= newValue.length) {
    var k = newIndex - newValue.length + 1;
    while (k--) {
      // @ts-ignore
      newValue.push(undefined);
    }
  }
  newValue.splice(newIndex, 0, newValue.splice(oldIndex, 1)[0]);
  return newValue
}

export function insert (arr: unknown[], index: number, newItem: unknown) {
  let newValue = [...arr]

  return [
    // part of the array before the specified index
    ...newValue.slice(0, index),
    // inserted item
    newItem,
    // part of the array after the specified index
    ...newValue.slice(index)
  ]
}

export function arrayRemove (arr: any[], index: number) {
  let newValue = [...arr]
  newValue.splice(index, 1)
  return newValue
}
