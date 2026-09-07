import { watch, onMounted, onBeforeUnmount } from "vue";

/** Watch explicit dependencies without treating a fresh snapshot as a change to every field. */
export function watchLifecycle(
  effect: () => void | (() => void),
  dependencies?: () => readonly unknown[],
): void {
  let cleanup: void | (() => void);
  if (!dependencies) {
    onMounted(() => {
      cleanup = effect();
    });
    onBeforeUnmount(() => cleanup?.());
    return;
  }
  let previous: readonly unknown[] | undefined;
  const stop = watch(
    dependencies,
    (values) => {
      if (
        previous &&
        previous.length === values.length &&
        values.every((value, index) => Object.is(value, previous![index]))
      )
        return;
      cleanup?.();
      previous = [...values];
      cleanup = effect();
    },
    { immediate: true, flush: "post" },
  );
  onBeforeUnmount(() => {
    stop();
    cleanup?.();
  });
}
