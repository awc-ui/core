<template>
  <main class="page">
    <h1 class="page-headline">Course catalog</h1>
    <p class="page-sub">
      Systems-first courses in design and creative development. Every course ships
      real checkpoints, not just videos.
    </p>

    <div class="catalog-toolbar">
      <md-search
        ref="searchEl"
        layout="docked"
        variant="contained"
        placeholder="Search courses"
        input-aria-label="Search courses"
        debounce="150"
        results-label="{count} courses found"
        no-results-label="No courses match"
        @mdSearch="onSearch"
        @mdClear="onSearch({ detail: { value: '' } })"
      >
        <div slot="results">
          <div
            v-for="course in searchResults"
            :key="course.slug"
            class="search-result"
            data-search-result
            tabindex="0"
            role="link"
            @click="goToCourse(course.slug)"
            @keydown.enter="goToCourse(course.slug)"
          >
            <span class="search-result__title">{{ course.title }}</span>
            <span class="search-result__meta">{{ course.level }} · {{ course.hours }}h</span>
          </div>
          <p v-if="query && searchResults.length === 0" class="search-empty">
            No courses match “{{ query }}”. Try a topic like “color” or “motion”.
          </p>
        </div>
      </md-search>

      <div class="topic-filter" role="group" aria-label="Filter by topic">
        <span class="topic-filter__label">Topics</span>
        <md-chip
          v-for="topic in allTopics"
          :key="topic"
          variant="filter"
          :label="topic"
          :selected="selectedTopics.includes(topic)"
          @mdSelect="toggleTopic(topic, $event)"
        ></md-chip>
      </div>
    </div>

    <div class="course-grid">
      <md-card
        v-for="course in visibleCourses"
        :key="course.slug"
        variant="outlined"
        full-width
        full-height
        class="course-card"
      >
        <span class="course-card__level">{{ course.level }} · {{ course.hours }} hours</span>
        <h2 class="course-card__title">{{ course.title }}</h2>
        <p class="course-card__tagline">{{ course.tagline }}</p>
        <div class="course-card__meta">
          <md-rating
            :value="course.rating"
            precision="0.5"
            size="xs"
            readonly
            show-value-label
            :rating-label="`Average rating for ${course.title}`"
          ></md-rating>
          <span>({{ course.ratingCount.toLocaleString('en-US') }} ratings)</span>
        </div>
        <div class="course-card__chips">
          <md-chip
            v-for="topic in course.topics"
            :key="topic"
            variant="assist"
            appearance="outlined"
            :label="topic"
          ></md-chip>
        </div>
        <div class="course-card__foot">
          <span class="course-card__price">${{ course.price }}</span>
          <md-button
            variant="tonal"
            size="sm"
            trailing-icon="arrow_forward"
            mirror-icon
            :href="appHref(`/courses/${course.slug}`)"
          >View course</md-button>
        </div>
      </md-card>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { allTopics, courses } from '~/data/courses';

useHead({ title: 'Catalog — Tessellate Academy' });

const query = ref('');
const selectedTopics = ref<string[]>([]);

function onSearch(e: { detail: { value: string } }) {
  query.value = e.detail.value;
}

const searchResults = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return courses.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.tagline.toLowerCase().includes(q) ||
      c.topics.some((t) => t.toLowerCase().includes(q)) ||
      c.instructor.toLowerCase().includes(q),
  );
});

const visibleCourses = computed(() => {
  if (selectedTopics.value.length === 0) return courses;
  return courses.filter((c) => c.topics.some((t) => selectedTopics.value.includes(t)));
});

function toggleTopic(topic: string, e: { detail: { selected: boolean } }) {
  if (e.detail.selected) {
    if (!selectedTopics.value.includes(topic)) selectedTopics.value = [...selectedTopics.value, topic];
  } else {
    selectedTopics.value = selectedTopics.value.filter((t) => t !== topic);
  }
}

const searchEl = ref<any>(null);

async function goToCourse(slug: string) {
  await searchEl.value?.close?.();
  navigateTo(`/courses/${slug}`);
}
</script>
