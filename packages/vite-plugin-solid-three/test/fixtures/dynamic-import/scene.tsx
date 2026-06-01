export function load(n: string) {
  return import(`./scenes/${n}.tsx`)
}
