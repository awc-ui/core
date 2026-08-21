<template>
  <div>
    <header class="site-header">
      <div class="site-header__inner">
        <NuxtLink to="/" class="site-brand">
          <span class="site-brand__mark" aria-hidden="true"></span>
          <span>Tessellate Academy</span>
        </NuxtLink>
        <nav class="site-nav" aria-label="Main navigation">
          <NuxtLink to="/">Catalog</NuxtLink>
          <NuxtLink to="/progress">My progress</NuxtLink>
          <NuxtLink to="/quiz">Quiz</NuxtLink>
        </nav>
      </div>
    </header>

    <NuxtPage />

    <footer class="site-footer">
      <div class="site-footer__inner">
        <span>Tessellate Academy — learn the systems behind good design.</span>
        <span>Fictional demo built with AWC UI web components.</span>
      </div>
    </footer>
  </div>
</template>
