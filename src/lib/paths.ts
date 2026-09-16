/** True when `path` is exactly `prefix`, or nested under it — either as an
 * object field ("customer.city" under "customer") or as an array's own item
 * shape ("cart[].sku" under "cart"). Used to cascade schema/mapping cleanup
 * to a field's descendants when the field itself is removed. */
export function pathIsOrUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);
}
