/**
 * Preserve native DSD host classes during framework hydration.
 * Call the returned function after framework mount; protection ends per host
 * once its component adopts the server render. Safe to call outside a browser.
 * A supplied element includes itself; removing a partial root releases its observers.
 */
export declare function preserveSsrClasses(root?: ParentNode): () => void;
