<script setup lang="ts">
import { computed } from "vue";
import { useT } from "~/composables/useShowcase";
import { usePathname, useRouter, isPlainActivation } from "~/lib/router";
import { crumbsFor, withBase } from "~/lib/routes";
const props = defineProps<{
  title: string;
  subtitle?: string;
  crumbLabel?: string;
}>();
const t = useT(),
  pathname = usePathname(),
  router = useRouter();
const crumbs = computed(() =>
  crumbsFor(pathname.value, props.crumbLabel ?? null),
);
const navigate = (
  event: CustomEvent<{ href: string; originalEvent?: MouseEvent }>,
) => {
  const { href, originalEvent } = event.detail ?? {};
  if (!href || !isPlainActivation(originalEvent)) return;
  event.preventDefault();
  router.push(href.replace(withBase(""), "") || "/");
};
</script>
<template>
  <div class="shell__trail">
    <md-breadcrumbs
      v-if="crumbs.length"
      :label="t('design.nav.breadcrumb')"
      max-items="4"
      items-before-collapse="1"
      items-after-collapse="2"
      v-awc="{ on: { mdSelect: navigate } }"
      ><md-breadcrumb-item
        v-for="(crumb, index) in crumbs"
        :key="index"
        :href="
          crumb.href && index < crumbs.length - 1
            ? withBase(crumb.href)
            : undefined
        "
        >{{
          crumb.labelKey ? t(crumb.labelKey) : crumb.label
        }}</md-breadcrumb-item
      ></md-breadcrumbs
    >
  </div>
  <div class="screen-head">
    <div class="screen-head__text">
      <h1>{{ title }}</h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.aside" class="screen-head__aside">
      <slot name="aside" />
    </div>
  </div>
  <div v-if="$slots.actions" class="screen-toolbar">
    <md-toolbar
      variant="floating"
      color="vibrant"
      :aria-label="t('design.nav.toolbar')"
      ><slot name="actions"
    /></md-toolbar>
  </div>
  <div class="screen-stage">
    <div class="screen-body"><slot /></div>
  </div>
</template>
