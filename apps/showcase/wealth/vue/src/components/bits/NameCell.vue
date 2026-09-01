<!-- A status dot beside a name, without the dot pushing the baseline around. -->
<template>
  <span class="with-dot">
    <slot name="dot" />
    <span><slot /></span>
  </span>
</template>
